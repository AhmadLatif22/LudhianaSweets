import {response} from './server.js';

export function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function orderTrackLink(order) {
  const origin = process.env.SITE_URL;
  if (!origin) return null;
  const hash = new URLSearchParams({order: order.order_number, token: order.checkout_token});
  return `${origin.replace(/\/$/,'')}/track-order.html#${hash}`;
}
export async function sendOrderEmail(order, subject, lead) {
  const key = process.env.RESEND_API_KEY, from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) return {ok:false, reason:'Email not configured'};
  const list = (order.items || []).map(item => `<li>${escapeHtml(item.name)} (${escapeHtml(item.weight)}) × ${Number(item.quantity)}</li>`).join('');
  const link = orderTrackLink(order);
  const html = `<div style="font-family:Arial,sans-serif;color:#4a2c1d;max-width:600px;margin:auto">
  <h1>Ludhiana Sweets</h1><p>Hi ${escapeHtml(order.customer.fullName)},</p><p>${escapeHtml(lead)}</p>
  <p><b>Order ${escapeHtml(order.order_number)}</b></p><ul>${list}</ul>
  <p>Total: Rs ${Number(order.total).toLocaleString('en-PK')}</p>
  ${link ? `<p><a href="${escapeHtml(link)}">Track your order securely</a></p>` : ''}
  <p>Delivery: ${escapeHtml(order.customer.address)}, ${escapeHtml(order.customer.city)}</p></div>`;
  const sends = [order.customer.email, process.env.ADMIN_EMAIL].filter(Boolean);
  let ok = true;
  for (const address of new Set(sends)) {
    try {
      const r = await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(3000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[address],subject,html})});
      if (!r.ok) {console.error('Resend response:',r.status);ok=false;}
    } catch (e) {console.error('Resend unavailable',e.message);ok=false;}
  }
  return {ok};
}
export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g,'');
  if (/^03\d{9}$/.test(digits)) return '92'+digits.slice(1);
  if (/^923\d{9}$/.test(digits)) return digits;
  return null;
}
export async function sendWhatsApp(order) {
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_TEMPLATE_NAME) return {ok:false,reason:'WhatsApp not configured'};
  const phone = normalizePhone(order.customer.phone);
  if (!phone) return {ok:false,reason:'Invalid Pakistani mobile number'};
  // Meta's approved template must have three body variables and Confirm / Cancel quick replies.
  const r = await fetch(`https://graph.facebook.com/${process.env.META_API_VERSION || 'v23.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{
    method:'POST',signal:AbortSignal.timeout(4000),headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,'Content-Type':'application/json'},
    body:JSON.stringify({messaging_product:'whatsapp',to:phone,type:'template',template:{name:process.env.WHATSAPP_TEMPLATE_NAME,language:{code:process.env.WHATSAPP_TEMPLATE_LANG || 'en'},components:[{type:'body',parameters:[{type:'text',text:order.customer.fullName},{type:'text',text:order.order_number},{type:'text',text:`Rs ${order.total.toLocaleString('en-PK')}` }]}]}})
  });
  const body = await r.json().catch(()=>({}));
  return {ok:r.ok && !!body.messages?.[0]?.id,messageId:body.messages?.[0]?.id || null};
}
