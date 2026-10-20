-- Holiday themes: owner-built seasons (Christmas, Easter, Valentine's, Independence Day) that repaint
-- the whole site and offer a matching look in the quiz studio.
-- Spec: docs/superpowers/specs/2026-10-20-holiday-themes-design.md
--
-- The design is a NEW pair of tables rather than extending content_looks: that system's vocabulary is
-- card layouts for /events and /news, with no schedule, no decor, no storage and no quiz mapping in it,
-- and `content_looks.page` must keep meaning a content page. calendar_looks is the shape copied here —
-- client-minted text PK, jsonb design, owner-write — because a holiday theme repaints the whole site
-- the way a calendar look repaints one page, and more widely than the admin-write studios ever could.
--
-- `starts_on`/`ends_on` are `date`, never `timestamptz`: a holiday is a range of days, not an instant,
-- and the same reasoning as academic_calendar applies — a timestamp would invent a midnight and
-- re-render it through each viewer's timezone. "Today" is resolved in Africa/Lagos inside the RPC below,
-- because Vercel runs UTC and the two disagree for hours a day (the same lesson the calendar reminders
-- learned).

create table public.holiday_themes (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  name text not null check (char_length(name) between 1 and 40),
  palette jsonb not null default '{}'::jsonb
    check (jsonb_typeof(palette) = 'object' and pg_column_size(palette) < 6000),
  decor jsonb not null default '{}'::jsonb
    check (jsonb_typeof(decor) = 'object' and pg_column_size(decor) < 1200),
  imagery jsonb not null default '{}'::jsonb
    check (jsonb_typeof(imagery) = 'object' and pg_column_size(imagery) < 1200),
  quiz jsonb not null default '{}'::jsonb
    check (jsonb_typeof(quiz) = 'object' and pg_column_size(quiz) < 6000),
  starts_on date,
  ends_on date,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A range may not end before it starts. Both columns may be NULL (unbounded), so this only bites
  -- once both ends are actually known. The studio validates first; this is the backstop.
  constraint holiday_themes_range_ordered
    check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

-- The resolution reads every enabled theme, which is a handful of rows — no index earns its keep.

-- One row, like calendar_settings and content_settings. Holds the mode and the manual override; a
-- separate table for one value would be a table to keep in sync for nothing.
create table public.holiday_settings (
  id smallint primary key default 1,
  -- 'auto' follows the schedule, 'manual' forces active_theme_id whatever the dates say, 'off' paints
  -- nothing even when a range is live. The middle one is the override the spec asked for; the last is
  -- the panic switch that does not need a flag update to work mid-December.
  mode text not null default 'off' check (mode in ('auto', 'manual', 'off')),
  active_theme_id text references public.holiday_themes(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint holiday_settings_singleton check (id = 1)
);

insert into public.holiday_settings (id) values (1) on conflict (id) do nothing;

-- The studio writes whole rows through supabase-js and nothing would otherwise remember to bump the
-- timestamp — the same argument as touch_calendar_updated_at (20261009090000_calendar.sql:111).
create or replace function public.touch_holiday_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger holiday_themes_touch before update on public.holiday_themes
  for each row execute function public.touch_holiday_updated_at();
create trigger holiday_settings_touch before update on public.holiday_settings
  for each row execute function public.touch_holiday_updated_at();

-- ---------- The resolver ----------
-- Returns the one theme row that is live right now, or null. SECURITY DEFINER because neither anon
-- nor a non-owner admin may read holiday_themes directly (see the grants below): visitors need one
-- resolved row, never the list, and resolving server-side means the browser cannot disagree with the
-- server about what day it is.
--
-- The flag check is first and reads `coalesce(enabled, false)`: a missing row means the feature has
-- never been switched on, so it stays off rather than defaulting to painted.
create or replace function public.active_holiday_theme()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_mode text;
  v_forced text;
  v_today date;
  v_row jsonb;
begin
  if not coalesce((select enabled from public.feature_flags where key = 'holidays'), false) then
    return null;
  end if;

  select s.mode, s.active_theme_id into v_mode, v_forced
    from public.holiday_settings s where s.id = 1;
  if v_mode is null or v_mode = 'off' then
    return null;
  end if;

  if v_mode = 'manual' then
    select to_jsonb(t) into v_row from public.holiday_themes t
      where t.id = v_forced and t.enabled;
    return v_row;
  end if;

  -- 'auto': today in Africa/Lagos, never the host clock. Inclusive on both ends, so a theme that runs
  -- to Dec 24 is still painted on the 24th.
  v_today := (now() at time zone 'Africa/Lagos')::date;

  -- Overlap rule from the spec: the theme whose range started most recently wins, tie-broken by id so
  -- the answer is deterministic. Unbounded themes (null starts_on) come last — they are the fallback,
  -- not the front of the queue. NULLS LAST is stated because Postgres would otherwise sort them first
  -- under DESC.
  select to_jsonb(t) into v_row from public.holiday_themes t
    where t.enabled
      and (t.starts_on is null or t.starts_on <= v_today)
      and (t.ends_on is null or t.ends_on >= v_today)
    order by t.starts_on desc nulls last, t.id asc
    limit 1;
  return v_row;
end $$;

-- ---------- Row level security ----------
-- holiday_themes is OWNER-write and owner-READ: the tables stay invisible to anon (the public surface
-- holiday_themes is OWNER-write; READS also reach admins. The owner-only part is the spec's answer —
-- a theme repaints the whole site, so managing one is an owner decision, like calendar_looks — but the
-- quiz studio is an ADMIN surface, and applying a holiday look there (src/data/holidays.js
-- applyHolidayLook) reads the `quiz` mapping as whichever admin is in the studio. An owner-only read
-- made every non-owner admin's backdrop copy silently degrade to a plain backdrop with no warning.
-- Anon still sees nothing: the public surface goes through the RPC below, and the row is presentation
-- that the same RPC already paints for every visitor. holiday_settings stays owner-only — nobody but
-- the owner needs to see which mode the site is in.
alter table public.holiday_themes enable row level security;
create policy holiday_themes_owner_select on public.holiday_themes
  for select using ((select public.is_owner()));
create policy holiday_themes_admin_select on public.holiday_themes
  for select using ((select public.is_admin()));
create policy holiday_themes_owner_insert on public.holiday_themes
  for insert with check ((select public.is_owner()));
create policy holiday_themes_owner_update on public.holiday_themes
  for update using ((select public.is_owner())) with check ((select public.is_owner()));
create policy holiday_themes_owner_delete on public.holiday_themes
  for delete using ((select public.is_owner()));

alter table public.holiday_settings enable row level security;
create policy holiday_settings_owner_select on public.holiday_settings
  for select using ((select public.is_owner()));
create policy holiday_settings_owner_update on public.holiday_settings
  for update using ((select public.is_owner())) with check ((select public.is_owner()));

-- ---------- Grants ----------
-- Both roles have to be revoked before granting, not just anon: 20260929071000_least_privilege_grants.sql:23
-- revokes anon's default only, so a table created afterwards still inherits `grant all` for authenticated
-- — TRUNCATE included. Every table added since re-revokes and re-grants narrowly.
revoke all on public.holiday_themes, public.holiday_settings from anon, authenticated;

grant select, insert, update, delete on public.holiday_themes to authenticated;

-- The settings row is seeded above and only ever updated after that, so it gets no insert and no
-- delete, and the update is column-scoped with `id` omitted so the singleton key cannot be repointed
-- — the same narrowing calendar_settings uses (20261009090000_calendar.sql:159-161).
grant select on public.holiday_settings to authenticated;
grant update (mode, active_theme_id, updated_at) on public.holiday_settings to authenticated;

-- ---------- Two-factor enforcement ----------
-- Restrictive policies pass IN ADDITION to the ones above. Every owner/admin-writable settings
-- singleton and look table joins this loop (20260929150000_admin_mfa_enforcement.sql, extended by
-- handbook_editor, calendar and content_looks); these two are the same kind of table.
do $$
declare t text;
begin
  foreach t in array array['holiday_themes', 'holiday_settings'] loop
    execute format('create policy mfa_required_insert on public.%I as restrictive for insert with check ((select public.admin_mfa_ok()))', t);
    execute format('create policy mfa_required_update on public.%I as restrictive for update using ((select public.admin_mfa_ok())) with check ((select public.admin_mfa_ok()))', t);
    execute format('create policy mfa_required_delete on public.%I as restrictive for delete using ((select public.admin_mfa_ok()))', t);
  end loop;
end $$;

-- ---------- Storage ----------
-- Own bucket, the same pattern as page-banners and quiz-branding: a theme's band, logo and quiz
-- backdrop live under `themeId/<uuid>.ext`, public-read because the band and logo are drawn on
-- anonymous pages, owner-write because a theme is owner territory top to bottom.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('holiday-themes', 'holiday-themes', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy holiday_themes_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'holiday-themes' and (select public.is_owner()));
create policy holiday_themes_bucket_update on storage.objects for update to authenticated
  using (bucket_id = 'holiday-themes' and (select public.is_owner()))
  with check (bucket_id = 'holiday-themes' and (select public.is_owner()));
create policy holiday_themes_bucket_delete on storage.objects for delete to authenticated
  using (bucket_id = 'holiday-themes' and (select public.is_owner()));

-- ---------- Kill switch ----------
-- Lets the whole feature be switched off without a deploy, in the row the RPC above already checks.
-- feature_flags grants select to anon (20260929121000_feature_flags.sql:13,15), so nothing else has to
-- be readable for the site to learn that nothing should be painted.
insert into public.feature_flags (key, enabled) values ('holidays', true)
on conflict (key) do nothing;

-- ---------- Seeded presets ----------
-- Starter themes, editable like any other row: the owner tweaks one and saves, or builds from blank.
-- Palettes are partial on purpose — each provides only the tokens it means to change, and anything it
-- omits falls back to the site's own token (holidayTheme.holidayThemeVars). The dark maps stop before
-- green-900 because the site's `.dark` block deliberately leaves that fill dark in both modes.
insert into public.holiday_themes (id, name, palette, decor, imagery, quiz, starts_on, ends_on, enabled) values
  (
    'christmas-2026',
    'Christmas / New Year',
    '{
      "light": { "brand": "#8a1c1c", "brand-orange": "#a34a12", "green-900": "#14452f", "paper": "#f7f3ec", "surface": "#ffffff", "surface-low": "#f0e9dd", "ink-900": "#1d130f", "ink": "#33261e", "ink-muted": "#5f5147", "hairline": "#d3c7b4" },
      "dark": { "brand": "#e08a8a", "brand-orange": "#ffa06b", "paper": "#14100d", "surface": "#1e1813", "surface-low": "#181310", "ink-900": "#f6efe6", "ink": "#e7ded2", "ink-muted": "#ab9d8d", "hairline": "#3b322a" }
    }',
    '{ "particles": "snow", "banner": "Season''s Greetings from NAMMES Hub" }',
    '{}',
    '{ "design": { "look": "forest", "pattern": "stars", "confetti": "stars", "sound": { "music": "cinematic" } }, "image": null, "look_id": null }',
    date '2026-12-15', date '2027-01-05', true
  ),
  (
    'valentines-2027',
    'Valentine''s Day',
    '{
      "light": { "brand": "#b3123c", "brand-orange": "#c2185b", "green-900": "#8e1440", "paper": "#fdf5f7", "surface": "#ffffff", "surface-low": "#f9edf1", "ink-900": "#22101a", "ink": "#3b2530", "ink-muted": "#6d505c", "hairline": "#dcc4ce" },
      "dark": { "brand": "#f08cab", "brand-orange": "#ff9db8", "paper": "#170f13", "surface": "#21161b", "surface-low": "#1b1216", "ink-900": "#f9eff3", "ink": "#ecdee4", "ink-muted": "#b39aa5", "hairline": "#3d2c33" }
    }',
    '{ "particles": "petals", "banner": "Happy Valentine''s Day from NAMMES Hub" }',
    '{}',
    '{ "design": { "look": "candy", "pattern": "dots", "confetti": "hearts", "sound": { "music": "chill" } }, "image": null, "look_id": null }',
    date '2027-02-10', date '2027-02-16', true
  ),
  (
    'easter-2027',
    'Easter',
    '{
      "light": { "brand": "#5c3a86", "brand-orange": "#8e4fa3", "green-900": "#4a2f70", "paper": "#fbf8fc", "surface": "#ffffff", "surface-low": "#f3edf8", "ink-900": "#17111f", "ink": "#2a2233", "ink-muted": "#55485f", "hairline": "#cabfd6" },
      "dark": { "brand": "#b691e0", "brand-orange": "#cf9ff0", "paper": "#120f17", "surface": "#1b1622", "surface-low": "#161220", "ink-900": "#f4effa", "ink": "#e5dcef", "ink-muted": "#9c90ad", "hairline": "#332a42" }
    }',
    '{ "particles": "sparks", "banner": "Happy Easter from NAMMES Hub" }',
    '{}',
    '{ "design": { "look": "royal", "pattern": "party", "confetti": "petals", "sound": { "music": "chill" } }, "image": null, "look_id": null }',
    date '2027-03-20', date '2027-04-05', true
  ),
  (
    'independence-2026',
    'Nigeria Independence Day',
    '{
      "light": { "brand": "#00623a", "brand-orange": "#0b7a48", "green-900": "#004d2c", "paper": "#f5faf6", "surface": "#ffffff", "surface-low": "#eaf3ec", "ink-900": "#0a1a10", "ink": "#1e2b22", "ink-muted": "#45554b", "hairline": "#bcd0c2" },
      "dark": { "brand": "#5fd39a", "brand-orange": "#7fe0b0", "paper": "#0c130f", "surface": "#121b15", "surface-low": "#0f1712", "ink-900": "#eef6f0", "ink": "#dbe8de", "ink-muted": "#93a89a", "hairline": "#26382c" }
    }',
    '{ "particles": "confetti", "banner": "Happy Independence Day from NAMMES Hub" }',
    '{}',
    '{ "design": { "look": "forest", "pattern": "stripes", "confetti": "paper", "sound": { "music": "afro" } }, "image": null, "look_id": null }',
    date '2026-09-30', date '2026-10-03', true
  )
on conflict (id) do nothing;

-- The RPC is reachable by everyone (it answers with one row or null and refuses when the flag is
-- down); functions are otherwise private to service_role by default
-- (20260929071000_least_privilege_grants.sql:53).
grant execute on function public.active_holiday_theme() to anon, authenticated;
