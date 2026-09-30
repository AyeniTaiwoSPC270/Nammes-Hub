-- Handbook: editable covers, front pages and authors.
-- `texts` holds the wording of the covers/front pages (only fields an admin changed), `authors` holds
-- { team, session, people: [{ name, role, photo }] }. Both are validated again by the server before a build.
alter table public.handbook_settings
  add column if not exists texts jsonb,
  add column if not exists authors jsonb;
grant update (texts, authors) on public.handbook_settings to authenticated;

-- Admins upload author photos into the handbook bucket, under authors/ only. Reading is public (public bucket);
-- the server removes photos that are no longer used.
update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    file_size_limit = 52428800
where id = 'handbook';

create policy handbook_author_photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'handbook'
    and (storage.foldername(name))[1] = 'authors'
    and (select public.is_admin())
  );
