/* Settings: your account, password, dashboard preferences and data exports. */
A.start({ page: "settings", title: "Settings" }, async (main) => {
  const { esc, icon } = A, email = A.user?.email || "";
  main.innerHTML = `<div class="page-head"><div><h1>Settings</h1><p>Your account and dashboard preferences.</p></div></div>
    <div class="grid g2" style="align-items:start">
      <div class="card"><div class="card-h"><h2>Your account</h2></div><div class="card-b">
        <dl class="kv" style="grid-template-columns:90px 1fr"><dt>Email</dt><dd>${esc(email)}</dd><dt>Access</dt><dd><span class="badge b-ok">Store administrator</span></dd></dl>
        <div class="mt"><button class="btn" id="out">${icon("logout")}Sign out</button></div></div></div>
      <div class="card"><div class="card-h"><h2>Change password</h2></div><div class="card-b"><form id="pwForm" novalidate>
        <div class="field"><label for="p1">New password</label><input class="input" id="p1" type="password" autocomplete="new-password" /><div class="hint">At least 10 characters.</div></div>
        <div class="field"><label for="p2">Confirm new password</label><input class="input" id="p2" type="password" autocomplete="new-password" /><div class="err" id="pwErr" role="alert" hidden></div></div>
        <button class="btn primary" type="submit" id="pwBtn">Update password</button></form></div></div>
      <div class="card"><div class="card-h"><h2>Stock alerts</h2></div><div class="card-b">
        <div class="field"><label for="low">Low-stock level (units)</label><input class="input" id="low" type="number" min="0" max="999" step="1" style="max-width:140px" value="${A.lowStockLimit()}" /><div class="hint">A size is marked “Low stock” at or below this number. This preference is saved in this browser.</div></div>
        <button class="btn primary" id="saveLow">Save</button></div></div>
      <div class="card"><div class="card-h"><h2>Export your data</h2></div><div class="card-b"><p class="muted" style="margin-bottom:14px;font-size:.86rem">Download spreadsheets (CSV) for accounting or backups. Order exports include the newest ${A.ORDER_LIMIT} orders.</p>
        <div class="steps"><button class="btn" id="xOrders">${icon("download")}Orders</button><button class="btn" id="xProducts">${icon("download")}Products &amp; stock</button></div></div></div>
    </div>`;
  A.$("#out").onclick = () => A.signOut();
  A.$("#saveLow").onclick = () => { const v = Number(A.$("#low").value); if (!Number.isInteger(v) || v < 0 || v > 999) return A.toast("Enter a whole number from 0 to 999.", "error"); A.store.set("low_stock", v); A.toast("Low-stock level saved"); };
  A.$("#pwForm").onsubmit = async (e) => {
    e.preventDefault(); const p1 = A.$("#p1").value, p2 = A.$("#p2").value, err = A.$("#pwErr"), btn = A.$("#pwBtn"); err.hidden = true;
    const bad = p1.length < 10 ? "Use at least 10 characters." : p1 !== p2 ? "The two passwords don’t match." : "";
    if (bad) { err.textContent = bad; err.hidden = false; return; }
    btn.disabled = true; const { error } = await supabaseClient.auth.updateUser({ password: p1 }); btn.disabled = false;
    if (error) { err.textContent = error.message; err.hidden = false; return; }
    e.target.reset(); A.toast("Password updated");
  };
  A.$("#xOrders").onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      const list = await A.orders.load(), rows = [["Order", "Placed", "Customer", "Phone", "Email", "City", "Items", "Total", "Payment method", "Payment status", "Status"]];
      list.forEach((o) => rows.push([o.orderNumber, A.dateTime(o.createdAt), o.customer.fullName, o.customer.phone, o.customer.email, o.customer.city, o.items.map((i) => `${i.name} ${i.weight} x${i.quantity}`).join("; "), o.total, A.payMethod(o.paymentMethod), o.paymentStatus, A.statusLabel(o.status)]));
      A.csv(`orders-${A.dayKey(Date.now())}.csv`, rows); A.toast(`Exported ${list.length} orders`);
    } catch (x) { A.toast(x.message, "error"); } e.currentTarget.disabled = false;
  };
  A.$("#xProducts").onclick = async () => {
    try { const l = await A.catalog.load(), rows = [["Product", "Category", "Link name", "Size", "Price (PKR)", "Stock"]]; l.forEach((p) => p.variants.forEach((v) => rows.push([p.name, p.category, p.slug, v.weight, v.price, v.stock]))); A.csv(`products-${A.dayKey(Date.now())}.csv`, rows); A.toast("Products exported"); } catch (x) { A.toast(x.message, "error"); }
  };
});
