-- Shipping details (courier + tracking number) and "Shipped" flow.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- What changes vs. the previous store_transition_order:
--   1. A confirmed order can go straight to shipped (out_for_delivery) when
--      courier + tracking number are provided (processing step is optional).
--   2. Courier / tracking number / tracking link of an already shipped order
--      can be corrected later (same status, new details).

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

  -- Same status: only a shipped order may have its shipping details corrected.
  if v_order.status = p_status then
    if p_status = 'out_for_delivery' and (p_courier is not null or p_tracking_number is not null or p_tracking_url is not null) then
      if coalesce(trim(coalesce(p_courier, v_order.courier)),'') = ''
         or coalesce(trim(coalesce(p_tracking_number, v_order.tracking_number)),'') = '' then
        raise exception 'TRACKING_REQUIRED';
      end if;
      update public.orders set updated_at=now(),
        courier=coalesce(p_courier,courier), tracking_number=coalesce(p_tracking_number,tracking_number),
        tracking_url=p_tracking_url
      where id=v_order.id;
      insert into public.order_events(order_id,from_status,to_status,note)
        values(v_order.id,v_order.status,p_status,'Shipping details updated');
    end if;
    return true;
  end if;

  v_allowed := case v_order.status
    when 'pending' then p_status in ('confirmed','cancelled')
    when 'pending_whatsapp_confirmation' then p_status in ('confirmed','cancelled')
    when 'confirmed' then p_status in ('processing','out_for_delivery','cancelled')
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
    values(v_order.id,v_order.status,p_status,
      case when p_status='out_for_delivery'
        then 'Shipped via '||coalesce(trim(p_courier),'courier')||' — tracking '||coalesce(trim(p_tracking_number),'')
        else 'Status updated' end);
  return true;
end;
$$;
revoke all on function public.store_transition_order(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.store_transition_order(text,text,text,text,text,text) to service_role;
