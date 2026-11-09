# Admin Analytics Rollup and N+1 Audit

Admin analytics is computed live over raw event tables, and several handlers loop per-row queries —
this gets slower quadratically as data accumulates and will be the first admin pain at scale.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Rollup table | `analytics_daily(day, metric, key, value)` filled by a nightly worker |
| Worker | Reuses the email-worker pattern (`/api/system?action=…` + **Supabase `pg_cron`**, which is free — it is already what the calendar reminders use per `2026-10-17-calendar-ics-feed-design.md`; Vercel Hobby cron only allows ~2 daily jobs, so keep it on pg_cron) |
| Handlers | Admin analytics + `analyticsPdf` read rollups with raw-SQL fallback for "today" |
| N+1 audit | Grep per-row `supabase` calls inside loops in `api/` and `src/lib/`; convert to `in()` batches |
| Index | Cover rollup key: `analytics_daily(day, metric)` unique |

### Out

- **Realtime analytics.** Nightly granularity is honest for an org dashboard; hourly if needed later.
- **A warehouse (BigQuery/Tinybird).** Overkill; Postgres window functions suffice at this scale.

---

## 2. The problem

`page_views` indexes exist (`page_views_at_idx`, `page_views_path_at_idx`) but scanning raw rows per
admin page-load burns CPU and egress every time an exec opens the dashboard. `src/lib/analyticsPdf.js`
(739 LOC) aggregates for PDF export — the exact place N+1 hides. Any loop shaped like
`for (row of rows) await supabase…` is a latent timeout.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Granularity | Daily rollup, overwritten per day (idempotent `on conflict`) | Simple, rerun-safe for cron retries |
| Metrics v1 | page views/day, uniques (approx via count(distinct)), per-path top-20, quiz completions, form submissions | Covers the current dashboard, no more |
| "Today" | Live query bounded to `at >= date_trunc('day', now())` | Fresh enough; one bounded scan |
| Batch audit | One PR converting loops to `in()`; add `api/_lib/batch.js` helper | Removes the whole class, not one instance |
| PDF | Reads rollups; exports render from ≤ 366 rows | PDF generation stays under the 60 s function budget |

## 4. The change

Migration:
`create table public.analytics_daily(day date not null, metric text not null, key text not null default '',
value bigint not null default 0, primary key(day, metric, key));`
A scheduled handler `api/system?action=analytics-rollup` upserts yesterday's numbers. Admin dashboard
and `analyticsPdf.js` swap raw scans for `analytics_daily` reads. N+1 sites rewritten to
`… .in('id', ids)` with a two-phase map.

## 5. Verification

1. Rollup run twice → identical row counts (idempotent).
2. Dashboard query plan shows index-only scans on `analytics_daily`.
3. `grep -E 'for.*await.*supabase' api src` → no remaining hits without an explicit exception comment.
4. `npm run build` + existing analytics tests green; ADMIN.md notes the metrics' freshness (24 h).

## 6. Risk

Rollup drift if the worker fails — mitigate with a `system_test`-style check alerting when
`analytics_daily` lacks yesterday. "Uniques" from count(distinct) on raw rows during the backfill may be
slow once on a big table — run the backfill off-peak, chunked by day.
