-- Private evidence bucket. The Apps Script version wrote receipts to Drive and
-- fell back to ANYONE_WITH_LINK sharing when the domain-scoped call failed,
-- which could quietly make supplier invoices world-readable. Nothing here is
-- public; the app issues short-lived signed URLs instead.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('utility-evidence', 'utility-evidence', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy evidence_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'utility-evidence');

create policy evidence_read on storage.objects
  for select to authenticated
  using (bucket_id = 'utility-evidence');

create policy evidence_manager_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'utility-evidence' and is_manager());
