# Database Migration Hygiene and Row Retention

255 tracked `ALTER TABLE` statements across 135 SQL files show organic, hand-applied drift — plus unknown
foreign-key indexing and unbounded growth of `page_views`-class tables.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Squash analysis | Map migration history; identify squashable baseline vs live deltas (no rewrite of history yet) |
| FK index audit | List every FK without an index; add covering indexes in one migration |
| Retention | `page_views` rollup + delete raw rows older than 13 months; `quiz_practice_runs` retention 2 years |
| Guard | `supabase/migrations.test.js` extension: every FK column referenced has an index or a comment justifying it |
| Discipline | New migrations must be additive and reversible-forward; destructive changes need a two-step deploy |

### Out

- **Squashing migrations now.** Rewriting applied history is a separate, high-risk operation — this spec only maps feasibility.
- **Partitioning.** Noted as Phase 2 if `page_views` exceeds ~20M rows.

---

## 2. The problem

`20261009100000`-style files interleave seeds, fixes, and features; two columns were added through the dashboard with no DDL at all (see `2026-10-17-database-integrity-fixes-design.md`). RLS policies (251) reference columns that drift; indexes (51) may not cover FKs — Postgres does **not** auto-index FK columns, and `quiz_answers(session_id)`, `award_votes(season_id)` etc. can pile up seq scans.

`page_views(path, at)` will dominate storage within a year; unbounded growth degrades every backup and list query.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| FK audit | Query `pg_constraint` vs `pg_index`; produce the missing-index list; one additive migration | See §2; zero downtime |
| page_views | Nightly rollup into `page_views_daily(day, path, views)` (pairs with the analytics-rollup spec); raw kept 13 months, then deleted in batches of 50k | Bounded table; dashboard unaffected |
| Squash map | `docs/db/migration-map.md`: baseline hash + list of post-baseline files | Cheap now; unlocks a future squash without archæology |
| Guard | Index lint in `migrations.test.js` | The class of bug stops here |

## 4. The change

New migration: adds missing FK indexes (`concurrently` where possible — note: inside a transaction use plain `create index`). Scheduled `api/system?action=retention-sweep` deletes expired raw rows in batches. `migrations.test.js` gains the FK-index lint. `docs/db/migration-map.md` committed.

## 5. Verification

1. `EXPLAIN` on the three heaviest FK joins (quiz answers↔players, votes↔nominees) shows index scans.
2. Retention job on staging: row counts drop as expected; rollup totals reconcile with raw count ±0.
3. Guard test fails when a new FK lacks an index (prove by planting one).
4. Backup size before/after one raw sweep recorded.

## 6. Risk

Deleting raw `page_views` destroys forensic detail — 13-month retention balances storage vs analytics needs; extend if a stakeholder objects. `create index concurrently` cannot run inside Supabase's migration transaction wrapper; apply via SQL editor per README convention and note it in the migration header.
