/* Overview: KPIs, sales chart, work queue, top products, low stock. */
A.start({ page: "dashboard", title: "Overview" }, async (main) => {
  const { esc, pkr, num, icon, date, ago } = A;
  let range = [7, 30, 90].includes(Number(A.store.get("range", 30))) ? Number(A.store.get("range", 30)) : 30;
  let metric = "sales";
  main.innerHTML = `<div class="page-head"><div><h1>Overview</h1><p>How the shop is doing, and what needs you today.</p></div></div>
    <div class="grid g4">${'<div class="card kpi"><div class="skel" style="width:50%"></div><div class="skel" style="height:28px;width:70%;margin:10px 0"></div></div>'.repeat(4)}</div>`;

  const pendingReviews = async () => { const r = await supabaseClient.from("reviews").select("id", { count: "exact", head: true }).eq("approved", false); return r.count || 0; };
  const [orders, products, reviewsPending] = await Promise.all([A.orders.load(), A.catalog.load(), pendingReviews().catch(() => 0)]);
  const compact = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(Math.round(n)));
  const oldest = orders.length ? orders[orders.length - 1].ts : Infinity;
  const covers = (t) => !A.orders.truncated || oldest <= t;

  const agg = (list) => {
    const valid = list.filter((o) => o.status !== "cancelled");
    const sales = valid.reduce((s, o) => s + o.total, 0);
    return { sales, count: valid.length, aov: valid.length ? sales / valid.length : 0, cancelled: list.length - valid.length, total: list.length,
      collected: valid.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + o.total, 0),
      units: valid.reduce((s, o) => s + o.items.reduce((n, i) => n + (Number(i.quantity) || 0), 0), 0) };
  };
  const delta = (c, p, ok) => {
    if (!ok) return "";
    if (!p) return c ? '<span class="delta up">New</span>' : "";
    const d = ((c - p) / p) * 100; if (Math.abs(d) < 0.5) return '<span class="delta flat">0%</span>';
    return `<span class="delta ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(0)}%</span>`;
  };

  function draw() {
    const start = A.startOfDay(new Date(Date.now() - (range - 1) * 864e5)).getTime(), prevStart = start - range * 864e5;
    const cur = orders.filter((o) => o.ts >= start), prev = orders.filter((o) => o.ts >= prevStart && o.ts < start);
    const c = agg(cur), p = agg(prev), prevOk = covers(prevStart), curOk = covers(start);

    /* work queue (all loaded orders, not just the range) */
    const awaiting = orders.filter((o) => ["pending", "pending_whatsapp_confirmation"].includes(o.status));
    const toShip = orders.filter((o) => ["confirmed", "processing"].includes(o.status));
    const codDue = orders.filter((o) => o.status === "delivered" && o.paymentMethod === "cod" && o.paymentStatus !== "paid");
    const codSum = codDue.reduce((s, o) => s + o.total, 0);
    const lowVariants = products.flatMap((pr) => pr.variants.map((v) => ({ pr, v }))).filter(({ v }) => A.catalog.variantState(v) !== "ok").sort((a, b) => a.v.stock - b.v.stock);
    const tile = (href, tone, ic, n, label) => `<a class="attn tone-${tone}" href="${href}"><div class="ic">${icon(ic)}</div><div><b>${n}</b><span>${label}</span></div></a>`;

    /* chart data */
    const days = []; for (let i = range - 1; i >= 0; i--) { const d = A.startOfDay(new Date(Date.now() - i * 864e5)); days.push({ d, k: A.dayKey(d), sales: 0, count: 0 }); }
    const byDay = new Map(days.map((x) => [x.k, x]));
    cur.filter((o) => o.status !== "cancelled").forEach((o) => { const x = byDay.get(A.dayKey(o.ts)); if (x) { x.sales += o.total; x.count++; } });

    /* status split */
    const order = ["pending_whatsapp_confirmation", "pending", "confirmed", "processing", "out_for_delivery", "delivered", "cancelled"];
    const colors = { pending_whatsapp_confirmation: "#D99A22", pending: "#E7B955", confirmed: "#4F7FBF", processing: "#2F5F9A", out_for_delivery: "#C89B3C", delivered: "#2E9460", cancelled: "#C4574B" };
    const tab = { pending_whatsapp_confirmation: "awaiting", pending: "awaiting", confirmed: "toship", processing: "toship", out_for_delivery: "road", delivered: "delivered", cancelled: "cancelled" };
    const split = order.map((s) => ({ s, n: cur.filter((o) => o.status === s).length })).filter((x) => x.n);

    /* top products */
    const tp = new Map();
    cur.filter((o) => o.status !== "cancelled").forEach((o) => o.items.forEach((i) => {
      const key = i.productId || i.name, r = tp.get(key) || { name: i.name, image: i.image, qty: 0, rev: 0 };
      r.qty += Number(i.quantity) || 0; r.rev += (Number(i.unitPrice) || 0) * (Number(i.quantity) || 0); tp.set(key, r);
    }));
    const top = [...tp.values()].sort((a, b) => b.rev - a.rev).slice(0, 5), topMax = top[0]?.rev || 1;
    const thumb = (src) => (src ? `<img class="thumb" src="${esc(A.imgSrc(src))}" alt="" />` : `<div class="thumb empty">${icon("image")}</div>`);

    main.innerHTML = `
    <div class="page-head"><div><h1>Overview</h1><p>How the shop is doing, and what needs you today.</p></div>
      <div class="head-actions"><div class="seg" role="group" aria-label="Date range">${[7, 30, 90].map((n) => `<button data-range="${n}" class="${n === range ? "active" : ""}">${n} days</button>`).join("")}</div>
      <button class="btn" id="refresh">${icon("refresh")}Refresh</button></div></div>
    ${!curOk ? `<div class="note warn">${icon("alert")}<span>Only the newest ${A.ORDER_LIMIT} orders are loaded, so figures for this period may be incomplete.</span></div>` : ""}
    <div class="grid g4 mb">
      ${tile("orders.html?status=awaiting", "warn", "clock", awaiting.length, "Awaiting confirmation")}
      ${tile("orders.html?status=toship", "info", "box", toShip.length, "To pack &amp; ship")}
      ${tile("orders.html?status=delivered&pay=unpaid", "gold", "cash", pkr(codSum), `COD to collect (${codDue.length})`)}
      ${tile("inventory.html?stock=low", lowVariants.length ? "bad" : "ok", "layers", lowVariants.length, "Low or out-of-stock sizes")}
    </div>
    <div class="grid g4 mb">
      <div class="card kpi"><div class="k-l">Sales</div><div class="k-v">${pkr(c.sales)}</div><div class="k-d">${delta(c.sales, p.sales, prevOk && curOk)} vs previous ${range} days</div></div>
      <div class="card kpi"><div class="k-l">Cash collected</div><div class="k-v">${pkr(c.collected)}</div><div class="k-d">${c.sales ? Math.round((c.collected / c.sales) * 100) : 0}% of sales paid</div></div>
      <div class="card kpi"><div class="k-l">Orders</div><div class="k-v">${num(c.count)}</div><div class="k-d">${delta(c.count, p.count, prevOk && curOk)} ${c.cancelled ? `${c.cancelled} cancelled` : "none cancelled"}</div></div>
      <div class="card kpi"><div class="k-l">Average order</div><div class="k-v">${pkr(c.aov)}</div><div class="k-d">${num(c.units)} items sold</div></div>
    </div>
    <div class="grid g2-1 mb">
      <div class="card"><div class="card-h"><div><h2>Sales</h2><div class="sub">Excludes cancelled orders</div></div><div class="seg"><button data-metric="sales" class="${metric === "sales" ? "active" : ""}">Sales</button><button data-metric="count" class="${metric === "count" ? "active" : ""}">Orders</button></div></div>
        <div class="card-b"><div class="chart" id="chart"></div></div></div>
      <div class="card"><div class="card-h"><h2>Orders by status</h2><span class="sub">${c.total} in period</span></div><div class="card-b">
        ${split.length ? `<div class="stackbar" role="img" aria-label="Order status split">${split.map((x) => `<i style="flex:${x.n};background:${colors[x.s]}" title="${esc(A.statusLabel(x.s))}: ${x.n}"></i>`).join("")}</div>
        <div class="legend">${split.map((x) => `<a href="orders.html?status=${tab[x.s]}"><i style="background:${colors[x.s]}"></i>${esc(A.statusLabel(x.s))}<b>${x.n}</b></a>`).join("")}</div>` : '<div class="empty" style="padding:30px 0"><p>No orders in this period.</p></div>'}
      </div></div>
    </div>
    <div class="grid g2-1 mb">
      <div class="card"><div class="card-h"><h2>Recent orders</h2><a class="btn sm" href="orders.html">View all</a></div>
        ${orders.length ? `<div class="table-wrap" style="border:0;box-shadow:none;border-radius:0"><table class="t"><tbody>${orders.slice(0, 7).map((o) => `<tr class="click" data-order="${esc(o.orderNumber)}"><td><span class="strong">${esc(o.orderNumber)}</span><div class="sub">${ago(o.createdAt)}</div></td><td>${esc(o.customer.fullName || "—")}<div class="sub">${esc(o.customer.city || "")}</div></td><td class="r strong">${pkr(o.total)}</td><td>${A.statusBadge(o.status)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">${icon("bag")}<h3>No orders yet</h3><p>Orders placed on the storefront will appear here.</p></div>`}</div>
      <div class="card"><div class="card-h"><h2>Top products</h2><span class="sub">By sales</span></div>
        ${top.length ? top.map((t) => `<div class="list-row">${thumb(t.image)}<div class="grow"><div class="t1">${esc(t.name)}</div><div class="t2">${num(t.qty)} sold</div><div class="meter" style="margin-top:5px"><i style="width:${Math.max(4, (t.rev / topMax) * 100)}%"></i></div></div><b>${pkr(t.rev)}</b></div>`).join("") : '<div class="empty"><p>No sales in this period.</p></div>'}</div>
    </div>
    <div class="card"><div class="card-h"><h2>Stock to review</h2><a class="btn sm" href="inventory.html">Open inventory</a></div>
      ${lowVariants.length ? lowVariants.slice(0, 6).map(({ pr, v }) => `<div class="list-row">${thumb(pr.images[0])}<div class="grow"><div class="t1">${esc(pr.name)} · ${esc(v.weight)}</div><div class="t2">${num(v.stock)} left</div></div>${A.stockBadge(A.catalog.variantState(v))}</div>`).join("") : `<div class="empty">${icon("check")}<h3>Stock looks healthy</h3><p>No sizes at or below ${A.lowStockLimit()} units.</p></div>`}
    </div>
    ${reviewsPending ? `<a class="note mt" href="reviews.html">${icon("star")}<span>${reviewsPending} customer review${reviewsPending > 1 ? "s are" : " is"} waiting for approval.</span></a>` : ""}`;

    drawChart(days);
    A.$$("[data-range]", main).forEach((b) => (b.onclick = () => { range = Number(b.dataset.range); A.store.set("range", range); draw(); }));
    A.$$("[data-metric]", main).forEach((b) => (b.onclick = () => { metric = b.dataset.metric; draw(); }));
    A.$$("[data-order]", main).forEach((r) => (r.onclick = () => (location.href = "orders.html?order=" + encodeURIComponent(r.dataset.order))));
    A.$("#refresh", main).onclick = async (e) => { e.currentTarget.disabled = true; try { await Promise.all([A.orders.load(), A.catalog.load()]); draw(); } catch (x) { A.toast(x.message, "error"); } };
  }

  function drawChart(days) {
    const el = A.$("#chart", main), W = 760, H = 230, pl = 42, pb = 24, pt = 8, iw = W - pl - 6, ih = H - pb - pt;
    const val = (d) => (metric === "sales" ? d.sales : d.count), max = Math.max(1, ...days.map(val));
    const mag = Math.pow(10, Math.floor(Math.log10(max / 4))), step = max <= 4 ? 1 : mag * ([1, 2, 5, 10].find((m) => mag * m * 4 >= max) || 10);
    const top = Math.ceil(max / step) * step, bw = iw / days.length, gap = Math.min(4, bw * 0.25);
    let g = ""; for (let v = 0; v <= top; v += step) { const y = pt + ih - (v / top) * ih; g += `<line class="grid-l" x1="${pl}" x2="${W - 6}" y1="${y}" y2="${y}"/><text class="axis" x="${pl - 6}" y="${y + 3}" text-anchor="end">${metric === "sales" ? compact(v) : v}</text>`; }
    const every = Math.ceil(days.length / 7);
    const bars = days.map((d, i) => { const h = (val(d) / top) * ih, hh = Math.max(h, val(d) ? 2 : 0), x = pl + i * bw + gap / 2; return `<rect class="bar" data-i="${i}" x="${x}" y="${pt + ih - hh}" width="${Math.max(1, bw - gap)}" height="${hh}" rx="2"/>${i % every === 0 ? `<text class="axis" x="${x + (bw - gap) / 2}" y="${H - 6}" text-anchor="middle">${d.d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</text>` : ""}`; }).join("");
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${metric === "sales" ? "Daily sales" : "Daily orders"} chart">${g}${bars}</svg><div class="chart-tip"></div>`;
    const tip = A.$(".chart-tip", el);
    A.$$(".bar", el).forEach((b) => {
      const show = () => { const d = days[b.dataset.i], r = b.getBoundingClientRect(), e = el.getBoundingClientRect(); tip.innerHTML = `${esc(date(d.d))}<br>${pkr(d.sales)} · ${d.count} order${d.count === 1 ? "" : "s"}`; tip.style.left = r.left - e.left + r.width / 2 + "px"; tip.style.top = r.top - e.top - 6 + "px"; tip.style.opacity = 1; };
      b.addEventListener("mouseenter", show); b.addEventListener("mouseleave", () => (tip.style.opacity = 0));
    });
  }
  draw();
});
