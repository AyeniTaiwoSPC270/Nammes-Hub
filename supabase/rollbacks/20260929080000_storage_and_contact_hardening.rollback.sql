-- EMERGENCY ROLLBACK for 20260929080000_storage_and_contact_hardening.sql
-- Run only if uploads start failing unexpectedly. Restores unlimited size/type and public listing.

update storage.buckets set file_size_limit = null, allowed_mime_types = null
where id in ('news-images','exco-photos','event-images','event-gallery','award-nominee-photos',
             'home-content','page-banners','broadcast-images','outline-attachments','form-uploads');

drop policy if exists form_uploads_select_admin on storage.objects;
drop policy if exists outline_attachments_select_admin on storage.objects;
create policy form_uploads_select_public on storage.objects for select to public using (bucket_id = 'form-uploads');
create policy outline_attachments_public_select on storage.objects for select to public using (bucket_id = 'outline-attachments');

drop policy if exists award_nominee_photos_insert_own on storage.objects;
alter table public.contact_messages drop constraint if exists contact_messages_lengths;
