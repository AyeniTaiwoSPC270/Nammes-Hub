-- Problem reports and feedback arrive in the admin inbox and on the dashboard, and news is now
-- shared by slug as well as by id. All three land here because `admin_inbox()` and
-- `admin_analytics()` are re-declared wholesale -- `create or replace` replaces the entire body, so
-- a second migration carrying only the feedback half would silently delete the reports half.
-- One declaration, every change, one thing to review.
--
-- Specs:
--   docs/superpowers/specs/2026-10-31-report-a-problem-design.md
--   docs/superpowers/specs/2026-10-31-news-slugs-share-preview-design.md
--   docs/superpowers/specs/2026-10-31-rate-the-hub-modal-design.md

-- ===== The seen table has to accept the two new categories =====
-- Without this, the first admin to open the bell with a report or a rating in it gets a check
-- violation instead of a notification.
alter table public.admin_inbox_seen drop constraint if exists admin_inbox_seen_category_check;
alter table public.admin_inbox_seen
  add constraint admin_inbox_seen_category_check check (category in
    ('submissions', 'messages', 'responses', 'reviews', 'errors', 'announcements', 'reports', 'feedback'));

-- ===== The inbox =====
-- Re-declared from 20261017120000_admin_inbox.sql with three changes:
--   * the messages source now selects `kind = 'message'` only, so a report is not also announced
--     as a contact message under the wrong label;
--   * a `reports` source: the page title is the detail, because that is where the admin has to go;
--   * a `feedback` source, and an `outstanding` count for both new categories so the bell can be
--     emptied -- `reports` and `feedback` both have a handled state, unlike messages or responses.
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
     where m.kind = 'message'
       and m.created_at > now() - interval '30 days'

    union all
    select 'reports'::text as category, m.id::text, 'New problem report',
           coalesce(nullif(m.page_title, ''), m.page_url), m.created_at
      from public.contact_messages m
     where m.kind = 'report'
       and m.created_at > now() - interval '30 days'

    union all
    select 'feedback'::text as category, f.id::text,
           'Rating ' || f.rating || '/5',
           coalesce(nullif(f.message, ''), nullif(f.category, ''), ''), f.created_at
      from public.hub_feedback f
     where f.created_at > now() - interval '30 days'

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

  -- `outstanding` means work that is still unresolved, not "how many rows exist". Messages,
  -- responses and announcements have no resolution at all; reports and feedback do, and counting
  -- them is what lets an admin empty the bell instead of watching it grow forever.
  with totals as (
    select 'submissions' as category,
           count(*)::int as outstanding
      from public.outline_submissions
     where status = 'pending'

    union all
    select 'messages', 0

    union all
    select 'reports', count(*)::int
      from public.contact_messages
     where kind = 'report' and handled_at is null

    union all
    select 'feedback', count(*)::int
      from public.hub_feedback
     where not handled

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

-- ===== The dashboard =====
-- Re-declared from 20261026120000_analytics.sql with five changes:
--   1. top_content resolves a news path by id OR by slug -- articles are now shared by slug, and a
--      join on id alone would stop resolving every shared link;
--   2. the activity feed labels a report as a report instead of "New contact message";
--   3. a `reports` KPI, counted for the range like every other flow;
--   4. a `feedback` KPI: ratings in the range plus the all-time average, because an average over
--      thirty days of a five-vote table is a number that means nothing;
--   5. `unhandledMessages` counts messages only. A report is triaged with its own tick, so leaving
--      it in this total would make the dashboard's one reply-related number climb forever.
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
  -- grouped by their list route because /resources/:level/:semester has no per-item id. The news join
  -- matches either form of the address, so a path recorded before slugs existed and one recorded
  -- after both resolve to the article's title.
  top_content as (
    select t.path,
           coalesce(n.title, e.title) as label,
           t.views
      from top_paths t
      left join public.news n
        on t.path = '/news/' || n.id or t.path = '/news/' || n.slug
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
    select m.created_at, 'message',
           case when m.kind = 'report'
                then 'Problem report: ' || coalesce(nullif(m.page_title, ''), m.page_url)
                else 'New contact message' end
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
      -- Reports are a flow: how many arrived, for the range, against the range before it.
      'reports', jsonb_build_object(
        'current', (select count(*) from public.contact_messages where kind = 'report' and created_at >= v_start and created_at < v_end),
        'previous', (select count(*) from public.contact_messages where kind = 'report' and created_at >= v_prev_start and created_at < v_prev_end)
      ),
      -- The count is a flow; the average is a state. A rating table has too few rows for a
      -- thirty-day mean to say anything, so the average and total read all time -- the same
      -- reasoning the optInRate KPI uses below.
      'feedback', jsonb_build_object(
        'current', (select count(*) from public.hub_feedback where created_at >= v_start and created_at < v_end),
        'previous', (select count(*) from public.hub_feedback where created_at >= v_prev_start and created_at < v_prev_end),
        'average', (select coalesce(round(avg(rating)::numeric, 1), 0) from public.hub_feedback),
        'total', (select count(*) from public.hub_feedback)
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
      -- Reports are excluded: they are triaged with their own handled tick, never replied to, so
      -- counting them here would make a number that is supposed to mean "someone is waiting on you"
      -- grow every time a visitor reports a broken link.
      'unhandledMessages', (select count(*) from public.contact_messages where kind = 'message' and handled_at is null),
      'unhandledReports', (select count(*) from public.contact_messages where kind = 'report' and handled_at is null),
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
