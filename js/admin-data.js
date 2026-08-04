/* ==========================================================================
   admin-data.js — reads orders recorded locally by checkout.js.
   TODO(you): swap getAllOrders()/updateOrderStatus() for real API calls once
   you have a backend + database (see the Next.js version's
   lib/supabase/server.ts for a ready-made schema).
   ========================================================================== */

function getAllOrders() {
  try {
    return JSON.parse(localStorage.getItem("ls_all_orders")) || [];
  } catch {
    return [];
  }
}

function updateOrderStatus(orderNumber, status) {
  const orders = getAllOrders().map((o) => (o.orderNumber === orderNumber ? { ...o, status } : o));
  localStorage.setItem("ls_all_orders", JSON.stringify(orders));
  return orders;
}
