/* Reviews: moderation queue with filters, bulk actions and manual reviews.
   Approving, unapproving, adding or deleting a review also recalculates the
   product's star rating and review count that the storefront displays. */
A.start({ page: "reviews", title: "Reviews" }, async (main) => {
  const { esc, num, icon, date } = A;
  const S = { tab: "pending", q: "", product: "", rating: "", sel: new Set() };
  let reviews = [];
  main.innerHTML = `<div class="page-head"><div><h1>Reviews</h1><p>Approve what appears on product pages. Approved reviews update each product’s rating.</p></div><div class="head-actions"><button class="btn primary" id="add">${icon("plus")}Add review</button></div></div>
    <div class="grid g3 mb" id="kpis"></div><div class="tabs" id="tabs"></div>
    <div class="toolbar"><div class="search">${icon("search")}<input class="input" id="q" placeholder="Search reviews" aria-label="Search reviews" /></div><select class="select" id="prod" aria-label="Product"></select>
      <select class="select" id="rate" aria-label="Rating"><option value="">All ratings</option>${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${n} star${n > 1 ? "s" : ""}</option>`).join("")}</select></div>
    <div id="bulk"></div><div id="list"><div class="card"><div class="card-b"><div class="skel"></div></div></div></div>`;

  const pname = (id) => A.catalog.byId(id)?.name || "Deleted product";
  const stars = (n) => `<span class="stars" aria-label="${n} out of 5">${"★".repeat(n)}${"☆".repeat(5 - n)}</span>`;
  async function load() {
    const [{ data, error }] = await Promise.all([supabaseClient.from("reviews").select("*").order("created_at", { ascending: false }).limit(1000), A.catalog.load()]);
    if (error) throw error; reviews = data || [];
  }
  async function syncRating(pid) {
    const { data, error } = await supabaseClient.from("reviews").select("rating").eq("product_id", pid).eq("approved", true); if (error) throw error;
    const n = data.length, avg = n ? Math.round((data.reduce((s, r) => s + r.rating, 0) / n) * 10) / 10 : 0;
    const res = await supabaseClient.from("products").update({ rating: avg, review_count: n }).eq("id", pid); if (res.error) throw res.error;
  }
  const syncAll = async (pids) => { try { for (const p of new Set(pids)) if (A.catalog.byId(p)) await syncRating(p); } catch (e) { A.toast("Saved, but product ratings could not be updated: " + e.message, "error"); } A.refreshBadges(); };

  function render() {
    const ap = reviews.filter((r) => r.approved), pend = reviews.length - ap.length, avg = ap.length ? ap.reduce((s, r) => s + r.rating, 0) / ap.length : 0;
    A.$("#kpis").innerHTML = `<div class="card kpi"><div class="k-l">Waiting for approval</div><div class="k-v">${pend}</div><div class="k-d">${pend ? "Not visible to customers yet" : "All caught up"}</div></div>
      <div class="card kpi"><div class="k-l">Published reviews</div><div class="k-v">${ap.length}</div><div class="k-d">Visible on product pages</div></div>
      <div class="card kpi"><div class="k-l">Average rating</div><div class="k-v">${ap.length ? avg.toFixed(1) : "—"}</div><div class="k-d">${ap.length ? stars(Math.round(avg)) : "No approved reviews yet"}</div></div>`;
    const TABS = [["pending", "Pending", (r) => !r.approved], ["approved", "Approved", (r) => r.approved], ["all", "All", () => true]];
    A.$("#tabs").innerHTML = TABS.map(([id, l, f]) => `<button data-tab="${id}" class="${id === S.tab ? "active" : ""}">${l}<span class="n">${reviews.filter(f).length}</span></button>`).join("");
    A.$$("[data-tab]").forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; S.sel.clear(); render(); }));
    A.$("#prod").innerHTML = `<option value="">All products</option>` + A.catalog.list.map((p) => `<option value="${esc(p.id)}" ${p.id === S.product ? "selected" : ""}>${esc(p.name)}</option>`).join("");
    const q = S.q.toLowerCase().trim(), fn = TABS.find((t) => t[0] === S.tab)[2];
    const rows = reviews.filter((r) => fn(r) && (!S.product || r.product_id === S.product) && (!S.rating || r.rating === +S.rating) && (!q || `${r.name} ${r.comment}`.toLowerCase().includes(q)));
    const el = A.$("#list");
    if (!rows.length) { el.innerHTML = `<div class="card"><div class="empty">${icon("star")}<h3>${S.tab === "pending" && !q ? "No reviews waiting" : "No reviews here"}</h3><p>${S.tab === "pending" && !q ? "New customer reviews will wait here until you approve them." : "Try a different filter."}</p></div></div>`; bulk(); return; }
    el.innerHTML = `<div class="card">${rows.map((r) => `<div class="rv"><input type="checkbox" class="cb" data-sel="${esc(r.id)}" aria-label="Select review by ${esc(r.name)}" ${S.sel.has(r.id) ? "checked" : ""} style="margin-top:6px" />
      <div class="avatar">${esc(A.initials(r.name))}</div><div class="body"><div><b>${esc(r.name)}</b> <span class="muted">on</span> <b>${esc(pname(r.product_id))}</b> ${r.approved ? '<span class="badge b-ok">Published</span>' : '<span class="badge b-warn">Pending</span>'}</div>
      <div>${stars(r.rating)}</div><p>${esc(r.comment || "")}</p>${r.photo_url ? `<a href="${esc(r.photo_url)}" target="_blank" rel="noopener"><img class="thumb" style="width:72px;height:72px" src="${esc(r.photo_url)}" alt="Customer photo" /></a>` : ""}
      <div class="meta">${r.source === "admin" ? "Added by you" : "Customer submission"} · ${esc(date(r.created_at))}</div></div>
      <div class="acts">${r.approved ? `<button class="btn sm" data-un="${esc(r.id)}">Unpublish</button>` : `<button class="btn gold sm" data-ap="${esc(r.id)}">Approve</button>`}<button class="btn sm danger" data-del="${esc(r.id)}">Delete</button></div></div>`).join("")}</div>`;
    A.$$("[data-sel]", el).forEach((c) => (c.onchange = () => { c.checked ? S.sel.add(c.dataset.sel) : S.sel.delete(c.dataset.sel); bulk(); }));
    A.$$("[data-ap]", el).forEach((b) => (b.onclick = () => setApproved([b.dataset.ap], true)));
    A.$$("[data-un]", el).forEach((b) => (b.onclick = () => setApproved([b.dataset.un], false)));
    A.$$("[data-del]", el).forEach((b) => (b.onclick = () => remove([b.dataset.del])));
    bulk();
  }
  function bulk() {
    const n = S.sel.size, box = A.$("#bulk");
    box.innerHTML = n ? `<div class="bulkbar"><span>${n} selected</span><button class="btn sm" id="bAp">Approve</button><button class="btn sm" id="bUn">Unpublish</button><button class="btn sm" id="bDel">Delete</button><span class="spacer"></span><button class="btn sm" id="bClr">Clear</button></div>` : "";
    if (!n) return;
    A.$("#bAp").onclick = () => setApproved([...S.sel], true); A.$("#bUn").onclick = () => setApproved([...S.sel], false); A.$("#bDel").onclick = () => remove([...S.sel]); A.$("#bClr").onclick = () => { S.sel.clear(); render(); };
  }
  async function setApproved(ids, approved) {
    const { error } = await supabaseClient.from("reviews").update({ approved }).in("id", ids);
    if (error) return A.toast("Could not update: " + error.message, "error");
    const pids = []; reviews.forEach((r) => { if (ids.includes(r.id)) { r.approved = approved; pids.push(r.product_id); } });
    ids.forEach((i) => S.sel.delete(i)); render(); A.toast(approved ? `${ids.length} review${ids.length > 1 ? "s" : ""} published` : `${ids.length} review${ids.length > 1 ? "s" : ""} unpublished`); await syncAll(pids);
  }
  async function remove(ids) {
    if (!(await A.confirmBox({ title: `Delete ${ids.length} review${ids.length > 1 ? "s" : ""}?`, message: "This permanently removes them. Published reviews disappear from product pages.", confirm: "Delete", danger: true }))) return;
    const { error } = await supabaseClient.from("reviews").delete().in("id", ids);
    if (error) return A.toast("Could not delete: " + error.message, "error");
    const pids = reviews.filter((r) => ids.includes(r.id)).map((r) => r.product_id); reviews = reviews.filter((r) => !ids.includes(r.id)); ids.forEach((i) => S.sel.delete(i));
    render(); A.toast("Deleted"); await syncAll(pids);
  }

  function addReview() {
    if (!A.catalog.list.length) return A.toast("Add a product first.", "error");
    let rating = 5;
    const d = A.drawer({ title: "Add a review", sub: '<span class="muted">Published immediately</span>' });
    d.body.innerHTML = `<div class="sec"><div class="field"><label for="rP">Product</label><select class="select" id="rP">${A.catalog.list.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></div>
      <div class="field"><label for="rN">Customer name</label><input class="input" id="rN" maxlength="100" placeholder="e.g. Ayesha K." /></div>
      <div class="field"><label>Rating</label><div class="star-pick" id="rS"></div></div>
      <div class="field" style="margin:0"><label for="rC">Review</label><textarea class="input" id="rC" rows="5" maxlength="2000"></textarea><div class="err" id="rE" hidden></div></div></div>`;
    d.footer.innerHTML = `<button class="btn" data-x2>Cancel</button><button class="btn primary" id="rSave">Publish review</button>`;
    const paint = () => { A.$("#rS", d.el).innerHTML = [1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-label="${n} stars" aria-pressed="${n === rating}">${n <= rating ? "★" : "☆"}</button>`).join(""); A.$$("[data-n]", d.el).forEach((b) => (b.onclick = () => { rating = +b.dataset.n; paint(); })); };
    paint(); A.$("[data-x2]", d.footer).onclick = () => d.close();
    A.$("#rSave", d.el).onclick = async (e) => {
      const name = A.$("#rN", d.el).value.trim(), comment = A.$("#rC", d.el).value.trim(), pid = A.$("#rP", d.el).value, err = A.$("#rE", d.el);
      if (name.length < 2 || comment.length < 10) { err.textContent = "Enter a name and a review of at least 10 characters."; err.hidden = false; return; }
      e.currentTarget.disabled = true;
      const { error } = await supabaseClient.from("reviews").insert({ product_id: pid, name, rating, comment, approved: true, source: "admin" });
      if (error) { e.currentTarget.disabled = false; return A.toast("Could not save: " + error.message, "error"); }
      await d.close(true); await load(); S.tab = "approved"; render(); A.toast("Review published"); await syncAll([pid]);
    };
  }

  A.$("#add").onclick = addReview;
  A.$("#q").oninput = A.debounce((e) => { S.q = e.target.value; render(); });
  A.$("#prod").onchange = (e) => { S.product = e.target.value; render(); }; A.$("#rate").onchange = (e) => { S.rating = e.target.value; render(); };
  try { await load(); } catch (e) { return A.errorPanel(A.$("#list"), e, () => location.reload()); }
  if (!reviews.some((r) => !r.approved) && reviews.length) S.tab = "approved";
  render();
});
