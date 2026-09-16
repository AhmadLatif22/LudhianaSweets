/* ==========================================================================
   admin-data.js — reads/writes real orders from Supabase once connected.
   Falls back to the browser's localStorage copy (from checkout.js) if
   Supabase isn't configured yet, so the demo flow still works.
   ========================================================================== */

let ORDERS = [];

function normalizeOrder(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    items: row.items,
    customer: row.customer,
    paymentMethod: row.payment_method,
    subtotal: row.subtotal,
    shipping: row.shipping,
    total: row.total,
    status: row.status,
    estimatedDelivery: row.estimated_delivery,
    createdAt: row.created_at,
  };
}

async function loadOrders() {
  if (!isDatabaseConnected()) {
    try {
      ORDERS = JSON.parse(localStorage.getItem("ls_all_orders")) || [];
    } catch {
      ORDERS = [];
    }
    return ORDERS;
  }

  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  ORDERS = error ? [] : data.map(normalizeOrder);
  return ORDERS;
}

function getAllOrders() {
  return ORDERS;
}

async function updateOrderStatus(orderNumber, status) {
  if (isDatabaseConnected()) {
    const { error } = await supabaseClient.from("orders").update({ status }).eq("order_number", orderNumber);
    if (error) {
      showToast("Could not update — sign in required.", true);
      return ORDERS;
    }
    await loadOrders();
  } else {
    ORDERS = ORDERS.map((o) => (o.orderNumber === orderNumber ? { ...o, status } : o));
    localStorage.setItem("ls_all_orders", JSON.stringify(ORDERS));
  }
  return ORDERS;
}

let _ordersChannel = null;

function subscribeToOrderChanges(callback) {
  if (!isDatabaseConnected() || _ordersChannel) return;
  _ordersChannel = supabaseClient
    .channel("orders-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, async () => {
      await loadOrders();
      callback();
    })
    .subscribe();
}
