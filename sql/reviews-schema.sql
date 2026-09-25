-- ==========================================================================
-- reviews-schema.sql
-- Run this once in your Supabase project's SQL Editor.
-- ==========================================================================

-- 1. Table
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  name text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  photo_url text,
  approved boolean not null default false,
  source text not null default 'customer' check (source in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

alter table reviews enable row level security;

-- 2. Public (anon) policies — the storefront runs as anon
create policy "Public can read approved reviews"
  on reviews for select
  to anon
  using (approved = true);

create policy "Public can submit a pending review"
  on reviews for insert
  to anon
  with check (approved = false and source = 'customer');

-- 3. Admin (authenticated) policies — your admin panel logs in via Supabase Auth
create policy "Admins can read all reviews"
  on reviews for select
  to authenticated
  using (true);

create policy "Admins can insert any review"
  on reviews for insert
  to authenticated
  with check (true);

create policy "Admins can update reviews"
  on reviews for update
  to authenticated
  using (true);

create policy "Admins can delete reviews"
  on reviews for delete
  to authenticated
  using (true);

-- 4. Realtime, so the reviews tab updates live like your product prices/stock do
alter publication supabase_realtime add table reviews;

-- ==========================================================================
-- Storage bucket for review photos
-- Do this part in the dashboard first, then run the policies below:
--   Storage → New bucket → name it "review-photos" → toggle "Public bucket" ON
-- ==========================================================================

create policy "Public can upload review photos"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'review-photos');

create policy "Public can view review photos"
  on storage.objects for select
  to anon
  using (bucket_id = 'review-photos');
