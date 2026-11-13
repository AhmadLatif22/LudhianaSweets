document.addEventListener('DOMContentLoaded',()=>{
  const form=document.getElementById('trackForm'),result=document.getElementById('trackResult');
  const number=document.getElementById('trackNumber'),token=document.getElementById('trackToken');
  const p=new URLSearchParams(location.hash.replace(/^#/,''));number.value=p.get('order')||'';token.value=p.get('token')||'';
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label=st=>st==='out_for_delivery'?'shipped':String(st).replace(/_/g,' ');
  const money=n=>`Rs ${Number(n).toLocaleString('en-PK')}`;
  async function load(e){e?.preventDefault();result.style.display='block';result.textContent='Checking order…';
    try{
      const r=await fetch('/api/track-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderNumber:number.value.trim(),token:token.value.trim()})});
      const o=await r.json();if(!r.ok)throw Error(o.error||'Order not found');
      const statuses=['pending_whatsapp_confirmation','confirmed','processing','out_for_delivery','delivered'];
      result.innerHTML=`<h2>Order ${escape(o.order_number)}</h2><p><strong>${escape(label(o.status))}</strong></p>
       ${o.status==='cancelled'?'<p>This order has been cancelled.</p>':`<ol class="tracking-timeline">${statuses.map((s,i)=>`<li class="${statuses.indexOf(o.status)>=i?'done':''}">${escape(label(s))}</li>`).join('')}</ol>`}
       <div class="tracking-value"><span>Placed on</span><strong>${new Date(o.created_at).toLocaleDateString('en-PK')}</strong></div>
       <div class="tracking-value"><span>Delivery city</span><strong>${escape(o.delivery_city)}</strong></div>
       <div class="tracking-value"><span>Payment</span><strong>COD · ${escape(o.payment_status)}</strong></div>
       <div class="tracking-value"><span>Order total</span><strong>${money(o.total)}</strong></div>
       ${o.courier?`<div class="tracking-value"><span>Courier</span><strong>${escape(o.courier)}</strong></div>`:''}
       ${o.tracking_number?`<div class="tracking-value"><span>Consignment number</span><strong>${escape(o.tracking_number)}</strong></div>`:''}
       ${o.tracking_url&&/^https:\/\//.test(o.tracking_url)?`<p style="margin-top:16px"><a href="${escape(o.tracking_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline">Track with courier</a></p>`:''}
       <h3 style="margin-top:20px;font-size:1.05rem">Items</h3><ul>${o.items.map(i=>`<li>${escape(i.name)} (${escape(i.weight)}) × ${Number(i.quantity)}</li>`).join('')}</ul>`;
      history.replaceState(null,'',`#${new URLSearchParams({order:number.value.trim(),token:token.value.trim()})}`);
    }catch(err){result.textContent=err.message;}
  }
  form.addEventListener('submit',load);if(number.value&&token.value)load();
});
