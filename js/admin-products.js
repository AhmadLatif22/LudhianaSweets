/* ==========================================================================
   admin-products.js
   Reads/writes real data via Supabase when connected (js/supabase-client.js).
   Falls back to editing the in-memory demo array only if Supabase isn't
   configured yet (changes won't persist or reach other visitors in that mode).
   ========================================================================== */

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const WEIGHT_PRESETS = ["100g", "250g", "500g", "750g", "1kg", "1.5kg", "2kg", "3kg", "5kg"];

document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("productsList");
  const banner = document.getElementById("dbStatusBanner");
  if (banner) {
    banner.textContent = isDatabaseConnected()
      ? "Connected to your live Supabase database — changes here are real and visible to every visitor immediately."
      : "Demo mode — Supabase isn't connected yet (see js/supabase-client.js), so changes here only affect this browser tab.";
    banner.className = isDatabaseConnected() ? "db-banner connected" : "db-banner demo";
  }

  async function uploadImage(file, productId) {
    if (!isDatabaseConnected()) {
      return URL.createObjectURL(file); // local preview only in demo mode
    }
    const path = `${productId}/${Date.now()}-${file.name}`;
    const { error } = await supabaseClient.storage.from("product-images").upload(path, file);
    if (error) {
      showToast("Image upload failed: " + error.message, true);
      return null;
    }
    const { data } = supabaseClient.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  }

  function weightSelectHTML(productId) {
    return `
      <select class="input packaging-weight-select" data-product-id="${productId}" style="max-width:140px;">
        ${WEIGHT_PRESETS.map((w) => `<option value="${w}">${w}</option>`).join("")}
        <option value="__custom__">Custom…</option>
      </select>
      <input class="input packaging-custom-input" data-product-id="${productId}" type="text" placeholder="e.g. 2.5kg Family Pack" style="display:none;max-width:180px;" />
    `;
  }

  function render() {
    list.innerHTML = PRODUCTS.map((product) => {
      const imagesHTML = product.images.length
        ? product.images
            .map((img) => `<img src="${img}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;" alt="" />`)
            .join("")
        : `<img src="${PLACEHOLDER_IMAGE}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;" alt="No image yet" />`;

      const pricesHTML = product.prices.length
        ? product.prices
            .map(
              (price) => `
            <div style="border:1px solid rgba(183,139,92,.2);border-radius:12px;padding:16px;position:relative;">
              <button class="delete-price-btn" data-price-id="${price.id}" data-product="${product.id}" aria-label="Remove ${price.weight}" style="position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:rgba(74,44,29,.35);font-size:.9rem;">✕</button>
              <p style="font-weight:600;font-size:.9rem;margin-bottom:10px;">${price.weight}</p>
              <label style="font-size:.75rem;color:rgba(74,44,29,.6);">Price (PKR)</label>
              <input class="input" type="number" value="${price.price}" data-price-id="${price.id}" data-product="${product.id}" data-field="price" style="margin:4px 0 10px;" />
              <label style="font-size:.75rem;color:rgba(74,44,29,.6);">Stock</label>
              <input class="input" type="number" value="${price.stock}" data-price-id="${price.id}" data-product="${product.id}" data-field="stock" style="margin-top:4px;" />
            </div>`
            )
            .join("")
        : `<p style="grid-column:1/-1;font-size:.85rem;color:rgba(74,44,29,.5);">No packaging sizes yet — add one below.</p>`;

      return `
      <div style="background:#fff;border-radius:var(--radius);box-shadow:var(--shadow-card);padding:24px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="font-size:1.1rem;">${product.name}</h2>
          <div style="display:flex;align-items:center;gap:14px;">
            <span style="font-size:.75rem;text-transform:uppercase;color:rgba(74,44,29,.5);">${product.category || ""}</span>
            <button class="delete-product-btn" data-product-id="${product.id}" style="background:none;border:none;cursor:pointer;color:#c0392b;font-size:.8rem;">Delete product</button>
          </div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;align-items:center;">
          ${imagesHTML}
          <label class="btn btn-outline" style="cursor:pointer;font-size:.8rem;padding:10px 16px;">
            + Upload Image
            <input type="file" accept="image/*" data-product-id="${product.id}" class="image-upload-input" style="display:none;" />
          </label>
        </div>

        <p style="font-weight:600;font-size:.85rem;margin-bottom:10px;">Packaging &amp; Pricing</p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px;">
          ${pricesHTML}
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;border-top:1px dashed rgba(183,139,92,.3);padding-top:16px;">
          ${weightSelectHTML(product.id)}
          <input class="input packaging-price-input" data-product-id="${product.id}" type="number" placeholder="Price (PKR)" style="max-width:130px;" />
          <input class="input packaging-stock-input" data-product-id="${product.id}" type="number" placeholder="Stock" style="max-width:100px;" />
          <button class="btn btn-gold add-packaging-btn" data-product-id="${product.id}" style="padding:10px 18px;font-size:.85rem;">+ Add Packaging</button>
        </div>
      </div>`;
    }).join("");

    // ---- Custom weight toggle ----
    list.querySelectorAll(".packaging-weight-select").forEach((select) => {
      select.addEventListener("change", () => {
        const productId = select.dataset.productId;
        const customInput = list.querySelector(`.packaging-custom-input[data-product-id="${productId}"]`);
        customInput.style.display = select.value === "__custom__" ? "block" : "none";
      });
    });

    // ---- Price / stock edits ----
    list.querySelectorAll("input[data-price-id][data-field]").forEach((input) => {
      input.addEventListener("change", async () => {
        const priceId = input.dataset.priceId;
        const productId = input.dataset.product;
        const field = input.dataset.field;
        const value = Number(input.value);
        const product = PRODUCTS.find((p) => p.id === productId);
        const weightLabel = product?.prices.find((p) => String(p.id) === priceId)?.weight || "";

        if (isDatabaseConnected()) {
          const { error } = await supabaseClient.from("product_prices").update({ [field]: value }).eq("id", priceId);
          if (error) {
            showToast("Could not save — sign in required for edits.", true);
            return;
          }
          await loadProducts();
        } else {
          const priceEntry = product.prices.find((p) => String(p.id) === priceId);
          if (priceEntry) priceEntry[field] = value;
        }
        showToast(`Updated ${product.name} (${weightLabel})`);
      });
    });

    // ---- Delete a packaging tier ----
    list.querySelectorAll(".delete-price-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const priceId = btn.dataset.priceId;
        const productId = btn.dataset.product;
        if (!confirm("Remove this packaging size?")) return;

        if (isDatabaseConnected()) {
          const { error } = await supabaseClient.from("product_prices").delete().eq("id", priceId);
          if (error) {
            showToast("Could not delete — sign in required.", true);
            return;
          }
          await loadProducts();
        } else {
          const product = PRODUCTS.find((p) => p.id === productId);
          product.prices = product.prices.filter((p) => String(p.id) !== priceId);
        }
        render();
        showToast("Packaging size removed");
      });
    });

    // ---- Add a new packaging tier ----
    list.querySelectorAll(".add-packaging-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const productId = btn.dataset.productId;
        const select = list.querySelector(`.packaging-weight-select[data-product-id="${productId}"]`);
        const customInput = list.querySelector(`.packaging-custom-input[data-product-id="${productId}"]`);
        const priceInput = list.querySelector(`.packaging-price-input[data-product-id="${productId}"]`);
        const stockInput = list.querySelector(`.packaging-stock-input[data-product-id="${productId}"]`);

        const weight = select.value === "__custom__" ? customInput.value.trim() : select.value;
        const price = Number(priceInput.value);
        const stock = Number(stockInput.value) || 0;

        if (!weight) {
          showToast("Enter a packaging size first.", true);
          return;
        }
        if (!price || price <= 0) {
          showToast("Enter a price greater than 0.", true);
          return;
        }

        if (isDatabaseConnected()) {
          const { error } = await supabaseClient
            .from("product_prices")
            .insert({ product_id: productId, weight, price, stock });
          if (error) {
            showToast("Could not add packaging — sign in required.", true);
            return;
          }
          await loadProducts();
        } else {
          const product = PRODUCTS.find((p) => p.id === productId);
          product.prices.push({ id: `local-${Date.now()}`, weight, price, stock });
        }
        render();
        showToast(`Added ${weight} packaging`);
      });
    });

    // ---- Image upload ----
    list.querySelectorAll(".image-upload-input").forEach((input) => {
      input.addEventListener("change", async () => {
        const file = input.files[0];
        if (!file) return;
        const productId = input.dataset.productId;
        const url = await uploadImage(file, productId);
        if (!url) return;

        if (isDatabaseConnected()) {
          const product = PRODUCTS.find((p) => p.id === productId);
          const newImages = [...product.images, url];
          const { error } = await supabaseClient.from("products").update({ images: newImages }).eq("id", productId);
          if (error) {
            showToast("Could not save image — sign in required for edits.", true);
            return;
          }
          await loadProducts();
        } else {
          const product = PRODUCTS.find((p) => p.id === productId);
          product.images.push(url);
        }
        render();
        showToast("Image added");
      });
    });

    // ---- Delete product ----
    list.querySelectorAll(".delete-product-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const productId = btn.dataset.productId;
        const product = PRODUCTS.find((p) => p.id === productId);
        if (!confirm(`Delete "${product.name}" completely? This can't be undone.`)) return;

        if (isDatabaseConnected()) {
          const { error } = await supabaseClient.from("products").delete().eq("id", productId);
          if (error) {
            showToast("Could not delete — sign in required.", true);
            return;
          }
          await loadProducts();
        } else {
          PRODUCTS = PRODUCTS.filter((p) => p.id !== productId);
        }
        render();
        showToast("Product deleted");
      });
    });
  }

  const toggleBtn = document.getElementById("toggleAddForm");
  const addForm = document.getElementById("addProductForm");
  toggleBtn.addEventListener("click", () => {
    addForm.style.display = addForm.style.display === "none" ? "block" : "none";
  });

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("newProductName").value.trim();
    if (!name) return;

    if (isDatabaseConnected()) {
      const id = `${slugify(name)}-${Date.now().toString(36)}`;
      const { error: prodErr } = await supabaseClient.from("products").insert({
        id,
        slug: slugify(name),
        name,
        category: "General",
        images: [],
      });
      if (prodErr) {
        showToast("Could not add product — sign in required.", true);
        return;
      }
      // No default packaging tier is created — add sizes below using the
      // packaging dropdown once the product card appears.
      await loadProducts();
      render();
    } else {
      showToast(`"${name}" added locally — connect Supabase to persist this for real.`);
    }

    addForm.reset();
    addForm.style.display = "none";
  });

  await loadProducts();
  render();
  subscribeToProductChanges(render);
});
