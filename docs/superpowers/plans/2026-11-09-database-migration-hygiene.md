# Database Migration Hygiene and Retention — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Index the unindexed foreign keys, bound the two unbounded tables, and record a feasibility map for squashing — no rewriting of applied history.

**Architecture:** A one-off audit SQL (run in staging) produces the FK/index gap list; one additive migration fixes it; an `page_views_daily` rollup + scheduled retention sweep bounds raw `page_views`; `migrations.test.js` gains a guard; `docs/db/migration-map.md` records what would squash cleanly.

**Tech Stack:** psql/SQL editor, supabase migrations, vitest (`supabase/migrations.test.js`), existing `/api/system?action=…` worker pattern (see email-worker handler), `pg_cron` for the sweep.

**Spec:** `docs/superpowers/specs/2026-11-09-database-migration-hygiene-design.md`

## Global Constraints

- Never edit an applied migration; every change is a new `supabase/migrations/YYYYMMDDHHMMSS_*.sql` + a `supabase/rollbacks/<same-name>.rollback.sql` pair.
- Every migration must be idempotent where the pattern allows (`if not exists`), and explained in header comments like the house style (e.g. `20261026120000_analytics.sql`).
- Retention never deletes silently: batched deletes of ≥ 50k rows per batch, logged to `audit_log` (entity `retention-sweep`).

---

## Task 1: Audit queries

**Files:** Create `scripts/sql/audit-fk-indexes.sql`

- [ ] Query: FKs without covering index — `select con.conrelid::regclass as table, a.attname as fk_col from pg_constraint con join unnest(con.conkey) k(attnum) on true join pg_attribute a on a.attrelid=con.conrelid and a.attnum=k.attnum where con.contype='f' and not exists (select 1 from pg_index i where i.indrelid=con.conrelid and a.attnum = any(i.indkey));`
- [ ] Also list unused indexes (`pg_stat_user_indexes.idx_scan = 0` over 30 days) — report only, no drops.
- [ ] Run against staging (never prod first). Write the output to the new file `docs/db/fk-index-audit-2026-11.md`. Commit.

## Task 2: The index migration

- [ ] Create `supabase/migrations/20261110090000_fk_index_coverage.sql`: `create index if not exists <table>_<col>_idx on public.<table> (<col>);` per audit row (use plain `create index` — cannot use `concurrently` inside the transaction wrapper).
- [ ] Rollback sibling drops exactly those indexes.
- [ ] Apply to staging; re-run audit → zero missing. `npm test` (migrations.test.js will pick up the new file).
- [ ] Apply to prod via SQL editor (owner). Record in ADMIN.md.

## Task 3: page_views rollup + retention

- [ ] Migration `20261110091000_page_views_daily.sql`:

```sql
create table if not exists public.page_views_daily (
  day date not null, path text not null, views bigint not null default 0,
  primary key (day, path)
);
alter table public.page_views_daily enable row level security;
create policy page_views_daily_select_admin on public.page_views_daily
  for select to authenticated using ((select public.is_admin()));
revoke all on public.page_views_daily from anon, authenticated;
grant select on public.page_views_daily to authenticated;
```

- [ ] Extend `api/_lib/handlers/email-worker.js`? No — **separate, new** worker `api/_lib/handlers/retention-sweep.js` registered in `api/system.js` ACTIONS as `retention-sweep` (no new function slot), doing: (1) upsert yesterday's `page_views_daily` from raw (`insert … on conflict (day,path) do update set views = excluded.views`), (2) delete raw `page_views` older than 13 months in batches of 50k (`ctid in (select ctid from page_views where at < now() - interval '13 months' limit 50000)`) until affected = 0, (3) same treatment for `quiz_practice_runs` > 2 years, (4) one `audit_log` row with totals.
- [ ] Schedule: `cron.schedule` weekly Sunday 04:00 — commented-out line pattern copied from `20261009120000_calendar_reminders.sql` (they leave cron scheduling as a documented, commented step); enabling is an owner action in the SQL editor.
- [ ] Rollback file; staging dry-run; verify counts reconcile: sum(daily) ≈ raw count for a known window (±1%).

## Task 4: Guard test

**Files:** Modify `supabase/migrations.test.js`

- [ ] Add: every `<col>_idx` from the FK audit list exists in some migration (so regressions fail loud). Strip comments before matching (existing file already does this).
- [ ] Commit.

## Task 5: Squash map

**Files:** Create `docs/db/migration-map.md`

- [ ] Baseline hash = oldest state producing current prod schema; list of squashable files (< 2026-01-01, no seed data, superseded by later fixes), list of untouchable (seeds, hand-applied fixes like the outlines columns — see open spec).
- [ ] Explicit "do not squash yet" verdict with rationale (applied-history rewrite, zero functional gain) — this doc exists so the question is answered, not re-litigated.

## Rollback

Indexes: drop via rollback file (fast). Retention: restore from nightly dump (backup plan) if rows vanish prematurely — hence the audit_log counts to notice fast.
