/* ==========================================================================
   checkout.js
   TODO(you): sign up at https://www.emailjs.com, create an email service +
   template, then fill in EMAILJS_PUBLIC_KEY / SERVICE_ID / TEMPLATE_ID
   below. Until then, orders are still recorded locally and the confirmation
   step still works — only the email send will silently no-op.
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

document.addEventListener("DOMContentLoaded", () => {
  const items = getCart();

  if (items.length === 0) {
    document.querySelector(".checkout-grid").innerHTML =
      '<p style="grid-column:1/-1;text-align:center;padding:60px 0;">Your cart is empty. <a href="shop.html" class="gold-text" style="font-weight:600;">Continue shopping →</a></p>';
    return;
  }

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
    const shipping = cartShipping();
    document.getElementById("summarySubtotal").textContent = formatPKR(sub);
    document.getElementById("summaryShipping").textContent = shipping === 0 ? "Free" : formatPKR(shipping);
    document.getElementById("summaryTotal").textContent = formatPKR(sub + shipping);
  }
  renderSummary();

  // ---- Payment method selection ----
  let paymentMethod = "visa";
  document.querySelectorAll(".payment-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".payment-option").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      paymentMethod = btn.dataset.method;
      document.getElementById("placeOrderBtn").textContent =
        paymentMethod === "cod" ? "Place Order" : "Place Order (Manual Payment Confirmation)";
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

  form.addEventListener("submit", (e) => {
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
    const shipping = cartShipping();
    const total = sub + shipping;
    const estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toDateString();
    const cartItems = getCart();

    const order = {
      orderNumber,
      items: cartItems,
      customer,
      paymentMethod,
      subtotal: sub,
      shipping,
      total,
      status: "pending",
      estimatedDelivery,
      createdAt: new Date().toISOString(),
    };

    // Persist locally so order-success.html and the admin dashboard can read it.
    localStorage.setItem("ls_last_order", JSON.stringify(order));
    const allOrders = JSON.parse(localStorage.getItem("ls_all_orders") || "[]");
    allOrders.unshift(order);
    localStorage.setItem("ls_all_orders", JSON.stringify(allOrders));

    // ---- EmailJS confirmation (no-ops silently if keys aren't set) ----
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
