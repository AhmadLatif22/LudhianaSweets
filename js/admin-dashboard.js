document.addEventListener('DOMContentLoaded',async()=>{
  const target=document.getElementById('statsGrid');
  try{
    const [orders]=await Promise.all([loadOrders(),loadProducts()]);
    const today=new Date().toDateString();
    const ordersToday=orders.filter(o=>new Date(o.createdAt).toDateString()===today).length;
    // COD orders are NOT recorded as paid revenue until collected and marked paid.
    const paidRevenue=orders.filter(o=>o.paymentStatus==='paid'&&o.status!=='cancelled').reduce((sum,o)=>sum+Number(o.total),0);
    const pending=orders.filter(o=>['pending','pending_whatsapp_confirmation'].includes(o.status)).length;
    const lowStock=PRODUCTS.flatMap(p=>p.prices||[]).filter(p=>p.stock<10).length;
    target.innerHTML=`<div class="stat-card"><p class="label">Orders today</p><p class="value">${ordersToday}</p></div>
    <div class="stat-card"><p class="label">Collected revenue</p><p class="value">${formatPKR(paidRevenue)}</p></div>
    <div class="stat-card"><p class="label">Awaiting confirmation</p><p class="value">${pending}</p></div>
    <div class="stat-card"><p class="label">Low stock variants</p><p class="value">${lowStock}</p></div>`;
    const recent=document.getElementById('recentOrders');
    if(recent)recent.innerHTML=orders.slice(0,8).map(o=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:13px;border-bottom:1px solid #eadcca"><span><strong>${escapeAdmin(o.orderNumber)}</strong><br/><small>${escapeAdmin(o.customer.fullName)}</small></span><span>${formatPKR(o.total)}<br/><small>${escapeAdmin(o.status.replace(/_/g,' '))}</small></span></div>`).join('')||'<p>No orders yet.</p>';
  }catch(err){target.innerHTML=`<p role="alert">Could not load dashboard: ${escapeAdmin(err.message)}</p>`;}
});
