# Ludhiana Sweets — Static HTML/CSS/JS Version

A plain HTML, CSS, and vanilla JavaScript build of the Ludhiana Sweets site —
no build step, no framework. Open `index.html` in a browser or serve the
folder with any static host.

## Structure

```
index.html            Homepage
shop.html              Product listing
product.html            Product detail (Ludhiana Special Barfi)
checkout.html          Cart checkout (5 payment method UI, EmailJS-ready)
order-success.html     Confirmation + PDF invoice download
contact.html            Contact form + map
privacy-policy.html, refund-policy.html, terms.html
admin/                 Simple local admin panel (login/dashboard/orders/products)
css/style.css           All styles (CSS variables for the brand palette)
js/                     One file per feature — see below
images/                 Drop your real product photos here (see filenames below)
```

## Run it locally

No build tools needed — but browsers block `fetch`/localStorage in some
setups when opening `file://` directly, so serve it instead:

```bash
cd ludhiana-sweets-static
python3 -m http.server 8000
# or: npx serve .
```

Then open http://localhost:8000

## Add your images

Drop real photos into `images/` with these filenames (or edit
`js/products-data.js` / the `<img>` tags in `index.html` / `product.html`):

- `barfi-hero.jpg`, `barfi-1.jpg`, `barfi-2.jpg`, `barfi-3.jpg`, `barfi-4.jpg`
- `about-kitchen.jpg`
- `favicon.png`, `logo.png` (used in the JSON-LD schema)

## Wire up order emails (EmailJS)

1. Create a free account at [emailjs.com](https://www.emailjs.com)
2. Add an email service (Gmail, Outlook, etc.) and create a template using
   these variables: `to_email`, `to_name`, `order_number`, `order_items`,
   `order_total`, `payment_method`, `delivery_address`, `estimated_delivery`
3. Open `js/checkout.js` and fill in `EMAILJS_PUBLIC_KEY`, `EMAILJS_SERVICE_ID`,
   `EMAILJS_TEMPLATE_ID` at the top of the file.

Until you do this, checkout still works end-to-end (order confirmation page,
PDF invoice, admin dashboard) — only the email send is skipped.

## Admin panel

`admin/login.html` — demo credentials: `admin` / `ludhiana123`

**This is a demo-only gate**, not real security — the password lives in
`js/admin-auth.js`, readable by anyone who views the page source. It's meant
to keep casual visitors out while you're building, nothing more. Don't put
real customer data behind it as-is. See the comment at the top of
`js/admin-auth.js` for what to replace it with.

Orders shown in the admin panel are the ones placed through `checkout.html`
**on that same browser** (stored in `localStorage`) — they won't sync across
devices without a real backend.

## What's real vs. placeholder

| Feature | Status |
|---|---|
| Design, responsiveness, animations | Fully built |
| Cart, checkout form validation | Fully built (client-side) |
| SEO meta tags, JSON-LD, sitemap, robots.txt | Fully built |
| Order emails | Needs your EmailJS keys |
| Payment gateways (Stripe/JazzCash/EasyPaisa) | UI only — selecting a method just records it; no real charge happens. Wire up each gateway's hosted checkout/redirect flow when ready. |
| Admin login | Demo password gate — replace before real use |
| Order/product data | Stored in the visitor's browser (localStorage) — add a real backend to share data across devices |

## SEO checklist already done

- Per-page `<title>`, meta description, canonical URL
- Open Graph + Twitter Card tags on every page
- JSON-LD structured data (Organization on homepage, Product on product page)
- `robots.txt` and `sitemap.xml`
- Semantic HTML, alt text on all images, skip-to-content link, visible focus states
