-- Named saved designs for the Events and News Design Studio
-- (src/pages/admin/ContentDesign.jsx), the fifth studio and the counterpart of calendar_looks.
-- Spec: docs/superpowers/specs/2026-10-15-content-design-studio-design.md
--
-- The deliberate choice is a NEW pair of tables rather than a `theme` jsonb on `events` or `news`.
-- `apply_change_request` (api/_lib/handlers/applyChangeRequest.js) enumerates those tables' columns
-- explicitly -- see 20261009100000_calendar_review_queue.sql:37-67 -- so a column added here would be
-- silently dropped from every queued non-owner edit, and the review queue would fail its set-difference
-- check. A look table has no such coupling, and it is also the only one of the four studios that can keep
-- two pages on two different designs.

-- One row per saved design, one row per page in practice but not enforced to be so: an admin may keep
-- several designs for one page and point the settings row at whichever is live.
--
-- `page` is load-bearing rather than bookkeeping. The theme has page-specific settings -- a news page can
-- show a featured card and an events page cannot, because events are grouped by date and not by
-- importance -- so pointing the events page at a news design would either do nothing or do the wrong
-- thing. The check keeps that from being storable in the first place.
--
-- Created before content_settings, which references it.
create table public.content_looks (
  id text primary key,
  page text not null check (page in ('events', 'news')),
  name text not null check (char_length(name) between 1 and 40),
  design jsonb not null default '{}'::jsonb
    check (jsonb_typeof(design) = 'object' and pg_column_size(design) < 4000),
  created_at timestamptz not null default now()
);

-- One row, exactly like calendar_settings. Holds which design each page is showing and whether Home
-- adopts it. Two pointers and two booleans, so no separate "content_settings per page" table is needed.
--
-- `on delete set null` rather than restrict: deleting the live design should drop the page back to its
-- default look, which is a defined and visible state, rather than refusing the delete. AdminCalendarDesign
-- does this by hand in JavaScript for the same reason (AdminCalendarDesign.jsx:152-173); the foreign key
-- makes the pointer impossible to leave dangling, which is the part worth having in the database.
create table public.content_settings (
  id smallint primary key default 1,
  events_look_id text references public.content_looks(id) on delete set null,
  news_look_id text references public.content_looks(id) on delete set null,
  events_on_home boolean not null default false,
  news_on_home boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint content_settings_singleton check (id = 1)
);

-- Both flags default to false, so a look made live on /events does not reach the Home page until an
-- admin asks for it. Home also renders awards, opportunities and announcements; an accent that quietly
-- spread to those would be a bug report, not a feature.
insert into public.content_settings (id) values (1) on conflict (id) do nothing;

-- Same no-client-discipline argument as 20261009090000_calendar.sql:80-95: the studio writes whole rows
-- through supabase-js and nothing would otherwise remember to bump the timestamp.
create or replace function public.touch_content_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger content_settings_touch before update on public.content_settings
  for each row execute function public.touch_content_updated_at();

-- ---------- Row level security ----------
-- Read posture matches calendar_looks: PUBLIC read, admin write. The public read is forced rather than
-- chosen -- /news and /events are anonymous pages and read through the anon key, so a design they could
-- not select would leave both pages permanently on the default.
--
-- The write posture differs from calendar_looks on purpose. calendar_looks is OWNER-write because
-- academic_calendar is owner-write, and a non-owner admin already goes through the review queue for the
-- dates themselves. `events` and `news` are reviewed too, but a design is presentation, not content:
-- form_looks is the closer precedent, and it is admin-write (20261013111000_form_looks.sql:7-9,27-28).
-- Gating this on the owner would leave most admins unable to restyle a page they can already edit.
alter table public.content_looks enable row level security;
create policy content_looks_public_select on public.content_looks
  for select using (true);
create policy content_looks_admin_insert on public.content_looks
  for insert with check ((select public.is_admin()));
create policy content_looks_admin_update on public.content_looks
  for update using ((select public.is_admin())) with check ((select public.is_admin()));
create policy content_looks_admin_delete on public.content_looks
  for delete using ((select public.is_admin()));

alter table public.content_settings enable row level security;
create policy content_settings_public_select on public.content_settings
  for select using (true);
create policy content_settings_admin_update on public.content_settings
  for update using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- Grants ----------
-- Both roles have to be revoked before granting, not just anon:
-- 20260929071000_least_privilege_grants.sql:23 sets `alter default privileges ... revoke all on tables
-- from anon`, which covers anon only, so a table created afterwards still inherits the platform default
-- `grant all` for authenticated -- TRUNCATE included, and TRUNCATE is not subject to RLS, so no policy
-- above would stop it. Every table added since re-revokes and re-grants narrowly.
revoke all on public.content_looks, public.content_settings from anon, authenticated;

grant select on public.content_looks, public.content_settings to anon;

grant select, insert, update, delete on public.content_looks to authenticated;

-- The settings row is seeded above and only ever updated after that, so it gets no insert and no delete.
-- The update is column-scoped and omits `id` so the singleton key cannot be repointed -- the same
-- narrowing calendar_settings uses (20261009090000_calendar.sql:159-161).
grant select on public.content_settings to authenticated;
grant update (events_look_id, news_look_id, events_on_home, news_on_home, updated_at)
  on public.content_settings to authenticated;

-- ---------- Two-factor enforcement ----------
-- Restrictive policies pass IN ADDITION to the ones above, so this adds a rule without touching one.
-- content_looks joins the list for the same reason form_looks does (20261013111000_form_looks.sql:30-32):
-- it is an admin-writable configuration table.
--
-- content_settings is in this list too, and the reason is a parity one rather than a judgement about how
-- much a settings row is worth. EVERY admin-writable settings singleton in this schema is restricted:
-- calendar_settings and handbook_settings both are (20261009090000_calendar.sql:170,
-- 20260930120000_handbook_editor.sql:48). Leaving this one out would mean an admin who has deliberately not
-- finished MFA can still repoint which design /events and /news render -- which is exactly the write the
-- list exists to gate. Its insert and delete policies are moot (the table is granted neither) but the
-- update one is load-bearing.
do $$
declare t text;
begin
  foreach t in array array['content_looks', 'content_settings'] loop
    execute format('create policy mfa_required_insert on public.%I as restrictive for insert with check ((select public.admin_mfa_ok()))', t);
    execute format('create policy mfa_required_update on public.%I as restrictive for update using ((select public.admin_mfa_ok())) with check ((select public.admin_mfa_ok()))', t);
    execute format('create policy mfa_required_delete on public.%I as restrictive for delete using ((select public.admin_mfa_ok()))', t);
  end loop;
end $$;