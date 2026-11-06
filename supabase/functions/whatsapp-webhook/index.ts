
// Ludhiana Sweets - WhatsApp Webhook
//
// Deploy with:
// supabase functions deploy whatsapp-webhook --no-verify-jwt
//
// Security:
// Meta webhook requests are verified using WHATSAPP_APP_SECRET
// and X-Hub-Signature-256.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const text = (value: unknown): string => String(value ?? "");

const html = (value: unknown): string =>
  text(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);

function normalizePhone(value: unknown): string {
  const digits = text(value).replace(/\D/g, "");

  // Convert Pakistani local mobile format to international format.
  if (/^03\d{9}$/.test(digits)) {
    return `92${digits.slice(1)}`;
  }

  // Accept international numbers in digits-only format.
  return digits.length >= 10 && digits.length <= 15 ? digits : "";
}

// --------------------------------------------------
// Verify Meta webhook signature
// --------------------------------------------------

async function validSignature(
  raw: string,
  secret: string,
  header: string,
): Promise<boolean> {
  try {
    if (!/^sha256=[0-9a-f]{64}$/i.test(header)) {
      return false;
    }

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const hex = header.slice(7);
    const signatureBytes = new Uint8Array(
      hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
    );

    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(raw),
    );
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

// --------------------------------------------------
// Send WhatsApp text message
// --------------------------------------------------

async function sendWhatsAppText(
  recipient: string,
  message: string,
): Promise<boolean> {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v26.0";

  if (!token || !phoneNumberId) {
    console.error(
      "WhatsApp reply not configured: missing access token or phone number ID.",
    );
    return false;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "text",
          text: {
            preview_url: false,
            body: message,
          },
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("WhatsApp reply failed:", {
        status: response.status,
        error: result?.error?.message ?? "Unknown WhatsApp API error",
        errorCode: result?.error?.code ?? null,
      });

      return false;
    }

    console.log("WhatsApp reply accepted:", {
      recipient,
      messageId: result?.messages?.[0]?.id ?? null,
    });

    return true;
  } catch (error) {
    console.error("WhatsApp sending error:", error);
    return false;
  }
}
// --------------------------------------------------
// Send confirmation email through Resend
// --------------------------------------------------

const rs = (value: unknown): string =>
  `Rs. ${Number(value ?? 0).toLocaleString()}`;

function buildItemsHtml(items: Record<string, any>[]): string {
  return items.map((item) => {
    const qty = Number(item.quantity ?? 1);
    const line = Number(item.unitPrice ?? 0) * qty;
    const weight = item.weight ? ` (${html(item.weight)})` : "";

    return `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #eee9df;font-weight:600;color:#2b2418;">${html(item.name)}${weight}</td>
      <td style="padding:14px 0;border-bottom:1px solid #eee9df;text-align:center;color:#514937;">${qty}</td>
      <td style="padding:14px 0;border-bottom:1px solid #eee9df;text-align:right;color:#2b2418;">${rs(line)}</td>
    </tr>`;
  }).join("");
}

function buildAddress(order: Record<string, any>): string {
  const c = order.customer ?? {};
  const address = text(c.address).trim();
  const city = text(c.city).trim();

  const cityAlreadyIncluded =
    city && address.toLowerCase().includes(city.toLowerCase());

  return [address, cityAlreadyIncluded ? "" : city, c.postalCode]
    .filter(Boolean)
    .join(", ");
}

const PAYMENT_LABELS: Record<string, string> = {
  cod: "Cash on Delivery",
};

function buildEmailHtml(order: Record<string, any>): string {
  const shipping = Number(order.shipping) > 0 ? rs(order.shipping) : "Free";
  const payment = PAYMENT_LABELS[order.payment_method] ??
    text(order.payment_method);

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;width:100%;margin:0 auto;padding:12px;box-sizing:border-box;">
    <h1 style="margin:0 0 8px;font-size:22px;color:#2b2418;">Order confirmed 🎉</h1>
    <p style="margin:0 0 20px;color:#514937;line-height:1.5;">
      Hi ${html(order.customer?.fullName)}, thank you for shopping with Ludhiana Sweets.
      Your order <strong>${html(order.order_number)}</strong> is confirmed.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <th align="left" style="padding-bottom:8px;border-bottom:2px solid #eee9df;color:#514937;font-size:13px;">Item</th>
        <th style="padding-bottom:8px;border-bottom:2px solid #eee9df;color:#514937;font-size:13px;">Qty</th>
        <th align="right" style="padding-bottom:8px;border-bottom:2px solid #eee9df;color:#514937;font-size:13px;">Price</th>
      </tr>
      ${buildItemsHtml(order.items ?? [])}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;color:#2b2418;">
      <tr><td>Subtotal</td><td align="right">${rs(order.subtotal)}</td></tr>
      <tr><td>Shipping</td><td align="right">${shipping}</td></tr>
      <tr>
        <td style="padding-top:8px;font-weight:700;">Total</td>
        <td align="right" style="padding-top:8px;font-weight:700;">${rs(order.total)}</td>
      </tr>
    </table>

    <p style="margin:24px 0 4px;color:#514937;font-size:13px;">Delivery address</p>
    <p style="margin:0 0 16px;color:#2b2418;line-height:1.5;">${html(buildAddress(order))}</p>

    <p style="margin:0 0 4px;color:#514937;font-size:13px;">Payment method</p>
    <p style="margin:0;color:#2b2418;">${html(payment)}</p>
  </div>
</body>
</html>`;
}
async function sendEmail(order: Record<string, any>): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL"); // e.g. "Ludhiana Sweets <orders@yourdomain.com>"

  if (!apiKey || !from) {
    console.log("Confirmation email skipped: Resend not configured.");
    return;
  }

  const customerEmail = text(order.customer?.email).trim();
  const adminEmail = text(Deno.env.get("ADMIN_EMAIL")).trim();

  const messages: { to: string; subject: string }[] = [];

  if (customerEmail) {
    messages.push({
      to: customerEmail,
      subject: `Your order ${order.order_number} is confirmed`,
    });
  }

  if (adminEmail) {
    messages.push({
      to: adminEmail,
      subject: `New confirmed order ${order.order_number}`,
    });
  }

  if (messages.length === 0) {
    console.log("Confirmation email skipped: no recipient email.");
    return;
  }

  const htmlBody = buildEmailHtml(order);

  for (const message of messages) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          // Prevents duplicate emails if Meta retries the webhook.
          "Idempotency-Key": `order-confirmed/${order.order_number}/${message.to}`,
        },
body: JSON.stringify({
  from,
  to: [message.to],
  reply_to: "ludhianasweetmart@gmail.com",
  subject: message.subject,
  html: htmlBody,
}),      });

      if (!response.ok) {
        console.error("Resend error:", {
          status: response.status,
          detail: await response.text(),
          recipient: message.to,
        });
      } else {
        console.log("Resend email accepted:", { recipient: message.to });
      }
    } catch (error) {
      console.error("Email sending error:", error);
    }
  }
}
// --------------------------------------------------
// Main webhook
// --------------------------------------------------

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Meta webhook verification (GET).
  if (req.method === "GET") {
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

    if (
      verifyToken &&
      url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === verifyToken
    ) {
      return new Response(
        url.searchParams.get("hub.challenge") ?? "",
        { status: 200 },
      );
    }

    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify Meta's signature.
  const secret = Deno.env.get("WHATSAPP_APP_SECRET");

  if (!secret) {
    console.error("Missing WHATSAPP_APP_SECRET.");
    return new Response("Webhook not configured", { status: 503 });
  }

  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";

  if (!await validSignature(raw, secret, signature)) {
    console.error("Invalid Meta webhook signature.");
    return new Response("Invalid signature", { status: 403 });
  }

  try {
    const payload = JSON.parse(raw);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase environment variables are missing.");
    }

    const db = createClient(supabaseUrl, serviceRoleKey);

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {

        // Log EVERY event before checking the phone number ID.
        console.log("WHATSAPP WEBHOOK EVENT:", {
          field: change.field ?? null,
          messagesCount: change.value?.messages?.length ?? 0,
          statusesCount: change.value?.statuses?.length ?? 0,
          phoneNumberId: change.value?.metadata?.phone_number_id ?? null,
          configuredPhoneNumberId:
            Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? null,
        });

        // Confirm this event belongs to our WhatsApp business number.
        const configuredPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
        const incomingPhoneId = change.value?.metadata?.phone_number_id;

        if (configuredPhoneId && incomingPhoneId !== configuredPhoneId) {
          console.warn("WhatsApp phone number ID mismatch.");
          continue;
        }

        // Process customer messages and button replies.
        for (const message of change.value?.messages ?? []) {
          const mid = message.context?.id;
          const sender = normalizePhone(message.from);

          const rawButtonValue =
            message.button?.payload ||
            message.interactive?.button_reply?.id ||
            message.button?.text ||
            message.interactive?.button_reply?.title ||
            "";

          const label = text(rawButtonValue)
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, "_");

          const status = [
            "CONFIRM_ORDER",
            "CONFIRM",
            "YES",
          ].includes(label)
            ? "confirmed"
            : [
              "CANCEL_ORDER",
              "CANCEL",
              "NO",
            ].includes(label)
            ? "cancelled"
            : null;

          console.log("WHATSAPP BUTTON DIAGNOSTIC:", {
            messageType: message.type ?? null,
            buttonPayload: message.button?.payload ?? null,
            buttonText: message.button?.text ?? null,
            interactiveButtonId:
              message.interactive?.button_reply?.id ?? null,
            interactiveButtonTitle:
              message.interactive?.button_reply?.title ?? null,
            parsedLabel: label,
            parsedStatus: status,
            hasContextId: Boolean(mid),
            hasSender: Boolean(sender),
          });

          if (!status) {
            console.log("Ignoring unrecognised WhatsApp message.");
            continue;
          }

          if (!mid || !sender) {
            console.warn("Button reply missing context ID or valid sender.");
            continue;
          }

          // Find the order associated with the original outgoing template.
          const { data: order, error: orderError } = await db
            .from("orders")
            .select("*")
            .eq("whatsapp_message_id", mid)
            .maybeSingle();

          if (orderError) {
            throw orderError;
          }

          if (!order) {
            console.warn("No order found for WhatsApp message ID.");
            continue;
          }

          const phoneMatches =
            normalizePhone(order.customer?.phone) === sender;

          const paymentMatches = order.payment_method === "cod";

          const pendingMatches =
            order.status === "pending_whatsapp_confirmation";

          console.log("WHATSAPP ORDER MATCHING:", {
            orderNumber: order.order_number,
            phoneMatches,
            paymentMatches,
            pendingMatches,
          });

          if (!phoneMatches || !paymentMatches || !pendingMatches) {
            console.warn("Order failed validation; no status change made.");
            continue;
          }

          // Atomically transition the order through the existing RPC.
          const { data: updated, error: transitionError } = await db.rpc(
            "store_transition_order",
            {
              p_number: order.order_number,
              p_status: status,
              p_expected_status: "pending_whatsapp_confirmation",
            },
          );

          if (transitionError) {
            throw transitionError;
          }

          console.log("WHATSAPP ORDER TRANSITION RESULT:", {
            orderNumber: order.order_number,
            targetStatus: status,
            rpcReturnedTruthy: Boolean(updated),
            resultType: typeof updated,
          });

          // Send customer notifications only when the RPC reports success.
          if (!updated) {
            console.warn(
              "Order transition did not report success; no reply sent.",
            );
            continue;
          }

          if (status === "confirmed") {
            const customerMessage =
              `Your order has been confirmed successfully! 🎉\n\n` +
              `Order Number: ${order.order_number}\n\n` +
              `Thank you for shopping with Ludhiana Sweets. ` +
              `We will keep you updated on your order.`;

            await sendWhatsAppText(sender, customerMessage);
            await sendEmail(order);
          } else {
            const customerMessage =
              `Your order ${order.order_number} has been cancelled as requested.\n\n` +
              `Thank you for contacting Ludhiana Sweets.`;

            await sendWhatsAppText(sender, customerMessage);
          }
        }
      }
    }

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("WhatsApp webhook failed:", error);
    return new Response("Temporary failure", { status: 500 });
  }
});


