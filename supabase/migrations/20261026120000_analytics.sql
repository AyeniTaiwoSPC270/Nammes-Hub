-- The admin analytics dashboard (src/pages/admin/AdminAnalytics.jsx).
-- Spec: docs/superpowers/specs/2026-10-26-admin-analytics-dashboard-design.md
--
-- Two of the numbers that page shows do not exist anywhere in this schema: how many people visited,
-- and which news items and events they read. Nothing records a page view, so page_views below is new
-- content rather than a read of rows some other feature already writes. Everything else the dashboard
-- needs -- signups, quiz plays, CBT attempts, form responses, pending queues, email opt-in, award
-- votes -- is derived from the tables those features already own.
--
-- The aggregate is one security-definer function returning jsonb. The alternative, twelve client
-- queries grouped in JavaScript, ships raw rows to the browser and turns each new metric into another
-- round trip. One call also keeps the public tables' RLS policies untouched: the page never reads
-- page_views directly, so there is exactly one place that decides who may see the numbers.

-- ===== Page views =====
-- No IP, no user agent, no cookie, no user id. `visitor` is a random uuid the browser keeps in
-- sessionStorage, so it separates visits within one browsing session and identifies nobody across
-- sessions -- which is why the UI labels the metric "visitors (sessions)" rather than implying unique
-- people. referrer_host is the host only: the referring path can carry another site's search terms or
-- internal ids, and none of that is needed to answer "where did people come from".
--
-- `path` is normalised by record_page_view (query string and hash stripped, trailing slash removed) so
-- a utm parameter cannot split one page into fifty rows.
create table public.page_views (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  path text not null check (char_length(path) between 1 and 200),
  visitor text not null check (
    visitor ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 120),
  viewer text not null default 'anon' check (viewer in ('anon', 'user'))
);

-- The dashboard reads a date window and orders by time; top content groups by path inside the same
-- window. Two indexes cover both without a scan of the whole table.
create index page_views_at_idx on public.page_views (at);
create index page_views_path_at_idx on public.page_views (path, at);

alter table public.page_views enable row level security;

-- Admins read. Nobody writes through PostgREST: the only writer is record_page_view below, so a
-- client cannot forge rows or backfill a flattering number.
create policy page_views_select_admin on public.page_views
  for select to authenticated using ((select public.is_admin()));

revoke all on public.page_views from anon, authenticated;
grant select on public.page_views to authenticated;

-- ===== The beacon =====
-- Validation lives here, not in the browser: this function is reachable by anyone with the anon key,
-- so a client-side rule is a suggestion. Every early return is deliberate -- a bad view is dropped,
-- never repaired into something plausible.
--
-- The two-second duplicate guard is not only for retries. React StrictMode invokes an effect twice in
-- development, and a route change plus a remount in production can fire the same beacon twice; without
-- the guard every view would count double and the traffic line would be wrong by a factor of two.
create or replace function public.record_page_view(
  p_path text,
  p_visitor text,
  p_referrer_host text default null,
  p_viewer text default 'anon'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
  v_viewer text;
begin
  v_path := left(coalesce(p_path, ''), 200);
  v_path := split_part(v_path, '?', 1);
  v_path := split_part(v_path, '#', 1);
  if v_path = '' or left(v_path, 1) <> '/' then
    return;
  end if;
  if v_path <> '/' then
    v_path := rtrim(v_path, '/');
  end if;

  -- Not page views: the admin area, the API, and the projector/phone quiz clients. Recording the admin
  -- area would have every exec inflating their own dashboard on a visit, and the quiz clients are
  -- screens in a room rather than readers of a page.
  if v_path like '/admin/%' or v_path like '/api/%' or v_path like '/play/%' then
    return;
  end if;

  -- The kill switch is read here rather than in the browser: a client-side check would cost every
  -- anonymous visitor an extra round trip just to decide whether to make another one, and it would
  -- only stop a beacon that chose to honour it. A missing row means enabled, so a failed read cannot
  -- silently switch tracking off. This is why the tracker itself is unconditional.
  if exists (select 1 from public.feature_flags where key = 'analytics' and not enabled) then
    return;
  end if;

  if p_visitor is null
     or p_visitor !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return;
  end if;

  -- A caller may claim 'user' only when it is actually signed in, so an anonymous beacon cannot pad the
  -- signed-in series.
  v_viewer := case
    when p_viewer = 'user' and auth.uid() is not null then 'user'
    else 'anon'
  end;

  if exists (
    select 1 from public.page_views
     where visitor = p_visitor
       and path = v_path
       and at > now() - interval '2 seconds'
  ) then
    return;
  end if;

  insert into public.page_views (path, visitor, referrer_host, viewer)
  values (v_path, p_visitor, left(nullif(p_referrer_host, ''), 120), v_viewer);
end;
$$;

revoke execute on function public.record_page_view(text, text, text, text) from public;
grant execute on function public.record_page_view(text, text, text, text) to anon, authenticated;

-- ===== Kill switch =====
-- Fail-open the way the calendar and holidays flags are read: a missing row means tracking is on, so a
-- failed read cannot silently stop the site recording anything. Flipping it off stops the beacon and
-- hides the dashboard without a deploy.
insert into public.feature_flags (key, enabled) values ('analytics', true)
on conflict (key) do nothing;

-- ===== A message can be "handled" =====
-- The dashboard's "unhandled messages" card needs a state contact_messages never had. Without it the
-- metric would be "messages received", which is not a to-do and can never reach zero.
alter table public.contact_messages
  add column if not exists handled_at timestamptz,
  add column if not exists handled_by uuid references auth.users(id) on delete set null;

create policy contact_messages_update_admin on public.contact_messages
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant update on public.contact_messages to authenticated;

-- ===== The dashboard =====
-- security definer because page_views is admin-only and the function must read it consistently
-- regardless of which rows the caller's own policies would return. Because it bypasses RLS it
-- re-checks is_admin() itself -- that predicate is the whole access control for every number below.
--
-- Every day bucket is Lagos local time, not UTC. Vercel runs UTC and this site is in Lagos: a UTC
-- bucket puts an 11pm visit on tomorrow's bar and, for five hours a day, disagrees with the date the
-- person saw on the page. Same reasoning as the calendar reminder worker.
--
-- p_days = 0 means all time and is the only unbounded query, opt-in from the range picker. Anything
-- else is clamped to 1..730.
create or replace function public.admin_analytics(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_days integer;
  v_from date;
  v_to date := v_today;
  v_prev_from date;
  v_prev_to date;
  v_start timestamptz;
  v_end timestamptz;
  v_prev_start timestamptz;
  v_prev_end timestamptz;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can read analytics.';
  end if;

  if p_days is null or p_days < 0 then
    v_days := 30;
  elsif p_days = 0 then
    -- First day we have any evidence of traffic or membership. Both are coalesced to today so an empty
    -- database gives a one-day report rather than a null range.
    select greatest(1, v_today - least(
             coalesce((select min(at)::date from public.page_views), v_today),
             coalesce((select min(created_at)::date from public.profiles), v_today)
           ) + 1)
      into v_days;
  else
    v_days := least(p_days, 730);
  end if;

  v_from := v_today - (v_days - 1);
  v_prev_to := v_from - 1;
  v_prev_from := v_prev_to - (v_days - 1);

  -- A Lagos calendar date converted back to the instant that date began. `date::timestamp at time zone`
  -- is the only correct direction here: the reverse reads a stored timestamp as if it were UTC midnight.
  v_start := (v_from::timestamp at time zone 'Africa/Lagos');
  v_end := ((v_to + 1)::timestamp at time zone 'Africa/Lagos');
  v_prev_start := (v_prev_from::timestamp at time zone 'Africa/Lagos');
  v_prev_end := ((v_prev_to + 1)::timestamp at time zone 'Africa/Lagos');

  with days as (
    select generate_series(v_from::timestamp, v_to::timestamp, interval '1 day')::date as day
  ),
  traffic as (
    select (at at time zone 'Africa/Lagos')::date as day,
           count(*)::int as views,
           count(distinct visitor)::int as visitors,
           count(*) filter (where viewer = 'user')::int as signed_in
      from public.page_views
     where at >= v_start and at < v_end
     group by 1
  ),
  signups as (
    select (created_at at time zone 'Africa/Lagos')::date as day, count(*)::int as count
      from public.profiles
     where created_at >= v_start and created_at < v_end
     group by 1
  ),
  -- One union of kinds, pivoted: five separate daily series would be five scans of five tables, and the
  -- chart wants them stacked on the same axis anyway.
  events as (
    select (created_at at time zone 'Africa/Lagos')::date as day, 'quiz'::text as kind
      from public.quiz_sessions
     where created_at >= v_start and created_at < v_end
    union all
    select (created_at at time zone 'Africa/Lagos')::date, 'practice'
      from public.quiz_practice_runs
     where created_at >= v_start and created_at < v_end
    union all
    select (created_at at time zone 'Africa/Lagos')::date, 'battles'
      from public.quiz_battles
     where created_at >= v_start and created_at < v_end
    union all
    select (started_at at time zone 'Africa/Lagos')::date, 'cbt'
      from public.cbt_attempts
     where started_at >= v_start and started_at < v_end
    union all
    select (submitted_at at time zone 'Africa/Lagos')::date, 'forms'
      from public.form_responses
     where submitted_at >= v_start and submitted_at < v_end
  ),
  engagement as (
    select day,
           count(*) filter (where kind = 'quiz')::int as quiz,
           count(*) filter (where kind = 'practice')::int as practice,
           count(*) filter (where kind = 'battles')::int as battles,
           count(*) filter (where kind = 'cbt')::int as cbt,
           count(*) filter (where kind = 'forms')::int as forms
      from events
     group by 1
  ),
  top_paths as (
    select path, count(*)::int as views
      from public.page_views
     where at >= v_start and at < v_end
     group by path
     order by views desc, path
     limit 8
  ),
  -- A title where the route carries an id we can resolve, the cleaned path otherwise. Resources are
  -- grouped by their list route because /resources/:level/:semester has no per-item id.
  top_content as (
    select t.path,
           coalesce(n.title, e.title) as label,
           t.views
      from top_paths t
      left join public.news n on t.path = '/news/' || n.id
      left join public.events e on t.path = '/events/' || e.id
  ),
  award_window as (
    select category_id, count(*)::int as votes
      from public.award_votes
     where created_at >= v_start and created_at < v_end
     group by category_id
     order by votes desc
     limit 8
  ),
  award_rows as (
    select c.title as category, a.votes
      from award_window a
      join public.award_categories c on c.id = a.category_id
  ),
  activity as (
    select created_at as at, 'signup'::text as kind, 'A new member joined'::text as label
      from public.profiles
     where created_at >= v_start and created_at < v_end
    union all
    select s.created_at, 'submission', s.title
      from public.outline_submissions s
     where s.created_at >= v_start and s.created_at < v_end
    union all
    select r.submitted_at, 'response', 'New response to ' || coalesce(f.title, 'a form')
      from public.form_responses r
      left join public.forms f on f.id = r.form_id
     where r.submitted_at >= v_start and r.submitted_at < v_end
    union all
    select m.created_at, 'message', 'New contact message'
      from public.contact_messages m
     where m.created_at >= v_start and m.created_at < v_end
    union all
    select s.finished_at, 'quiz', 'Quiz finished: ' || coalesce(q.title, 'a quiz')
      from public.quiz_sessions s
      left join public.quizzes q on q.id = s.quiz_id
     where s.finished_at is not null
       and s.finished_at >= v_start and s.finished_at < v_end
    union all
    select n.created_at, 'news', 'Published: ' || n.title
      from public.news n
     where n.created_at >= v_start and n.created_at < v_end
  )
  select jsonb_build_object(
    'range', jsonb_build_object(
      'days', v_days,
      'from', v_from,
      'to', v_to,
      'previousFrom', v_prev_from,
      'previousTo', v_prev_to
    ),
    'kpis', jsonb_build_object(
      'views', jsonb_build_object(
        'current', (select count(*) from public.page_views where at >= v_start and at < v_end),
        'previous', (select count(*) from public.page_views where at >= v_prev_start and at < v_prev_end)
      ),
      'visitors', jsonb_build_object(
        'current', (select count(distinct visitor) from public.page_views where at >= v_start and at < v_end),
        'previous', (select count(distinct visitor) from public.page_views where at >= v_prev_start and at < v_prev_end)
      ),
      'signups', jsonb_build_object(
        'current', (select count(*) from public.profiles where created_at >= v_start and created_at < v_end),
        'previous', (select count(*) from public.profiles where created_at >= v_prev_start and created_at < v_prev_end)
      ),
      'quizPlays', jsonb_build_object(
        'current', (select count(*) from public.quiz_sessions where created_at >= v_start and created_at < v_end),
        'previous', (select count(*) from public.quiz_sessions where created_at >= v_prev_start and created_at < v_prev_end),
        'players', (select count(*) from public.quiz_players where joined_at >= v_start and joined_at < v_end)
      ),
      'cbtAttempts', jsonb_build_object(
        'current', (select count(*) from public.cbt_attempts where started_at >= v_start and started_at < v_end),
        'previous', (select count(*) from public.cbt_attempts where started_at >= v_prev_start and started_at < v_prev_end),
        -- Rounded because a percentage with decimals reads as precision an exam score does not have.
        'averageScore', (
          select coalesce(round(avg(100.0 * score / nullif(total, 0))), 0)::int
            from public.cbt_attempts
           where submitted_at >= v_start and submitted_at < v_end
             and score is not null and total > 0
        )
      ),
      'formResponses', jsonb_build_object(
        'current', (select count(*) from public.form_responses where submitted_at >= v_start and submitted_at < v_end),
        'previous', (select count(*) from public.form_responses where submitted_at >= v_prev_start and submitted_at < v_prev_end)
      ),
      -- Opt-in is a state, not a flow: the useful number is the share of members who can be emailed
      -- today, so both sides are all-time rather than the window.
      'optInRate', jsonb_build_object(
        'current', (
          select case when count(*) = 0 then 0
                      else round(count(*) filter (where email_notifications_enabled)::numeric / count(*), 4) end
            from public.profiles
        ),
        'previous', 0,
        'optedIn', (select count(*) from public.profiles where email_notifications_enabled),
        'total', (select count(*) from public.profiles)
      )
    ),
    'traffic', coalesce((
      select jsonb_agg(jsonb_build_object(
               'day', d.day,
               'views', coalesce(t.views, 0),
               'visitors', coalesce(t.visitors, 0),
               'signedIn', coalesce(t.signed_in, 0)
             ) order by d.day)
        from days d left join traffic t on t.day = d.day
    ), '[]'::jsonb),
    'signups', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'count', coalesce(s.count, 0)) order by d.day)
        from days d left join signups s on s.day = d.day
    ), '[]'::jsonb),
    'engagement', coalesce((
      select jsonb_agg(jsonb_build_object(
               'day', d.day,
               'quiz', coalesce(e.quiz, 0),
               'practice', coalesce(e.practice, 0),
               'battles', coalesce(e.battles, 0),
               'cbt', coalesce(e.cbt, 0),
               'forms', coalesce(e.forms, 0)
             ) order by d.day)
        from days d left join engagement e on e.day = d.day
    ), '[]'::jsonb),
    'topContent', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'label', label, 'views', views)
                       order by views desc, path)
        from top_content
    ), '[]'::jsonb),
    'awards', coalesce((
      select jsonb_agg(jsonb_build_object('category', category, 'votes', votes) order by votes desc)
        from award_rows
    ), '[]'::jsonb),
    'email', jsonb_build_object(
      'optedIn', (select count(*) from public.profiles where email_notifications_enabled),
      'optedOut', (select count(*) from public.profiles where not email_notifications_enabled),
      'broadcasts', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'subject', subject, 'recipients', recipient_count, 'sentAt', created_at
               ) order by created_at desc)
          from (
            select subject, recipient_count, created_at
              from public.broadcasts
             order by created_at desc
             limit 6
          ) b
      ), '[]'::jsonb)
    ),
    -- Queues, not period totals: a pending submission does not expire at the end of a range, so every
    -- number here is "right now" except the error count.
    'attention', jsonb_build_object(
      'pendingSubmissions', (select count(*) from public.outline_submissions where status = 'pending'),
      'pendingReviews', (select count(*) from public.change_requests where status = 'pending'),
      'unhandledMessages', (select count(*) from public.contact_messages where handled_at is null),
      'calendarTba', (select count(*) from public.academic_calendar where starts_at is null),
      'failedEmails', (select count(*) from public.email_outbox where status = 'failed'),
      'errors24h', (select count(*) from public.error_log where at > now() - interval '24 hours')
    ),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object('kind', kind, 'label', label, 'at', at) order by at desc)
        from (select kind, label, at from activity order by at desc limit 12) a
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_analytics(integer) from public, anon;
grant execute on function public.admin_analytics(integer) to authenticated;

-- ===== Retention =====
-- page_views grows on every navigation, so it needs an expiry from the day it ships. Twelve months
-- matches contact_messages, and re-declaring the function here (rather than editing the original
-- migration, which is already applied) keeps one purge job for every table that has a window.
create or replace function public.purge_old_data()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.contact_messages where created_at < now() - interval '12 months';
  delete from public.error_log where at < now() - interval '30 days';
  delete from public.page_views where at < now() - interval '12 months';
$$;
