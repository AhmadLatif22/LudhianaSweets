import {allowMethod,cleanCustomer,cleanItems,db,response,validUUID} from './_lib/server.js';
import {sendWhatsApp,sendOrderEmail} from './_lib/notifications.js';
export default async function handler(req,res) {
  if (!allowMethod(req,res)) return;
  try {
    const {customer,items,billingAddress,paymentMethod,idempotencyKey,expectedTotal} = req.body || {};
    if (paymentMethod !== 'cod') return response(res,409,{error:'Online payment is not active yet. Select Cash on Delivery.'});
    if (!validUUID(idempotencyKey)) return response(res,400,{error:'Invalid checkout session; reload checkout.'});
    const trusted = cleanCustomer(customer), cart = cleanItems(items);
    if (!Number.isSafeInteger(expectedTotal) || expectedTotal <= 0) return response(res,400,{error:'Invalid order total; reload the checkout.'});
    const billing = billingAddress?.sameAsShipping === false ? {
      sameAsShipping:false,firstName:String(billingAddress.firstName || '').slice(0,60),lastName:String(billingAddress.lastName || '').slice(0,60),
      address:String(billingAddress.address||'').slice(0,250),city:String(billingAddress.city||'').slice(0,90),postalCode:String(billingAddress.postalCode||'').slice(0,15)
    } : {sameAsShipping:true};
    if (!billing.sameAsShipping && (!billing.firstName || !billing.lastName || billing.address.length < 6 || !billing.city)) throw new Error('Complete the billing address');
    const supabase=db();
    const {data,error}=await supabase.rpc('store_place_order',{p_items:cart,p_customer:trusted,p_billing:billing,p_payment_method:'cod',p_idempotency:idempotencyKey,p_expected_total:expectedTotal});
    if (error) {
      const err = error.message || '';
      const status = /RATE_LIMITED/.test(err)?429:/OUT_OF_STOCK|PRODUCT_NOT_FOUND|PRICE_CHANGED/.test(err) ? 409 : 400;
      return response(res,status,{error: /OUT_OF_STOCK/.test(err)?'An item is out of stock. Review your cart.':/PRODUCT_NOT_FOUND/.test(err)?'An item is no longer available.':/ORDER_TOO_LARGE/.test(err)?'Cart total exceeds the allowed amount.':/PRICE_CHANGED/.test(err)?'Prices changed while you were shopping. Please refresh the product page and update your cart.':/RATE_LIMITED/.test(err)?'Too many recent orders for this mobile number. Please contact the store.':'Order could not be placed. Check your cart and delivery details.'});
    }
    if (data.created) {
      const {data:order}=await supabase.from('orders').select('*').eq('order_number',data.orderNumber).single();
      if (order) {
        // Run both in parallel, each with its own timeout, so a slow provider can't stall the customer's response.
        await Promise.allSettled([
          (async()=>{
            try {
              const wa=await sendWhatsApp(order);
              if (wa.ok) await supabase.from('orders').update({whatsapp_message_id:wa.messageId}).eq('id',order.id).is('whatsapp_message_id',null);
              else console.warn('WhatsApp confirmation not sent:',wa.reason || 'provider rejected request');
            } catch(e) {console.error('WhatsApp send failed:',e.message);}
          })(),
          (async()=>{
            try {await sendOrderEmail(order,`We received your order ${order.order_number}`,'Your order is awaiting WhatsApp confirmation. We will prepare it after you confirm.');} catch(e) {console.error('Order email failed:',e.message);}
          })()
        ]);
      }
    }
    response(res,201,{orderNumber:data.orderNumber,trackingToken:data.trackingToken,total:data.total,shipping:data.shipping,status:data.status});
  } catch(err) {console.error('Order creation:',err.message); response(res,/database is not configured/.test(err.message)?503:400,{error:/database is not configured/.test(err.message)?'Checkout is temporarily unavailable':err.message});}
}
