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

  function render() {
    list.innerHTML = PRODUCTS.map(
      (product) => `
      <div style="background:#fff;border-radius:var(--radius);box-shadow:var(--shadow-card);padding:24px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="font-size:1.1rem;">${product.name}</h2>
          <span style="font-size:.75rem;text-transform:uppercase;color:rgba(74,44,29,.5);">${product.category || ""}</span>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;">
          ${product.images
            .map((img) => `<img src="${img}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;" alt="" />`)
            .join("")}
          <label class="btn btn-outline" style="cursor:pointer;font-size:.8rem;padding:10px 16px;">
            + Upload Image
            <input type="file" accept="image/*" data-product-id="${product.id}" class="image-upload-input" style="display:none;" />
          </label>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
          ${product.prices
            .map(
              (price) => `
            <div style="border:1px solid rgba(183,139,92,.2);border-radius:12px;padding:16px;">
              <p style="font-weight:600;font-size:.9rem;margin-bottom:10px;">${price.weight}</p>
              <label style="font-size:.75rem;color:rgba(74,44,29,.6);">Price (PKR)</label>
              <input class="input" type="number" value="${price.price}" data-product="${product.id}" data-weight="${price.weight}" data-field="price" style="margin:4px 0 10px;" />
              <label style="font-size:.75rem;color:rgba(74,44,29,.6);">Stock</label>
              <input class="input" type="number" value="${price.stock}" data-product="${product.id}" data-weight="${price.weight}" data-field="stock" style="margin-top:4px;" />
            </div>`
            )
            .join("")}
        </div>
      </div>`
    ).join("");

    // ---- Price / stock edits ----
    list.querySelectorAll("input[data-product]").forEach((input) => {
      input.addEventListener("change", async () => {
        const product = PRODUCTS.find((p) => p.id === input.dataset.product);
        const weight = input.dataset.weight;
        const field = input.dataset.field;
        const value = Number(input.value);

        if (isDatabaseConnected()) {
          const { error } = await supabaseClient
            .from("product_prices")
            .update({ [field]: value })
            .eq("product_id", product.id)
            .eq("weight", weight);
          if (error) {
            showToast("Could not save — sign in required for edits.", true);
            return;
          }
          // Realtime subscription (shop.js/product.js) picks this up automatically;
          // refresh our own copy too so this page reflects it immediately.
          await loadProducts();
        } else {
          const priceEntry = product.prices.find((p) => p.weight === weight);
          priceEntry[field] = value;
        }
        showToast(`Updated ${product.name} (${weight})`);
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
      await supabaseClient.from("product_prices").insert({ product_id: id, weight: "250g", price: 0, stock: 0 });
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
