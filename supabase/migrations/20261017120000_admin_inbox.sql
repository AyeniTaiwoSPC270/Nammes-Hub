-- The admin notification bell (src/components/admin/AdminNotificationBell.jsx).
-- Spec: docs/superpowers/specs/2026-10-17-admin-notifications-design.md
--
-- The inbox is DERIVED, not stored. Every source below is a table some other feature already
-- writes: a student submission, a contact message, a form response, a queued non-owner edit, a
-- server error. The alternative -- a notification row inserted at each producer -- needs a writer
-- in every handler and SQL trigger, and the one that gets forgotten fails silently. This repo has
-- already paid for that class of bug once (see the quiz_record_answer call-site drift in
-- AGENTS.md), so the bell reads what exists instead.
--
-- The only genuinely new content is an announcement, because nothing anywhere holds one.
--
-- Read state is one timestamp per admin per category, not a row per item: the question a bell
-- answers is "what arrived since I last looked", and "I dismissed this one but not that one" was
-- not asked for.

-- ===== Announcements =====
-- Plain text, rendered as text. No HTML column, no markdown, nothing an admin can inject into a
-- page. Length limits mirror validateAnnouncement() in src/lib/adminInbox.js so the composer
-- refuses before the round trip rather than after it.
create table public.admin_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_announcements enable row level security;

create policy admin_announcements_select_admin on public.admin_announcements
  for select to authenticated using (public.is_admin());

-- Any admin may post; created_by must be the caller so the row cannot be attributed to someone
-- else, and delete is the author's own note or the owner cleaning up.
create policy admin_announcements_insert_admin on public.admin_announcements
  for insert to authenticated with check (public.is_admin() and created_by = auth.uid());

create policy admin_announcements_delete_author_or_owner on public.admin_announcements
  for delete to authenticated using (created_by = auth.uid() or public.is_owner());

-- No update policy: an announcement is a note, not a document. Corrections are a new note.

-- ===== Seen state =====
-- One row per admin per category. `seen_at` is the moment the panel was last opened (or "Mark all
-- read" was pressed); anything in admin_inbox() newer than it is unread.
--
-- Cascade, so deleting an account does not leave rows that can never match auth.uid() again.
create table public.admin_inbox_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in
    ('submissions', 'messages', 'responses', 'reviews', 'errors', 'announcements')),
  seen_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.admin_inbox_seen enable row level security;

create policy admin_inbox_seen_select_own on public.admin_inbox_seen
  for select to authenticated using (user_id = auth.uid());

create policy admin_inbox_seen_insert_own on public.admin_inbox_seen
  for insert to authenticated with check (user_id = auth.uid());

create policy admin_inbox_seen_update_own on public.admin_inbox_seen
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===== Indexes =====
-- The inbox reads a 30-day window per source ordered by time; these are the columns that window
-- and its ordering touch. error_log is skipped on purpose: it is pruned at 30 days by
-- 20260929170000_retention_and_anonymise.sql, so its unique (route, message, bucket) index already
-- bounds the scan to the rows the inbox can return.
create index admin_inbox_contact_messages_created_idx
  on public.contact_messages (created_at desc);
create index admin_inbox_outline_submissions_status_idx
  on public.outline_submissions (status, created_at desc);
create index admin_inbox_form_responses_submitted_idx
  on public.form_responses (submitted_at desc);
create index admin_inbox_change_requests_status_idx
  on public.change_requests (status, created_at desc);
create index admin_inbox_announcements_created_idx
  on public.admin_announcements (created_at desc);

-- ===== Grants =====
-- 20260929071000_least_privilege_grants.sql revokes broadly and makes future tables private to
-- anon, but authenticated still inherits the Supabase default grant, so the shape is stated
-- explicitly here. RLS stays the second layer.
revoke all on public.admin_announcements, public.admin_inbox_seen from anon;

grant select, insert, delete on public.admin_announcements to authenticated;
grant select, insert, update on public.admin_inbox_seen to authenticated;

-- ===== The inbox =====
-- security definer is required, not incidental: error_log is readable only through its owner-only
-- policy, and the union must not silently depend on which rows the caller personally can see for
-- the owner-gated sources. Because it bypasses RLS, the function re-checks is_owner() itself --
-- without that predicate a non-owner's bell would leak the owner's server errors.
--
-- Returns { categories: { <key>: { outstanding, seenAt } }, items: [...] }. It deliberately does
-- NOT return a link: category -> label/icon/href is INBOX_CATEGORIES in src/lib/adminInbox.js, so
-- a route rename cannot leave a stale path inside SQL.
create or replace function public.admin_inbox()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_owner boolean := public.is_owner();
  v_items jsonb;
  v_categories jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can read the admin inbox.';
  end if;

  -- Ten per category is the cap: enough that a busy morning is visible, bounded so a poll every
  -- 60 seconds cannot return an unbounded payload. The 30-day window matches the error_log
  -- retention job, so no source can return rows the site has already decided to forget.
  with sources as (
    select 'submissions'::text as category,
           s.id::text as id,
           'New course material submission'::text as title,
           s.title as detail,
           s.created_at
      from public.outline_submissions s
     where s.status = 'pending'
       and s.created_at > now() - interval '30 days'

    union all
    select 'messages'::text as category, m.id::text, 'New contact message',
           coalesce(nullif(m.name, ''), m.email), m.created_at
      from public.contact_messages m
     where m.created_at > now() - interval '30 days'

    union all
    select 'responses'::text as category, r.id::text, 'New form response',
           coalesce(f.title, 'Form'), r.submitted_at
      from public.form_responses r
      left join public.forms f on f.id = r.form_id
     where r.submitted_at > now() - interval '30 days'

    -- v_owner as a predicate, not a post-filter: a non-owner never sees these rows at all.
    union all
    select 'reviews'::text as category, c.id::text, 'Change awaiting approval',
           c.entity_type || ' ' || c.action, c.created_at
      from public.change_requests c
     where v_owner
       and c.status = 'pending'
       and c.created_at > now() - interval '30 days'

    union all
    select 'errors'::text as category, e.id::text, 'Server error',
           e.route || ' — ' || e.message, e.at
      from public.error_log e
     where v_owner
       and e.at > now() - interval '30 days'

    union all
    select 'announcements'::text as category, a.id::text, a.title, a.body, a.created_at
      from public.admin_announcements a
     where a.created_at > now() - interval '30 days'
  ),
  ranked as (
    -- id breaks ties so two rows in the same transaction still order deterministically.
    select category, id, title, detail, created_at,
           row_number() over (partition by category order by created_at desc, id desc) as rn
      from sources
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'category', category,
               'id', id,
               'title', title,
               'detail', detail,
               'createdAt', created_at
             )
             order by created_at desc
           ),
           '[]'::jsonb
         )
    into v_items
    from ranked
   where rn <= 10;

  -- `outstanding` means work that is still unresolved, not "how many rows exist". Only two
  -- sources have a resolved/unresolved state and therefore a number worth showing: pending
  -- submissions and pending owner reviews. Messages, responses, errors and announcements have no
  -- resolution at all, so counting them here would invent a to-do list that can never be emptied.
  with totals as (
    select 'submissions' as category,
           count(*)::int as outstanding
      from public.outline_submissions
     where status = 'pending'

    union all
    select 'messages', 0

    union all
    select 'responses', 0

    union all
    select 'reviews', count(*)::int
      from public.change_requests
     where v_owner and status = 'pending'

    union all
    select 'errors', 0

    union all
    select 'announcements', 0
  ),
  visible as (
    select t.category, t.outstanding, s.seen_at
      from totals t
      left join public.admin_inbox_seen s
        on s.user_id = auth.uid()
       and s.category = t.category
     -- The owner-only categories are omitted entirely rather than returned as zero, so the panel
     -- does not offer a non-owner a section they can never open.
     where t.category not in ('reviews', 'errors') or v_owner
  )
  select coalesce(
           jsonb_object_agg(
             category,
             jsonb_build_object('outstanding', outstanding, 'seenAt', seen_at)
           ),
           '{}'::jsonb
         )
    into v_categories
    from visible;

  return jsonb_build_object('categories', v_categories, 'items', v_items);
end;
$$;

-- Functions are private by default; only signed-in admins call this, and the body re-checks.
revoke execute on function public.admin_inbox() from public, anon;
grant execute on function public.admin_inbox() to authenticated;
