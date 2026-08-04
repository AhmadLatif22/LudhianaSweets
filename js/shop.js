document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  function render() {
    grid.innerHTML = PRODUCTS.map((p) => {
      const startingPrice = Math.min(...p.prices.map((pr) => pr.price));
      return `
        <a class="product-card" href="product.html?slug=${p.slug}">
          <div class="thumb"><img src="${p.images[0]}" alt="${p.name}" loading="lazy" /></div>
          <div class="body">
            <div class="rating">${stars(p.rating)} <span style="color:rgba(74,44,29,.4)">(${p.reviewCount})</span></div>
            <h3>${p.name}</h3>
            <p class="tagline">${p.tagline}</p>
            <p class="price">From ${formatPKR(startingPrice)}</p>
          </div>
        </a>`;
    }).join("");
  }

  await loadProducts();
  render();
  subscribeToProductChanges(render); // storefront updates the instant admin changes something
});
