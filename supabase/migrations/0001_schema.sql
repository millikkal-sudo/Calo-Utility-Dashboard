-- Calo Utility Dashboard — core schema
-- Replaces the eight Google Sheet tabs from the Apps Script version.
-- Derived values (gallons, net_quantity, line_total) are generated columns so
-- they can never drift from their inputs the way stored copies did.

create extension if not exists pgcrypto;

create type shift_name     as enum ('Morning','Afternoon','Night');
create type fuel_kind      as enum ('Gas','Diesel');
create type payment_method as enum ('Cash','Card');
create type level_unit     as enum ('litres','percent');
create type staff_role     as enum ('staff','manager');

-- ---------------------------------------------------------------- people ----
create table staff (
  id         uuid primary key default gen_random_uuid(),
  auth_uid   uuid unique references auth.users on delete set null,
  full_name  text not null,
  role       staff_role not null default 'staff',
  pin_hash   text,
  active     boolean not null default true,
  legacy_id  text,
  created_at timestamptz not null default now()
);

-- security definer so the policies below can call these without recursing
-- through staff's own RLS.
create or replace function is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from staff
    where auth_uid = auth.uid() and role = 'manager' and active
  );
$$;

create or replace function me() returns uuid
language sql stable security definer set search_path = public as $$
  select id from staff where auth_uid = auth.uid();
$$;

-- Only @calo.app may hold an account at all.
create or replace function enforce_email_domain() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null
     and new.email not ilike '%@' || coalesce(
       current_setting('app.allowed_email_domain', true), 'calo.app')
  then
    raise exception 'Sign-in is restricted to Calo accounts.';
  end if;
  return new;
end;
$$;

create trigger auth_domain_guard
  before insert on auth.users
  for each row execute function enforce_email_domain();

-- ------------------------------------------------------------- generators ----
create table generators (
  id          text primary key,          -- 'GEN-01'
  label       text,
  cycle_hours int not null default 12 check (cycle_hours between 1 and 168),
  active      boolean not null default true
);

-- ----------------------------------------------------------------- garbage ---
create table garbage_pickups (
  id               bigint generated always as identity primary key,
  occurred_on      date not null,
  shift            shift_name not null,
  collections      int not null check (collections between 1 and 50),
  photo_path       text,
  legacy_photo_url text,
  logged_by        uuid not null references staff(id),
  legacy_id        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------- waste water ---
create table wastewater_trips (
  id               bigint generated always as identity primary key,
  occurred_on      date not null,
  tank_capacity    int not null check (tank_capacity in (5000,10000)),
  trips            int not null check (trips between 1 and 50),
  gallons          int generated always as (tank_capacity * trips) stored,
  photo_path       text,
  legacy_photo_url text,
  logged_by        uuid not null references staff(id),
  legacy_id        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- -------------------------------------------------------------------- fuel ---
create table fuel_receipts (
  id               bigint generated always as identity primary key,
  occurred_on      date not null,
  fuel_type        fuel_kind not null,
  start_meter      numeric(12,2) not null check (start_meter >= 0),
  end_meter        numeric(12,2) not null,
  net_quantity     numeric(12,2) generated always as (end_meter - start_meter) stored,
  delivery_note_no text,
  note_path        text,
  legacy_photo_url text,
  received_by      uuid not null references staff(id),
  logged_by        uuid not null references staff(id),
  legacy_id        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- the old code clamped a reversed reading to 0, turning a typo into a
  -- silent zero. Reject it instead.
  constraint meter_forward check (end_meter >= start_meter)
);

-- --------------------------------------------------------------- purchases ---
create table purchases (
  id               bigint generated always as identity primary key,
  occurred_on      date not null,
  vendor           text,
  total_amount     numeric(12,2) not null check (total_amount >= 0),
  payment_method   payment_method not null,
  receipt_path     text,
  legacy_photo_url text,
  purchased_by     uuid not null references staff(id),
  logged_by        uuid not null references staff(id),
  legacy_id        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table purchase_line_items (
  id          bigint generated always as identity primary key,
  purchase_id bigint not null references purchases(id) on delete cascade,
  item_name   text not null,
  quantity    numeric(12,2) not null check (quantity >= 0),
  unit_price  numeric(12,2) not null check (unit_price >= 0),
  line_total  numeric(14,2) generated always as (quantity * unit_price) stored
);
create index on purchase_line_items (purchase_id);

-- -------------------------------------------------------------- generators ---
create table generator_switches (
  id               bigint generated always as identity primary key,
  generator_id     text not null references generators(id),
  -- the real event time. The Apps Script version used the row's created_at,
  -- so logging an hour late silently shifted the 12h cycle.
  switched_at      timestamptz not null,
  diesel_level     numeric(10,2) not null check (diesel_level >= 0),
  level_unit       level_unit not null default 'litres',
  photo_path       text,
  legacy_photo_url text,
  logged_by        uuid not null references staff(id),
  legacy_id        text,
  created_at       timestamptz not null default now(),
  constraint level_pct_range check (level_unit <> 'percent' or diesel_level <= 100)
);
create index on generator_switches (generator_id, switched_at desc);

-- ----------------------------------------------------------- water bottles ---
create table water_bottle_receipts (
  id               bigint generated always as identity primary key,
  occurred_on      date not null,
  bottles          int not null check (bottles between 1 and 5000),
  received_by      uuid not null references staff(id),
  logged_by        uuid not null references staff(id),
  invoice_path     text,
  legacy_photo_url text,
  legacy_id        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------------ indexes --
create index on garbage_pickups       (occurred_on);
create index on wastewater_trips      (occurred_on);
create index on fuel_receipts         (occurred_on, fuel_type);
create index on purchases             (occurred_on);
create index on water_bottle_receipts (occurred_on);

-- --------------------------------------------------------------- updated_at --
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare t text;
begin
  foreach t in array array['garbage_pickups','wastewater_trips','fuel_receipts',
                           'purchases','water_bottle_receipts']
  loop
    execute format('create trigger %I_touch before update on %I
      for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;

-- ------------------------------------------------------- meter continuity ----
-- A delivery's start_meter must match the previous reading for that fuel type.
-- The Sheet version never checked this.
create or replace function check_meter_continuity() returns trigger
language plpgsql as $$
declare prev numeric;
begin
  if current_setting('app.skip_meter_check', true) = 'on' then
    return new;
  end if;

  select end_meter into prev
  from fuel_receipts
  where fuel_type = new.fuel_type
    and (new.id is null or id <> new.id)
    and (occurred_on < new.occurred_on
         or (occurred_on = new.occurred_on and id < coalesce(new.id, 2147483647)))
  order by occurred_on desc, id desc
  limit 1;

  if prev is not null and new.start_meter <> prev then
    raise exception
      'Start meter % does not match the previous % reading of %',
      new.start_meter, new.fuel_type, prev
      using hint = 'Confirm the reading, or correct the earlier entry first.',
            errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger fuel_meter_continuity
  before insert or update on fuel_receipts
  for each row execute function check_meter_continuity();

-- --------------------------------------------------- generator status view ---
create or replace view generator_status
with (security_invoker = true) as
select g.id, g.label, g.cycle_hours,
       s.switched_at, s.diesel_level, s.level_unit, s.logged_by,
       st.full_name as logged_by_name,
       s.switched_at + make_interval(hours => g.cycle_hours) as due_at,
       now() > s.switched_at + make_interval(hours => g.cycle_hours) as overdue
from generators g
left join lateral (
  select * from generator_switches
  where generator_id = g.id order by switched_at desc limit 1
) s on true
left join staff st on st.id = s.logged_by
where g.active;
