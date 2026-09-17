# WhatsApp Order Confirmation — Setup Guide

This wires up: customer pays Cash on Delivery → order saved as "awaiting
confirmation" → WhatsApp message sent with Confirm/Cancel buttons → customer
taps one → order status updates instantly everywhere (admin dashboard, the
customer's own order-success page) → if confirmed, an email goes to both the
customer and you.

Online payment methods (Visa/MasterCard/JazzCash/EasyPaisa) skip all of this
— they still use the EmailJS flow from before, unchanged.

This requires three things you don't have yet: a Meta developer account with
WhatsApp API access, an approved message template, and the two server
functions in `supabase/functions/` deployed. Budget **30–60 minutes** for
setup plus **hours-to-a-few-days waiting on Meta's template approval** before
it's fully live.

---

## 1. Run the new database migration

Supabase Dashboard → SQL Editor → paste and run `sql/orders-schema.sql`.
This creates the `orders` table that both the website and the webhook read
from — previously orders only lived in each customer's browser.

## 2. Create a Meta developer account & WhatsApp app

1. Go to [developers.facebook.com](https://developers.facebook.com) → sign
   up / log in with a Facebook account.
2. Create an **App** → type "Business" → give it a name (e.g. "Ludhiana
   Sweets").
3. In the app dashboard, find **WhatsApp** in the product list and click
   **Set up**.
4. Under WhatsApp → **API Setup**, Meta gives you a **test phone number**
   for free — good enough to build and test with. You'll need your own
   verified business number before sending real customer messages at scale.
5. On that same API Setup page, note down:
   - **Temporary access token** (24-hour token, fine for testing — you'll
     generate a permanent one in step 5)
   - **Phone number ID**

## 3. Add a recipient for testing

WhatsApp test numbers can only message phone numbers you've explicitly
added. On the API Setup page, under "To", click **Manage phone number list**
and add your own WhatsApp number to test with.

## 4. Create and submit the message template

Templates are required for a business to message a customer first (outside
a 24-hour reply window), and Meta must approve the wording before it can be
used.

1. Go to **WhatsApp Manager** → **Message Templates** → **Create Template**.
2. Category: **Utility**. Name: `order_confirmation` (must match exactly —
   this is what `WHATSAPP_TEMPLATE_NAME` will point to).
3. Language: English.
4. Body text (use exactly this, with the three placeholders):
   ```
   Hi {{1}}, thank you for your order from Ludhiana Sweets!

   Order {{2}} — Total: {{3}}

   Please confirm you'd like us to prepare and deliver this order.
   ```
5. Add **Buttons** → type **Quick Reply** → add two buttons:
   - Button 1 text: `Confirm Order`
   - Button 2 text: `Cancel Order`
6. Submit for review. Approval is usually a few hours, sometimes up to 2 days.
   You'll see the template's status change to "Approved" in WhatsApp Manager.

> The webhook code matches replies by button **payload**, not label text.
> Meta auto-generates payloads for quick-reply buttons as `CONFIRM_ORDER`/
> `CANCEL_ORDER`-style strings by default when you type those button texts —
> if yours come out differently, open the approved template's details and
> update the `buttonPayload` checks in
> `supabase/functions/whatsapp-webhook/index.ts` to match exactly.

## 5. Generate a permanent access token

The temporary token from step 2 expires in 24 hours — not usable long-term.

1. Go to **Business Settings** → **Users** → **System Users** → **Add**.
2. Create a system user with **Admin** role.
3. Click **Add Assets** → select your WhatsApp app → give it **Full control**.
4. Click **Generate New Token** → select your app → check the
   `whatsapp_business_messaging` and `whatsapp_business_management`
   permissions → **Generate Token**.
5. Copy this token now — Meta only shows it once.

## 6. Install the Supabase CLI and deploy the functions

```bash
npm install -g supabase
supabase login
cd ludhiana-sweets-static
supabase link --project-ref <your-project-ref>   # found in your Supabase project URL
supabase functions deploy send-whatsapp-confirmation
supabase functions deploy whatsapp-webhook
```

## 7. Set the function secrets

```bash
supabase secrets set \
  WHATSAPP_ACCESS_TOKEN="<permanent token from step 5>" \
  WHATSAPP_PHONE_NUMBER_ID="<from step 2>" \
  WHATSAPP_TEMPLATE_NAME="order_confirmation" \
  WHATSAPP_VERIFY_TOKEN="<make up any random secret string>" \
  RESEND_API_KEY="<your Resend API key>" \
  ADMIN_EMAIL="you@yourdomain.com" \
  SUPABASE_URL="<your Supabase project URL>" \
  SUPABASE_SERVICE_ROLE_KEY="<Project Settings → API → service_role key — never expose this in client code>"
```

You need a [Resend](https://resend.com) account with a verified sending
domain for the confirmation emails — same as any other transactional email
setup.

## 8. Point Meta's webhook at your function

1. Your webhook URL is:
   `https://<your-project-ref>.supabase.co/functions/v1/whatsapp-webhook`
2. In the Meta app dashboard → WhatsApp → **Configuration** → **Webhook** →
   **Edit**.
3. Callback URL: the URL above. Verify token: the same random string you
   set as `WHATSAPP_VERIFY_TOKEN` in step 7.
4. Click **Verify and Save** — Meta calls your function's GET handler to
   confirm it's really you; it should go through instantly if the token
   matches.
5. Under **Webhook fields**, subscribe to **messages**.

## 9. Fill in your project's client-side keys

Open `js/checkout.js` — no changes needed there, it already calls the
function using `SUPABASE_URL`/`SUPABASE_ANON_KEY` from `js/supabase-client.js`
(same keys you set up for products).

## 10. Test it end-to-end

1. Add your test WhatsApp number as the phone on a checkout form.
2. Place an order with Cash on Delivery.
3. You should land on `order-success.html` with "Almost there — check
   WhatsApp!" and receive the WhatsApp message within a few seconds.
4. Tap **Confirm Order**. Within a couple seconds:
   - The order-success page updates live to "Order Confirmed!" (no refresh)
   - `admin/orders.html` shows the status flip live
   - You and the customer both get a confirmation email

If the WhatsApp message never arrives, check the function logs:
```bash
supabase functions logs send-whatsapp-confirmation
```

If the button tap doesn't update anything, check:
```bash
supabase functions logs whatsapp-webhook
```

## Known limitations to plan around

- **Test numbers only work with numbers you've added** (step 3) until you
  verify a real business phone number for production use.
- **Template wording can't change without re-approval** — if you edit the
  body text later, Meta needs to re-review it.
- If a customer doesn't reply at all, the order just sits at
  `pending_whatsapp_confirmation` forever — you may want to periodically
  follow up manually via `admin/orders.html`, or add a reminder/expiry job
  later (not built here).
- The webhook currently only handles **button replies** — a free-text
  message like "yes" typed by the customer instead of tapping the button
  won't be understood.
