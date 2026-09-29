-- The site_content table was created by hand in the Supabase dashboard, so no migration created it.
-- Rebuilt here from the live definition. Columns added later (social links, maintenance mode) come from
-- file 04. Apply between 03 and 04.
create table public.site_content (
  id smallint primary key default 1,
  hero_title text not null default '',
  hero_subtitle text not null default '',
  hero_image_url text,
  president_name text not null default '',
  president_role text not null default '',
  president_message text not null default '',
  president_photo_url text,
  updated_at timestamptz not null default now(),
  constraint site_content_singleton check (id = 1)
);

alter table public.site_content enable row level security;

create policy site_content_public_select on public.site_content for select using (true);
create policy site_content_admin_update on public.site_content for update
  using ((select auth.uid()) in (select user_id from public.admins));

insert into public.site_content (id) values (1) on conflict (id) do nothing;
