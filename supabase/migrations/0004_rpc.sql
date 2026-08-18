-- Replaces getDashboardData().
--
-- The old function read all eight tabs in full on every page load and shipped
-- the entire dataset to the browser, which then did all filtering client-side.
-- This aggregates in Postgres and returns one small object.
--
-- security INVOKER is deliberate and load-bearing: the RPC runs under the
-- caller's RLS, so a staff member sees only their own numbers. Making this
-- security definer would reopen exactly the hole this migration closes.

create or replace function dashboard_summary(
  p_start date,
  p_end   date,
  p_staff uuid default null
) returns jsonb
language sql stable security invoker as $$
  with
  g as (select coalesce(sum(collections),0) n from garbage_pickups
        where occurred_on between p_start and p_end
          and (p_staff is null or logged_by = p_staff)),
  w as (select coalesce(sum(gallons),0) gal,
               coalesce(sum(trips) filter (where tank_capacity = 5000),0)  t5,
               coalesce(sum(trips) filter (where tank_capacity = 10000),0) t10
        from wastewater_trips
        where occurred_on between p_start and p_end
          and (p_staff is null or logged_by = p_staff)),
  f as (select coalesce(sum(net_quantity) filter (where fuel_type='Gas'),0)    gas,
               coalesce(sum(net_quantity) filter (where fuel_type='Diesel'),0) diesel
        from fuel_receipts
        where occurred_on between p_start and p_end
          and (p_staff is null or received_by = p_staff)),
  fd as (select jsonb_agg(jsonb_build_object(
                  'd', occurred_on, 'gas', gas, 'diesel', diesel)
                order by occurred_on) series
         from (select occurred_on,
                      coalesce(sum(net_quantity) filter (where fuel_type='Gas'),0)    gas,
                      coalesce(sum(net_quantity) filter (where fuel_type='Diesel'),0) diesel
               from fuel_receipts
               where occurred_on between p_start and p_end
                 and (p_staff is null or received_by = p_staff)
               group by occurred_on) x),
  p as (select coalesce(sum(total_amount),0) total,
               coalesce(sum(total_amount) filter (where payment_method='Cash'),0) cash,
               coalesce(sum(total_amount) filter (where payment_method='Card'),0) card
        from purchases
        where occurred_on between p_start and p_end
          and (p_staff is null or purchased_by = p_staff)),
  b as (select coalesce(sum(bottles),0) n from water_bottle_receipts
        where occurred_on between p_start and p_end
          and (p_staff is null or received_by = p_staff))
  select jsonb_build_object(
    'pickups',     (select n from g),
    'gallons',     (select gal from w),
    'tanks',       jsonb_build_object('t5', (select t5 from w), 't10', (select t10 from w)),
    'gas',         (select gas from f),
    'diesel',      (select diesel from f),
    'fuel_series', coalesce((select series from fd), '[]'::jsonb),
    'spend',       (select total from p),
    'pay',         jsonb_build_object('cash', (select cash from p), 'card', (select card from p)),
    'bottles',     (select n from b)
  );
$$;

-- Paginated activity feed. Replaces merging six client-side arrays and sorting
-- the whole thing on every render.
create or replace view activity_feed
with (security_invoker = true) as
  select 'Garbage'::text kind, id::text ref, occurred_on, created_at,
         collections || ' pickup(s) · ' || shift as detail,
         logged_by, photo_path, legacy_photo_url
  from garbage_pickups
union all
  select 'Waste Water', id::text, occurred_on, created_at,
         trips || ' trip(s) · ' || to_char(tank_capacity, 'FM999,999') || ' gal',
         logged_by, photo_path, legacy_photo_url
  from wastewater_trips
union all
  select 'Fuel · ' || fuel_type::text, id::text, occurred_on, created_at,
         to_char(net_quantity, 'FM999,999.99') || ' units',
         received_by, note_path, legacy_photo_url
  from fuel_receipts
union all
  select 'Purchase', id::text, occurred_on, created_at,
         coalesce(vendor, '—') || ' · AED ' || to_char(total_amount, 'FM999,999.00')
           || ' · ' || payment_method::text,
         purchased_by, receipt_path, legacy_photo_url
  from purchases
union all
  select 'Generator', id::text, switched_at::date, created_at,
         'Gen ' || generator_id || ' · diesel ' ||
         to_char(diesel_level, 'FM999,999.99') || ' ' || level_unit::text,
         logged_by, photo_path, legacy_photo_url
  from generator_switches
union all
  select 'Water Bottles', id::text, occurred_on, created_at,
         bottles || ' bottle(s) received',
         received_by, invoice_path, legacy_photo_url
  from water_bottle_receipts;
