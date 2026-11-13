import {requireAdmin,response} from './_lib/server.js';
import {sendOrderEmail,sendShippedEmail} from './_lib/notifications.js';
const ALLOWED = new Set(['confirmed','processing','out_for_delivery','delivered','cancelled']);
export default async function handler(req,res) {
  if (!['GET','PATCH'].includes(req.method)) return response(res,405,{error:'Method not allowed'});
  try {
    const auth=await requireAdmin(req);
    if (!auth) return response(res,403,{error:'Admin access required'});
    const db=auth.supabase;
    if (req.method === 'GET') {
      const {data,error}=await db.from('orders').select('*').order('created_at',{ascending:false}).limit(300);
      if (error) throw error;
      return response(res,200,{orders:(data || []).map(({checkout_token,idempotency_key,...row})=>row)});
    }
    const {orderNumber,status,courier,trackingNumber,trackingUrl,action,notify}=req.body || {};
    if (action==='collect_cod') {
      if(typeof orderNumber!=='string')return response(res,400,{error:'Invalid order number'});
      const {data,error}=await db.rpc('store_collect_cod',{p_number:orderNumber});
      if(error)return response(res,409,{error:error.message});
      if(!data)return response(res,409,{error:'Only delivered COD orders with outstanding payment can be marked collected.'});
      return response(res,200,{ok:true});
    }
    if (typeof orderNumber !== 'string' || !ALLOWED.has(status)) return response(res,400,{error:'Invalid order or status'});
    if (status === 'out_for_delivery' && (!courier?.trim() || !trackingNumber?.trim())) return response(res,400,{error:'Courier and tracking number are required before dispatch'});
    if (trackingUrl && !/^https:\/\//.test(trackingUrl)) return response(res,400,{error:'Tracking URL must start with https://'});
    if ([courier,trackingNumber].some(v=>v!=null&&(typeof v!=='string'||v.trim().length>80))||(trackingUrl!=null&&(typeof trackingUrl!=='string'||trackingUrl.length>400))) return response(res,400,{error:'Courier, tracking number or link is too long'});
    const {data:before}=await db.from('orders').select('status').eq('order_number',orderNumber).maybeSingle();
    const {data:changed,error}=await db.rpc('store_transition_order',{
      p_number:orderNumber,p_status:status,p_courier:(courier||'').trim()||null,
      p_tracking_number:(trackingNumber||'').trim()||null,p_tracking_url:(trackingUrl||'').trim()||null
    });
    if (error) return response(res,409,{error:error.message});
    if (!changed) return response(res,404,{error:'Order not found or status changed concurrently'});
    // Shipping an order emails the customer; editing an already shipped order re-sends only when asked.
    const newlyChanged = before && before.status !== status;
    const shippingEdited = before && before.status === status && status === 'out_for_delivery' && notify === true;
    if (newlyChanged || shippingEdited) {
      const {data:order}=await db.from('orders').select('*').eq('order_number',orderNumber).single();
      if(order) {
        try {
          if (status === 'out_for_delivery') await sendShippedEmail(order);
          else await sendOrderEmail(order,`Ludhiana Sweets: ${status.replace(/_/g,' ')} — ${orderNumber}`,`Your order status is now ${status.replace(/_/g,' ')}.`);
        } catch(err){console.error('Order update email failed:',err.message);}
      }
    }
    return response(res,200,{ok:true});
  } catch(e) {console.error('Admin orders:',e.message);return response(res,503,{error:'Admin order service unavailable'});}
}
