# Admin Analytics: N+1 Audit and Rollup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** The admin dashboard + PDF export stop doing per-row awaits; the heavy path (if any) gets an optional nightly rollup — without duplicating the existing `admin_analytics(p_from, p_to)` RPC.

**Architecture:** Phase A (this plan's core): mechanically find and batch every per-row await-loop; measure dashboard p95 before/after. Phase B (only if audit shows the RPC is the bottleneck): a `page_views_daily`-style rollup read via an extension of `admin_analytics` using the house "wholesale re-declare" convention — or the separate `analytics_daily` table; decide with data, in the open.

**Tech Stack:** `@tanstack/react-query` (client), existing SQL RPC, `pg_cron` (free, already used by calendar reminders), vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-admin-analytics-rollup-design.md`

## Global Constraints

- `admin_analytics` is re-declared wholesale in any migration that changes it — never `create or replace` a half body (see `20261031130000_inbox_and_analytics_rollup.sql`'s header note).
- Rollup is **optional work behind evidence**; Phase A alone must land green and may already be enough.
- Do not change metric definitions (what counts as an engaged student etc.) in this plan.

---

## Task 1: Baseline

- [ ] In devtools on staging/prod admin: load Admin Analytics, record windowed p95 and bytes transferred (docs/perf/admin-analytics-baseline-2026-11.md).
- [ ] Read `src/pages/admin/AdminAnalytics.jsx` and `src/lib/analyticsPdf.js`; list every data fetch (RPC names, table names).

## Task 2: The N+1 audit (the actual fix)

**Files:** Create `scripts/find-nplus1.mjs`

- [ ] Script: scan `src/` and `api/` for awaits inside loops whose body contains `.from(`, `.select(`, or `.rpc(` — heuristic regex; print file:line + enclosing function name.
- [ ] Run it; write the raw output to the new file `docs/perf/nplus1-report-2026-11.md` with a manual verdict per hit (true N+1 / false positive / accepted).
- [ ] Convert true positives to `in()`/`range()` batches:
  - typical shape: `const { data } = await supabase.from('profiles').select('id,name').in('id', ids)` then map by id client-side.
  - `analyticsPdf.js`: build the whole PDF from ≤ 3 queries; no per-row fetch inside the render loop.
- [ ] `npm test` after each conversion batch (three commits expected max).

## Task 3: Measure what you changed

- [ ] Re-run the baseline measurement; write before/after into the perf doc; open a PR titled `perf(admin-analytics): batch N+1 queries` with both numbers.

## Task 4 (optional, only if still slow): Rollup table

- [ ] Migration: `create table public.analytics_daily(day date not null, metric text not null, key text not null default '', value bigint not null default 0, primary key (day, metric, key));` + admin-only select policy (copy `page_views_daily` policy from the migration-hygiene plan verbatim pattern).
- [ ] Worker: **Create** `api/_lib/handlers/analytics-rollup.js` → registered in `api/system.js` ACTIONS as `analytics-rollup` (no new function slot); computes yesterday's metrics idempotently (`on conflict do update set value = excluded.value`); `pg_cron` 05:00 daily (commented-schedule pattern — owner enables in SQL editor like calendar-reminders).
- [ ] Read path: extend `AdminAnalytics` to prefer `analytics_daily` for windows ≥ 7 days; fall back to `admin_analytics()` for "today" and any window including today.
- [ ] Verify: rollup rerun is idempotent; dashboard identical totals vs RPC on same window (±0); PDF export < 30 s on prod-like volume.

## Rollback

Phase A: revert the batching commits. Phase B: drop `analytics_daily` via rollback file; client falls back to RPC automatically by removing the preference branch.
