-- Append-only change history. Replaces "the Sheet is the audit trail", and is
-- what makes it safe to allow edits at all (the old app had no update path, so
-- corrections were made directly in the Sheet, bypassing every check).

create table audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     text not null,
  action     text not null check (action in ('INSERT','UPDATE','DELETE')),
  actor      uuid,
  diff       jsonb,
  at         timestamptz not null default now()
);
create index on audit_log (table_name, row_id);
create index on audit_log (at desc);

create or replace function audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (table_name, row_id, action, actor, diff)
  values (
    tg_table_name,
    coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id'),
    tg_op,
    auth.uid(),
    case tg_op
      when 'INSERT' then to_jsonb(new)
      when 'DELETE' then to_jsonb(old)
      else jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
    end
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'garbage_pickups','wastewater_trips','fuel_receipts','purchases',
    'purchase_line_items','generator_switches','water_bottle_receipts','staff'
  ] loop
    execute format('create trigger %I_audit after insert or update or delete on %I
      for each row execute function audit()', t, t);
  end loop;
end $$;
