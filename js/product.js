document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  let product;
  let selectedWeight;
  let quantity = 1;
  let reviewFormRating = 5;
  let reviewsChannel;

  function pickProduct() {
    product = (slug && getProductBySlug(slug)) || PRODUCTS[0];
    if (!product) return;
    if (!selectedWeight || !product.prices.find((p) => p.weight === selectedWeight)) {
      selectedWeight = product.prices[0]?.weight;
    }
  }

  function renderEmptyState() {
    document.querySelector(".product-detail-grid").innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;">
        <h1 style="font-size:1.6rem;">No products yet</h1>
        <p style="color:rgba(74,44,29,.6);margin-top:10px;">Add your first product from the admin panel to see it here.</p>
      </div>`;
    document.querySelector(".tabs").style.display = "none";
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

    if (!product.images || product.images.length === 0) {
      mainImg.style.display = "none";
      thumbs.innerHTML = "";
    } else {
      mainImg.style.display = "";
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

    refreshPriceAndStock();
    renderReviewsTab();

    // Re-subscribe to this product's reviews (in case the product changed)
    if (reviewsChannel && typeof reviewsChannel.unsubscribe === "function") {
      reviewsChannel.unsubscribe();
    }
    reviewsChannel = subscribeToReviews(product.id, renderReviewsTab);
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

  // ---- Reviews tab: list + "write a review" form (text + optional photo) ----
  async function renderReviewsTab() {
    const panel = document.getElementById("tab-reviews");
    const reviews = await loadReviewsForProduct(product.id);

    const listHtml = reviews.length
      ? reviews
          .map(
            (r) => `
        <div class="review-item">
          <div class="stars">${starsMarkup(r.rating)}</div>
          ${r.photo_url ? `<img src="${r.photo_url}" alt="Photo from ${r.name}'s review" class="review-photo" />` : ""}
          <p style="font-size:.9rem;color:rgba(74,44,29,.75);">${r.comment || ""}</p>
          <p class="review-name">${r.name}</p>
        </div>`
          )
          .join("")
      : `<p style="color:rgba(74,44,29,.5);font-size:.9rem;">No reviews yet — be the first to share yours.</p>`;

    panel.innerHTML = `
      <div id="reviewsList">${listHtml}</div>
      <div class="review-form-wrap" style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(74,44,29,.1);max-width:480px;">
        <h3 style="font-size:1.1rem;margin-bottom:14px;">Write a Review</h3>
        <div id="reviewFormMsg" style="font-size:.85rem;margin-bottom:10px;"></div>
        <form id="reviewForm">
          <div class="field">
            <label for="reviewName">Your Name</label>
            <input class="input" id="reviewName" required />
          </div>
          <div class="field">
            <label>Rating</label>
            ${renderStarPickerHTML("starPicker", 5)}
          </div>
          <div class="field">
            <label for="reviewComment">Your Review</label>
            <textarea class="input" id="reviewComment" rows="3" required></textarea>
          </div>
          <div class="field">
            <label for="reviewPhoto">Add a Photo (optional)</label>
            <input type="file" id="reviewPhoto" accept="image/*" />
          </div>
          <button type="submit" class="btn btn-gold" id="reviewSubmitBtn">Submit Review</button>
        </form>
      </div>
    `;

    reviewFormRating = 5;
    attachStarPicker("starPicker", (v) => (reviewFormRating = v));

    document.getElementById("reviewForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msgEl = document.getElementById("reviewFormMsg");
      const submitBtn = document.getElementById("reviewSubmitBtn");
      const name = document.getElementById("reviewName").value.trim();
      const comment = document.getElementById("reviewComment").value.trim();
      const photoFile = document.getElementById("reviewPhoto").files[0] || null;
      if (!name || !comment) return;

      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting…";

      const result = await submitReview({ productId: product.id, name, rating: reviewFormRating, comment, photoFile });

      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Review";

      if (result.ok) {
        msgEl.style.color = "#3f7d3f";
        msgEl.textContent = "Thanks! Your review is awaiting approval and will appear here shortly.";
        e.target.reset();
      } else {
        msgEl.style.color = "#b23a2e";
        msgEl.textContent =
          result.reason === "offline"
            ? "Reviews are temporarily unavailable — please check back later."
            : "Something went wrong — please try again.";
      }
    });
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
  if (!product) {
    renderEmptyState();
    return;
  }
  renderProduct();
  subscribeToProductChanges(() => {
    pickProduct();
    if (!product) {
      renderEmptyState();
      return;
    }
    renderProduct(); // price/stock/image edits from the admin appear immediately
  });
});