-- Row Level Security.
-- This is the change that makes access control real. In the Apps Script version
-- checkPassword() returned {ok:true} to the browser and the session was a
-- localStorage key, while getDashboardData() shipped every row to every visitor
-- before any auth ran. Here the database refuses, so the client cannot lie.

-- ---------------------------------------------------------------- staff -----
alter table staff enable row level security;

create policy staff_read_roster on staff
  for select to authenticated using (active or is_manager());

create policy staff_manager_write on staff
  for all to authenticated using (is_manager()) with check (is_manager());

-- --------------------------------------------------- generators (reference) --
alter table generators enable row level security;

create policy generators_read on generators
  for select to authenticated using (true);

create policy generators_manager_write on generators
  for all to authenticated using (is_manager()) with check (is_manager());

-- ------------------------------------------------------------ data tables ---
-- Pattern per table: insert your own, read your own or everything if manager,
-- managers may correct anything, and staff may fix their own entry for 30
-- minutes (which removes most "please fix this in the Sheet" traffic without
-- handing out general edit rights).

do $$
declare
  t text;
  owner_col text;
begin
  foreach t in array array[
    'garbage_pickups','wastewater_trips','fuel_receipts','purchases',
    'generator_switches','water_bottle_receipts'
  ] loop
    owner_col := 'logged_by';

    execute format('alter table %I enable row level security', t);

    execute format($f$
      create policy insert_own on %I for insert to authenticated
        with check (%I = me())$f$, t, owner_col);

    execute format($f$
      create policy read_own_or_manager on %I for select to authenticated
        using (%I = me() or is_manager())$f$, t, owner_col);

    execute format($f$
      create policy manager_update on %I for update to authenticated
        using (is_manager()) with check (is_manager())$f$, t);

    execute format($f$
      create policy manager_delete on %I for delete to authenticated
        using (is_manager())$f$, t);

    execute format($f$
      create policy staff_fix_recent on %I for update to authenticated
        using (%I = me() and created_at > now() - interval '30 minutes')
        with check (%I = me())$f$, t, owner_col, owner_col);
  end loop;
end $$;

-- Line items follow their parent purchase.
alter table purchase_line_items enable row level security;

create policy line_items_follow_parent on purchase_line_items
  for all to authenticated
  using (exists (select 1 from purchases p
                 where p.id = purchase_id and (p.logged_by = me() or is_manager())))
  with check (exists (select 1 from purchases p
                      where p.id = purchase_id and (p.logged_by = me() or is_manager())));

-- ------------------------------------------------------------- audit log ----
-- Managers read it. Nobody writes it from a client; only the trigger does,
-- and the trigger is security definer so it bypasses this.
alter table audit_log enable row level security;

create policy audit_manager_read on audit_log
  for select to authenticated using (is_manager());
