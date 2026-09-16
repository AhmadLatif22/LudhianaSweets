/* ==========================================================================
   checkout.js

   Cash on Delivery orders now go through a WhatsApp confirmation step:
   the order is saved as "pending_whatsapp_confirmation", a WhatsApp message
   with Confirm/Cancel buttons is sent to the customer, and the order only
   becomes "confirmed" (with confirmation emails sent) once they tap Confirm
   — handled server-side by supabase/functions/whatsapp-webhook. See
   sql/orders-schema.sql and the setup guide for what needs to be configured
   before this works end-to-end.

   Online payment methods (Visa/MasterCard/JazzCash/EasyPaisa) skip WhatsApp
   entirely and still use the EmailJS immediate-confirmation flow below —
   TODO(you): sign up at https://www.emailjs.com, create an email service +
   template, then fill in EMAILJS_PUBLIC_KEY / SERVICE_ID / TEMPLATE_ID.
   ========================================================================== */

const EMAILJS_PUBLIC_KEY = "";
const EMAILJS_SERVICE_ID = "";
const EMAILJS_TEMPLATE_ID = "";

if (typeof emailjs !== "undefined" && EMAILJS_PUBLIC_KEY) {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

function generateOrderNumber() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `LS-${stamp}-${rand}`;
}

async function triggerWhatsAppConfirmation(orderNumber) {
  if (!isDatabaseConnected()) return; // demo mode — nothing to call
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-confirmation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ orderNumber }),
    });
  } catch (err) {
    console.warn("Could not reach the WhatsApp confirmation function:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const items = getCart();

  if (items.length === 0) {
    document.querySelector(".checkout-grid").innerHTML =
      '<p style="grid-column:1/-1;text-align:center;padding:60px 0;">Your cart is empty. <a href="shop.html" class="gold-text" style="font-weight:600;">Continue shopping →</a></p>';
    return;
  }

  // ---- Payment method selection ----
  let paymentMethod = "cod";

  // ---- Render order summary ----
  function renderSummary() {
    const summaryItems = document.getElementById("summaryItems");
    summaryItems.innerHTML = getCart()
      .map(
        (item) => `
        <div class="summary-line-item">
          <img src="${item.image}" alt="${item.name}" />
          <div style="flex:1;min-width:0;">
            <p style="font-weight:600;font-size:.88rem;">${item.name}</p>
            <p style="font-size:.78rem;color:rgba(74,44,29,.6);">${item.weight} × ${item.quantity}</p>
          </div>
          <strong class="gold-text" style="font-size:.9rem;">${formatPKR(item.unitPrice * item.quantity)}</strong>
        </div>`
      )
      .join("");

    const sub = cartSubtotal();
    const shipping = cartShipping(paymentMethod);
    document.getElementById("summarySubtotal").textContent = formatPKR(sub);
    document.getElementById("summaryShipping").textContent = shipping === 0 ? "Free" : formatPKR(shipping);
    document.getElementById("summaryTotal").textContent = formatPKR(sub + shipping);
  }
  renderSummary();

  document.querySelectorAll(".payment-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".payment-option").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      paymentMethod = btn.dataset.method;
      document.getElementById("placeOrderBtn").textContent =
        paymentMethod === "cod" ? "Place Order" : "Place Order (Manual Payment Confirmation)";
      renderSummary();
    });
  });

  // ---- Form validation + submit ----
  const form = document.getElementById("checkoutForm");
  const fields = ["fullName", "email", "phone", "address", "city", "postalCode"];

  function validate() {
    let valid = true;
    fields.forEach((name) => {
      const input = form.elements[name];
      const errorEl = form.querySelector(`[data-error-for="${name}"]`);
      errorEl.textContent = "";
      if (!input.value.trim() || (input.validity && !input.validity.valid)) {
        errorEl.textContent = "This field is required.";
        valid = false;
      }
    });
    const email = form.elements.email;
    if (email.value && !email.validity.valid) {
      form.querySelector('[data-error-for="email"]').textContent = "Please enter a valid email.";
      valid = false;
    }
    return valid;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const submitBtn = document.getElementById("placeOrderBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Placing your order...";

    const customer = {
      fullName: form.elements.fullName.value,
      email: form.elements.email.value,
      phone: form.elements.phone.value,
      address: form.elements.address.value,
      city: form.elements.city.value,
      postalCode: form.elements.postalCode.value,
      notes: form.elements.notes.value,
    };

    const orderNumber = generateOrderNumber();
    const sub = cartSubtotal();
    const shipping = cartShipping(paymentMethod);
    const total = sub + shipping;
    const estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toDateString();
    const cartItems = getCart();
    const initialStatus = paymentMethod === "cod" ? "pending_whatsapp_confirmation" : "confirmed";

    const order = {
      orderNumber,
      items: cartItems,
      customer,
      paymentMethod,
      subtotal: sub,
      shipping,
      total,
      status: initialStatus,
      estimatedDelivery,
      createdAt: new Date().toISOString(),
    };

    // Always keep a local copy too — lets order-success.html render instantly
    // without waiting on a network round trip, and is the only copy at all
    // in demo mode (Supabase not connected yet).
    localStorage.setItem("ls_last_order", JSON.stringify(order));
    const allOrders = JSON.parse(localStorage.getItem("ls_all_orders") || "[]");
    allOrders.unshift(order);
    localStorage.setItem("ls_all_orders", JSON.stringify(allOrders));

    if (isDatabaseConnected()) {
      const { error } = await supabaseClient.from("orders").insert({
        order_number: orderNumber,
        items: cartItems,
        customer,
        payment_method: paymentMethod,
        subtotal: sub,
        shipping,
        total,
        status: initialStatus,
        estimated_delivery: estimatedDelivery,
      });
      if (error) console.warn("Could not save order to Supabase:", error.message);
    }

    if (paymentMethod === "cod") {
      // Don't send the EmailJS confirmation yet — the order isn't confirmed
      // until the customer taps "Confirm" on WhatsApp. The webhook sends
      // the real confirmation emails once that happens.
      await triggerWhatsAppConfirmation(orderNumber);
      clearCart();
      window.location.href = `order-success.html?order=${orderNumber}&pending=whatsapp`;
      return;
    }

    // ---- Online payment methods: immediate EmailJS confirmation (no-ops silently if keys aren't set) ----
    const sendEmail =
      typeof emailjs !== "undefined" && EMAILJS_PUBLIC_KEY && EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID
        ? emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            to_email: customer.email,
            to_name: customer.fullName,
            order_number: orderNumber,
            order_items: cartItems.map((i) => `${i.name} (${i.weight}) × ${i.quantity}`).join(", "),
            order_total: formatPKR(total),
            payment_method: paymentMethod.toUpperCase(),
            delivery_address: `${customer.address}, ${customer.city}`,
            estimated_delivery: estimatedDelivery,
          })
        : Promise.resolve();

    sendEmail
      .catch((err) => console.warn("EmailJS not configured yet:", err))
      .finally(() => {
        clearCart();
        window.location.href = `order-success.html?order=${orderNumber}`;
      });
  });
});
