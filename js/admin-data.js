let ORDERS=[];
function escapeAdmin(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function normalizeOrder(row) {return { ...row,id:row.id,orderNumber:row.order_number,items:row.items||[],customer:row.customer||{},paymentMethod:row.payment_method,paymentStatus:row.payment_status,subtotal:row.subtotal,shipping:row.shipping,total:row.total,status:row.status,createdAt:row.created_at,updatedAt:row.updated_at,estimatedDelivery:row.estimated_delivery,trackingNumber:row.tracking_number,trackingUrl:row.tracking_url,courier:row.courier};}
async function adminRequest(path, options={}) {
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session?.access_token)throw Error('Sign in as an administrator to continue');
  const result=await fetch(path,{...options,headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json',...options.headers}});
  const body=await result.json().catch(()=>({}));
  if(!result.ok)throw Error(body.error||'Admin request failed');
  return body;
}
async function loadOrders(){const r=await adminRequest('/api/admin-orders');ORDERS=(r.orders||[]).map(normalizeOrder);return ORDERS;}
function getAllOrders(){return ORDERS;}
async function updateOrderStatus(orderNumber,status,shipping={}) {
  await adminRequest('/api/admin-orders',{method:'PATCH',body:JSON.stringify({orderNumber,status,...shipping})});
  return loadOrders();
}
function subscribeToOrderChanges(callback){/* Protected order data is never sent on anonymous public Realtime channels. Use manual refresh. */}
