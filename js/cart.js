/* ==========================================================================
   cart.js — shared cart state (localStorage) + cart drawer + toast helper
   Include this on every page BEFORE any page-specific script.
   ========================================================================== */

const CART_KEY = "ls_cart";
const SHIPPING_FLAT = 250;
const FREE_SHIPPING_THRESHOLD = 3000;

function formatPKR(amount) {
  return "Rs " + Math.round(amount).toLocaleString("en-PK");
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  renderCartDrawer();
  updateCartCount();
}

function addToCart(item) {
  const items = getCart();
  const existing = items.find((i) => i.productId === item.productId && i.weight === item.weight);
  if (existing) {
    existing.quantity += item.quantity;
  } else {
    items.push(item);
  }
  saveCart(items);
  openCart();
  showToast(`Added ${item.quantity} × ${item.name} (${item.weight}) to cart`);
}

function updateQuantity(productId, weight, quantity) {
  let items = getCart();
  if (quantity <= 0) {
    items = items.filter((i) => !(i.productId === productId && i.weight === weight));
  } else {
    items = items.map((i) =>
      i.productId === productId && i.weight === weight ? { ...i, quantity } : i
    );
  }
  saveCart(items);
}

function removeFromCart(productId, weight) {
  const items = getCart().filter((i) => !(i.productId === productId && i.weight === weight));
  saveCart(items);
}

function clearCart() {
  saveCart([]);
}

function cartSubtotal() {
  return getCart().reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

function cartCount() {
  return getCart().reduce((sum, i) => sum + i.quantity, 0);
}

function cartShipping() {
  const items = getCart();
  if (items.length === 0) return 0;
  const sub = cartSubtotal();
  return sub >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
}

function updateCartCount() {
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    const count = cartCount();
    el.textContent = count;
    el.style.display = count > 0 ? "flex" : "none";
  });
}

function openCart() {
  document.getElementById("cartOverlay")?.classList.add("open");
  document.getElementById("cartDrawer")?.classList.add("open");
}

function closeCart() {
  document.getElementById("cartOverlay")?.classList.remove("open");
  document.getElementById("cartDrawer")?.classList.remove("open");
}

function renderCartDrawer() {
  const itemsEl = document.getElementById("cartItems");
  const footerEl = document.getElementById("cartFooter");
  if (!itemsEl) return;

  const items = getCart();

  if (items.length === 0) {
    itemsEl.innerHTML = `<div class="cart-empty"><p style="font-family:var(--font-display);font-size:1.1rem;margin-bottom:8px;">Your cart is empty</p><p>Add some barfi to get started.</p></div>`;
    if (footerEl) footerEl.style.display = "none";
    return;
  }

  itemsEl.innerHTML = items
    .map(
      (item) => `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.name}" loading="lazy" />
        <div class="cart-item-info">
          <p class="name">${item.name}</p>
          <p class="weight">${item.weight}</p>
          <div class="cart-item-row">
            <div class="qty-control">
              <button aria-label="Decrease quantity" onclick="updateQuantity('${item.productId}','${item.weight}',${item.quantity - 1})">−</button>
              <span>${item.quantity}</span>
              <button aria-label="Increase quantity" onclick="updateQuantity('${item.productId}','${item.weight}',${item.quantity + 1})">+</button>
            </div>
            <strong class="gold-text">${formatPKR(item.unitPrice * item.quantity)}</strong>
          </div>
        </div>
        <button class="cart-item-remove" aria-label="Remove ${item.name}" onclick="removeFromCart('${item.productId}','${item.weight}')">✕</button>
      </div>`
    )
    .join("");

  const sub = cartSubtotal();
  const shipping = cartShipping();
  const total = sub + shipping;

  if (footerEl) {
    footerEl.style.display = "block";
    footerEl.innerHTML = `
      <div class="cart-coupon">
        <input class="input" type="text" placeholder="Coupon code" />
        <button class="btn btn-outline" type="button">Apply</button>
      </div>
      <div class="summary-row"><span>Subtotal</span><span>${formatPKR(sub)}</span></div>
      <div class="summary-row"><span>Shipping</span><span>${shipping === 0 ? "Free" : formatPKR(shipping)}</span></div>
      <div class="summary-row total"><span>Total</span><span class="gold-text">${formatPKR(total)}</span></div>
      <a href="checkout.html" class="btn btn-primary btn-block">Proceed to Checkout</a>
      <button class="btn btn-outline btn-block" type="button" onclick="closeCart()">Continue Shopping</button>
    `;
  }
}

function showToast(message, isError = false) {
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = "toast show" + (isError ? " error" : "");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 3000);
}

document.addEventListener("DOMContentLoaded", () => {
  renderCartDrawer();
  updateCartCount();
  document.getElementById("cartOverlay")?.addEventListener("click", closeCart);
  document.getElementById("cartOpenBtn")?.addEventListener("click", openCart);
  document.getElementById("cartCloseBtn")?.addEventListener("click", closeCart);
});
