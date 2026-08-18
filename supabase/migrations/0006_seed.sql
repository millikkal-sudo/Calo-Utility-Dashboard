-- Seed reference data. Adjust to match your floor.
-- Staff rows are created without auth_uid; they link on first sign-in
-- (see lib/supabase/link-staff.ts) or you can set auth_uid by hand.

insert into generators (id, label, cycle_hours) values
  ('GEN-01', 'Main kitchen generator', 12),
  ('GEN-02', 'Cold store generator',   12)
on conflict (id) do nothing;

insert into staff (full_name, role) values
  ('Kuldeep',       'manager'),
  ('Sagar',         'manager'),
  ('Pankaj Tiwari', 'manager')
on conflict do nothing;
