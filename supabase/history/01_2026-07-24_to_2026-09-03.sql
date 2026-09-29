-- Exported from Supabase's applied-migration history (supabase_migrations.schema_migrations).
-- These ran on the live project before the repo tracked migrations. Apply files in this folder in
-- order (01, 02, ...) on a fresh project, then the files in supabase/migrations. Later migrations
-- replace some of these policies and functions, which is expected.

-- ===== 20260724081427_create_cgpa_tables =====
create table public.cgpa_semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('100','200','300','400','500')),
  semester smallint not null check (semester in (1,2)),
  created_at timestamptz not null default now(),
  unique (user_id, level, semester)
);

create table public.cgpa_courses (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.cgpa_semesters(id) on delete cascade,
  code text not null,
  title text,
  units smallint not null check (units between 1 and 6),
  grade text not null check (grade in ('A','B','C','D','E','F')),
  counts_toward_cgpa boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.cgpa_semesters enable row level security;
alter table public.cgpa_courses enable row level security;

create policy "Users manage their own semesters"
  on public.cgpa_semesters
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage courses in their own semesters"
  on public.cgpa_courses
  for all
  using (
    exists (
      select 1 from public.cgpa_semesters s
      where s.id = cgpa_courses.semester_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cgpa_semesters s
      where s.id = cgpa_courses.semester_id and s.user_id = auth.uid()
    )
  );

-- ===== 20260809113803_admin_cms_schema =====
-- Content tables
create table news (
  id text primary key,
  category text not null,
  tone text,
  date date not null,
  title text not null,
  body text not null,
  author text not null,
  badge_tone text,
  badge_label text,
  image_url text,
  image_width_pct int,
  created_at timestamptz not null default now()
);

create table opportunities (
  id text primary key,
  type text not null,
  title text not null,
  org text not null,
  deadline date not null,
  link text not null,
  created_at timestamptz not null default now()
);

create table events (
  id text primary key,
  title text not null,
  date text not null,
  tone text,
  meta text,
  description text,
  created_at timestamptz not null default now()
);

create table resources (
  id text primary key,
  level int not null,
  semester int not null,
  category text not null,
  title text not null,
  updated date not null,
  link text not null,
  created_at timestamptz not null default now()
);

create table outlines (
  id text primary key,
  level int not null,
  semester int not null,
  code text not null,
  title text not null,
  units int not null,
  lecturer text not null,
  updated date not null,
  description text not null,
  topics text[] not null default '{}',
  texts text[],
  created_at timestamptz not null default now()
);

create table excos (
  id text primary key,
  role text not null,
  name text,
  photo_url text,
  sort_order int not null,
  created_at timestamptz not null default now()
);

create table admins (
  user_id uuid primary key references auth.users(id)
);

-- RLS
alter table news enable row level security;
alter table opportunities enable row level security;
alter table events enable row level security;
alter table resources enable row level security;
alter table outlines enable row level security;
alter table excos enable row level security;
alter table admins enable row level security;

-- Each user may only see their own admins row (enough for the `in (select ...)`
-- membership check below to work; it does NOT expose the full admin list).
create policy admins_self_select on admins for select using (auth.uid() = user_id);

create policy news_public_select on news for select using (true);
create policy news_admin_insert on news for insert with check (auth.uid() in (select user_id from admins));
create policy news_admin_update on news for update using (auth.uid() in (select user_id from admins));
create policy news_admin_delete on news for delete using (auth.uid() in (select user_id from admins));

create policy opportunities_public_select on opportunities for select using (true);
create policy opportunities_admin_insert on opportunities for insert with check (auth.uid() in (select user_id from admins));
create policy opportunities_admin_update on opportunities for update using (auth.uid() in (select user_id from admins));
create policy opportunities_admin_delete on opportunities for delete using (auth.uid() in (select user_id from admins));

create policy events_public_select on events for select using (true);
create policy events_admin_insert on events for insert with check (auth.uid() in (select user_id from admins));
create policy events_admin_update on events for update using (auth.uid() in (select user_id from admins));
create policy events_admin_delete on events for delete using (auth.uid() in (select user_id from admins));

create policy resources_public_select on resources for select using (true);
create policy resources_admin_insert on resources for insert with check (auth.uid() in (select user_id from admins));
create policy resources_admin_update on resources for update using (auth.uid() in (select user_id from admins));
create policy resources_admin_delete on resources for delete using (auth.uid() in (select user_id from admins));

create policy outlines_public_select on outlines for select using (true);
create policy outlines_admin_insert on outlines for insert with check (auth.uid() in (select user_id from admins));
create policy outlines_admin_update on outlines for update using (auth.uid() in (select user_id from admins));
create policy outlines_admin_delete on outlines for delete using (auth.uid() in (select user_id from admins));

create policy excos_public_select on excos for select using (true);
create policy excos_admin_insert on excos for insert with check (auth.uid() in (select user_id from admins));
create policy excos_admin_update on excos for update using (auth.uid() in (select user_id from admins));
create policy excos_admin_delete on excos for delete using (auth.uid() in (select user_id from admins));

-- Storage buckets (public read, admin write, 5MB cap)
insert into storage.buckets (id, name, public, file_size_limit)
values ('news-images', 'news-images', true, 5242880)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('exco-photos', 'exco-photos', true, 5242880)
on conflict (id) do nothing;

create policy news_images_public_select on storage.objects for select using (bucket_id = 'news-images');
create policy news_images_admin_insert on storage.objects for insert with check (bucket_id = 'news-images' and auth.uid() in (select user_id from admins));
create policy news_images_admin_update on storage.objects for update using (bucket_id = 'news-images' and auth.uid() in (select user_id from admins));
create policy news_images_admin_delete on storage.objects for delete using (bucket_id = 'news-images' and auth.uid() in (select user_id from admins));

create policy exco_photos_public_select on storage.objects for select using (bucket_id = 'exco-photos');
create policy exco_photos_admin_insert on storage.objects for insert with check (bucket_id = 'exco-photos' and auth.uid() in (select user_id from admins));
create policy exco_photos_admin_update on storage.objects for update using (bucket_id = 'exco-photos' and auth.uid() in (select user_id from admins));
create policy exco_photos_admin_delete on storage.objects for delete using (bucket_id = 'exco-photos' and auth.uid() in (select user_id from admins));

-- ===== 20260830181735_events_image_upload =====
alter table events add column image_url text;

insert into storage.buckets (id, name, public) values ('event-images', 'event-images', true);

create policy "event_images_public_select" on storage.objects for select
  to public using (bucket_id = 'event-images');

create policy "event_images_admin_insert" on storage.objects for insert
  to public with check (bucket_id = 'event-images' and auth.uid() in (select user_id from admins));

create policy "event_images_admin_update" on storage.objects for update
  to public using (bucket_id = 'event-images' and auth.uid() in (select user_id from admins));

create policy "event_images_admin_delete" on storage.objects for delete
  to public using (bucket_id = 'event-images' and auth.uid() in (select user_id from admins));

-- ===== 20260903173733_event_photos_gallery =====
create table event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete cascade,
  image_url text not null,
  created_at timestamptz not null default now()
);

alter table event_photos enable row level security;

create policy "event_photos_public_select" on event_photos for select
  to public using (true);

create policy "event_photos_admin_insert" on event_photos for insert
  to public with check (auth.uid() in (select user_id from admins));

create policy "event_photos_admin_delete" on event_photos for delete
  to public using (auth.uid() in (select user_id from admins));

insert into storage.buckets (id, name, public) values ('event-gallery', 'event-gallery', true);

create policy "event_gallery_public_select" on storage.objects for select
  to public using (bucket_id = 'event-gallery');

create policy "event_gallery_admin_insert" on storage.objects for insert
  to public with check (bucket_id = 'event-gallery' and auth.uid() in (select user_id from admins));

create policy "event_gallery_admin_delete" on storage.objects for delete
  to public using (bucket_id = 'event-gallery' and auth.uid() in (select user_id from admins));

-- ===== 20260903204401_add_outline_links_and_timetables =====
alter table public.outlines
  add column past_questions_link text,
  add column lecturer_notes_link text;

create table public.timetables (
  id text primary key,
  level integer not null,
  semester integer not null,
  type text not null check (type in ('class', 'exam')),
  day text,
  date date,
  start_time time not null,
  end_time time not null,
  code text not null,
  title text not null,
  venue text not null,
  lecturer text,
  created_at timestamptz not null default now()
);

alter table public.timetables enable row level security;

create policy timetables_public_select on public.timetables
  for select to public using (true);

create policy timetables_admin_insert on public.timetables
  for insert to public with check (auth.uid() in (select user_id from admins));

create policy timetables_admin_update on public.timetables
  for update to public using (auth.uid() in (select user_id from admins));

create policy timetables_admin_delete on public.timetables
  for delete to public using (auth.uid() in (select user_id from admins));

-- ===== 20260903210439_add_notes_to_timetables =====
alter table public.timetables add column notes text;
