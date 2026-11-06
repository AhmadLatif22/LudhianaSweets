/* Products: searchable catalogue table + full editor (details, photos with
   reorder, sizes/prices/stock). Writes go straight to Supabase under RLS. */
A.start({ page: "products", title: "Products" }, async (main) => {
  const { esc, pkr, num, icon } = A;
  const PRESETS = ["100g", "250g", "500g", "750g", "1kg", "1.5kg", "2kg", "3kg", "5kg"];
  const qs = new URLSearchParams(location.search);
  const S = { tab: "all", q: "", cat: "", sort: "name" };
  main.innerHTML = `<div class="page-head"><div><h1>Products</h1><p>Everything customers see in the shop: details, photos, sizes, prices and stock.</p></div>
    <div class="head-actions"><button class="btn" id="exportCsv">${icon("download")}Export CSV</button><button class="btn primary" id="add">${icon("plus")}Add product</button></div></div>
    <div class="tabs" id="tabs"></div>
    <div class="toolbar"><div class="search">${icon("search")}<input class="input" id="q" placeholder="Search products" aria-label="Search products" /></div>
      <select class="select" id="cat" aria-label="Category"></select>
      <select class="select" id="sort" aria-label="Sort"><option value="name">Name A–Z</option><option value="new">Newest first</option><option value="price">Price: low to high</option><option value="stock">Stock: low to high</option></select></div>
    <div id="list"><div class="card"><div class="card-b"><div class="skel"></div></div></div></div>`;

  async function reload() { await A.catalog.load(); render(); }
  const cats = () => [...new Set(A.catalog.list.map((p) => p.category).filter(Boolean))].sort();
  const thumb = (p) => (p.images[0] ? `<img class="thumb" src="${esc(A.imgSrc(p.images[0]))}" alt="" loading="lazy" />` : `<div class="thumb empty">${icon("image")}</div>`);
  const prices = (p) => { if (!p.variants.length) return "—"; const a = p.variants.map((v) => v.price); const lo = Math.min(...a), hi = Math.max(...a); return lo === hi ? pkr(lo) : `${pkr(lo)} – ${pkr(hi)}`; };

  function render() {
    const all = A.catalog.list, st = A.catalog.stockState;
    const TABS = [["all", "All", () => true], ["low", "Low stock", (p) => st(p) === "low"], ["out", "Out of stock", (p) => st(p) === "out"], ["nosize", "No sizes", (p) => !p.variants.length]];
    A.$("#tabs").innerHTML = TABS.map(([id, l, f]) => `<button data-tab="${id}" class="${id === S.tab ? "active" : ""}">${l}<span class="n">${all.filter(f).length}</span></button>`).join("");
    A.$$("[data-tab]").forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; render(); }));
    const cs = A.$("#cat"); cs.innerHTML = `<option value="">All categories</option>` + cats().map((c) => `<option ${c === S.cat ? "selected" : ""}>${esc(c)}</option>`).join("");
    const q = S.q.toLowerCase().trim(), tabFn = TABS.find((t) => t[0] === S.tab)[2];
    let rows = all.filter((p) => tabFn(p) && (!S.cat || p.category === S.cat) && (!q || `${p.name} ${p.slug} ${p.category} ${p.tagline}`.toLowerCase().includes(q)));
    rows.sort(S.sort === "new" ? (a, b) => new Date(b.createdAt) - new Date(a.createdAt) : S.sort === "price" ? (a, b) => (a.variants[0]?.price ?? 1e12) - (b.variants[0]?.price ?? 1e12) : S.sort === "stock" ? (a, b) => A.catalog.stockOf(a) - A.catalog.stockOf(b) : (a, b) => a.name.localeCompare(b.name));
    const el = A.$("#list");
    if (!rows.length) { el.innerHTML = `<div class="card"><div class="empty">${icon("box")}<h3>${all.length ? "No products match" : "Your catalogue is empty"}</h3><p>${all.length ? "Try another search or filter." : "Add your first product to start selling."}</p>${all.length ? "" : '<button class="btn primary mt" id="add2">Add product</button>'}</div></div>`; A.$("#add2")?.addEventListener("click", () => edit()); return; }
    el.innerHTML = `<div class="table-wrap"><table class="t"><thead><tr><th>Product</th><th>Category</th><th>Sizes &amp; price</th><th class="r">Stock</th><th></th></tr></thead><tbody>
      ${rows.map((p) => `<tr class="click" data-edit="${esc(p.id)}"><td><div class="cell">${thumb(p)}<div><div class="strong">${esc(p.name)}</div><div class="sub">${esc(p.tagline || "/" + p.slug)}</div></div></div></td>
        <td>${p.category ? `<span class="badge plain b-neutral">${esc(p.category)}</span>` : '<span class="muted">—</span>'}</td>
        <td>${prices(p)}<div class="sub">${p.variants.length} size${p.variants.length === 1 ? "" : "s"}${p.variants.length ? ": " + esc(p.variants.map((v) => v.weight).join(", ")) : ""}</div></td>
        <td class="r"><div class="strong">${num(A.catalog.stockOf(p))}</div>${A.stockBadge(st(p))}</td>
        <td class="r nowrap" data-stop><a class="btn sm ghost" href="../product.html?slug=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener" title="View in shop">${icon("ext")}</a><button class="btn sm" data-edit="${esc(p.id)}">Edit</button></td></tr>`).join("")}</tbody></table></div>
      <div class="pager"><span>${rows.length} product${rows.length === 1 ? "" : "s"}</span></div>`;
    A.$$("[data-edit]", el).forEach((r) => (r.onclick = (e) => { if (e.target.closest("a")) return; e.stopPropagation(); edit(r.dataset.edit); }));
  }

  /* ---------- editor ---------- */
  function edit(id) {
    const orig = id ? A.catalog.byId(id) : null; if (id && !orig) return;
    const draft = orig ? { id: orig.id, name: orig.name, slug: orig.slug, category: orig.category, tagline: orig.tagline, description: orig.description, ingredients: orig.ingredients.join("\n"), storage: orig.storage, images: [...orig.images], variants: orig.variants.map((v) => ({ ...v })) }
      : { id: null, name: "", slug: "", category: "", tagline: "", description: "", ingredients: "", storage: "", images: [], variants: [{ weight: "500g", price: "", stock: 0 }] };
    const tmp = Date.now().toString(36); let slugTouched = !!orig, busy = false;
    const snap = () => JSON.stringify([draft.name, draft.slug, draft.category, draft.tagline, draft.description, draft.ingredients, draft.storage, draft.images, draft.variants.map((v) => [v.id, v.weight, v.price, v.stock])]);
    let base = snap();
    const d = A.drawer({ beforeClose: async () => (snap() === base || busy ? true : A.confirmBox({ title: "Discard your changes?", message: "You have unsaved edits to this product.", confirm: "Discard", danger: true })) });
    d.setTitle(orig ? "Edit product" : "New product", orig ? `<span class="muted">/${esc(orig.slug)}</span>` : "");
    d.body.innerHTML = `
      <div class="sec"><h3>Basics</h3>
        <div class="field"><label for="fName">Product name</label><input class="input" id="fName" maxlength="120" value="${esc(draft.name)}" /><div class="err" data-e="name" hidden></div></div>
        <div class="field"><label for="fSlug">Link name</label><input class="input" id="fSlug" maxlength="80" value="${esc(draft.slug)}" /><div class="hint">${orig ? "Changing this breaks existing links to the product page." : "Appears in the page link. Letters, numbers and dashes only."}</div><div class="err" data-e="slug" hidden></div></div>
        <div class="row2"><div class="field"><label for="fCat">Category</label><input class="input" id="fCat" list="catList" maxlength="60" placeholder="e.g. Barfi" value="${esc(draft.category)}" /><datalist id="catList">${cats().map((c) => `<option value="${esc(c)}">`).join("")}</datalist><div class="hint">For organising products here.</div></div>
        <div class="field"><label for="fTag">Short tagline</label><input class="input" id="fTag" maxlength="140" value="${esc(draft.tagline)}" /><div class="hint">Shown on the shop cards.</div></div></div>
        <div class="field" style="margin:0"><label for="fDesc">Description</label><textarea class="input" id="fDesc" rows="5">${esc(draft.description)}</textarea></div></div>
      <div class="sec"><h3>Photos</h3><div class="imgs" id="imgs"></div>
        <div class="hint" style="margin:10px 0 8px">The first photo is the cover. JPG, PNG or WebP up to 8 MB; large photos are resized automatically.</div>
        <div class="row2" style="grid-template-columns:1fr auto"><input class="input" id="fUrl" placeholder="Or paste an https:// image link" aria-label="Image link" /><button class="btn" id="addUrl">Add link</button></div></div>
      <div class="sec"><h3>Sizes, price &amp; stock <button class="btn sm" id="addSize">${icon("plus")}Add size</button></h3>
        <div class="vrows" id="vrows"></div><div class="err" data-e="variants" hidden></div>
        <datalist id="sizeList">${PRESETS.map((w) => `<option value="${w}">`).join("")}</datalist>
        <div class="hint" style="margin-top:8px">Each size is a separate option customers can buy. Prices are in PKR. Stock is the number available now.</div></div>
      <div class="sec"><h3>Product details</h3>
        <div class="field"><label for="fIng">Ingredients</label><textarea class="input" id="fIng" rows="5" placeholder="One ingredient per line">${esc(draft.ingredients)}</textarea></div>
        <div class="field" style="margin:0"><label for="fStore">Storage instructions</label><textarea class="input" id="fStore" rows="3">${esc(draft.storage)}</textarea></div></div>`;
    d.footer.innerHTML = `${orig ? `<button class="btn danger left" id="del">${icon("trash")}Delete</button>` : ""}<button class="btn" id="cancel">Cancel</button><button class="btn primary" id="save">${orig ? "Save changes" : "Create product"}</button>`;
    const $ = (s) => A.$(s, d.el);
    const bind = (id, k, fn) => ($(id).oninput = (e) => { draft[k] = e.target.value; fn?.(e); });
    bind("#fName", "name", () => { if (!slugTouched) { draft.slug = A.slug(draft.name); $("#fSlug").value = draft.slug; } });
    bind("#fSlug", "slug", () => (slugTouched = true)); bind("#fCat", "category"); bind("#fTag", "tagline"); bind("#fDesc", "description"); bind("#fIng", "ingredients"); bind("#fStore", "storage");

    function paintImgs(busyUpload) {
      $("#imgs").innerHTML = draft.images.map((src, i) => `<div class="img-tile"><img src="${esc(A.imgSrc(src))}" alt="Photo ${i + 1}" />${i === 0 ? '<span class="cover">Cover</span>' : ""}<div class="tools"><span>${i > 0 ? `<button data-mv="${i}" data-d="-1" aria-label="Move earlier">${icon("arrowL")}</button>` : ""}</span><span>${i < draft.images.length - 1 ? `<button data-mv="${i}" data-d="1" aria-label="Move later">${icon("arrowR")}</button>` : ""}<button data-rm="${i}" aria-label="Remove photo">${icon("x")}</button></span></div></div>`).join("")
        + `<label class="add-tile ${busyUpload ? "busy" : ""}">${busyUpload ? "Uploading…" : `${icon("plus")}<br>Add photos`}<input type="file" id="fFile" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden /></label>`;
      A.$$("[data-mv]", d.el).forEach((b) => (b.onclick = () => { const i = +b.dataset.mv, j = i + +b.dataset.d;[draft.images[i], draft.images[j]] = [draft.images[j], draft.images[i]]; paintImgs(); }));
      A.$$("[data-rm]", d.el).forEach((b) => (b.onclick = () => { draft.images.splice(+b.dataset.rm, 1); paintImgs(); }));
      $("#fFile").onchange = async (e) => {
        const files = [...e.target.files]; if (!files.length) return; paintImgs(true); busy = true;
        for (const f of files) { try { draft.images.push(await A.uploadProductImage(f, draft.id || "new-" + tmp)); } catch (x) { A.toast(f.name + ": " + x.message, "error"); } }
        busy = false; paintImgs();
      };
    }
    $("#addUrl").onclick = () => { const u = $("#fUrl").value.trim(); if (!/^(https:\/\/|images\/)/.test(u)) return A.toast("Enter a link starting with https://", "error"); draft.images.push(u); $("#fUrl").value = ""; paintImgs(); };

    function paintVariants() {
      $("#vrows").innerHTML = (draft.variants.length ? `<div class="vrow vhead"><span>Size</span><span>Price (Rs)</span><span class="v-stock">Stock</span><span></span></div>` : `<p class="muted">No sizes yet. Customers can’t buy this product until you add one.</p>`)
        + draft.variants.map((v, i) => `<div class="vrow"><input class="input" list="sizeList" data-v="${i}" data-f="weight" placeholder="e.g. 500g" value="${esc(v.weight)}" aria-label="Size" /><input class="input" type="number" min="1" step="1" data-v="${i}" data-f="price" value="${esc(v.price)}" aria-label="Price" /><input class="input v-stock" type="number" min="0" step="1" data-v="${i}" data-f="stock" value="${esc(v.stock)}" aria-label="Stock" /><button class="btn icon ghost" data-rv="${i}" aria-label="Remove size">${icon("trash")}</button></div>`).join("");
      A.$$("[data-v]", d.el).forEach((inp) => (inp.oninput = () => (draft.variants[+inp.dataset.v][inp.dataset.f] = inp.value)));
      A.$$("[data-rv]", d.el).forEach((b) => (b.onclick = () => { draft.variants.splice(+b.dataset.rv, 1); paintVariants(); }));
    }
    $("#addSize").onclick = () => { draft.variants.push({ weight: "", price: "", stock: 0 }); paintVariants(); A.$$("[data-f=weight]", d.el).pop()?.focus(); };
    paintImgs(); paintVariants();

    $("#cancel").onclick = () => d.close();
    const fail = (key, msg) => { const e = A.$(`[data-e=${key}]`, d.el); e.textContent = msg; e.hidden = false; e.scrollIntoView({ block: "center", behavior: "smooth" }); return false; };
    function validate() {
      A.$$("[data-e]", d.el).forEach((e) => (e.hidden = true));
      if (draft.name.trim().length < 2) return fail("name", "Enter the product name.");
      draft.slug = A.slug(draft.slug); $("#fSlug").value = draft.slug;
      if (!draft.slug) return fail("slug", "Enter a link name (letters, numbers, dashes).");
      if (A.catalog.list.some((p) => p.slug === draft.slug && p.id !== draft.id)) return fail("slug", "Another product already uses this link name.");
      const seen = new Set();
      for (const v of draft.variants) {
        const w = String(v.weight).trim(), pr = Number(v.price), st = Number(v.stock);
        if (!w) return fail("variants", "Every size needs a name, like 500g.");
        if (seen.has(w.toLowerCase())) return fail("variants", `The size “${w}” is listed twice.`); seen.add(w.toLowerCase());
        if (!Number.isInteger(pr) || pr <= 0) return fail("variants", `Enter a whole-number price above 0 for ${w}.`);
        if (!Number.isInteger(st) || st < 0) return fail("variants", `Stock for ${w} must be a whole number, 0 or more.`);
      }
      return true;
    }
    $("#save").onclick = async (e) => {
      if (busy || !validate()) return; const btn = e.currentTarget; btn.disabled = true; busy = true; btn.textContent = "Saving…";
      try {
        const db = supabaseClient, vs = draft.variants.map((v) => ({ id: v.id, weight: String(v.weight).trim(), price: Number(v.price), stock: Number(v.stock) }));
        const row = { name: draft.name.trim(), slug: draft.slug, tagline: draft.tagline.trim(), description: draft.description.trim(), category: draft.category.trim() || "General", storage_instructions: draft.storage.trim(), images: draft.images,
          ingredients: draft.ingredients.split("\n").map((s) => s.trim()).filter(Boolean) };
        /* stock guard: warn if an order changed stock since this product was loaded */
        const stockEdits = orig ? vs.filter((v) => v.id && orig.variants.find((o) => o.id === v.id && o.stock !== v.stock)) : [];
        if (stockEdits.length) {
          const { data } = await db.from("product_prices").select("id,weight,stock").in("id", stockEdits.map((v) => v.id));
          const moved = (data || []).filter((r) => r.stock !== orig.variants.find((o) => o.id === r.id).stock);
          if (moved.length && !(await A.confirmBox({ title: "Stock changed while you were editing", message: moved.map((r) => `${r.weight}: now ${r.stock}`).join(", ") + ". Saving will overwrite these with your numbers.", confirm: "Overwrite" }))) { btn.disabled = false; busy = false; btn.textContent = orig ? "Save changes" : "Create product"; return; }
        }
        let pid = draft.id;
        if (!orig) { pid = `${draft.slug}-${tmp}`; const { error } = await db.from("products").insert({ id: pid, ...row, rating: 0, review_count: 0 }); if (error) throw error; }
        else { const { error } = await db.from("products").update(row).eq("id", pid); if (error) throw error; }
        if (orig) {
          const keep = new Set(vs.filter((v) => v.id).map((v) => v.id)), gone = orig.variants.filter((o) => !keep.has(o.id)).map((o) => o.id);
          if (gone.length) { const { error } = await db.from("product_prices").delete().in("id", gone); if (error) throw error; }
          for (const v of vs.filter((x) => x.id)) { const o = orig.variants.find((z) => z.id === v.id); if (o && (o.weight !== v.weight || o.price !== v.price || o.stock !== v.stock)) { const { error } = await db.from("product_prices").update({ weight: v.weight, price: v.price, stock: v.stock }).eq("id", v.id); if (error) throw error; } }
        }
        const fresh = vs.filter((v) => !v.id).map((v) => ({ product_id: pid, weight: v.weight, price: v.price, stock: v.stock }));
        if (fresh.length) { const { error } = await db.from("product_prices").insert(fresh); if (error) throw error; }
        busy = false; base = snap(); await d.close(true); await reload(); A.toast(orig ? "Product saved" : "Product created");
      } catch (x) {
        busy = false; btn.disabled = false; btn.textContent = orig ? "Save changes" : "Create product";
        A.toast(/duplicate|unique/i.test(x.message) ? "That link name is already in use." : "Could not save: " + x.message, "error"); if (orig) reload();
      }
    };
    $("#del")?.addEventListener("click", async () => {
      if (!(await A.confirmBox({ title: `Delete “${orig.name}”?`, message: "It disappears from the shop immediately. Past orders keep their own copy of the details.", confirm: "Delete product", danger: true }))) return;
      const { error } = await supabaseClient.from("products").delete().eq("id", orig.id);
      if (error) return A.toast("Could not delete: " + error.message, "error");
      busy = true; await d.close(true); await reload(); A.toast("Product deleted");
    });
    setTimeout(() => (orig ? null : $("#fName").focus()), 260);
  }

  A.$("#add").onclick = () => edit();
  A.$("#q").oninput = A.debounce((e) => { S.q = e.target.value; render(); });
  A.$("#cat").onchange = (e) => { S.cat = e.target.value; render(); }; A.$("#sort").onchange = (e) => { S.sort = e.target.value; render(); };
  A.$("#exportCsv").onclick = () => {
    const rows = [["Product", "Category", "Link name", "Size", "Price (PKR)", "Stock"]];
    A.catalog.list.forEach((p) => (p.variants.length ? p.variants : [{ weight: "", price: "", stock: "" }]).forEach((v) => rows.push([p.name, p.category, p.slug, v.weight, v.price, v.stock])));
    A.csv(`products-${A.dayKey(Date.now())}.csv`, rows); A.toast("Products exported");
  };
  try { await A.catalog.load(); } catch (e) { return A.errorPanel(A.$("#list"), e, () => location.reload()); }
  render();
  if (qs.get("new")) edit(); else if (qs.get("edit")) edit(qs.get("edit"));
});
