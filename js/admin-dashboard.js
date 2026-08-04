document.addEventListener("DOMContentLoaded", async () => {
  await loadProducts();
  const orders = getAllOrders();
  const today = new Date().toDateString();
  const ordersToday = orders.filter((o) => new Date(o.createdAt).toDateString() === today).length;
  const revenue = orders.reduce((sum, o) => sum + o.total, 0);
  const pending = orders.filter((o) => o.status === "pending").length;
  const lowStock = PRODUCTS.flatMap((p) => p.prices).filter((pr) => pr.stock < 10).length;

  document.getElementById("statsGrid").innerHTML = `
    <div class="stat-card"><p class="label">Orders Today</p><p class="value">${ordersToday}</p></div>
    <div class="stat-card"><p class="label">Total Revenue</p><p class="value">${formatPKR(revenue)}</p></div>
    <div class="stat-card"><p class="label">Pending Orders</p><p class="value">${pending}</p></div>
    <div class="stat-card"><p class="label">Low Stock Items</p><p class="value">${lowStock}</p></div>
  `;
});
