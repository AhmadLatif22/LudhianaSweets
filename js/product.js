document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  let product;
  let selectedWeight;
  let quantity = 1;

  function pickProduct() {
    product = (slug && getProductBySlug(slug)) || PRODUCTS[0];
    if (!selectedWeight || !product.prices.find((p) => p.weight === selectedWeight)) {
      selectedWeight = product.prices[0]?.weight;
    }
  }

  function currentPriceInfo() {
    return product.prices.find((p) => p.weight === selectedWeight);
  }

  // ---- Full hydration from live product data (initial load + realtime updates) ----
  function renderProduct() {
    document.getElementById("productName").textContent = product.name;
    document.getElementById("productTagline").textContent = product.tagline;
    document.getElementById("productRating").innerHTML =
      `${stars(product.rating)} <span style="color:rgba(74,44,29,.5)">${product.rating} (${product.reviewCount} reviews)</span>`;
    document.title = `${product.name} | Ludhiana Sweets`;

    // Gallery
    const thumbs = document.getElementById("galleryThumbs");
    const mainImg = document.getElementById("galleryMainImg");
    const mainWrap = document.getElementById("galleryMain");

    if (!product.images || product.images.length === 0) {
      mainImg.style.display = "none";
      if (!mainWrap.querySelector(".no-image-placeholder")) {
        mainWrap.insertAdjacentHTML(
          "beforeend",
          `<div class="no-image-placeholder"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span>Photos coming soon</span></div>`
        );
      }
      thumbs.innerHTML = "";
    } else {
      mainImg.style.display = "";
      mainWrap.querySelector(".no-image-placeholder")?.remove();
      thumbs.innerHTML = product.images
        .map(
          (img, i) => `
        <button class="${i === 0 ? "active" : ""}" data-img="${img}" aria-label="View image ${i + 1}">
          <img src="${img}" alt="" />
        </button>`
        )
        .join("");
      mainImg.src = product.images[0];
      thumbs.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          thumbs.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          mainImg.src = btn.dataset.img;
        });
      });
    }

    // Weight options
    const weightWrap = document.getElementById("weightOptions");
    if (!product.prices || product.prices.length === 0) {
      weightWrap.innerHTML = `<p style="font-size:.85rem;color:rgba(74,44,29,.5);">No packaging options yet — check back soon.</p>`;
    } else {
      weightWrap.innerHTML = product.prices
        .map(
          (p) => `<button class="${p.weight === selectedWeight ? "active" : ""}" data-weight="${p.weight}">${p.weight}</button>`
        )
        .join("");
      weightWrap.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          selectedWeight = btn.dataset.weight;
          weightWrap.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          refreshPriceAndStock();
        });
      });
    }

    // Ingredients / storage
    document.getElementById("productIngredients").innerHTML = product.ingredients
      .map((ing) => `<li>${ing}</li>`)
      .join("");
    document.getElementById("productStorage").textContent = product.storageInstructions;

    // Reviews (site-wide REVIEWS list — swap for per-product reviews if you add that table)
    document.getElementById("tab-reviews").innerHTML = REVIEWS.map(
      (r) => `
      <div class="review-item">
        <div class="stars">${stars(r.rating)}</div>
        <p style="font-size:.9rem;color:rgba(74,44,29,.75);">${r.comment}</p>
        <p class="review-name">${r.name}</p>
      </div>`
    ).join("");

    refreshPriceAndStock();
  }

  function refreshPriceAndStock() {
    const info = currentPriceInfo();
    const priceEl = document.getElementById("productPrice");
    const stockEl = document.getElementById("stockStatus");
    const addBtn = document.getElementById("addToCartBtn");
    const buyBtn = document.getElementById("buyNowBtn");

    if (!info) {
      priceEl.textContent = "—";
      stockEl.textContent = "Currently unavailable";
      stockEl.className = "stock-status out";
      addBtn.disabled = true;
      buyBtn.disabled = true;
      return;
    }

    priceEl.textContent = formatPKR(info.price);
    if (info.stock > 0) {
      stockEl.textContent = `In stock — ${info.stock} available`;
      stockEl.className = "stock-status in";
      addBtn.disabled = false;
      buyBtn.disabled = false;
    } else {
      stockEl.textContent = "Currently out of stock";
      stockEl.className = "stock-status out";
      addBtn.disabled = true;
      buyBtn.disabled = true;
    }
  }

  // ---- Quantity ----
  const qtyEl = document.getElementById("qtyValue");
  document.getElementById("qtyMinus").addEventListener("click", () => {
    quantity = Math.max(1, quantity - 1);
    qtyEl.textContent = quantity;
  });
  document.getElementById("qtyPlus").addEventListener("click", () => {
    quantity += 1;
    qtyEl.textContent = quantity;
  });

  // ---- Add to cart / Buy now ----
  function buildCartItem() {
    const info = currentPriceInfo();
    return {
      productId: product.id,
      name: product.name,
      image: product.images[0],
      weight: selectedWeight,
      unitPrice: info.price,
      quantity,
    };
  }
  document.getElementById("addToCartBtn").addEventListener("click", () => addToCart(buildCartItem()));
  document.getElementById("buyNowBtn").addEventListener("click", () => {
    addToCart(buildCartItem());
    window.location.href = "checkout.html";
  });

  // ---- Wishlist (visual only) ----
  const wishBtn = document.getElementById("wishlistBtn");
  wishBtn.addEventListener("click", () => {
    const active = wishBtn.classList.toggle("active");
    wishBtn.setAttribute("aria-pressed", String(active));
    wishBtn.textContent = active ? "♥" : "♡";
  });

  // ---- Tabs ----
  document.querySelectorAll(".tab-buttons button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-buttons button").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });

  // ---- Load + realtime ----
  await loadProducts();
  pickProduct();
  renderProduct();
  subscribeToProductChanges(() => {
    pickProduct();
    renderProduct(); // price/stock/image edits from the admin appear immediately
  });
});
