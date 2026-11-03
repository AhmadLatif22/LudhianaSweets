const ORDER_STATUSES=['pending_whatsapp_confirmation','confirmed','processing','out_for_delivery','delivered','cancelled'];
document.addEventListener('DOMContentLoaded',async()=>{
  const tbody=document.getElementById('ordersTableBody');
  const search=document.getElementById('ordersSearch'),filter=document.getElementById('ordersFilter');
  const dialog=document.getElementById('orderDetailDialog');
  const body=document.getElementById('orderDetailContent');
  const info=document.getElementById('ordersInfo');
  const friendly=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  function render(){
    const q=(search.value||'').toLowerCase().trim();
    const orders=getAllOrders().filter(o=>(!filter.value||filter.value===o.status)&&(!q||`${o.orderNumber} ${o.customer.fullName} ${o.customer.email} ${o.customer.phone}`.toLowerCase().includes(q)));
    info.textContent=`Showing ${orders.length} of ${getAllOrders().length} orders`;
    tbody.innerHTML=orders.length?orders.map(o=>`<tr><td><button class="admin-link" data-details="${escapeAdmin(o.orderNumber)}">${escapeAdmin(o.orderNumber)}</button><div style="font-size:.74rem;color:#836f60">${new Date(o.createdAt).toLocaleDateString('en-PK')}</div></td>
      <td>${escapeAdmin(o.customer.fullName)}<div style="font-size:.77rem;color:#7c6856">${escapeAdmin(o.customer.city)}</div></td>
      <td>${formatPKR(o.total)}</td><td>${escapeAdmin(o.paymentMethod?.toUpperCase())}<div style="font-size:.73rem">${friendly(o.paymentStatus)}</div></td>
      <td><span class="status-pill">${friendly(o.status)}</span></td><td><button class="btn btn-outline" data-details="${escapeAdmin(o.orderNumber)}" style="padding:8px 12px">Manage</button></td></tr>`).join(''):'<tr><td colspan="6" style="text-align:center;padding:38px">No matching orders.</td></tr>';
    tbody.querySelectorAll('[data-details]').forEach(b=>b.addEventListener('click',()=>openDetails(b.dataset.details)));
  }
  function openDetails(number){
    const o=getAllOrders().find(x=>x.orderNumber===number);if(!o)return;
    const list=o.items.map(i=>`<li>${escapeAdmin(i.name)} · ${escapeAdmin(i.weight)} × ${Number(i.quantity)} — ${formatPKR(Number(i.unitPrice)*Number(i.quantity))}</li>`).join('');
    const statuses=ORDER_STATUSES.map(s=>`<option value="${s}" ${s===o.status?'selected':''}>${friendly(s)}</option>`).join('');
    body.innerHTML=`<div class="admin-details-grid">
      <div><b>Order</b>${escapeAdmin(o.orderNumber)}<br/>${new Date(o.createdAt).toLocaleString('en-PK')}</div>
      <div><b>Status & Payment</b>${friendly(o.status)} · ${escapeAdmin(o.paymentMethod.toUpperCase())}<br/>${friendly(o.paymentStatus)}</div>
      <div><b>Customer</b>${escapeAdmin(o.customer.fullName)}<br/>${escapeAdmin(o.customer.phone)}<br/>${escapeAdmin(o.customer.email)}</div>
      <div><b>Delivery address</b>${escapeAdmin(o.customer.address)}<br/>${escapeAdmin(o.customer.city)} ${escapeAdmin(o.customer.postalCode)}</div>
      <div><b>Order notes</b>${escapeAdmin(o.customer.notes||'No notes')}</div>
      <div><b>Total</b>${formatPKR(o.subtotal)} + ${formatPKR(o.shipping)} shipping<br/><strong>${formatPKR(o.total)}</strong></div>
    </div><h3>Items</h3><ul>${list}</ul>
    <h3>Update fulfilment</h3><form id="adminOrderUpdateForm">
      <div class="field"><label for="editOrderStatus">Order status</label><select class="input" id="editOrderStatus">${statuses}</select></div>
      <div class="admin-details-grid">
        <div class="field"><label for="editCourier">Courier name</label><input class="input" id="editCourier" value="${escapeAdmin(o.courier||'')}" placeholder="e.g. TCS"/></div>
        <div class="field"><label for="editTracking">Tracking number</label><input class="input" id="editTracking" value="${escapeAdmin(o.trackingNumber||'')}" placeholder="Tracking ID"/></div></div>
      <div class="field"><label for="editTrackingUrl">Courier tracking URL (https://)</label><input class="input" id="editTrackingUrl" value="${escapeAdmin(o.trackingUrl||'')}" placeholder="https://..."/></div>
      <p id="orderUpdateError" class="checkout-error" style="display:none" role="alert"></p>
      <div class="admin-actions"><button class="btn btn-primary" type="submit">Save order status</button>${o.status==='delivered'&&o.paymentStatus!=='paid'&&o.paymentMethod==='cod'?'<button type="button" class="btn btn-gold" id="collectCOD">Mark COD collected</button>':''}<button type="button" class="btn btn-outline" id="detailClose">Close</button></div>
    </form>`;
    dialog.showModal();
    document.getElementById('detailClose').onclick=()=>dialog.close();
    const collect=document.getElementById('collectCOD');
    if(collect)collect.onclick=async()=>{if(!confirm('Confirm that Cash on Delivery payment was physically received?'))return;collect.disabled=true;try{await adminRequest('/api/admin-orders',{method:'PATCH',body:JSON.stringify({orderNumber:o.orderNumber,action:'collect_cod'})});await loadOrders();dialog.close();render();showToast('COD collection recorded');}catch(err){collect.disabled=false;const msg=document.getElementById('orderUpdateError');msg.textContent=err.message;msg.style.display='block';}};
    document.getElementById('adminOrderUpdateForm').onsubmit=async e=>{
      e.preventDefault();const btn=e.target.querySelector('[type=submit]'),status=document.getElementById('editOrderStatus').value;
      const warning=document.getElementById('orderUpdateError');
      if(status==='cancelled'&&!confirm('Cancel this order and restore the reserved inventory?'))return;
      btn.disabled=true;warning.style.display='none';
      try{
        await updateOrderStatus(o.orderNumber,status,{courier:document.getElementById('editCourier').value,trackingNumber:document.getElementById('editTracking').value,trackingUrl:document.getElementById('editTrackingUrl').value});
        dialog.close();render();showToast('Order updated');
      }catch(err){warning.textContent=err.message;warning.style.display='block';}finally{btn.disabled=false;}
    };
  }
  async function refresh(){try{info.textContent='Loading orders…';await loadOrders();render();}catch(e){info.textContent=e.message;tbody.innerHTML='<tr><td colspan="6">Unable to load orders.</td></tr>';}}
  search.addEventListener('input',render);filter.addEventListener('change',render);
  document.getElementById('refreshOrders').addEventListener('click',refresh);
  await refresh();
});
