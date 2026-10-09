-- The senate's academic calendar, plus the settings and saved looks behind the public /calendar page
-- and its Design Studio.
--
-- `starts_at` and `ends_at` are `date`, not `timestamptz`, and that is deliberate. Every row in the
-- senate's calendar is an all-day item, so a timestamp would mean inventing a midnight that never
-- existed and re-rendering it through each viewer's timezone: Nigeria is UTC+1, but a student reading
-- west of Greenwich would see the event on the previous day. A `date` carries no timezone, so that
-- class of bug is unrepresentable rather than defended against. Timed items belong on
-- `events.starts_at` below, which is a timestamptz for exactly that reason.
--
-- `starts_at` is nullable because the senate prints "To be determined" for Orientation and
-- Matriculation. Modelling that as a sentinel date would corrupt every comparison, so an undated row is
-- a first-class state: it is shown in its own panel and never placed in a day cell.

create table public.academic_calendar (
  id text primary key,
  session text not null,
  semester int not null check (semester in (1, 2)),
  title text not null,
  kind text not null check (kind in
    ('lectures','exams','registration','break','convocation','orientation','other')),
  starts_at date,
  ends_at date,
  note text,
  remind_days int check (remind_days is null or remind_days between 0 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A range may not end before it starts. Both columns may be NULL (undated), so this only bites once
  -- both ends are actually known. The paste parser must reject a reversed range with a readable message
  -- first; this is the backstop, not the first line of defence.
  constraint academic_calendar_range_ordered
    check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

-- The public page always reads one session in date order.
create index academic_calendar_session_starts_idx
  on public.academic_calendar (session, starts_at);

-- Departmental events gain real timestamps so the calendar can place them, while `date` (free text) and
-- `meta` stay as they are. All four are nullable and additive: existing rows keep rendering exactly as
-- they do today, and the calendar falls back to parseEventDate(src/data/events.js) when starts_at is
-- null. `kind` is unconstrained because it is the same vocabulary as academic_calendar.kind but does
-- not have to match it -- an event is not a senate date.
alter table public.events
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add column kind text,
  add column remind_days int check (remind_days is null or remind_days between 0 and 30);

-- One row, like site_content. Holds the active session and the landing-view defaults the Design Studio
-- writes; a separate sessions table would be a table to keep in sync for a single value.
create table public.calendar_settings (
  id smallint primary key default 1,
  active_session text not null,
  active_look_id text,
  default_view text not null default 'month' check (default_view in ('month', 'agenda')),
  default_kinds text[] not null default
    '{lectures,exams,registration,break,convocation,orientation,other}',
  default_sources text[] not null default '{academic,event}',
  reminder_enabled boolean not null default true,
  reminder_default_days int not null default 3 check (reminder_default_days between 0 and 30),
  updated_at timestamptz not null default now(),
  constraint calendar_settings_singleton check (id = 1)
);

-- Named saved designs for the Design Studio. Deliberately narrower than email_styles: that table is a
-- uuid PK minted by the database with a created_by FK, this one is a text PK minted by the client.
create table public.calendar_looks (
  id text primary key,
  name text not null,
  design jsonb not null default '{}'::jsonb
    check (jsonb_typeof(design) = 'object'),
  created_at timestamptz not null default now()
);

insert into public.calendar_settings (id, active_session)
values (1, '2026/2027')
on conflict (id) do nothing;

-- `updated_at` on both writable tables has no client-side discipline behind it: the Design Studio writes
-- whole rows through supabase-js and nothing would remember to bump the timestamp. The touch trigger
-- cbt_touch (20261002100000_cbt_exams.sql:85-94) is the same pattern for the same reason.
create or replace function public.touch_calendar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger academic_calendar_touch before update on public.academic_calendar
  for each row execute function public.touch_calendar_updated_at();
create trigger calendar_settings_touch before update on public.calendar_settings
  for each row execute function public.touch_calendar_updated_at();

-- No grants here: every function is private to service_role by default
-- (20260929071000_least_privilege_grants.sql:53) and triggers do not need EXECUTE from the caller.

-- ---------- Row level security ----------
-- Read posture matches events: anyone logged out can read, every write is owner-only. Non-owner admins
-- go through the review queue -- the two submitChangeRequest calls inside `if (gated)` at
-- src/components/admin/AdminResourceManager.jsx:86,98 -- exactly as they already do for events, which is
-- why insert and update are owner-only here too and not merely admin. Insert and update were tightened to
-- owner in supabase/history/04_2026-09-05_to_2026-09-28_email_hardening_content.sql:286-294; delete in
-- 20260929100000_owner_only_deletes.sql:1,5.

alter table public.academic_calendar enable row level security;
create policy academic_calendar_public_select on public.academic_calendar
  for select using (true);
create policy academic_calendar_admin_insert on public.academic_calendar
  for insert with check ((select public.is_owner()));
create policy academic_calendar_admin_update on public.academic_calendar
  for update using ((select public.is_owner())) with check ((select public.is_owner()));
create policy academic_calendar_admin_delete on public.academic_calendar
  for delete using ((select public.is_owner()));

alter table public.calendar_settings enable row level security;
create policy calendar_settings_public_select on public.calendar_settings
  for select using (true);
create policy calendar_settings_admin_update on public.calendar_settings
  for update using ((select public.is_owner())) with check ((select public.is_owner()));

alter table public.calendar_looks enable row level security;
create policy calendar_looks_public_select on public.calendar_looks
  for select using (true);
create policy calendar_looks_admin_insert on public.calendar_looks
  for insert with check ((select public.is_owner()));
create policy calendar_looks_admin_update on public.calendar_looks
  for update using ((select public.is_owner())) with check ((select public.is_owner()));
create policy calendar_looks_admin_delete on public.calendar_looks
  for delete using ((select public.is_owner()));

-- ---------- Grants ----------
-- Both roles have to be revoked before granting, not just anon. 20260929071000_least_privilege_grants.sql:23
-- sets `alter default privileges ... revoke all on tables from anon`, which covers anon only, so a table
-- created afterwards still inherits the platform default `grant all` for authenticated -- TRUNCATE
-- included, and TRUNCATE is not subject to RLS, so no policy here would stop it. Every other table added
-- since that migration re-revokes and re-grants narrowly
-- (20260930120000_handbook_editor.sql:32, 20261002100000_cbt_exams.sql:125).
revoke all on
  public.academic_calendar, public.calendar_settings, public.calendar_looks
from anon, authenticated;

-- Without this the public calendar renders empty for logged-out visitors while looking fine in the admin.
grant select on
  public.academic_calendar, public.calendar_settings, public.calendar_looks
to anon;

-- Admins manage entries and looks. The settings row is seeded by this migration and is only ever
-- updated after that, so it is granted no insert and no delete, and its update is column-scoped rather
-- than blanket -- the same narrowing handbook_settings and feature_flags use on their singletons
-- (20260930120000_handbook_editor.sql:35, 20260929121000_feature_flags.sql:14). id is omitted so the
-- singleton key cannot be repointed.
grant select, insert, update, delete on
  public.academic_calendar, public.calendar_looks
to authenticated;
grant select on public.calendar_settings to authenticated;
grant update (active_session, active_look_id, default_view, default_kinds, default_sources,
              reminder_enabled, reminder_default_days, updated_at)
  on public.calendar_settings to authenticated;

-- ---------- Two-factor enforcement ----------
-- The same additive, restrictive-policy pattern as 20260929150000_admin_mfa_enforcement.sql:24-38, whose
-- loop covered 23 tables and which handbook_editor.sql and email_design_studio.sql each extended by two.
-- Restrictive policies must pass IN ADDITION to the normal ones, so no existing rule is touched.
do $$
declare t text;
begin
  foreach t in array array['academic_calendar', 'calendar_settings', 'calendar_looks'] loop
    execute format('create policy mfa_required_insert on public.%I as restrictive for insert with check ((select public.admin_mfa_ok()))', t);
    execute format('create policy mfa_required_update on public.%I as restrictive for update using ((select public.admin_mfa_ok())) with check ((select public.admin_mfa_ok()))', t);
    execute format('create policy mfa_required_delete on public.%I as restrictive for delete using ((select public.admin_mfa_ok()))', t);
  end loop;
end $$;

-- ---------- Audit + kill switch ----------
-- Deleting a senate date is hard to undo and easy to do by accident, so it is logged the same way events
-- deletes are (20260929120000_audit_log.sql:65).
create trigger academic_calendar_audit_del after delete on public.academic_calendar
  for each row execute function public.log_change();

-- Lets the calendar be switched off without a deploy. feature_flags already grants select to anon
-- (20260929121000_feature_flags.sql:13,15), so the public page can read it and hide itself.
insert into public.feature_flags (key, enabled) values ('calendar', true)
on conflict (key) do nothing;