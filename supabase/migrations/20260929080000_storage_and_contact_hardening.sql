-- Storage and contact-form hardening.
-- Limits match what the app already enforces client-side (5 MB images, 10 MB documents),
-- so the server now enforces them too for anyone calling the API directly.

-- ---------- Size and type limits ----------
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/avif']
where id in ('news-images','exco-photos','event-images','event-gallery','award-nominee-photos',
             'home-content','page-banners','broadcast-images');

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf','image/jpeg','image/png']
where id in ('outline-attachments','form-uploads');

-- ---------- Stop anyone listing uploaded documents ----------
-- Files stay reachable by their direct URL; only browsing/listing the buckets is restricted.
-- Admins keep SELECT because the storage API needs it to delete files.
drop policy if exists form_uploads_select_public on storage.objects;
drop policy if exists outline_attachments_public_select on storage.objects;

create policy form_uploads_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'form-uploads' and public.is_admin());

create policy outline_attachments_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'outline-attachments' and public.is_admin());

-- ---------- Members upload nominee photos into their own folder ----------
-- Added alongside the old policy; the old any-path policy is removed in a follow-up
-- once the client that writes to <user-id>/ is deployed.
create policy award_nominee_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'award-nominee-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------- Contact form limits ----------
alter table public.contact_messages
  add constraint contact_messages_lengths check (
    char_length(name) between 1 and 100
    and char_length(email) between 3 and 254
    and char_length(message) between 1 and 5000
  );
