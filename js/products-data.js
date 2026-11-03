/* ==========================================================================
   products-data.js — loads the product catalogue from Supabase.
   Requires js/supabase-client.js loaded first (defines supabaseClient /
   isDatabaseConnected()).

   Exposes:
     PRODUCTS                    (array — populated once loadProducts() resolves)
     REVIEWS                      (static demo reviews — not database-backed yet)
     loadProducts()               async — fills PRODUCTS from Supabase
     getProductBySlug(slug)       sync — reads from the already-loaded PRODUCTS
     subscribeToProductChanges(cb) sets up Supabase Realtime; cb runs on any change
     stars(rating)
   ========================================================================== */

let PRODUCTS = [];

// Real customer reviews are loaded from Supabase; never show invented testimonials.
const REVIEWS = [];

// Shown only if Supabase isn't configured yet, or a query fails, so pages
// never render completely empty during setup.
const DEMO_PRODUCTS = [
  {
    id: "barfi-classic",
    slug: "ludhiana-special-barfi",
    name: "Ludhiana Special Barfi",
    tagline: "Handcrafted with pure desi ghee, the traditional Ludhiana way",
    description:
      "Our signature barfi is simmered slowly in pure desi ghee and full-cream khoya, finished with a dusting of silver warq and slivered pistachios.",
    ingredients: ["Full-cream khoya", "Pure desi ghee", "Cane sugar", "Cardamom", "Silver warq", "Pistachios & almonds"],
    storageInstructions: "Store in an airtight container at room temperature for up to 4 days, or refrigerate for up to 10 days.",
    images: ["images/barfi.png"],
    prices: [
      { weight: "250g", price: 850, stock: 40 },
      { weight: "500g", price: 1600, stock: 35 },
      { weight: "1kg", price: 3100, stock: 20 },
    ],
    category: "Barfi",
    rating: 4.9,
    reviewCount: 128,
    featured: true,
  },
];

function normalizeProduct(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline || "",
    description: row.description || "",
    ingredients: row.ingredients || [],
    storageInstructions: row.storage_instructions || "",
    images: row.images || [],
    prices: (row.product_prices || []).map((p) => ({ id: p.id, weight: p.weight, price: Number(p.price), stock: p.stock })),
    category: row.category || "",
    rating: row.rating != null ? Number(row.rating) : 0,
    reviewCount: row.review_count || 0,
    featured: !!row.featured,
  };
}

async function loadProducts() {
  if (!isDatabaseConnected()) {
    PRODUCTS = DEMO_PRODUCTS;
    return PRODUCTS;
  }

  const { data, error } = await supabaseClient
    .from("products")
    .select("*, product_prices(id, weight, price, stock)")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Supabase error loading products:", error.message);
    PRODUCTS = [];
  } else if (!data || data.length === 0) {
    PRODUCTS = [];
  } else {
    PRODUCTS = data.map(normalizeProduct);
  }

  return PRODUCTS;
}

function getProductBySlug(slug) {
  return PRODUCTS.find((p) => p.slug === slug);
}

let _productsChannel = null;

function subscribeToProductChanges(callback) {
  if (!isDatabaseConnected() || _productsChannel) return;

  _productsChannel = supabaseClient
    .channel("products-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, async () => {
      await loadProducts();
      callback();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "product_prices" }, async () => {
      await loadProducts();
      callback();
    })
    .subscribe();
}

function stars(rating) {
  return "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
}
