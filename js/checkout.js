/* Secure checkout: the API/SQL compute prices, reserve inventory and create orders.
   A browser is NEVER allowed to mark a payment as collected or an order confirmed. */
document.addEventListener('DOMContentLoaded', async () => {
  const form=document.getElementById('checkoutForm'), summary=document.getElementById('summaryItems');
  const button=document.getElementById('placeOrderBtn');
  const options=[...document.querySelectorAll('.checkout-payment-option')];
  const shippingOptions=[...document.querySelectorAll('.shipping-option')];
  const notice=document.getElementById('paymentShippingNotice');
  const formError=document.getElementById('checkoutError');
  const format=n=>typeof formatPKR==='function'?formatPKR(n):`Rs ${Number(n).toLocaleString('en-PK')}`;
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shipping=200;
  let method='cod';
  let sending=false;
  const idKey='ls_checkout_request_id';
  if(!sessionStorage.getItem(idKey)) sessionStorage.setItem(idKey,crypto.randomUUID());
  if(!getCart().length) {
    document.querySelector('.checkout-grid').innerHTML=`<div class="checkout-empty"><h2>Your basket is empty</h2><p>Discover our handcrafted sweets to get started.</p><a href="shop.html" class="btn btn-primary">Browse Sweets</a></div>`;
    return;
  }
  function displayError(message) {
    if(!formError){if(message)alert(message);return;}
    formError.textContent=message;formError.style.display=message?'block':'none';
  }
  function renderSummary() {
    const cart=getCart();
    if(!cart.length) {location.href='shop.html';return;}
    summary.innerHTML=cart.map((item,index)=>`<div class="summary-line-item checkout-line">
      <img src="${escape(item.image||'images/barfi.png')}" alt="" />
      <div class="checkout-line-info"><strong>${escape(item.name)}</strong><span>${escape(item.weight)}</span>
      <div class="checkout-quantity"><button type="button" data-index="${index}" data-change="-1" aria-label="Decrease quantity">−</button><span>${Number(item.quantity)}</span><button type="button" data-index="${index}" data-change="1" aria-label="Increase quantity">+</button><button type="button" data-index="${index}" data-remove="true" class="checkout-remove">Remove</button></div></div>
      <strong>${format(Number(item.unitPrice)*Number(item.quantity))}</strong></div>`).join('');
    summary.querySelectorAll('button[data-index]').forEach(b=>b.addEventListener('click',()=>{
      const i=getCart()[Number(b.dataset.index)];if(!i)return;
      if(b.dataset.remove) removeFromCart(i.productId,i.weight);
      else updateQuantity(i.productId,i.weight,Math.min(20,i.quantity+Number(b.dataset.change)));
      sessionStorage.setItem(idKey,crypto.randomUUID());renderSummary();
    }));
    document.getElementById('summarySubtotal').textContent=format(cartSubtotal());
    document.getElementById('summaryShipping').textContent=format(shipping);
    document.getElementById('summaryTotal').textContent=format(cartSubtotal()+shipping);
    button.textContent=`Place Order · ${format(cartSubtotal()+shipping)}`;
  }
  function choose(methodName) {
    if(methodName!=='cod'){displayError('Online payments are awaiting PayFast merchant activation. Please choose Cash on Delivery.');return;}
    method=methodName;form.elements.paymentMethod.value=method;displayError('');
    options.forEach(opt=>{const active=opt.dataset.method===method;opt.classList.toggle('active',active);opt.setAttribute('aria-pressed',String(active));});
    shippingOptions.forEach(opt=>opt.classList.toggle('active',opt.dataset.shippingType===method));
    notice.textContent='Rs 200 delivery charge applies to Cash on Delivery. We will request confirmation on WhatsApp.';
    renderSummary();
  }
  options.forEach(opt=>opt.addEventListener('click',()=>choose(opt.dataset.method)));
  // The "Shipping Method" cards used to have no click handler at all, so Cash on Delivery looked unselectable.
  shippingOptions.forEach(opt=>opt.addEventListener('click',()=>choose(opt.dataset.shippingType==='cod'?'cod':'prepaid')));
  document.querySelectorAll('.billing-option').forEach(opt=>opt.addEventListener('click',()=>{
    const radio=opt.querySelector('input[name="billingAddress"]');if(radio)radio.checked=true;
    document.querySelectorAll('.billing-option').forEach(x=>x.classList.toggle('active',x===opt));
    document.getElementById('differentBillingAddress')?.classList.toggle('show',radio?.value==='different');
  }));
  const fields=['email','firstName','lastName','address','city','phone'];
  function validate() {
    let ok=true;
    fields.forEach(name=>{
      const el=form.elements[name],value=(el.value||'').trim(), messageEl=form.querySelector(`[data-error-for="${name}"]`);
      let message='';if(!value)message='This field is required.';
      else if(name==='email'&&!/^\S+@\S+\.\S+$/.test(value))message='Please enter a valid email address.';
      else if(name==='phone'&&!/^(?:\+?92|0)3\d{9}$/.test(value.replace(/[\s-]/g,'')))message='Use a valid Pakistani mobile number (03XXXXXXXXX).';
      else if(name==='address'&&value.length<6)message='Enter a complete delivery address.';
      if(messageEl)messageEl.textContent=message;
      el.classList.toggle('invalid',Boolean(message));if(message)ok=false;
    });
    if(form.querySelector('[name="billingAddress"]:checked')?.value==='different'){
      ['billingFirstName','billingLastName','billingAddressInput','billingCity'].forEach(name=>{
        const el=form.elements[name];const invalid=!el.value.trim();el.classList.toggle('invalid',invalid);if(invalid)ok=false;
      });
    }
    if(!ok) {displayError('Please correct the highlighted delivery details.');form.querySelector('.invalid')?.focus();}
    return ok;
  }
  fields.forEach(name=>form.elements[name]?.addEventListener('input',()=>{
    form.elements[name].classList.remove('invalid');const error=form.querySelector(`[data-error-for="${name}"]`);if(error)error.textContent='';
  }));
  async function submit(event){
    event.preventDefault();if(sending||!validate())return;
    sending=true;button.disabled=true;button.textContent='Submitting your order…';displayError('');
    const val=name=>(form.elements[name]?.value || '').trim();
    const customer={firstName:val('firstName'),lastName:val('lastName'),fullName:`${val('firstName')} ${val('lastName')}`,email:val('email'),phone:val('phone'),address:val('address'),city:val('city'),country:'Pakistan',postalCode:val('postalCode'),notes:val('notes')};
    const different=form.querySelector('input[name="billingAddress"]:checked')?.value==='different';
    const billingAddress=different?{sameAsShipping:false,firstName:val('billingFirstName'),lastName:val('billingLastName'),address:val('billingAddressInput'),city:val('billingCity'),postalCode:val('billingPostalCode')}:{sameAsShipping:true};
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
    try {
      const result=await fetch('/api/orders',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({items:getCart().map(({productId,weight,quantity})=>({productId,weight,quantity})),customer,billingAddress,paymentMethod:method,expectedTotal:cartSubtotal()+shipping,idempotencyKey:sessionStorage.getItem(idKey)})});
      const data=await result.json().catch(()=>({}));
      if(!result.ok||!data.trackingToken)throw new Error(data.error||'Could not create your order. No order has been confirmed.');
      sessionStorage.removeItem(idKey);
      // Keep only the private access token; never cache sensitive customer data in localStorage.
      sessionStorage.setItem(`ls_track_${data.orderNumber}`,data.trackingToken);
      clearCart();
      const hash=new URLSearchParams({order:data.orderNumber,token:data.trackingToken});
      window.location.assign(`order-success.html#${hash}`);
    } catch(e){
      displayError(e.name==='AbortError'?'The server took too long to respond. Please check your connection and try again.':(e.message||'Connection error. Please retry.'));
      button.disabled=false;sending=false;renderSummary();
    } finally {clearTimeout(timer);}
  }
  form.addEventListener('submit',submit);
  choose('cod');
  try {
    const response=await fetch('/api/payment-options');
    if(!response.ok)throw new Error();
    const status=await response.json();
    for(const opt of options) if(opt.dataset.method!=='cod'&&!status[opt.dataset.method]){
      opt.classList.add('payment-unavailable');opt.disabled=true;opt.setAttribute('aria-disabled','true');
      const text=opt.querySelector('.payment-option-info span');if(text)text.textContent='Coming soon · PayFast activation pending';
    }
  }catch{ // Fail closed: the server only accepts COD; no simulated prepaid orders.
    for(const opt of [...options,...shippingOptions]) if((opt.dataset.method||opt.dataset.shippingType)!=='cod')opt.disabled=true;
  }
});
