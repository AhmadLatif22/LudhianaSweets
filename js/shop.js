document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  function render() {
    grid.innerHTML = PRODUCTS.map((p) => {
      const hasPrices = p.prices && p.prices.length > 0;
      const startingPrice = hasPrices ? Math.min(...p.prices.map((pr) => pr.price)) : null;
      const thumb = p.images && p.images.length
        ? `<img src="${p.images[0]}" alt="${p.name}" loading="lazy" />`
        : "";

      return `
        <a class="product-card" href="product.html?slug=${p.slug}">
          <div class="thumb">${thumb}</div>
          <div class="body">
            <div class="rating">${stars(p.rating)} <span style="color:rgba(74,44,29,.4)">(${p.reviewCount})</span></div>
            <h3>${p.name}</h3>
            <p class="tagline">${p.tagline}</p>
            <p class="price">${hasPrices ? "From " + formatPKR(startingPrice) : "Pricing coming soon"}</p>
          </div>
        </a>`;
    }).join("");
  }

  await loadProducts();
  render();
  subscribeToProductChanges(render); // storefront updates the instant admin changes something
});