-- Rate the Hub: a star rating and an optional comment, left by a signed-in member or a visitor.
-- Spec: docs/superpowers/specs/2026-10-31-rate-the-hub-modal-design.md
--
-- The insert grant is deliberately absent. A rating is written by the server through the same
-- public submission path that carries the bot check, which is the posture 20260929160000_
-- close_public_inserts.sql moved contact_messages to -- a table anyone can write to directly is a
-- table anyone can fill with anything.

create table public.hub_feedback (
  id uuid primary key default gen_random_uuid(),
  rating smallint not null check (rating between 1 and 5),
  category text check (category is null or category in ('design', 'content', 'speed', 'bugs', 'other')),
  message text check (message is null or char_length(message) <= 1000),
  user_id uuid references auth.users(id) on delete set null,
  page_path text check (page_path is null or (page_path like '/%' and char_length(page_path) <= 300)),
  created_at timestamptz not null default now(),
  handled boolean not null default false,
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);

alter table public.hub_feedback enable row level security;

-- No insert policy at all: anon and authenticated get nothing, so PostgREST has no path in. The
-- service key bypasses RLS, which is how api/submit-public.js writes.
revoke all on public.hub_feedback from anon, authenticated;

grant select, update on public.hub_feedback to authenticated;

create policy hub_feedback_select_admin
  on public.hub_feedback for select to authenticated
  using ((select public.is_admin()));

create policy hub_feedback_update_admin
  on public.hub_feedback for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- The inbox reads a 30-day window newest-first; the dashboard's average reads everything.
create index hub_feedback_created_idx on public.hub_feedback (created_at desc);

-- ===== Kill switch =====
-- Off until it is switched on from the System page: modal, footer link, Account link and the
-- server branch all disappear again without a deploy.
insert into public.feature_flags (key, enabled) values ('feedback', false)
on conflict (key) do nothing;

-- Deliberately NOT added to purge_old_data(): contact messages age out because they are a
-- reply-based inbox, while the average over time is the entire point of a rating table.
