const ORDER_STATUSES = ["pending", "confirmed", "processing", "out_for_delivery", "delivered", "cancelled"];

document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.getElementById("ordersTableBody");

  function render() {
    const orders = getAllOrders();
    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:rgba(74,44,29,.5);">No orders yet — place a test order through checkout.html to see it here.</td></tr>`;
      return;
    }
    tbody.innerHTML = orders
      .map(
        (o) => `
        <tr>
          <td>${o.orderNumber}</td>
          <td>${o.customer.fullName}</td>
          <td>${formatPKR(o.total)}</td>
          <td style="text-transform:uppercase;font-size:.8rem;">${o.paymentMethod}</td>
          <td>
            <select class="input" style="padding:6px 10px;" data-order="${o.orderNumber}">
              ${ORDER_STATUSES.map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s.replace(/_/g, " ")}</option>`).join("")}
            </select>
          </td>
        </tr>`
      )
      .join("");

    tbody.querySelectorAll("select[data-order]").forEach((select) => {
      select.addEventListener("change", () => {
        updateOrderStatus(select.dataset.order, select.value);
        showToast("Order status updated");
      });
    });
  }

  render();
});
