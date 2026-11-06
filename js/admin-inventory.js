/* Inventory: every size of every product on one screen. Edit stock and price
   inline, review several changes, then save them together. */
A.start({ page: "inventory", title: "Inventory" }, async (main) => {
  const { esc, pkr, num, icon } = A;
  const qs = new URLSearchParams(location.search);
  const S = { tab: ["low", "out", "ok"].includes(qs.get("stock")) ? qs.get("stock") : "all", q: "", cat: "" };
  const dirty = new Map(); // variant id -> { price, stock }
  main.innerHTML = `<div class="page-head"><div><h1>Inventory</h1><p>Update stock counts and prices for every size in one place.</p></div>
    <div class="head-actions"><button class="btn" id="exportCsv">${icon("download")}Export CSV</button><button class="btn" id="refresh">${icon("refresh")}Refresh</button></div></div>
    <div class="grid g4 mb" id="kpis"></div><div class="tabs" id="tabs"></div>
    <div class="toolbar"><div class="search">${icon("search")}<input class="input" id="q" placeholder="Search product or size" aria-label="Search inventory" /></div><select class="select" id="cat" aria-label="Category"></select></div>
    <div id="list"><div class="card"><div class="card-b"><div class="skel"></div></div></div></div><div id="bar"></div>`;

  const flat = () => A.catalog.list.flatMap((p) => p.variants.map((v) => ({ p, v })));
  const lim = () => A.lowStockLimit();
  const find = (id) => flat().find((x) => x.v.id === id);
  const cur = (v) => dirty.get(v.id) || { price: v.price, stock: v.stock };

  function kpis() {
    const f = flat(), units = f.reduce((s, x) => s + x.v.stock, 0), value = f.reduce((s, x) => s + x.v.stock * x.v.price, 0);
    const low = f.filter((x) => A.catalog.variantState(x.v) === "low").length, out = f.filter((x) => A.catalog.variantState(x.v) === "out").length;
    A.$("#kpis").innerHTML = `<div class="card kpi"><div class="k-l">Units in stock</div><div class="k-v">${num(units)}</div><div class="k-d">${f.length} size${f.length === 1 ? "" : "s"} across ${A.catalog.list.length} products</div></div>
      <div class="card kpi"><div class="k-l">Stock value (at sale price)</div><div class="k-v">${pkr(value)}</div><div class="k-d">Units × current price</div></div>
      <div class="card kpi"><div class="k-l">Low stock</div><div class="k-v">${low}</div><div class="k-d">${lim()} units or fewer · <a class="link" href="settings.html">change</a></div></div>
      <div class="card kpi"><div class="k-l">Out of stock</div><div class="k-v">${out}</div><div class="k-d">Can’t be ordered right now</div></div>`;
  }

  function render() {
    const f = flat(), TABS = [["all", "All sizes", () => true], ["low", "Low stock", (x) => A.catalog.variantState(x.v) === "low"], ["out", "Out of stock", (x) => A.catalog.variantState(x.v) === "out"], ["ok", "In stock", (x) => A.catalog.variantState(x.v) === "ok"]];
    kpis();
    A.$("#tabs").innerHTML = TABS.map(([id, l, fn]) => `<button data-tab="${id}" class="${id === S.tab ? "active" : ""}">${l}<span class="n">${f.filter(fn).length}</span></button>`).join("");
    A.$$("[data-tab]").forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; render(); }));
    const cats = [...new Set(A.catalog.list.map((p) => p.category).filter(Boolean))].sort();
    A.$("#cat").innerHTML = `<option value="">All categories</option>` + cats.map((c) => `<option ${c === S.cat ? "selected" : ""}>${esc(c)}</option>`).join("");
    const q = S.q.toLowerCase().trim(), fn = TABS.find((t) => t[0] === S.tab)[2];
    const rows = f.filter((x) => fn(x) && (!S.cat || x.p.category === S.cat) && (!q || `${x.p.name} ${x.v.weight}`.toLowerCase().includes(q)));
    const el = A.$("#list");
    if (!rows.length) { el.innerHTML = `<div class="card"><div class="empty">${icon("layers")}<h3>${f.length ? "Nothing here" : "No sizes yet"}</h3><p>${f.length ? "No sizes match this view." : "Add products with sizes on the Products page."}</p></div></div>`; return; }
    el.innerHTML = `<div class="table-wrap"><table class="t"><thead><tr><th>Product</th><th>Size</th><th>Price (Rs)</th><th>Stock</th><th>Status</th><th class="r">Stock value</th></tr></thead><tbody>
      ${rows.map(({ p, v }) => { const c = cur(v); return `<tr data-row="${esc(v.id)}" class="${dirty.has(v.id) ? "dirty" : ""}"><td><div class="cell">${p.images[0] ? `<img class="thumb" src="${esc(A.imgSrc(p.images[0]))}" alt="" loading="lazy" />` : `<div class="thumb empty">${icon("image")}</div>`}<div><div class="strong">${esc(p.name)}</div><div class="sub">${esc(p.category || "")}</div></div></div></td>
        <td class="strong">${esc(v.weight)}</td>
        <td><input class="input" style="width:110px" type="number" min="1" step="1" data-id="${esc(v.id)}" data-f="price" value="${esc(c.price)}" aria-label="Price for ${esc(p.name)} ${esc(v.weight)}" /></td>
        <td><div class="stepper"><button data-step="-1" data-id="${esc(v.id)}" aria-label="Decrease stock">−</button><input type="number" min="0" step="1" data-id="${esc(v.id)}" data-f="stock" value="${esc(c.stock)}" aria-label="Stock for ${esc(p.name)} ${esc(v.weight)}" /><button data-step="1" data-id="${esc(v.id)}" aria-label="Increase stock">+</button></div></td>
        <td data-st>${A.stockBadge(A.catalog.variantState(v))}</td><td class="r" data-val>${pkr(c.stock * c.price)}</td></tr>`; }).join("")}</tbody></table></div><div class="pager"><span>${rows.length} size${rows.length === 1 ? "" : "s"}</span></div>`;
    A.$$("input[data-f]", el).forEach((i) => (i.oninput = () => onEdit(i.dataset.id)));
    A.$$("[data-step]", el).forEach((b) => (b.onclick = () => { const i = A.$(`input[data-f=stock][data-id="${CSS.escape(b.dataset.id)}"]`, el); i.value = Math.max(0, (parseInt(i.value, 10) || 0) + Number(b.dataset.step)); onEdit(b.dataset.id); }));
    bar();
  }

  function onEdit(id) {
    const x = find(id); if (!x) return; const row = A.$(`tr[data-row="${CSS.escape(id)}"]`);
    const price = Number(A.$("[data-f=price]", row).value), stock = Number(A.$("[data-f=stock]", row).value);
    if (price === x.v.price && stock === x.v.stock) dirty.delete(id); else dirty.set(id, { price, stock });
    row.classList.toggle("dirty", dirty.has(id));
    A.$("[data-val]", row).textContent = pkr((stock || 0) * (price || 0));
    A.$("[data-st]", row).innerHTML = A.stockBadge(stock <= 0 ? "out" : stock <= lim() ? "low" : "ok");
    bar();
  }

  function bar() {
    const n = dirty.size, box = A.$("#bar");
    box.innerHTML = n ? `<div class="savebar"><span>${n} unsaved change${n === 1 ? "" : "s"}</span><span class="spacer"></span><button class="btn sm" id="discard" style="color:#fff;background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.2)">Discard</button><button class="btn gold sm" id="saveAll">Save ${n} change${n === 1 ? "" : "s"}</button></div>` : "";
    if (!n) return;
    A.$("#discard").onclick = () => { dirty.clear(); render(); };
    A.$("#saveAll").onclick = save;
  }

  async function save() {
    const btn = A.$("#saveAll"), items = [...dirty].map(([id, c]) => ({ id, ...c, x: find(id) })).filter((i) => i.x);
    const badRow = items.find((i) => !Number.isInteger(i.price) || i.price <= 0 || !Number.isInteger(i.stock) || i.stock < 0);
    if (badRow) return A.toast(`Check ${badRow.x.p.name} ${badRow.x.v.weight}: use whole numbers, price above 0 and stock 0 or more.`, "error");
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      const stockEdits = items.filter((i) => i.stock !== i.x.v.stock);
      if (stockEdits.length) {
        const { data, error } = await supabaseClient.from("product_prices").select("id,stock").in("id", stockEdits.map((i) => i.id)); if (error) throw error;
        const moved = (data || []).filter((r) => r.stock !== find(r.id).v.stock).map((r) => { const x = find(r.id); return `${x.p.name} ${x.v.weight} (now ${r.stock})`; });
        if (moved.length && !(await A.confirmBox({ title: "Stock changed since you loaded this page", message: moved.join(", ") + ". Saving will overwrite those counts with the numbers you entered.", confirm: "Overwrite" }))) { btn.disabled = false; btn.textContent = `Save ${items.length} changes`; return; }
      }
      let fails = 0;
      for (const i of items) { const { error } = await supabaseClient.from("product_prices").update({ price: i.price, stock: i.stock }).eq("id", i.id); if (error) fails++; else dirty.delete(i.id); }
      await A.catalog.load(); render();
      fails ? A.toast(`${fails} change${fails > 1 ? "s" : ""} could not be saved. Check your connection and try again.`, "error") : A.toast(`${items.length} change${items.length === 1 ? "" : "s"} saved`);
    } catch (e) { btn.disabled = false; btn.textContent = `Save ${items.length} changes`; A.toast("Could not save: " + e.message, "error"); }
  }

  A.$("#q").oninput = A.debounce((e) => { S.q = e.target.value; render(); });
  A.$("#cat").onchange = (e) => { S.cat = e.target.value; render(); };
  A.$("#refresh").onclick = async () => { if (dirty.size && !(await A.confirmBox({ title: "Discard unsaved changes?", message: "Refreshing reloads stock from the database.", confirm: "Refresh", danger: true }))) return; dirty.clear(); try { await A.catalog.load(); render(); A.toast("Inventory refreshed"); } catch (e) { A.toast(e.message, "error"); } };
  A.$("#exportCsv").onclick = () => { const rows = [["Product", "Category", "Size", "Price (PKR)", "Stock", "Stock value"]]; flat().forEach(({ p, v }) => rows.push([p.name, p.category, v.weight, v.price, v.stock, v.price * v.stock])); A.csv(`inventory-${A.dayKey(Date.now())}.csv`, rows); A.toast("Inventory exported"); };
  window.addEventListener("beforeunload", (e) => { if (dirty.size) { e.preventDefault(); e.returnValue = ""; } });
  try { await A.catalog.load(); } catch (e) { return A.errorPanel(A.$("#list"), e, () => location.reload()); }
  render();
});
