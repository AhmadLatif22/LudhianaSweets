// Meta WhatsApp webhook. Deploy with --no-verify-jwt, since Meta cannot send a Supabase JWT.
// Verification is REQUIRED using WHATSAPP_APP_SECRET + X-Hub-Signature-256.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const text = (s: unknown) => String(s ?? "");
const html = (s: unknown) => text(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c] ?? c);
function validSignature(raw: string, secret: string, header: string): Promise<boolean> {
  return (async () => {
    if (!/^sha256=[0-9a-f]{64}$/i.test(header)) return false;
    const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    const hex = header.slice(7);
    const bytes = new Uint8Array(hex.match(/.{2}/g)!.map(b => parseInt(b,16)));
    return crypto.subtle.verify("HMAC",key,bytes,new TextEncoder().encode(raw));
  })();
}
function normalizePhone(raw: unknown) {
  const d = text(raw).replace(/\D/g, "");
  return /^03\d{9}$/.test(d) ? `92${d.slice(1)}` : /^923\d{9}$/.test(d) ? d : "";
}
Deno.serve(async req => {
  const url=new URL(req.url);
  if(req.method==="GET") {
    const token=Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    if(token && url.searchParams.get("hub.mode")==="subscribe" && url.searchParams.get("hub.verify_token")===token)
      return new Response(url.searchParams.get("hub.challenge") ?? "",{status:200});
    return new Response("Forbidden",{status:403});
  }
  if(req.method!=="POST") return new Response("Method not allowed",{status:405});
  const secret=Deno.env.get("WHATSAPP_APP_SECRET");
  if(!secret) return new Response("Webhook not configured",{status:503});
  const raw=await req.text();
  if(!await validSignature(raw,secret,req.headers.get("x-hub-signature-256") ?? "")) return new Response("Invalid signature",{status:403});
  try {
    const payload=JSON.parse(raw);
    const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    for(const entry of payload.entry ?? []) for(const change of entry.changes ?? []) {
      // Check the webhook belongs to the merchant's configured WhatsApp number.
      if(Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") && change.value?.metadata?.phone_number_id !== Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")) continue;
      for(const message of change.value?.messages ?? []) {
        const mid = message.context?.id;
        const sender = normalizePhone(message.from);
        const label=text(message.button?.payload ?? message.interactive?.button_reply?.id ?? message.button?.text ?? message.interactive?.button_reply?.title).toUpperCase().replace(/\s+/g,"_");
        const status = ["CONFIRM_ORDER","CONFIRM","YES"].includes(label) ? "confirmed" : ["CANCEL_ORDER","CANCEL","NO"].includes(label) ? "cancelled" : null;
        if(!status || !mid || !sender) continue;
        const {data:order,error}=await db.from("orders").select("*").eq("whatsapp_message_id",mid).maybeSingle();
        if(error) throw error;
        if(!order || normalizePhone(order.customer?.phone)!==sender || order.payment_method!=="cod" || order.status!=="pending_whatsapp_confirmation") continue;
        const {data:updated,error:transitionError}=await db.rpc("store_transition_order",{p_number:order.order_number,p_status:status,p_expected_status:"pending_whatsapp_confirmation"});
        if(transitionError) throw transitionError;
        if(updated && status==="confirmed") await sendEmail(order);
      }
    }
    return new Response("ok",{status:200});
  } catch(e) {
    console.error("WhatsApp webhook failed",e);
    // Meta should retry a transient failure. State changes are idempotent.
    return new Response("Temporary failure",{status:500});
  }
});
async function sendEmail(order: Record<string,any>) {
  const key=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("RESEND_FROM_EMAIL");
  if(!key || !from) return;
  const linkBase=Deno.env.get("SITE_URL")?.replace(/\/$/,"");
  const tracking=linkBase && order.checkout_token ? `${linkBase}/track-order.html#${new URLSearchParams({order:order.order_number,token:order.checkout_token})}` : null;
  const items=(order.items ?? []).map((item:Record<string,unknown>)=>`<li>${html(item.name)} (${html(item.weight)}) × ${Number(item.quantity)}</li>`).join("");
  const content=`<div style="font-family:Arial,sans-serif;color:#4a2c1d"><h1>Ludhiana Sweets</h1><p>Hi ${html(order.customer?.fullName)},</p><p>Your Cash on Delivery order is confirmed.</p><p><b>${html(order.order_number)}</b></p><ul>${items}</ul><p>Total: Rs ${Number(order.total).toLocaleString("en-PK")}</p>${tracking?`<p><a href="${html(tracking)}">Track your order</a></p>`:""}</div>`;
  for(const to of [order.customer?.email,Deno.env.get("ADMIN_EMAIL")].filter(Boolean)) {
    const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({from,to,subject:`Ludhiana Sweets order ${order.order_number} confirmed`,html:content})});
    if(!r.ok) console.error("Email provider error",r.status);
  }
}
