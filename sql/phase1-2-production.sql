-- Apply AFTER the existing schema.sql, orders-schema.sql, reviews-schema.sql.
-- IMPORTANT: review existing data/back up the database first. Run in Supabase SQL Editor.
-- No existing orders or products are deleted.
-- Uses PostgreSQL built-in gen_random_uuid() for cryptographically random order tokens.

create table if not exists public.store_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.store_admins enable row level security;
revoke all on public.store_admins from anon, authenticated;

create or replace function public.is_store_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.store_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_store_admin() from public, anon;
grant execute on function public.is_store_admin() to authenticated, service_role;

alter table public.orders add column if not exists billing_address jsonb default '{"sameAsShipping":true}'::jsonb;
alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add column if not exists checkout_token text;
alter table public.orders add column if not exists idempotency_key uuid unique;
alter table public.orders add column if not exists stock_restored boolean not null default false;
alter table public.orders add column if not exists stock_reserved boolean not null default false;
alter table public.orders add column if not exists courier text;
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists tracking_url text;
alter table public.orders add column if not exists updated_at timestamptz not null default now();
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_whatsapp_id on public.orders(whatsapp_message_id) where whatsapp_message_id is not null;

-- Existing barfi seed referenced missing images; point it to a bundled photo.
update public.products set images = array['images/barfi.png'] where id='barfi-classic' and images @> array['images/barfi-1.jpg'];
-- Correct seeded, unverified aggregate review claims until real reviews are added.
update public.products set review_count=0,rating=0 where id='barfi-classic' and review_count=128;

-- Historic orders have no checkout_token. New ones get one when created via the secured API.
-- No public direct order access: even knowing an order number must not expose customer details.
revoke all on public.orders from anon, authenticated;
alter table public.orders enable row level security;
drop policy if exists "Public can insert orders" on public.orders;
drop policy if exists "Public can view orders" on public.orders;
drop policy if exists "Authenticated admins can update orders" on public.orders;
drop policy if exists "Admins can read orders" on public.orders;
create policy "Admins can read orders" on public.orders for select to authenticated using ((select public.is_store_admin()));
grant select on public.orders to authenticated;

-- Product catalogue public read; writes are only permitted to specifically allowlisted admin accounts.
drop policy if exists "Authenticated users can manage products" on public.products;
drop policy if exists "Authenticated users can manage prices" on public.product_prices;
create policy "Store admins manage products" on public.products for all to authenticated
  using ((select public.is_store_admin())) with check ((select public.is_store_admin()));
create policy "Store admins manage prices" on public.product_prices for all to authenticated
  using ((select public.is_store_admin())) with check ((select public.is_store_admin()));

-- Customer reviews remain public only when approved; only allowlisted staff can moderate.
drop policy if exists "Admins can read all reviews" on public.reviews;
drop policy if exists "Admins can insert any review" on public.reviews;
drop policy if exists "Admins can update reviews" on public.reviews;
drop policy if exists "Admins can delete reviews" on public.reviews;
create policy "Store admins read reviews" on public.reviews for select to authenticated using ((select public.is_store_admin()));
create policy "Store admins create reviews" on public.reviews for insert to authenticated with check ((select public.is_store_admin()));
create policy "Store admins update reviews" on public.reviews for update to authenticated using ((select public.is_store_admin())) with check ((select public.is_store_admin()));
create policy "Store admins delete reviews" on public.reviews for delete to authenticated using ((select public.is_store_admin()));

-- Product image writes require staff membership, not merely a logged-in Supabase account.
drop policy if exists "Authenticated users can upload product images" on storage.objects;
drop policy if exists "Authenticated users can update product images" on storage.objects;
drop policy if exists "Authenticated users can delete product images" on storage.objects;
create policy "Store admins upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and (select public.is_store_admin()));
create policy "Store admins update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and (select public.is_store_admin())) with check (bucket_id = 'product-images' and (select public.is_store_admin()));
create policy "Store admins delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and (select public.is_store_admin()));
drop policy if exists "Public can upload review photos" on storage.objects;
-- Disable unauthenticated uploads until a validated, size-limited upload endpoint exists.

create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.order_events enable row level security;
revoke all on public.order_events from anon, authenticated;
create policy "Store admins read order events" on public.order_events for select to authenticated using ((select public.is_store_admin()));
grant select on public.order_events to authenticated;

-- Only a service-role server may call this procedure. Prices, shipping and inventory
-- are ALWAYS read/calculated inside this database transaction, never trusted from browser.
create or replace function public.store_place_order(
  p_items jsonb, p_customer jsonb, p_billing jsonb,
  p_payment_method text, p_idempotency uuid, p_expected_total integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_item jsonb; v_variant record; v_qty integer; v_subtotal integer := 0;
  v_shipping integer; v_items jsonb := '[]'::jsonb; v_order public.orders%rowtype;
  v_token text; v_number text; v_count integer := 0;
begin
  if p_payment_method <> 'cod' then raise exception 'ONLINE_PAYMENT_UNAVAILABLE'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'INVALID_CART';
  end if;
  if p_idempotency is null then raise exception 'INVALID_IDEMPOTENCY'; end if;
  if length(trim(coalesce(p_customer->>'fullName',''))) not between 2 and 120
    or length(trim(coalesce(p_customer->>'address',''))) not between 6 and 250
    or length(trim(coalesce(p_customer->>'city',''))) not between 2 and 90
    or length(coalesce(p_customer->>'phone','')) not between 10 and 25
    or length(coalesce(p_customer->>'email','')) not between 5 and 160 then
    raise exception 'INVALID_CUSTOMER';
  end if;
  select * into v_order from public.orders where idempotency_key = p_idempotency;
  if found then
    return jsonb_build_object('orderNumber',v_order.order_number,'trackingToken',v_order.checkout_token,
      'status',v_order.status,'total',v_order.total,'shipping',v_order.shipping,'created',false);
  end if;
  -- Serialize checkout for the same idempotency key even when two requests arrive together.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency::text, 0));
  select * into v_order from public.orders where idempotency_key = p_idempotency;
  if found then
    return jsonb_build_object('orderNumber',v_order.order_number,'trackingToken',v_order.checkout_token,
      'status',v_order.status,'total',v_order.total,'shipping',v_order.shipping,'created',false);
  end if;
  -- Limit repeated unverified COD orders per phone to reduce stock exhaustion.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('phone:' || (p_customer->>'phone'), 0));
  if (select count(*) from public.orders
      where customer->>'phone' = p_customer->>'phone' and created_at > now() - interval '1 hour'
        and status <> 'cancelled') >= 5 then
    raise exception 'RATE_LIMITED';
  end if;
  -- Lock variants in deterministic order to avoid two concurrent carts deadlocking.
  for v_item in select value from jsonb_array_elements(p_items) value order by (value->>'productId'), (value->>'weight') loop
    if jsonb_typeof(v_item) <> 'object' or (v_item->>'quantity') !~ '^[0-9]{1,2}$' then
      raise exception 'INVALID_ITEM';
    end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty not between 1 and 20 then raise exception 'INVALID_QUANTITY'; end if;
    select pp.id,pp.price,pp.stock,p.name,p.images into v_variant
      from public.product_prices pp join public.products p on p.id = pp.product_id
      where pp.product_id = (v_item->>'productId') and pp.weight = (v_item->>'weight')
      order by pp.id limit 1 for update of pp;
    if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
    if v_variant.price < 0 or v_variant.stock < v_qty then raise exception 'OUT_OF_STOCK'; end if;
    update public.product_prices set stock = stock - v_qty where id = v_variant.id;
    v_subtotal := v_subtotal + v_variant.price * v_qty;
    if v_subtotal > 5000000 then raise exception 'ORDER_TOO_LARGE'; end if;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'variantId',v_variant.id,'productId',v_item->>'productId','weight',v_item->>'weight',
      'name',v_variant.name,'quantity',v_qty,'unitPrice',v_variant.price,
      'image',coalesce(v_variant.images[1], 'images/barfi.png')));
    v_count := v_count + 1;
  end loop;
  if v_count = 0 then raise exception 'INVALID_CART'; end if;
  v_shipping := 200; -- COD delivery, server controlled; extend for shipping zones later.
  if p_expected_total is null or p_expected_total <> (v_subtotal + v_shipping) then
    raise exception 'PRICE_CHANGED';
  end if;
  v_token := pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '') || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '');
  v_number := 'LS-' || pg_catalog.to_char(pg_catalog.now(),'YYYYMMDD') || '-' || pg_catalog.upper(pg_catalog.substring(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '') from 1 for 10));
  insert into public.orders(order_number,items,customer,billing_address,payment_method,
    subtotal,shipping,total,status,payment_status,checkout_token,idempotency_key,stock_reserved)
  values(v_number,v_items,p_customer,coalesce(p_billing,'{"sameAsShipping":true}'::jsonb),'cod',
    v_subtotal,v_shipping,v_subtotal + v_shipping,'pending_whatsapp_confirmation','unpaid',v_token,p_idempotency,true)
  returning * into v_order;
  insert into public.order_events(order_id,to_status,note) values(v_order.id,v_order.status,'Order created and stock reserved');
  return jsonb_build_object('orderNumber',v_number,'trackingToken',v_token,
    'status',v_order.status,'subtotal',v_subtotal,'shipping',v_shipping,
    'total',v_order.total,'created',true);
end;
$$;
revoke all on function public.store_place_order(jsonb,jsonb,jsonb,text,uuid,integer) from public, anon, authenticated;
grant execute on function public.store_place_order(jsonb,jsonb,jsonb,text,uuid,integer) to service_role;

create or replace function public.store_transition_order(
  p_number text, p_status text, p_courier text default null,
  p_tracking_number text default null, p_tracking_url text default null,
  p_expected_status text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_allowed boolean;
begin
  select * into v_order from public.orders where order_number = p_number for update;
  if not found then return false; end if;
  if p_expected_status is not null and v_order.status <> p_expected_status then return false; end if;
  if v_order.status = p_status then return true; end if;
  v_allowed := case v_order.status
    when 'pending' then p_status in ('confirmed','cancelled')
    when 'pending_whatsapp_confirmation' then p_status in ('confirmed','cancelled')
    when 'confirmed' then p_status in ('processing','cancelled')
    when 'processing' then p_status in ('out_for_delivery','cancelled')
    when 'out_for_delivery' then p_status in ('delivered','cancelled')
    else false end;
  if not v_allowed then raise exception 'INVALID_STATUS_TRANSITION'; end if;
  if p_status = 'out_for_delivery' and (coalesce(trim(p_courier),'') = '' or coalesce(trim(p_tracking_number),'') = '') then
    raise exception 'TRACKING_REQUIRED';
  end if;
  if p_status = 'cancelled' and v_order.stock_reserved and not v_order.stock_restored then
    update public.product_prices pp set stock = pp.stock + (x.quantity)::integer
    from jsonb_to_recordset(v_order.items) as x("variantId" uuid,quantity integer)
    where pp.id = x."variantId";
  end if;
  update public.orders set status=p_status, updated_at=now(),
    stock_restored=case when p_status='cancelled' then true else stock_restored end,
    courier=coalesce(p_courier,courier), tracking_number=coalesce(p_tracking_number,tracking_number),
    tracking_url=coalesce(p_tracking_url,tracking_url)
  where id=v_order.id;
  insert into public.order_events(order_id,from_status,to_status,note)
    values(v_order.id,v_order.status,p_status,'Status updated');
  return true;
end;
$$;
revoke all on function public.store_transition_order(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.store_transition_order(text,text,text,text,text,text) to service_role;

-- Restrict old direct reads in existing Realtime configurations.
-- Do not rely on public Realtime channels for customer order updates.
-- Add the UUID of your actual Supabase Auth admin user after running the migration:
-- insert into public.store_admins(user_id) values ('YOUR-AUTH-USER-UUID');

-- COD can only be recorded as collected by an authorized server action after delivery.
create or replace function public.store_collect_cod(p_number text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set payment_status='paid',updated_at=now()
  where order_number=p_number and payment_method='cod' and status='delivered' and payment_status='unpaid';
  return found;
end;
$$;
revoke all on function public.store_collect_cod(text) from public,anon,authenticated;
grant execute on function public.store_collect_cod(text) to service_role;
