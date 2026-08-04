-- ============================================================================
-- Ludhiana Sweets — Supabase schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query
-- → paste this whole file → Run.
-- ============================================================================

-- ---------- Tables ----------

create table if not exists products (
  id text primary key,
  slug text unique not null,
  name text not null,
  tagline text,
  description text,
  ingredients text[],
  storage_instructions text,
  images text[] default '{}',
  category text,
  rating numeric default 5,
  review_count integer default 0,
  featured boolean default false,
  created_at timestamptz default now()
);

create table if not exists product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id text references products(id) on delete cascade,
  weight text not null,
  price integer not null default 0,
  stock integer not null default 0
);

-- ---------- Row Level Security ----------
-- Anyone (including anonymous storefront visitors) can READ products/prices.
-- Only a signed-in admin (real Supabase Auth user) can add/edit/delete.

alter table products enable row level security;
alter table product_prices enable row level security;

create policy "Public can read products"
  on products for select
  to anon, authenticated
  using (true);

create policy "Authenticated users can manage products"
  on products for all
  to authenticated
  using (true)
  with check (true);

create policy "Public can read prices"
  on product_prices for select
  to anon, authenticated
  using (true);

create policy "Authenticated users can manage prices"
  on product_prices for all
  to authenticated
  using (true)
  with check (true);

-- ---------- Realtime ----------
-- Lets shop.html / product.html get live updates the instant an admin
-- changes something (see js/products-data.js's subscribeToProductChanges).

alter publication supabase_realtime add table products;
alter publication supabase_realtime add table product_prices;

-- ---------- Storage bucket for product images ----------
-- Public read (so images display on the storefront), authenticated-only write.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Public can view product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy "Authenticated users can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

create policy "Authenticated users can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images');

create policy "Authenticated users can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');

-- ---------- Seed data (your existing barfi product) ----------
-- Safe to skip/delete if you'd rather add everything fresh through the admin panel.

insert into products (id, slug, name, tagline, description, ingredients, storage_instructions, images, category, rating, review_count, featured)
values (
  'barfi-classic',
  'ludhiana-special-barfi',
  'Ludhiana Special Barfi',
  'Handcrafted with pure desi ghee, the traditional Ludhiana way',
  E'Our signature barfi is simmered slowly in pure desi ghee and full-cream khoya, finished with a dusting of silver warq and slivered pistachios. It''s the same recipe carried from Ludhiana''s sweet houses generations ago — dense, milky, and never overly sweet.',
  array['Full-cream khoya', 'Cane sugar', 'Cardamom', 'Almonds'],
  'Store in an airtight container at room temperature for up to 4 days, or refrigerate for up to 10 days. Bring to room temperature before serving for the best texture.',
  array['images/barfi-1.jpg', 'images/barfi-2.jpg', 'images/barfi-3.jpg', 'images/barfi-4.jpg'],
  'Barfi',
  4.9,
  128,
  true
)
on conflict (id) do nothing;

insert into product_prices (product_id, weight, price, stock) values
  ('barfi-classic', '500g', 1000, 35),
  ('barfi-classic', '1kg', 1800, 20)
on conflict do nothing;

-- ---------- Next: create your admin login ----------
-- Dashboard → Authentication → Users → Add User → set an email + password.
-- Use those credentials to sign in at admin/login.html once
-- js/supabase-client.js has your project URL and anon key.
