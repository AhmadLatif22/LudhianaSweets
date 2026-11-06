/* Orders: tabs, search, filters, bulk actions, CSV export, order drawer with
   fulfilment actions, tracking, payment collection, timeline and invoice. */
A.start({ page: "orders", title: "Orders" }, async (main) => {
  const { esc, pkr, num, icon, date, dateTime, ago } = A;
  const PER = 25;
  const TABS = [
    ["all", "All", () => true],
    ["awaiting", "Awaiting confirmation", (o) => ["pending", "pending_whatsapp_confirmation"].includes(o.status)],
    ["toship", "To pack & ship", (o) => ["confirmed", "processing"].includes(o.status)],
    ["road", "Out for delivery", (o) => o.status === "out_for_delivery"],
    ["delivered", "Delivered", (o) => o.status === "delivered"],
    ["cancelled", "Cancelled", (o) => o.status === "cancelled"]
  ];
  const qs = new URLSearchParams(location.search);
  const S = { tab: TABS.some((t) => t[0] === qs.get("status")) ? qs.get("status") : "all", q: qs.get("q") || "", pay: ["paid", "unpaid"].includes(qs.get("pay")) ? qs.get("pay") : "", when: "", sort: "new", page: 1, sel: new Set() };
  let drawerCtl = null, lastLoad = Date.now();

  main.innerHTML = `<div class="page-head"><div><h1>Orders</h1><p>Confirm, pack and dispatch orders, and record cash collected.</p></div>
    <div class="head-actions"><button class="btn" id="exportCsv">${icon("download")}Export CSV</button><button class="btn" id="refresh">${icon("refresh")}Refresh</button></div></div>
    <div id="notice"></div><div class="tabs" id="tabs" role="tablist"></div>
    <div class="toolbar"><div class="search">${icon("search")}<input class="input" id="q" placeholder="Search order no., customer, phone, city" aria-label="Search orders" value="${esc(S.q)}" /></div>
      <select class="select" id="pay" aria-label="Payment"><option value="">All payments</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select>
      <select class="select" id="when" aria-label="Date"><option value="">All time</option><option value="today">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select>
      <select class="select" id="sort" aria-label="Sort"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="high">Highest total</option></select></div>
    <div id="bulk"></div><div id="list"><div class="card"><div class="card-b"><div class="skel" style="margin:6px 0"></div><div class="skel" style="margin:14px 0;width:80%"></div><div class="skel" style="width:60%"></div></div></div></div>`;
  A.$("#pay").value = S.pay;

  async function load(silent) {
    try { await A.orders.load(); lastLoad = Date.now(); if (A.orders.truncated) A.$("#notice").innerHTML = `<div class="note warn">${icon("alert")}<span>Showing the newest ${A.ORDER_LIMIT} orders. Older orders are not loaded here.</span></div>`; else A.$("#notice").innerHTML = ""; render(); A.refreshBadges(); }
    catch (e) { if (!silent) A.errorPanel(A.$("#list"), e, () => load()); }
  }

  function filtered() {
    const tab = TABS.find((t) => t[0] === S.tab)[2], q = S.q.toLowerCase().trim(), now = Date.now();
    const since = S.when === "today" ? A.startOfDay(now).getTime() : S.when ? now - Number(S.when) * 864e5 : 0;
    const rows = A.orders.list.filter((o) => tab(o) && (!S.pay || (S.pay === "paid") === (o.paymentStatus === "paid")) && o.ts >= since &&
      (!q || `${o.orderNumber} ${o.customer.fullName} ${o.customer.phone} ${o.customer.email} ${o.customer.city}`.toLowerCase().includes(q)));
    if (S.sort === "old") rows.sort((a, b) => a.ts - b.ts); else if (S.sort === "high") rows.sort((a, b) => b.total - a.total);
    return rows;
  }

  function render() {
    const all = A.orders.list, rows = filtered(), pages = Math.max(1, Math.ceil(rows.length / PER)); S.page = Math.min(S.page, pages);
    const slice = rows.slice((S.page - 1) * PER, S.page * PER);
    A.$("#tabs").innerHTML = TABS.map(([id, label, fn]) => `<button role="tab" data-tab="${id}" class="${id === S.tab ? "active" : ""}" aria-selected="${id === S.tab}">${label}<span class="n">${all.filter(fn).length}</span></button>`).join("");
    A.$$("[data-tab]").forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; S.page = 1; S.sel.clear(); render(); }));
    const el = A.$("#list");
    if (!slice.length) {
      el.innerHTML = `<div class="card"><div class="empty">${icon("bag")}<h3>${all.length ? "No orders match" : "No orders yet"}</h3><p>${all.length ? "Try a different tab, search or filter." : "Orders placed on the storefront will show up here."}</p></div></div>`;
      A.$("#bulk").innerHTML = ""; return;
    }
    const allSel = slice.every((o) => S.sel.has(o.orderNumber));
    el.innerHTML = `<div class="table-wrap"><table class="t"><thead><tr><th style="width:36px"><input type="checkbox" class="cb" id="selAll" aria-label="Select all on page" ${allSel ? "checked" : ""}/></th><th>Order</th><th>Customer</th><th>Items</th><th class="r">Total</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody>
      ${slice.map((o) => { const n = o.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0); return `<tr class="click" data-open="${esc(o.orderNumber)}">
        <td data-stop><input type="checkbox" class="cb" data-sel="${esc(o.orderNumber)}" aria-label="Select ${esc(o.orderNumber)}" ${S.sel.has(o.orderNumber) ? "checked" : ""}/></td>
        <td><span class="strong">${esc(o.orderNumber)}</span><div class="sub" title="${esc(dateTime(o.createdAt))}">${ago(o.createdAt)}</div></td>
        <td>${esc(o.customer.fullName || "—")}<div class="sub">${esc(o.customer.city || "")}</div></td>
        <td>${n} item${n === 1 ? "" : "s"}<div class="sub" style="max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.items.map((i) => i.name).join(", "))}</div></td>
        <td class="r strong">${pkr(o.total)}</td><td>${A.payBadge(o)}<div class="sub">${esc(A.payMethod(o.paymentMethod))}</div></td><td>${A.statusBadge(o.status)}</td><td class="c muted">${icon("chev")}</td></tr>`; }).join("")}</tbody></table></div>
      <div class="pager"><span>Showing ${(S.page - 1) * PER + 1}–${(S.page - 1) * PER + slice.length} of ${rows.length}</span><div class="btns"><button class="btn sm" id="prev" ${S.page <= 1 ? "disabled" : ""}>Previous</button><button class="btn sm" id="next" ${S.page >= pages ? "disabled" : ""}>Next</button></div></div>`;
    A.$("#selAll").onchange = (e) => { slice.forEach((o) => (e.target.checked ? S.sel.add(o.orderNumber) : S.sel.delete(o.orderNumber))); render(); };
    A.$$("[data-sel]", el).forEach((c) => (c.onchange = () => { c.checked ? S.sel.add(c.dataset.sel) : S.sel.delete(c.dataset.sel); renderBulk(); A.$("#selAll").checked = slice.every((o) => S.sel.has(o.orderNumber)); }));
    A.$$("[data-open]", el).forEach((r) => (r.onclick = (e) => { if (e.target.closest("[data-stop]")) return; openOrder(r.dataset.open); }));
    A.$("#prev").onclick = () => { S.page--; render(); window.scrollTo(0, 0); }; A.$("#next").onclick = () => { S.page++; render(); window.scrollTo(0, 0); };
    renderBulk();
  }

  /* ---------- bulk actions ---------- */
  function renderBulk() {
    const box = A.$("#bulk"), picked = A.orders.list.filter((o) => S.sel.has(o.orderNumber));
    if (!picked.length) { box.innerHTML = ""; return; }
    const can = (to) => picked.filter((o) => A.NEXT[o.status]?.includes(to)).length;
    const btn = (to, label) => (can(to) ? `<button class="btn sm" data-bulk="${to}">${label} (${can(to)})</button>` : "");
    box.innerHTML = `<div class="bulkbar"><span>${picked.length} selected</span>${btn("confirmed", "Confirm")}${btn("processing", "Start processing")}${btn("delivered", "Mark delivered")}<button class="btn sm" id="bulkExport">${icon("download")}Export</button><span class="spacer"></span><button class="btn sm" id="bulkClear">Clear</button></div>`;
    A.$("#bulkClear").onclick = () => { S.sel.clear(); render(); };
    A.$("#bulkExport").onclick = () => exportCsv(picked);
    A.$$("[data-bulk]", box).forEach((b) => (b.onclick = async () => {
      const to = b.dataset.bulk, targets = picked.filter((o) => A.NEXT[o.status]?.includes(to));
      if (!(await A.confirmBox({ title: `${A.statusLabel(to)}: ${targets.length} order${targets.length > 1 ? "s" : ""}?`, message: "Customers are emailed about status changes where an email address is on file.", confirm: "Update orders" }))) return;
      let ok = 0, fail = 0, lastErr = ""; b.disabled = true;
      for (const o of targets) { try { await A.orders.transition(o.orderNumber, to); ok++; } catch (e) { fail++; lastErr = e.message; } }
      S.sel.clear(); await load(); A.toast(`${ok} order${ok === 1 ? "" : "s"} updated` + (fail ? `, ${fail} failed (${lastErr})` : ""), fail ? "error" : "ok");
    }));
  }

  /* ---------- CSV ---------- */
  function exportCsv(list) {
    const rows = [["Order", "Placed", "Customer", "Phone", "Email", "City", "Address", "Items", "Subtotal", "Shipping", "Total", "Payment method", "Payment status", "Status", "Courier", "Tracking"]];
    list.forEach((o) => rows.push([o.orderNumber, dateTime(o.createdAt), o.customer.fullName, o.customer.phone, o.customer.email, o.customer.city, o.customer.address,
      o.items.map((i) => `${i.name} ${i.weight} x${i.quantity}`).join("; "), o.subtotal, o.shipping, o.total, A.payMethod(o.paymentMethod), o.paymentStatus, A.statusLabel(o.status), o.courier || "", o.trackingNumber || ""]));
    A.csv(`orders-${A.dayKey(Date.now())}.csv`, rows); A.toast(`Exported ${list.length} order${list.length === 1 ? "" : "s"}`);
  }

  /* ---------- order drawer ---------- */
  async function openOrder(number) {
    const o = A.orders.list.find((x) => x.orderNumber === number); if (!o) return A.toast("Order not found. Try refreshing.", "error");
    if (!drawerCtl || !drawerCtl.el.isConnected) { drawerCtl = A.drawer({ beforeClose: null }); drawerCtl.el.addEventListener("transitionend", () => {}); }
    paint(o);
  }
  function paint(o) {
    const d = drawerCtl, c = o.customer, next = A.NEXT[o.status] || [];
    d.setTitle(o.orderNumber, `${A.statusBadge(o.status)} ${A.payBadge(o)} <span class="muted">· placed ${esc(dateTime(o.createdAt))}</span>`);
    const dispatching = o.status === "processing";
    const primary = { confirmed: ["Confirm order", "confirmed"], processing: ["Start processing", "processing"], delivered: ["Mark delivered", "delivered"] };
    const mainAction = next.find((s) => primary[s]);
    const codDue = o.status === "delivered" && o.paymentMethod === "cod" && o.paymentStatus !== "paid";
    const phone = esc(c.phone || ""), wa = c.phone ? A.waLink(c.phone) : "";
    d.body.innerHTML = `
      ${next.length || codDue ? `<div class="sec"><h3>Next step</h3>
        ${dispatching ? `<div class="row2"><div class="field"><label for="dCourier">Courier</label><input class="input" id="dCourier" list="couriers" placeholder="e.g. TCS or own rider" value="${esc(o.courier || "")}" /><datalist id="couriers">${["TCS", "Leopards", "M&P", "Trax", "PostEx", "Pakistan Post", "Own rider"].map((x) => `<option value="${esc(x)}">`).join("")}</datalist></div>
          <div class="field"><label for="dTrack">Tracking number</label><input class="input" id="dTrack" placeholder="Tracking / reference" value="${esc(o.trackingNumber || "")}" /></div></div>
          <div class="field"><label for="dUrl">Tracking link <span class="muted">(optional, https://)</span></label><input class="input" id="dUrl" placeholder="https://…" value="${esc(o.trackingUrl || "")}" /></div><div class="err" id="dErr" role="alert" hidden></div>` : ""}
        <div class="steps">
          ${mainAction ? `<button class="btn primary" data-go="${mainAction}">${esc(primary[mainAction][0])}</button>` : ""}
          ${dispatching ? `<button class="btn gold" data-go="out_for_delivery">${icon("truck")}Dispatch order</button>` : ""}
          ${codDue ? `<button class="btn gold" id="collect">${icon("cash")}Mark ${pkr(o.total)} collected</button>` : ""}
          ${next.includes("cancelled") ? `<button class="btn danger" data-go="cancelled">Cancel order</button>` : ""}
        </div>${o.status === "pending_whatsapp_confirmation" ? `<p class="muted mt" style="font-size:.8rem">The customer is asked to confirm on WhatsApp. You can also confirm manually after speaking with them.</p>` : ""}</div>` : ""}
      <div class="sec"><h3>Customer ${c.phone ? `<span class="steps"><a class="btn sm" href="tel:${phone}">${icon("phone")}Call</a><a class="btn sm" href="${esc(wa)}" target="_blank" rel="noopener">${icon("chat")}WhatsApp</a></span>` : ""}</h3>
        <dl class="kv"><dt>Name</dt><dd>${esc(c.fullName || "—")}</dd><dt>Phone</dt><dd>${phone || "—"}</dd><dt>Email</dt><dd>${c.email ? `<a class="link" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : "—"}</dd>
        <dt>Deliver to</dt><dd>${esc(c.address || "—")}<br>${esc([c.city, c.postalCode].filter(Boolean).join(" "))} <button class="btn sm ghost" data-copy>${icon("copy")}Copy</button></dd>
        <dt>Notes</dt><dd>${c.notes ? esc(c.notes) : '<span class="muted">None</span>'}</dd></dl>
        ${c.phone ? `<a class="btn sm mt" href="customers.html?q=${encodeURIComponent(A.digits(c.phone).slice(-10))}">Customer history</a>` : ""}</div>
      <div class="sec"><h3>Items</h3><div class="items">${o.items.map((i) => `<div class="it">${i.image ? `<img class="thumb" src="${esc(A.imgSrc(i.image))}" alt="" />` : `<div class="thumb empty">${icon("image")}</div>`}<div class="grow"><div class="strong">${esc(i.name)}</div><div class="sub muted">${esc(i.weight)} × ${num(i.quantity)} @ ${pkr(i.unitPrice)}</div></div><b>${pkr(Number(i.unitPrice) * Number(i.quantity))}</b></div>`).join("")}</div>
        <div class="sum"><div><span>Subtotal</span><span>${pkr(o.subtotal)}</span></div><div><span>Shipping</span><span>${o.shipping ? pkr(o.shipping) : "Free"}</span></div><div class="tot"><span>Total</span><span>${pkr(o.total)}</span></div></div></div>
      <div class="sec"><h3>Payment</h3><dl class="kv"><dt>Method</dt><dd>${esc(A.payMethod(o.paymentMethod))}</dd><dt>Status</dt><dd>${A.payBadge(o)}</dd></dl></div>
      ${o.courier || o.trackingNumber ? `<div class="sec"><h3>Delivery</h3><dl class="kv"><dt>Courier</dt><dd>${esc(o.courier || "—")}</dd><dt>Tracking</dt><dd>${esc(o.trackingNumber || "—")}</dd>${o.trackingUrl ? `<dt>Link</dt><dd><a class="link" href="${esc(o.trackingUrl)}" target="_blank" rel="noopener">Track shipment</a></dd>` : ""}</dl></div>` : ""}
      <div class="sec"><h3>Timeline</h3><ul class="timeline" id="tl"><li><b>Loading…</b></li></ul></div>`;
    d.footer.innerHTML = `<button class="btn left" id="print">${icon("print")}Print invoice</button><button class="btn" data-x2>Close</button>`;
    A.$("[data-x2]", d.footer).onclick = () => d.close(); A.$("#print", d.footer).onclick = () => printInvoice(o);
    A.$("[data-copy]", d.body)?.addEventListener("click", () => navigator.clipboard?.writeText(`${c.fullName}\n${c.phone}\n${c.address}\n${c.city} ${c.postalCode || ""}`.trim()).then(() => A.toast("Address copied")));
    A.$$("[data-go]", d.body).forEach((b) => (b.onclick = () => act(o, b.dataset.go, b)));
    A.$("#collect", d.body)?.addEventListener("click", (e) => collect(o, e.currentTarget));
    A.orders.events(o.id).then((ev) => {
      const tl = A.$("#tl", d.body); if (!tl) return;
      tl.innerHTML = ev.length ? ev.map((e) => `<li><b>${esc(A.statusLabel(e.to_status))}</b><small>${esc(dateTime(e.created_at))}${e.note ? " · " + esc(e.note) : ""}</small></li>`).join("") : `<li><b>Order placed</b><small>${esc(dateTime(o.createdAt))}</small></li>`;
    }).catch(() => { const tl = A.$("#tl", d.body); if (tl) tl.innerHTML = `<li><b>Order placed</b><small>${esc(dateTime(o.createdAt))}</small></li>`; });
  }
  async function act(o, to, btn) {
    const extra = {}, err = A.$("#dErr", drawerCtl.body);
    if (to === "cancelled" && !(await A.confirmBox({ title: `Cancel ${o.orderNumber}?`, message: "Reserved stock goes back to inventory and the customer is notified. This can’t be undone.", confirm: "Cancel order", danger: true }))) return;
    if (to === "out_for_delivery") {
      const f = (id) => A.$(id, drawerCtl.body)?.value.trim() || "";
      extra.courier = f("#dCourier") || o.courier || ""; extra.trackingNumber = f("#dTrack") || o.trackingNumber || ""; extra.trackingUrl = f("#dUrl") || o.trackingUrl || "";
      const bad = !extra.courier || !extra.trackingNumber ? "Enter the courier and a tracking number before dispatching." : extra.trackingUrl && !/^https:\/\//.test(extra.trackingUrl) ? "The tracking link must start with https://" : "";
      if (bad) { if (err) { err.textContent = bad; err.hidden = false; } else A.toast(bad, "error"); return; }
    }
    btn.disabled = true;
    try { await A.orders.transition(o.orderNumber, to, extra); await refreshAfter(o.orderNumber, `Order ${A.statusLabel(to).toLowerCase()}`); }
    catch (e) { btn.disabled = false; A.toast(e.message, "error"); }
  }
  async function collect(o, btn) {
    if (!(await A.confirmBox({ title: "Record cash collected?", message: `Confirm you received ${pkr(o.total)} in cash for ${o.orderNumber}.`, confirm: "Yes, collected" }))) return;
    btn.disabled = true;
    try { await A.orders.collectCod(o.orderNumber); await refreshAfter(o.orderNumber, "Payment recorded"); } catch (e) { btn.disabled = false; A.toast(e.message, "error"); }
  }
  async function refreshAfter(number, msg) { await A.orders.load(); lastLoad = Date.now(); render(); A.refreshBadges(); A.toast(msg); const o = A.orders.list.find((x) => x.orderNumber === number); if (o && drawerCtl?.el.isConnected) paint(o); }

  function printInvoice(o) {
    const c = o.customer, w = window.open("", "_blank");
    if (!w) return A.toast("Allow pop-ups to print the invoice.", "error");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(o.orderNumber)}</title><style>
      body{font:14px/1.5 "Segoe UI",system-ui,sans-serif;color:#222;max-width:720px;margin:32px auto;padding:0 20px}h1{font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin:18px 0}
      th,td{padding:8px 6px;border-bottom:1px solid #ddd;text-align:left}th:last-child,td:last-child,th:nth-child(3),td:nth-child(3){text-align:right}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #222;padding-bottom:14px}
      .tot td{border:0;padding:3px 6px}.muted{color:#666}@media print{button{display:none}}</style></head><body>
      <div class="top"><div><h1>Ludhiana Sweets</h1><div class="muted">Sargodha, Pakistan</div></div><div style="text-align:right"><b>Invoice</b><br>${esc(o.orderNumber)}<br><span class="muted">${esc(dateTime(o.createdAt))}</span></div></div>
      <p><b>Deliver to</b><br>${esc(c.fullName)}<br>${esc(c.phone)}<br>${esc(c.address)}<br>${esc([c.city, c.postalCode].filter(Boolean).join(" "))}</p>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${o.items.map((i) => `<tr><td>${esc(i.name)} <span class="muted">${esc(i.weight)}</span></td><td>${num(i.quantity)}</td><td>${pkr(Number(i.unitPrice) * Number(i.quantity))}</td></tr>`).join("")}</tbody></table>
      <table class="tot" style="width:240px;margin-left:auto"><tr><td>Subtotal</td><td>${pkr(o.subtotal)}</td></tr><tr><td>Shipping</td><td>${o.shipping ? pkr(o.shipping) : "Free"}</td></tr><tr><td><b>Total</b></td><td><b>${pkr(o.total)}</b></td></tr></table>
      <p class="muted">Payment: ${esc(A.payMethod(o.paymentMethod))} — ${o.paymentStatus === "paid" ? "Paid" : "Due on delivery"}</p><p class="muted">Thank you for shopping with Ludhiana Sweets.</p>
      <button onclick="print()">Print</button><script>onload=()=>setTimeout(print,300)<\/script></body></html>`);
    w.document.close();
  }

  /* ---------- wire up ---------- */
  A.$("#q").oninput = A.debounce((e) => { S.q = e.target.value; S.page = 1; render(); });
  [["pay", "pay"], ["when", "when"], ["sort", "sort"]].forEach(([id, k]) => (A.$("#" + id).onchange = (e) => { S[k] = e.target.value; S.page = 1; render(); }));
  A.$("#refresh").onclick = async (e) => { e.currentTarget.disabled = true; await load(); e.currentTarget.disabled = false; A.toast("Orders refreshed"); };
  A.$("#exportCsv").onclick = () => { const r = filtered(); if (!r.length) return A.toast("No orders to export", "error"); exportCsv(r); };
  document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - lastLoad > 120000) load(true); });

  await load();
  if (qs.get("order")) openOrder(qs.get("order"));
});
