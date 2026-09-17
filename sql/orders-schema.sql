-- ============================================================================
-- orders-schema.sql
-- Run this in Supabase Dashboard → SQL Editor → New query (after schema.sql).
-- Migrates orders from browser localStorage to a real, shared table so the
-- WhatsApp confirmation webhook (running on Supabase's servers, not in any
-- customer's browser) can read and update order status.
-- ============================================================================

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  items jsonb not null,
  customer jsonb not null,
  payment_method text not null,
  subtotal integer not null,
  shipping integer not null,
  total integer not null,
  status text not null default 'pending', -- pending | pending_whatsapp_confirmation | confirmed | cancelled | processing | out_for_delivery | delivered
  whatsapp_message_id text, -- the wamid Meta returns when we send the confirmation template — lets the webhook match a reply back to this order
  estimated_delivery text,
  created_at timestamptz not null default now()
);

alter table orders enable row level security;

-- Anyone can create an order (checkout is public / unauthenticated) and can
-- look up an order by its own order number (needed for order-success.html).
-- No sensitive payment data is stored here, so this is an acceptable trade-off
-- for a site with no customer login system.
create policy "Public can insert orders"
  on orders for insert
  to anon
  with check (true);

create policy "Public can view orders"
  on orders for select
  to anon
  using (true);

-- Only signed-in admins can change order status by hand (e.g. from
-- admin/orders.html). The webhook and edge functions use the service_role
-- key, which bypasses RLS entirely, so they don't need a policy here.
create policy "Authenticated admins can update orders"
  on orders for update
  to authenticated
  using (true);

-- Realtime so admin/orders.html updates live when the webhook confirms an
-- order, and order-success.html can show the confirmation the moment it lands.
alter publication supabase_realtime add table orders;
