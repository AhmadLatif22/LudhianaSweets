/* Receipt uses a verified server order, not untrusted browser localStorage. */
document.addEventListener('DOMContentLoaded',async()=>{
  const params=new URLSearchParams(location.hash.replace(/^#/,''));
  const number=params.get('order'),token=params.get('token')||(number?sessionStorage.getItem(`ls_track_${number}`):null);
  const heading=document.getElementById('successHeading'),subtitle=document.getElementById('successSubtitle');
  const note=document.getElementById('whatsappNote'),box=document.getElementById('orderInfoBox');
  const download=document.getElementById('downloadInvoiceBtn');
  download.disabled=true;heading.textContent='Order received';subtitle.textContent='Checking your order status…';
  const label=st=>st==='out_for_delivery'?'shipped':String(st).replace(/_/g,' ');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if(!number||!token){heading.textContent='Track your order';subtitle.textContent='Use the private order tracking link sent to your email.';box.innerHTML='<a href="track-order.html" class="btn btn-primary">Open Order Tracking</a>';return;}
  const track=document.createElement('a');track.className='btn btn-outline';track.textContent='Track my order';track.href=`track-order.html#${new URLSearchParams({order:number,token})}`;
  download.parentElement?.appendChild(track);
  async function fetchOrder(){const r=await fetch('/api/track-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderNumber:number,token})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Order not found');return data;}
  async function update(){
    try{
      const o=await fetchOrder();
      const waiting=o.status==='pending_whatsapp_confirmation';
      heading.textContent=waiting?'Check WhatsApp to confirm':o.status==='cancelled'?'Order cancelled':'Order '+label(o.status);
      subtitle.textContent=waiting?'Your order is saved, but preparation begins only after you confirm on WhatsApp.':o.status==='cancelled'?'This order has been cancelled.':'You can track the latest fulfilment status below.';
      note.style.display=waiting?'block':'none';note.textContent=waiting?'If you do not receive our message, contact our store and quote your order number. Do not place a duplicate order.':'';
      box.innerHTML=`<div class="row"><span>Order number</span><strong>${esc(o.order_number)}</strong></div><div class="row"><span>Order status</span><strong>${esc(label(o.status))}</strong></div><div class="row"><span>Payment</span><strong>Cash on Delivery · ${esc(o.payment_status)}</strong></div><div class="row"><span>Delivery city</span><span>${esc(o.delivery_city)}</span></div><div class="row"><span>Subtotal</span><span>${formatPKR(o.subtotal)}</span></div><div class="row"><span>Shipping</span><span>${formatPKR(o.shipping)}</span></div><div class="row"><span>Amount due</span><strong>${formatPKR(o.total)}</strong></div>`;
      download.disabled=false;
      download.onclick=()=>{
        if(!window.jspdf?.jsPDF)return;
        const doc=new window.jspdf.jsPDF();doc.setFontSize(18);doc.text('Ludhiana Sweets — Order Receipt',14,18);doc.setFontSize(10);
        doc.text('Ludhiana Sweets, 548D Block Satellite Town, Sargodha  |  +923296365372',14,25);
        doc.text(`Order: ${o.order_number}`,14,35);doc.text(`Status: ${label(o.status)}`,14,42);
        doc.text(`Payment: Cash on Delivery (${o.payment_status})`,14,49);
        let y=56;
        if(o.courier){doc.text(`Courier: ${o.courier}`,14,y);y+=7;}
        if(o.tracking_number){doc.text(`Tracking number: ${o.tracking_number}`,14,y);y+=7;}
        y+=7;for(const item of o.items||[]){doc.text(`${item.name} (${item.weight}) x ${item.quantity} - ${formatPKR(item.unitPrice*item.quantity)}`.slice(0,96),14,y);y+=8;if(y>265){doc.addPage();y=18;}}
        doc.text(`Subtotal: ${formatPKR(o.subtotal)}    Shipping: ${formatPKR(o.shipping)}`,14,y+10);
        doc.text(`Amount due: ${formatPKR(o.total)}`,14,y+18);
        doc.text('Receipt only — not proof of online payment.',14,y+28);
        doc.save(`${o.order_number}-receipt.pdf`);
      };
      return true;
    }catch(e){heading.textContent='Unable to load order';subtitle.textContent=e.message;box.innerHTML='<a href="track-order.html" class="btn btn-primary">Try tracking again</a>';return false;}
  }
  await update();
  // Lightweight polling for pending WhatsApp decisions; no public Realtime customer data.
  let attempts=0;const interval=setInterval(async()=>{if(document.hidden)return;const success=await update();if(!success||++attempts>=12)clearInterval(interval);},10000);
});
