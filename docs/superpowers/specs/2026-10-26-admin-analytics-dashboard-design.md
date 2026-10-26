# Admin analytics dashboard — design

Date: 2026-10-26
Status: awaiting review

## Goal

One screen at `/admin/analytics` that answers, for a chosen period: how many people visited, how
many joined, what they used, what they read, and what needs attention right now. It is an admin
tool, reachable from the existing `/admin` tile grid.

## What exists, and what has to be invented

Nothing about traffic is recorded today. There is no page-view table, no beacon, no chart library.
Two of the requested metrics therefore depend on a new write path:

| Requested | Reality |
|---|---|
| Users & signups over time | `profiles.created_at` — ready |
| Quiz plays, practice, battles | `quiz_sessions`, `quiz_practice_runs`, `quiz_battles` — ready |
| CBT attempts | `cbt_attempts.started_at / finished_at / mode` — ready |
| Form responses | `form_responses.created_at` — ready |
| Pending submissions / reviews | `outline_submissions.status`, `change_requests.status` — ready |
| Email opt-in, broadcasts sent | `profiles.email_notifications_enabled`, `broadcasts.recipient_count` — ready |
| Award participation | `award_votes.created_at` per `award_categories` — ready |
| Failed emails, app errors | `email_outbox.status='failed'`, `error_log.at` — ready |
| **Page views / visitors** | **nothing — new `page_views` table + beacon** |
| **Most-viewed news / events** | **nothing — same `page_views` table** |
| **Unreplied messages** | `contact_messages` has no read/handled state — new `handled_at` column |

## Architecture

One admin-gated `security definer` RPC returns the entire dashboard for a period as a single
`jsonb`. The browser makes one request, the database does the grouping, no raw rows cross the wire,
and the public tables' RLS is untouched.

Rejected alternatives:

- **Client-side queries grouped in JS.** 10–14 round trips, ~120 KB of rows, and every new metric
  becomes another request. Testable, but the wrong shape for a page an admin opens casually.
- **Third-party analytics (PostHog, Plausible).** Richer funnels and replay, but a vendor script on
  every public page, a cookie/consent question the site does not have today, and the numbers would
  live outside Supabase, splitting "views" from "signups" across two systems.

### Data flow

```
route change ──► PageViewTracker ──► record_page_view(path, visitor, referrer, viewer)
                                        │  (validates + 2s dedupe + truncates)
                                        ▼
                                   page_views
                                        │
/admin/analytics ──► admin_analytics(days) ──► jsonb ──► sanitizeAnalytics() ──► Recharts
       │                    (security definer, is_admin() gate, Africa/Lagos day buckets)
       └──► useAnalyticsQuery(days)  (react-query, staleTime 60s)
```

## Database

Migration `supabase/migrations/20261026120000_analytics.sql`.

### `page_views`

```sql
create table public.page_views (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  path          text not null check (char_length(path) between 1 and 200),
  visitor       text not null check (visitor ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 120),
  viewer        text not null default 'anon' check (viewer in ('anon', 'user'))
);
create index page_views_at_idx on public.page_views (at);
create index page_views_path_at_idx on public.page_views (path, at);
```

- **No IP, no user agent, no cookies, no user id.** `visitor` is a random UUID kept in
  `sessionStorage`, so it separates visitors within a browsing session and identifies nobody across
  sessions. The page labels the metric **"Visitors (sessions)"** rather than implying unique people.
- **`referrer_host` only**, never the full URL: the referring path can contain search terms or
  another site's internal ids.
- **`path` is normalised** to a pathname with no query string, no hash and no trailing slash, so
  `?utm_source=…` cannot split one page into fifty rows.
- **RLS on, no insert grant.** `record_page_view` is `security definer` and the only writer; select is
  admin-only. Insert is revoked from `anon` and `authenticated` so a client cannot forge rows.
- **Retention** is added to the existing `purge_old_data()` (12 months, the window that function
  actually uses) and asserted in `supabase/tests/retention.test.sql`.

### `record_page_view(p_path text, p_visitor text, p_referrer_host text, p_viewer text)`

Server-side validation is the only validation that counts:

- Truncate `p_path` to 200, drop it entirely if it does not start with `/`, strip `?`/`#`, collapse a
  trailing slash except for `/`.
- Refuse `/admin/%`, `/api/%`, `/play/%` (the projector and phone clients are not page views).
- Coerce `p_viewer` to `anon` unless it is exactly `user`; `p_viewer = 'user'` is only honoured when
  `auth.uid() is not null`, so an anonymous beacon cannot inflate the signed-in series.
- Ignore the row if the same `visitor` + `path` was recorded in the last 2 seconds — React's
  StrictMode double-effect in development and any retry would otherwise double every view.
- Return `void`; a failed insert is swallowed by the caller by design.

### `admin_analytics(p_days integer default 30) returns jsonb`

- `if not public.is_admin() then raise exception` — same gate as `admin_inbox`, which is a read.
  MFA is not required for a read, matching the existing read RPCs.
- `p_days` defaults to 30 when null and is clamped to `1..730`; `0` is the one explicit "all time"
  value, so an all-time series is the only unbounded query and it is opt-in.
- **Every day bucket is `(at at time zone 'Africa/Lagos')::date`.** Vercel runs UTC and the site is
  Lagos; a UTC bucket puts late-evening activity on tomorrow's bar, the same five-hour disagreement
  AGENTS.md records for calendar reminders.
- Returns current-period and previous-period totals for each KPI, so the client can compute deltas
  without a second call.

```jsonc
{
  "range": { "days": 30, "from": "2026-09-26", "to": "2026-10-26", "previousFrom": "2026-08-27", "previousTo": "2026-09-25" },
  "kpis": {
    "views":       { "current": 1840, "previous": 1200 },
    "visitors":    { "current": 612,  "previous": 540 },
    "signups":     { "current": 34,   "previous": 21 },
    "quizPlays":   { "current": 12,   "previous": 4, "players": 210 },
    "cbtAttempts": { "current": 57,   "previous": 61, "averageScore": 62 },
    "formResponses": { "current": 88, "previous": 40 },
    "optInRate":   { "current": 0.93, "previous": 0.91, "optedIn": 120, "total": 129 }
  },
  "traffic":     [{ "day": "2026-09-26", "views": 41, "visitors": 22, "signedIn": 6 }],
  "signups":     [{ "day": "2026-09-26", "count": 3 }],
  "engagement":  [{ "day": "2026-09-26", "quiz": 1, "practice": 2, "battles": 0, "cbt": 4, "forms": 3 }],
  "topContent":  [{ "path": "/news/scholarship-night", "label": "Scholarship night", "views": 140 }],
  "awards":      [{ "category": "Best Lecturer", "votes": 88, "season": "2026" }],
  "email":       { "optedIn": 120, "optedOut": 9, "broadcasts": [{ "subject": "Week 3", "recipients": 118, "sentAt": "2026-10-12T09:00:00Z" }] },
  "attention":   { "pendingSubmissions": 3, "pendingReviews": 1, "unhandledMessages": 2, "calendarTba": 4, "failedEmails": 1, "errors24h": 0 },
  "activity":    [{ "kind": "signup", "label": "A new member joined", "at": "2026-10-26T08:12:00Z" }]
}
```

- `topContent` joins the last path segment back to `news.id` / `events.id` for a display title and
  falls back to the cleaned path. Resource list pages (`/resources/:level/:semester`) are grouped as
  themselves — those routes carry no item id.
- `attention` is period-independent where the state is a queue (pending, unhandled, failed) and
  period-scoped only for `errors24h`.
- `activity` is a 12-row union of the newest signup, submission, response, message, finished quiz and
  published post. A row may carry a title an admin authored (a submission, a quiz, a news post); it is
  always rendered as a text node, never as HTML, and `AnalyticsPanels.test.jsx` asserts a title holding
  `<script>` comes out escaped.
- The series are dense: every day in the range is present with zeros rather than only days that have
  rows, so the client never has to invent a missing bucket.

### Messages: a state that exists

Migration adds `handled_at timestamptz` and `handled_by uuid references auth.users(id)` to
`contact_messages`, an admin update policy, and `set_contact_message_handled(p_id uuid, p_handled boolean)`.
`/admin/messages` gains a "Handled" toggle column; the dashboard card counts `handled_at is null`.

## Client

| File | Responsibility |
|---|---|
| `src/lib/analytics.js` (pure) | `normalisePath`, `sanitizeAnalytics` (shape + clamp every number), `percentDelta`, `humanisePath`, `analyticsCsv`, `RANGES` |
| `src/lib/analytics.test.js` | all of the above |
| `src/lib/pageViewTracker.js` (pure) | `shouldTrack(path)`, `readVisitor(storage)`, `referrerHost(ref)` — no `window` at import time |
| `src/lib/pageViewTracker.test.js` | skip rules, stable visitor per session, failures swallowed |
| `src/components/PageViewTracker.jsx` | one effect on `useLocation()`; honours `navigator.doNotTrack` / `globalPrivacyControl`; `.catch(() => {})` |
| `src/data/analytics.js` | `fetchAnalytics(days)`, `useAnalyticsQuery(days)`, `recordPageView(...)`, `useAnalyticsFlag()` |
| `src/pages/admin/AdminAnalytics.jsx` | route component, `?range=30d` state, layout |
| `src/components/admin/analytics/*` | `StatCard`, `TrafficChart`, `SignupChart`, `EngagementChart`, `TopContentList`, `AwardChart`, `EmailReach`, `AttentionPanel`, `ActivityFeed`, `QuickActions`, `RangePicker`, `ExportMenu` |
| `src/lib/analyticsPdf.js` | the PDF: drawn charts, KPI tiles, header, watermark and footer note (see below) |

Reuse rather than rebuild: `useCountUp` for KPI numbers, `downloadTextFile` for CSV, `Card`,
`Badge`, `Skeleton`, `EmptyState`, `ErrorState`, `Button`, and `lazyRetry` for the route chunk.

A kill switch is seeded in `feature_flags` (`analytics`, enabled). It is enforced **inside
`record_page_view`**, not in the browser: a client-side check would cost every anonymous visitor an
extra round trip just to decide whether to make another one, and would only stop a beacon that chose
to obey. A missing row means enabled, so a failed read cannot silently switch tracking off. The tile
on `/admin` reads the same flag (fail-open, like the calendar and holiday tiles) and disappears when
the switch is off; `/admin/*` is skipped in the client before any request is attempted.

`page_views` grows on every navigation, so the daily series is downsampled to 90 points in the
browser (`downsample` in `analytics.js`) — weekly buckets for an all-time range, unchanged for 7/30/90
days. The SQL always returns one row per day.

### PDF export

The PDF is drawn, not tabulated. The first build printed each number as a table row, which answered
"what are the figures" and nothing about the shape of a trend — so the export now mirrors the page:
KPI tiles across the top, then the traffic area chart, signups, stacked engagement, horizontal top
content and awards bars, an email donut, the queues and the activity list. Everything is jsPDF vector
primitives reading the same `sanitizeAnalytics` output as the screen; no screenshot, because
html2canvas captures Recharts' SVG unreliably and would bake in the exporting admin's viewport and
dark mode.

Two layouts, chosen from the PDF menu:

| Layout | Content |
|---|---|
| One-page summary (landscape) | header, seven tiles, traffic, email, signups, engagement, top content |
| Full report (portrait, 2 pages) | all of the above plus awards, the queues and the activity feed |

Both carry the logo, the period, the generated-at stamp, a 4%-opacity watermark and a footer note
saying the numbers are private to admins and when traffic counting began. `analyticsPdfModel` is pure
and tested; `drawAnalyticsReport` is exercised in Node against a real `jsPDF` document so a wrong
coordinate fails a test rather than shipping a broken page.

### Page layout

```
Executive Overview                     [7d|30d|90d|All]  [CSV] [PDF]
4 KPI cards — Visitors (sessions) · New members · Quiz players · Email opt-in
each: animated value, delta vs previous period, 14-day sparkline
┌──────────────────────┬──────────────────────┐
│ Traffic              │ Signups              │
├──────────────────────┼──────────────────────┤
│ Engagement mix       │ Top content          │
├──────────────────────┼──────────────────────┤
│ Award participation  │ Email reach          │
└──────────────────────┴──────────────────────┘
Needs attention · Recent activity · Quick actions
```

- Range lives in the URL (`?range=30d`) so a link is shareable and refresh-safe; it also keys the
  react-query cache.
- Every chart is responsive and dark-mode safe: colours come from existing tokens
  (`green-900`, `orange-500`, `success`, `warning`, `danger`, `hairline`) passed as CSS-variable
  reads, with no raw hex.
- Interactivity: hover tooltips, focus/keyboard-reachable range pills, animated counters, skeleton
  first paint, and an explicit empty state ("No visits recorded yet — data starts the day this
  shipped") because a fresh install will legitimately have zeros.
- `Recharts 3.10` goes in a lazy admin-only chunk. `/play/low` and the public pages gain nothing.

### Navigation

- New tile in `ADMIN_SECTIONS` (`category: 'Insights'`, `icon: 'insights'`), so the grid and any
  future sidebar read the same source.
- Route `admin/analytics` in `App.jsx` under the existing admin branch, lazy-loaded.
- `insights` added to `icon_names=` in `index.html`, alphabetically (after `info`).

## Privacy

The site has no consent banner and this design does not create a need for one: no personal data, no
IP, no device identifier, no cross-session identifier, no third-party processor. `doNotTrack` and
`globalPrivacyControl` are honoured. `/admin/*` is never recorded. Rows age out at 13 months with the
rest of the operational data.

## Testing

- `src/lib/analytics.test.js` — day bucketing across a Lagos midnight, `percentDelta` from zero,
  CSV quoting, sparse→dense series, `sanitizeAnalytics` rejecting a malformed payload, path
  humanising.
- `src/lib/pageViewTracker.test.js` — `/admin`, `/api`, `/play` excluded; query/hash stripped;
  visitor id stable within a session and regenerated without storage; a throwing storage fake does
  not break the caller.
- `src/lib/analyticsPdf.test.js` — the summary rows are built from the sanitised object.
- `supabase/tests/analytics.test.sql` — mirrors `rls_admins.test.sql`: an anonymous caller cannot
  select `page_views`; `record_page_view` refuses `/admin/…` and a >2s-duplicate; a non-admin calls
  `admin_analytics` and gets an exception.
- `supabase/tests/retention.test.sql` extended — a 14-month-old page view is purged, a recent one is
  kept.
- `migrations.test.js` — source-scan that the `page_views` policies exist and that the analytics RPC
  is `security definer` with an `is_admin()` gate, so a later `create or replace` cannot silently
  drop the gate.

## Out of scope

Funnels, cohort retention, per-user drilldown, realtime counters, session replay, per-page scroll or
click heatmaps, A/B testing, and revenue. Each needs either a heavier tracker or data the site does
not produce.

## Honest limitations

- **The dashboard reads real rows, so it cannot be reviewed with real numbers until the migration is
  applied to the Supabase project.** A local run shows the empty state only.
- **Rendering, dark mode and chart legibility are unverified without a signed-in admin session.**
- **Traffic starts empty.** Views begin the day the tracker ships; there is no backfill and the UI
  must say so rather than showing a broken-looking chart.
- Chart appearance cannot be checked by unit tests; the tests cover the numbers, not the pixels.
