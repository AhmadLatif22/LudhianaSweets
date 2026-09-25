document.addEventListener("DOMContentLoaded", async () => {
  const banner = document.getElementById("dbStatusBanner");
  if (!isDatabaseConnected()) {
    banner.innerHTML = `<div style="background:#fff3cd;color:#7a5b00;padding:12px 16px;border-radius:8px;font-size:.85rem;">
      Supabase isn't connected yet — reviews won't load or save until it is.
    </div>`;
  } else {
    banner.remove();
  }

  await loadProducts();

  // Product dropdown for the "add review" form
  const select = document.getElementById("reviewProductSelect");
  select.innerHTML = PRODUCTS.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");

  // Star picker for the add-review form
  let adminRating = 5;
  document.getElementById("adminStarPicker").outerHTML = renderStarPickerHTML("adminStarPicker", 5);
  attachStarPicker("adminStarPicker", (v) => (adminRating = v));

  // Toggle add-review form
  const addForm = document.getElementById("addReviewForm");
  document.getElementById("toggleAddForm").addEventListener("click", () => {
    addForm.style.display = addForm.style.display === "none" ? "block" : "none";
  });

  // Save a manually-added review — goes live immediately
  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const productId = select.value;
    const name = document.getElementById("adminReviewName").value.trim();
    const comment = document.getElementById("adminReviewComment").value.trim();
    const photoFile = document.getElementById("adminReviewPhoto").files[0] || null;
    if (!name || !comment) return;

    const submitBtn = addForm.querySelector("[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";

    const result = await adminAddReview({ productId, name, rating: adminRating, comment, photoFile });

    submitBtn.disabled = false;
    submitBtn.textContent = "Save Review";

    if (result.ok) {
      addForm.reset();
      addForm.style.display = "none";
      loadAndRenderReviews();
    } else {
      alert("Couldn't save review: " + (result.reason || "Supabase isn't connected."));
    }
  });

  // Filter tabs: pending / approved / all
  let currentFilter = "pending";
  document.querySelectorAll(".review-filter-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".review-filter-tabs button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      loadAndRenderReviews();
    });
  });

  async function loadAndRenderReviews() {
    const list = document.getElementById("reviewsAdminList");
    list.innerHTML = `<p style="color:rgba(74,44,29,.5);">Loading…</p>`;

    const all = await adminLoadAllReviews();
    const filtered = all.filter((r) => {
      if (currentFilter === "pending") return !r.approved;
      if (currentFilter === "approved") return r.approved;
      return true;
    });

    if (!filtered.length) {
      list.innerHTML = `<p style="color:rgba(74,44,29,.5);">No reviews here.</p>`;
      return;
    }

    list.innerHTML = filtered
      .map((r) => {
        const productName = PRODUCTS.find((p) => String(p.id) === String(r.product_id))?.name || "Unknown product";
        return `
        <div style="background:#fff;border-radius:var(--radius);box-shadow:var(--shadow-card);padding:20px;margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
            <div style="flex:1;min-width:220px;">
              <strong>${r.name}</strong> · <span style="color:rgba(74,44,29,.5);font-size:.85rem;">${productName}</span>
              <div class="stars" style="margin:6px 0;">${starsMarkup(r.rating)}</div>
              <p style="font-size:.9rem;color:rgba(74,44,29,.8);">${r.comment || ""}</p>
              ${r.photo_url ? `<img src="${r.photo_url}" class="review-photo" alt="Review photo" />` : ""}
              <div style="font-size:.75rem;color:rgba(74,44,29,.4);margin-top:4px;">
                ${r.source === "admin" ? "Added by admin" : "Customer submission"} · ${new Date(r.created_at).toLocaleDateString()}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
              ${
                !r.approved
                  ? `<button class="btn btn-gold" style="padding:6px 16px;font-size:.8rem;" data-approve="${r.id}">Approve</button>`
                  : `<button class="btn btn-outline" style="padding:6px 16px;font-size:.8rem;" data-unapprove="${r.id}">Unapprove</button>`
              }
              <button class="btn btn-outline" style="padding:6px 16px;font-size:.8rem;color:#b23a2e;border-color:#b23a2e;" data-delete="${r.id}">Delete</button>
            </div>
          </div>
        </div>`;
      })
      .join("");

    list.querySelectorAll("[data-approve]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        await adminSetReviewApproval(btn.dataset.approve, true);
        loadAndRenderReviews();
      })
    );
    list.querySelectorAll("[data-unapprove]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        await adminSetReviewApproval(btn.dataset.unapprove, false);
        loadAndRenderReviews();
      })
    );
    list.querySelectorAll("[data-delete]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (confirm("Delete this review permanently?")) {
          await adminDeleteReview(btn.dataset.delete);
          loadAndRenderReviews();
        }
      })
    );
  }

  loadAndRenderReviews();
});