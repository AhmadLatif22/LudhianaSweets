/* ==========================================================================
   admin-core.js — shared foundation for every admin page.
   Needs js/supabase-client.js loaded first. Provides: auth guard, page shell
   (sidebar/topbar), orders + catalogue data access, and UI helpers
   (toast, confirm, drawer, CSV export).
   Access control: Supabase login alone is not enough — the user must be in
   the store_admins allowlist (checked via the is_store_admin() RPC). Every
   write is also enforced server-side by RLS / the /api/admin-orders function.
   ========================================================================== */
const A = (() => {
  /* ---------- tiny helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pkr = (n) => "Rs " + Math.round(Number(n) || 0).toLocaleString("en-PK");
  const num = (n) => (Number(n) || 0).toLocaleString("en-PK");
  const date = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
  const dateTime = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
  const ago = (d) => {
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    if (s < 86400 * 7) return Math.floor(s / 86400) + "d ago";
    return date(d);
  };
  const slug = (t) => String(t || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const dayKey = (d) => { d = new Date(d); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const startOfDay = (d) => { d = new Date(d); d.setHours(0, 0, 0, 0); return d; };
  const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const digits = (p) => String(p || "").replace(/\D/g, "");
  const waLink = (phone) => { let d = digits(phone); if (d.startsWith("0")) d = "92" + d.slice(1); return "https://wa.me/" + d; };
  const imgSrc = (s) => (!s ? "" : /^(https?:|data:|blob:)/.test(s) ? s : "../" + String(s).replace(/^\//, ""));

  const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    bag: '<path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7a3 3 0 016 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c2 .6 3.2 2.3 3.5 5.2"/>',
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    chev: '<path d="M9 6l6 6-6 6"/>', arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>', arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>',
    print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
    chat: '<path d="M21 12a8 8 0 01-11.6 7.1L3 21l1.9-5.5A8 8 0 1121 12z"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    logout: '<path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4M16 8l4 4-4 4M20 12H9"/>',
    refresh: '<path d="M20 11a8 8 0 00-14.5-3.5M4 4v4h4M4 13a8 8 0 0014.5 3.5M20 20v-4h-4"/>',
    alert: '<path d="M12 3l10 18H2L12 3zM12 10v5M12 18v.01"/>', check: '<path d="M5 12l5 5 9-10"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
    truck: '<path d="M2 6h11v10H2zM13 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 4M6.6 6.6C3.7 8.5 2 12 2 12s4 7 10 7a10 10 0 004.4-1M9.9 9.9a3 3 0 004.2 4.2"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    store: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9M9 20v-6h6v6"/>'
  };
  const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;

  /* ---------- order status model (mirrors store_transition_order in SQL) ---------- */
  const STATUS = {
    pending: { l: "Awaiting confirmation", t: "warn" },
    pending_whatsapp_confirmation: { l: "Awaiting WhatsApp", t: "warn" },
    confirmed: { l: "Confirmed", t: "info" },
    processing: { l: "Processing", t: "info" },
    out_for_delivery: { l: "Shipped", t: "gold" },
    delivered: { l: "Delivered", t: "ok" },
    cancelled: { l: "Cancelled", t: "bad" }
  };
  const NEXT = {
    pending: ["confirmed", "cancelled"], pending_whatsapp_confirmation: ["confirmed", "cancelled"],
    confirmed: ["processing", "out_for_delivery", "cancelled"], processing: ["out_for_delivery", "cancelled"],
    out_for_delivery: ["delivered", "cancelled"], delivered: [], cancelled: []
  };
  const statusLabel = (s) => STATUS[s]?.l || String(s || "").replace(/_/g, " ");
  const statusBadge = (s) => `<span class="badge b-${STATUS[s]?.t || "neutral"}">${esc(statusLabel(s))}</span>`;
  const payBadge = (o) => o.paymentStatus === "paid" ? '<span class="badge b-ok">Paid</span>' : o.status === "cancelled" ? '<span class="badge b-neutral">Not collected</span>' : '<span class="badge b-warn">Unpaid</span>';
  const payMethod = (m) => ({ cod: "Cash on delivery", easypaisa: "Easypaisa", jazzcash: "JazzCash", card: "Card" }[m] || String(m || "—").toUpperCase());
  const isOpen = (s) => !["delivered", "cancelled"].includes(s);

  /* ---------- settings (stored in this browser only) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem("ls_admin_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("ls_admin_" + k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
  };
  const lowStockLimit = () => Math.max(0, Number(store.get("low_stock", 10)) || 0);

  /* ---------- toasts, confirm, drawer ---------- */
  function toast(msg, type = "ok") {
    let box = $(".toasts"); if (!box) { box = document.createElement("div"); box.className = "toasts"; box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
    const t = document.createElement("div"); t.className = "toast " + type; t.innerHTML = (type === "ok" ? icon("check") : icon("alert")) + `<span>${esc(msg)}</span>`;
    box.appendChild(t); setTimeout(() => t.remove(), type === "error" ? 6000 : 3200);
  }
  function confirmBox({ title, message = "", confirm = "Confirm", danger = false }) {
    return new Promise((resolve) => {
      const ov = document.createElement("div"); ov.className = "overlay"; ov.style.zIndex = 105;
      const m = document.createElement("div"); m.className = "modal"; m.setAttribute("role", "alertdialog"); m.setAttribute("aria-modal", "true");
      m.innerHTML = `<h3>${esc(title)}</h3><p>${esc(message)}</p><div class="acts"><button class="btn" data-no>Cancel</button><button class="btn ${danger ? "danger solid" : "primary"}" data-yes>${esc(confirm)}</button></div>`;
      document.body.append(ov, m); requestAnimationFrame(() => { ov.classList.add("show"); m.classList.add("show"); });
      const prev = document.activeElement;
      const done = (v) => { document.removeEventListener("keydown", key, true); ov.remove(); m.remove(); prev?.focus?.(); resolve(v); };
      const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); done(false); } };
      document.addEventListener("keydown", key, true);
      m.querySelector("[data-no]").onclick = () => done(false); ov.onclick = () => done(false);
      const yes = m.querySelector("[data-yes]"); yes.onclick = () => done(true); yes.focus();
    });
  }
  function drawer({ title = "", sub = "", body = "", footer = "", beforeClose } = {}) {
    const ov = document.createElement("div"); ov.className = "overlay";
    const el = document.createElement("aside"); el.className = "drawer"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.tabIndex = -1;
    el.innerHTML = `<div class="dr-h"><div><h2></h2><div class="sub"></div></div><button class="btn icon ghost" data-x aria-label="Close">${icon("x")}</button></div><div class="dr-b"></div><div class="dr-f"></div>`;
    document.body.append(ov, el);
    const api = {
      el, body: $(".dr-b", el), footer: $(".dr-f", el),
      setTitle(t, s) { $("h2", el).textContent = t; $(".sub", el).innerHTML = s ?? ""; },
      async close(force) { if (!force && beforeClose && !(await beforeClose())) return; document.removeEventListener("keydown", key); el.classList.remove("show"); ov.classList.remove("show"); setTimeout(() => { el.remove(); ov.remove(); }, 220); prev?.focus?.(); }
    };
    const prev = document.activeElement; api.setTitle(title, sub); api.body.innerHTML = body; api.footer.innerHTML = footer;
    const key = (e) => { if (e.key === "Escape" && !$(".modal")) api.close(); };
    document.addEventListener("keydown", key); ov.onclick = () => api.close(); $("[data-x]", el).onclick = () => api.close();
    requestAnimationFrame(() => { ov.classList.add("show"); el.classList.add("show"); el.focus(); });
    return api;
  }

  /* ---------- CSV export (guards against spreadsheet formula injection) ---------- */
  function csv(name, rows) {
    const cell = (c) => { c = String(c ?? ""); if (/^[=@\t\r]|^[+\-](?![\d\s(])/.test(c)) c = "'" + c; return /[",\n\r]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; };
    const blob = new Blob(["\ufeff" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- auth ---------- */
  async function guard() {
    if (typeof isDatabaseConnected !== "function" || !isDatabaseConnected()) return { ok: false };
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return { ok: false };
    const { data, error } = await supabaseClient.rpc("is_store_admin");
    return { ok: !error && data === true, session, denied: !error && data !== true };
  }
  async function signOut() { try { await supabaseClient.auth.signOut(); } finally { location.replace("login.html"); } }

  async function api(path, opts = {}) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.access_token) { location.replace("login.html?expired=1"); throw Error("Your session has ended. Please sign in again."); }
    const res = await fetch(path, { ...opts, headers: { Authorization: "Bearer " + session.access_token, "Content-Type": "application/json", ...(opts.headers || {}) } });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) { location.replace("login.html?expired=1"); }
    if (!res.ok) throw Error(body.error || "Request failed (" + res.status + ")");
    return body;
  }

  /* ---------- orders ---------- */
  const ORDER_LIMIT = 300; // /api/admin-orders returns the newest 300
  const normOrder = (r) => ({
    id: r.id, orderNumber: r.order_number, items: r.items || [], customer: r.customer || {}, paymentMethod: r.payment_method,
    paymentStatus: r.payment_status || "unpaid", subtotal: Number(r.subtotal) || 0, shipping: Number(r.shipping) || 0, total: Number(r.total) || 0,
    status: r.status, createdAt: r.created_at, updatedAt: r.updated_at, ts: new Date(r.created_at).getTime(),
    trackingNumber: r.tracking_number, trackingUrl: r.tracking_url, courier: r.courier, estimatedDelivery: r.estimated_delivery
  });
  const orders = {
    list: [], truncated: false,
    async load() { const r = await api("/api/admin-orders"); const rows = r.orders || []; orders.list = rows.map(normOrder); orders.truncated = rows.length >= ORDER_LIMIT; return orders.list; },
    async transition(orderNumber, status, extra = {}) { await api("/api/admin-orders", { method: "PATCH", body: JSON.stringify({ orderNumber, status, ...extra }) }); },
    async collectCod(orderNumber) { await api("/api/admin-orders", { method: "PATCH", body: JSON.stringify({ orderNumber, action: "collect_cod" }) }); },
    async events(orderId) { const { data, error } = await supabaseClient.from("order_events").select("from_status,to_status,note,created_at").eq("order_id", orderId).order("created_at", { ascending: true }); if (error) throw Error(error.message); return data || []; }
  };

  /* ---------- catalogue ---------- */
  const grams = (w) => { const m = /^\s*([\d.]+)\s*(kg|g)/i.exec(w || ""); return m ? parseFloat(m[1]) * (m[2].toLowerCase() === "kg" ? 1000 : 1) : Infinity; };
  const normProduct = (r) => ({
    id: r.id, slug: r.slug, name: r.name, tagline: r.tagline || "", description: r.description || "", ingredients: r.ingredients || [],
    storage: r.storage_instructions || "", images: r.images || [], category: r.category || "", featured: !!r.featured,
    rating: Number(r.rating) || 0, reviewCount: r.review_count || 0, createdAt: r.created_at,
    variants: (r.product_prices || []).map((v) => ({ id: v.id, weight: v.weight, price: Number(v.price) || 0, stock: Number(v.stock) || 0 })).sort((a, b) => grams(a.weight) - grams(b.weight))
  });
  const catalog = {
    list: [],
    async load() {
      const { data, error } = await supabaseClient.from("products").select("*, product_prices(id, weight, price, stock)").order("created_at", { ascending: true });
      if (error) throw Error(error.message); catalog.list = (data || []).map(normProduct); return catalog.list;
    },
    byId: (id) => catalog.list.find((p) => p.id === id),
    stockOf: (p) => p.variants.reduce((s, v) => s + v.stock, 0),
    stockState(p) { if (!p.variants.length) return "none"; const lim = lowStockLimit(); if (p.variants.every((v) => v.stock <= 0)) return "out"; if (p.variants.some((v) => v.stock <= lim)) return "low"; return "ok"; },
    variantState(v) { return v.stock <= 0 ? "out" : v.stock <= lowStockLimit() ? "low" : "ok"; }
  };
  const stockBadge = (st) => ({ out: '<span class="badge b-bad">Out of stock</span>', low: '<span class="badge b-warn">Low stock</span>', ok: '<span class="badge b-ok">In stock</span>', none: '<span class="badge b-neutral">No sizes</span>' }[st]);

  async function prepImage(file) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw Error("Use a JPG, PNG or WebP image.");
    if (file.size > 8 * 1024 * 1024) throw Error("Image is larger than 8 MB.");
    if (file.type === "image/gif" || typeof createImageBitmap !== "function") return file;
    const bmp = await createImageBitmap(file), s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    if (s === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.86));
    return blob && blob.size < file.size ? blob : file;
  }
  async function uploadProductImage(file, productId) {
    const blob = await prepImage(file), ext = { "image/webp": "webp", "image/png": "png", "image/gif": "gif" }[blob.type] || "jpg";
    const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await supabaseClient.storage.from("product-images").upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
    if (error) throw Error("Upload failed: " + error.message);
    return supabaseClient.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  }

  /* ---------- sidebar badges ---------- */
  function setBadge(page, n) {
    const a = $(`.sb-nav a[data-page="${page}"]`); if (!a) return; let b = $(".count", a);
    if (!n) { b?.remove(); return; } if (!b) { b = document.createElement("span"); b.className = "count"; a.appendChild(b); } b.textContent = n > 99 ? "99+" : n;
  }
  async function refreshBadges() {
    try {
      const [o, r] = await Promise.all([
        supabaseClient.from("orders").select("id", { count: "exact", head: true }).in("status", ["pending", "pending_whatsapp_confirmation"]),
        supabaseClient.from("reviews").select("id", { count: "exact", head: true }).eq("approved", false)
      ]);
      setBadge("orders", o.count || 0); setBadge("reviews", r.count || 0);
    } catch { /* badges are cosmetic */ }
  }

  /* ---------- shell ---------- */
  const NAV = [
    ["Sell", [["dashboard", "Overview", "home"], ["orders", "Orders", "bag"], ["customers", "Customers", "users"]]],
    ["Catalogue", [["products", "Products", "box"], ["inventory", "Inventory", "layers"], ["reviews", "Reviews", "star"]]],
    ["Store", [["settings", "Settings", "gear"]]]
  ];
  function buildShell(cfg) {
    const email = A.user?.email || "Admin";
    const nav = NAV.map(([g, items]) => `<div class="sb-group">${g}</div>` + items.map(([id, label, ic]) => `<a href="${id}.html" data-page="${id}" ${id === cfg.page ? 'class="active" aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`).join("")).join("");
    $("#app").innerHTML = `<div class="app">
      <aside class="sidebar" id="sidebar"><div class="sb-brand"><img src="../images/logoo.png" alt="" /><b>Ludhiana Sweets<small>Store admin</small></b></div>
        <nav class="sb-nav" aria-label="Admin">${nav}</nav>
        <div class="sb-foot"><a href="../index.html" target="_blank" rel="noopener">${icon("store")}View storefront</a><a href="#" id="signOut">${icon("logout")}Sign out</a></div></aside>
      <div class="scrim" id="scrim"></div>
      <div class="main-wrap"><header class="topbar"><button class="btn icon ghost menu-btn" id="menuBtn" aria-label="Open menu">${icon("menu")}</button>
        <span class="crumb">${esc(cfg.title)}</span><span class="spacer"></span>
        <div class="user-chip" title="${esc(email)}"><div class="av">${esc(initials(email))}</div><span>${esc(email)}</span></div></header>
        <main class="page" id="main"></main></div></div>`;
    const sb = $("#sidebar"), sc = $("#scrim"), tgl = (o) => { sb.classList.toggle("open", o); sc.classList.toggle("show", o); };
    $("#menuBtn").onclick = () => tgl(true); sc.onclick = () => tgl(false);
    $("#signOut").onclick = (e) => { e.preventDefault(); signOut(); };
    document.title = cfg.title + " · Ludhiana Sweets Admin";
  }
  function errorPanel(el, err, retry) {
    el.innerHTML = `<div class="card"><div class="empty">${icon("alert")}<h3>Something went wrong</h3><p>${esc(err.message || err)}</p>${retry ? '<button class="btn mt" data-retry>Try again</button>' : ""}</div></div>`;
    if (retry) $("[data-retry]", el).onclick = retry;
  }
  async function start(cfg, init) {
    const g = await guard();
    if (!g.ok) { location.replace("login.html" + (g.denied ? "?denied=1" : "")); return; }
    A.user = g.session.user; buildShell(cfg); document.body.classList.add("ready");
    supabaseClient.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") location.replace("login.html"); });
    refreshBadges();
    try { await init($("#main")); } catch (e) { console.error(e); errorPanel($("#main"), e, () => location.reload()); }
  }

  const A = { $, $$, esc, pkr, num, date, dateTime, ago, slug, debounce, dayKey, startOfDay, initials, digits, waLink, imgSrc, icon, STATUS, NEXT, statusLabel, statusBadge, payBadge, payMethod, isOpen,
    store, lowStockLimit, toast, confirmBox, drawer, csv, guard, signOut, api, ORDER_LIMIT, orders, catalog, stockBadge, uploadProductImage, setBadge, refreshBadges, errorPanel, start, user: null };
  return A;
})();
