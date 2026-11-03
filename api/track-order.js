import {allowMethod,db,response} from './_lib/server.js';
export default async function handler(req,res) {
  if (!allowMethod(req,res)) return;
  const {orderNumber,token}=req.body || {};
  if (typeof orderNumber !== 'string' || !/^LS-[\w-]{10,32}$/.test(orderNumber) || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return response(res,400,{error:'Invalid tracking details'});
  try {
    const {data:order,error}=await db().from('orders').select('order_number,status,payment_status,payment_method,subtotal,shipping,total,items,created_at,updated_at,estimated_delivery,courier,tracking_number,tracking_url,customer,checkout_token').eq('order_number',orderNumber).eq('checkout_token',token).maybeSingle();
    if (error || !order) return response(res,404,{error:'Order not found or access link is invalid'});
    const {checkout_token,customer,...safe}=order;
    return response(res,200,{...safe,delivery_city:customer?.city || '',customer_name:customer?.fullName || ''});
  } catch(e) {console.error('Tracking failure',e.message);return response(res,503,{error:'Tracking is temporarily unavailable'});}
}
