/* Customers: built from order history (the store has no customer accounts).
   Orders are grouped by phone number, falling back to email, then name. */
A.start({ page: "customers", title: "Customers" }, async (main) => {
  const { esc, pkr, num, icon, date, ago } = A;
  const PER = 25, qs = new URLSearchParams(location.search);
  const S = { tab: "all", q: qs.get("q") || "", sort: "recent", page: 1 };
  main.innerHTML = `<div class="page-head"><div><h1>Customers</h1><p>Everyone who has ordered, grouped by phone number.</p></div><div class="head-actions"><button class="btn" id="exportCsv">${icon("download")}Export CSV</button></div></div>
    <div id="notice"></div><div class="grid g4 mb" id="kpis"></div><div class="tabs" id="tabs"></div>
    <div class="toolbar"><div class="search">${icon("search")}<input class="input" id="q" placeholder="Search name, phone, email or city" aria-label="Search customers" value="${esc(S.q)}" /></div>
      <select class="select" id="sort" aria-label="Sort"><option value="recent">Most recent order</option><option value="orders">Most orders</option><option value="spent">Highest spend</option></select></div>
    <div id="list"><div class="card"><div class="card-b"><div class="skel"></div></div></div></div>`;

  let customers = [];
  function build() {
    const map = new Map();
    for (const o of A.orders.list) {
      const c = o.customer, ph = A.digits(c.phone).slice(-10), key = ph.length >= 10 ? "p" + ph : c.email ? "e" + String(c.email).toLowerCase() : "n" + String(c.fullName || o.orderNumber).toLowerCase();
      let x = map.get(key); if (!x) { x = { key, name: c.fullName || "Unknown", phone: c.phone || "", email: c.email || "", city: c.city || "", address: c.address || "", orders: [], spent: 0, count: 0 }; map.set(key, x); }
      x.orders.push(o); if (o.status !== "cancelled") { x.spent += o.total; x.count++; }
    }
    customers = [...map.values()].map((x) => { x.orders.sort((a, b) => b.ts - a.ts); const l = x.orders[0].customer; x.name = l.fullName || x.name; x.phone = l.phone || x.phone; x.email = l.email || x.email; x.city = l.city || x.city; x.address = l.address || x.address; x.last = x.orders[0].ts; x.first = x.orders[x.orders.length - 1].ts; x.aov = x.count ? x.spent / x.count : 0; return x; });
  }
  function render() {
    const TABS = [["all", "All", () => true], ["repeat", "Repeat customers", (c) => c.count >= 2], ["new", "First-time", (c) => c.count === 1], ["open", "Order in progress", (c) => c.orders.some((o) => A.isOpen(o.status))]];
    const month = Date.now() - 30 * 864e5, newCount = customers.filter((c) => c.first >= month).length;
    A.$("#kpis").innerHTML = `<div class="card kpi"><div class="k-l">Customers</div><div class="k-v">${num(customers.length)}</div><div class="k-d">${newCount} new in the last 30 days</div></div>
      <div class="card kpi"><div class="k-l">Repeat customers</div><div class="k-v">${customers.length ? Math.round((customers.filter((c) => c.count >= 2).length / customers.length) * 100) : 0}%</div><div class="k-d">${customers.filter((c) => c.count >= 2).length} ordered more than once</div></div>
      <div class="card kpi"><div class="k-l">Average spend</div><div class="k-v">${pkr(customers.length ? customers.reduce((s, c) => s + c.spent, 0) / customers.length : 0)}</div><div class="k-d">Per customer, excl. cancelled</div></div>
      <div class="card kpi"><div class="k-l">Top customer</div><div class="k-v" style="font-size:1.2rem">${esc([...customers].sort((a, b) => b.spent - a.spent)[0]?.name || "—")}</div><div class="k-d">${pkr([...customers].sort((a, b) => b.spent - a.spent)[0]?.spent || 0)} spent</div></div>`;
    A.$("#tabs").innerHTML = TABS.map(([id, l, f]) => `<button data-tab="${id}" class="${id === S.tab ? "active" : ""}">${l}<span class="n">${customers.filter(f).length}</span></button>`).join("");
    A.$$("[data-tab]").forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; S.page = 1; render(); }));
    const q = S.q.toLowerCase().trim(), fn = TABS.find((t) => t[0] === S.tab)[2];
    const rows = customers.filter((c) => fn(c) && (!q || `${c.name} ${c.phone} ${c.email} ${c.city}`.toLowerCase().includes(q)));
    rows.sort(S.sort === "orders" ? (a, b) => b.count - a.count || b.last - a.last : S.sort === "spent" ? (a, b) => b.spent - a.spent : (a, b) => b.last - a.last);
    const pages = Math.max(1, Math.ceil(rows.length / PER)); S.page = Math.min(S.page, pages); const slice = rows.slice((S.page - 1) * PER, S.page * PER), el = A.$("#list");
    if (!slice.length) { el.innerHTML = `<div class="card"><div class="empty">${icon("users")}<h3>${customers.length ? "No customers match" : "No customers yet"}</h3><p>${customers.length ? "Try a different search." : "Customers appear here after their first order."}</p></div></div>`; return; }
    el.innerHTML = `<div class="table-wrap"><table class="t"><thead><tr><th>Customer</th><th>Contact</th><th class="r">Orders</th><th class="r">Total spent</th><th class="r">Average order</th><th>Last order</th></tr></thead><tbody>
      ${slice.map((c) => `<tr class="click" data-c="${esc(c.key)}"><td><div class="cell"><div class="avatar">${esc(A.initials(c.name))}</div><div><div class="strong">${esc(c.name)}</div><div class="sub">${esc(c.city)}</div></div></div></td>
        <td>${esc(c.phone || "—")}<div class="sub">${esc(c.email)}</div></td><td class="r">${c.orders.length}${c.count >= 2 ? ' <span class="badge plain b-gold">Repeat</span>' : ""}</td><td class="r strong">${pkr(c.spent)}</td><td class="r">${pkr(c.aov)}</td><td>${ago(c.orders[0].createdAt)}</td></tr>`).join("")}</tbody></table></div>
      <div class="pager"><span>Showing ${(S.page - 1) * PER + 1}–${(S.page - 1) * PER + slice.length} of ${rows.length}</span><div class="btns"><button class="btn sm" id="prev" ${S.page <= 1 ? "disabled" : ""}>Previous</button><button class="btn sm" id="next" ${S.page >= pages ? "disabled" : ""}>Next</button></div></div>`;
    A.$$("[data-c]", el).forEach((r) => (r.onclick = () => open(customers.find((c) => c.key === r.dataset.c))));
    A.$("#prev").onclick = () => { S.page--; render(); }; A.$("#next").onclick = () => { S.page++; render(); };
  }
  function open(c) {
    const d = A.drawer({ title: c.name, sub: `<span class="muted">Customer since ${esc(date(c.first))}</span>` });
    d.body.innerHTML = `<div class="grid g2 mb"><div class="card kpi"><div class="k-l">Total spent</div><div class="k-v">${pkr(c.spent)}</div><div class="k-d">${c.count} order${c.count === 1 ? "" : "s"} (excl. cancelled)</div></div><div class="card kpi"><div class="k-l">Average order</div><div class="k-v">${pkr(c.aov)}</div><div class="k-d">Last order ${esc(ago(c.orders[0].createdAt))}</div></div></div>
      <div class="sec"><h3>Contact ${c.phone ? `<span class="steps"><a class="btn sm" href="tel:${esc(c.phone)}">${icon("phone")}Call</a><a class="btn sm" href="${esc(A.waLink(c.phone))}" target="_blank" rel="noopener">${icon("chat")}WhatsApp</a></span>` : ""}</h3>
        <dl class="kv"><dt>Phone</dt><dd>${esc(c.phone || "—")}</dd><dt>Email</dt><dd>${c.email ? `<a class="link" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : "—"}</dd><dt>Latest address</dt><dd>${esc(c.address || "—")}${c.city ? ", " + esc(c.city) : ""}</dd></dl></div>
      <div class="sec" style="padding:0"><h3 style="padding:16px 16px 0">Orders (${c.orders.length})</h3>${c.orders.map((o) => `<a class="list-row" href="orders.html?order=${encodeURIComponent(o.orderNumber)}"><div class="grow"><div class="t1">${esc(o.orderNumber)}</div><div class="t2">${esc(date(o.createdAt))} · ${o.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)} items</div></div>${A.statusBadge(o.status)}<b>${pkr(o.total)}</b></a>`).join("")}</div>`;
    d.footer.innerHTML = `<button class="btn" data-x2>Close</button>`; A.$("[data-x2]", d.footer).onclick = () => d.close();
  }
  A.$("#q").oninput = A.debounce((e) => { S.q = e.target.value; S.page = 1; render(); });
  A.$("#sort").onchange = (e) => { S.sort = e.target.value; render(); };
  A.$("#exportCsv").onclick = () => { const rows = [["Name", "Phone", "Email", "City", "Orders", "Total spent (PKR)", "Average order (PKR)", "First order", "Last order"]]; customers.forEach((c) => rows.push([c.name, c.phone, c.email, c.city, c.orders.length, c.spent, Math.round(c.aov), date(c.first), date(c.last)])); A.csv(`customers-${A.dayKey(Date.now())}.csv`, rows); A.toast("Customers exported"); };
  try { await A.orders.load(); } catch (e) { return A.errorPanel(A.$("#list"), e, () => location.reload()); }
  if (A.orders.truncated) A.$("#notice").innerHTML = `<div class="note warn">${icon("alert")}<span>Built from the newest ${A.ORDER_LIMIT} orders, so older customers may be missing.</span></div>`;
  build(); render();
});
