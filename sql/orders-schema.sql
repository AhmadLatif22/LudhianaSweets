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

-- SECURITY: public orders are private. No policies grant anonymous read or write.
-- Apply phase1-2-production.sql to create the protected server order RPC,
 -- administrator allowlist and privacy-preserving tracking API.
revoke all on orders from anon, authenticated;

-- Realtime so admin/orders.html updates live when the webhook confirms an
-- order, and order-success.html can show the confirmation the moment it lands.
alter publication supabase_realtime add table orders;
