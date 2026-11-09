# Staging Environment on Free Tiers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a zero-cost staging environment (second Supabase free project + Vercel Hobby preview/branch alias) with deterministic seed data and a keepalive job, so every later spec in the 2026-11-09 program rehearses here instead of production.

**Architecture:** A second free Supabase project (`nammes-hub-staging`) is built from `supabase/history/` + `supabase/migrations/` in the same order production used. Vercel "Preview" environment variables point at the staging keys; a `staging` branch alias gives the staging a stable URL while PRs get their own. A weekly GitHub Action pings `/api/health` so the free project does not auto-pause. `scripts/seed-staging.mjs` upserts a deterministic fixture.

**Tech Stack:** Supabase (free), Vercel Hobby (free), GitHub Actions, `@supabase/supabase-js` (already a dependency), Node 22 (CI's version).

**Spec:** `docs/superpowers/specs/2026-11-09-staging-environment-design.md`

## Global Constraints

- Zero spend. No paid Supabase features (no PITR, no branching, no replicas). If something needs money, stop and report.
- Never point Preview at production keys. Check the scope dropdown twice in Vercel.
- Staging keys are distinct from prod keys everywhere; nothing staged may write to prod, ever.
- Existing conventions: env vars are documented in `.env.example`, migrations live in `supabase/migrations/`, verification runs with `npm run lint && npm run build && npm test`.
- Commit after every task.

---

## Task 1: Create the staging project and rebuild its schema

- [ ] **Step 1 (manual):** Create a second Supabase free project named `nammes-hub-staging` in the same org. Note the URL, anon key, service-role key, and direct DB connection string (Project Settings → Database).
- [ ] **Step 2:** Rebuild the schema locally against staging: run `supabase/history/*.sql` in numeric order in the SQL editor, then every `supabase/migrations/*.sql` in name order. (This is the same rehearsal the backup drill performs.)
- [ ] **Step 3:** Verify with the README's checklist: `select count(*) from information_schema.tables where table_schema = 'public';` — expect 68+.
- [ ] **Step 4:** Confirm RLS is on for the tables the spec touches: `select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in ('page_views','audit_log','admins');`

## Task 2: Record the env contract

- [ ] **Step 1:** Create `.env.staging.example` (committed) with placeholders:

```bash
VITE_SUPABASE_URL=https://YOUR-STAGING-REF.supabase.co
VITE_SUPABASE_ANON_KEY=staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=staging-service-role-key
SUPABASE_POOLER_URL=postgresql://postgres.YOUR-STAGING-REF:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
VITE_APP_ENV=staging
```

- [ ] **Step 2:** Add `.env.staging` to `.gitignore` (check it is not already listed).
- [ ] **Step 3:** Document in `ADMIN.md` under a new "## Staging" section: where the keys live, that Preview in Vercel uses them, how to promote a migration staging → prod (SQL editor, name order), and that fixtures are the default test data.
- [ ] **Step 4:** Commit: `git add .env.staging.example .gitignore ADMIN.md && git commit -m "docs: record staging environment setup"`

## Task 3: Vercel wiring (manual, one-time)

- [ ] **Step 1:** Vercel → Project → Settings → Environment Variables: set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (and `SUPABASE_POOLER_URL` once the cache-and-pooling plan lands) with scope **Preview** only. Leave **Production** untouched.
- [ ] **Step 2:** Create a `staging` branch from `master` and push: `git switch -c staging && git push -u origin staging`. Confirm the alias deploy is created and serves the app.
- [ ] **Step 3:** Smoke: open the preview URL; home renders; `/outlines` lists (empty is fine pre-seed); `/api/health` returns 200.

## Task 4: Deterministic seed script

**Files:** Create `scripts/seed-staging.mjs`

- [ ] **Step 1:** Write `scripts/seed-staging.mjs`: uses `@supabase/supabase-js` with the service-role key from `.env.staging` (dotenv is already a transitive dep; or read env directly). Upsert by fixed UUIDs (idempotent). Fixture: 1 `admins` row (owner), 2 exco `profiles`, 18 student `profiles`, 1 CGPA per student? — keep minimal: outlines for 100–200 level, 1 active quiz session quiz with 20 questions, 1 CBT course + exam with 10 questions, 1 event, 1 form with 2 responses, a few `page_views` rows. Use `upsert(..., { onConflict: 'id' })` everywhere.
- [ ] **Step 2:** Run it twice; second run must report zero inserts (or upsert-noops).
- [ ] **Step 3:** Verify in SQL editor: `select count(*) from quizzes;` etc.
- [ ] **Step 4:** Commit: `git add scripts/seed-staging.mjs && git commit -m "chore(scripts): add deterministic staging seed"`

## Task 5: Keepalive

**Files:** Create `.github/workflows/staging-keepalive.yml`

- [ ] **Step 1:** Workflow: `on: schedule: cron: '0 6 * * 1'` + `workflow_dispatch`; job runs `curl -fsS "$STAGING_HEALTH_URL"` and a second `curl` to `$STAGING_URL/api/health`. Store `STAGING_HEALTH_URL` as a repo variable.
- [ ] **Step 2:** Add `workflow_dispatch` test run; confirm green.
- [ ] **Step 3:** Commit: `git add .github/workflows/staging-keepalive.yml && git commit -m "ci: keep staging Supabase project unpaused"`

## Task 6 (final): Program parity note

- [ ] **Step 1:** Add one line to `docs/superpowers/plans/2026-11-09-program-build-order.md` confirming staging is green; every later plan's "staging" references mean this environment.
- [ ] **Step 2:** Final check: `npm test` untouched paths (`api/`, `src/`) — no stray edits.

## Rollback

Delete the staging branch and (if anything goes wrong with keys) rotate the staging service-role key in Supabase. Production is never touched by this plan.
