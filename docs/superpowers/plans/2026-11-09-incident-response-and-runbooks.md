# Incident Response, Runbooks and Exam-Week Protocol — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Written, rehearsed responses for the five incidents that actually happen, a one-boolean kill switch per risky feature, and an exam-week war-room checklist.

**Architecture:** `docs/runbooks/*.md` (5 runbooks + drill script), `feature_flags` as the kill-switch mechanism wired via a `useFeatureFlag` helper copied from `useReportsFlag` (src/data/reports.js), and a CBT-window freeze checklist in ADMIN.md.

**Tech Stack:** Markdown, React Query helper, existing `feature_flags` table (select granted to anon per 20260929121000_feature_flags.sql).

**Spec:** `docs/superpowers/specs/2026-11-09-incident-response-and-runbooks-design.md`

## Global Constraints

- The kill switch must fail **open** (feature stays on if the flag can't be read) — a kill switch that holds a page hostage during a Supabase hiccup defeats its purpose. Copy `useReportsFlag`'s semantics verbatim.
- Every runbook fits on two screens; diagnosis order is fixed: is it DNS/Vercel → function logs → Sentry → DB.
- Never disable the site's only escalation path (ADMIN email) via flag.

---

## Task 1: Flag helper

**Files:** Create `src/data/featureFlags.js`

- [ ] Implement `useFeatureFlag(key)` exactly like `useReportsFlag` (`supabase.from('feature_flags').select('enabled').eq('key', key).maybeSingle()`, React Query `staleTime: 30_000`, default `true` until the row says otherwise — mirror reports.js:30-41).
- [ ] Admin read-all hook already exists (`useFeatureFlagsQuery`, src/data/systemLogs.js:72) — do not duplicate.
- [ ] Unit test: flag row missing → `true`; `enabled=false` → `false`.

## Task 2: Wire the three kill switches

- [ ] CBT: gate the CBT exam start/submit UI and the server handler entry (`api/_lib/cbt.js` callers' entry point) on `useFeatureFlag('cbt_enabled')`; when off → Maintenance-style notice page with exam help text.
- [ ] Live quiz battles: gate `BattleJoin`/`PlayBattle` entry UI and `quiz-battle` handler on `useFeatureFlag('battles_enabled')`.
- [ ] Broadcasts: gate the broadcast compose screen only (`/admin`) on `useFeatureFlag('broadcasts_enabled')` — students never see a difference.
- [ ] Seed rows: new migration adding the three flags (`insert into public.feature_flags(key, enabled, description) values ('cbt_enabled', true, …) on conflict (key) do nothing;`) + rollback file.
- [ ] Verify on staging: set `cbt_enabled=false` → CBT routes show the notice within 30 s; set back to true.

## Task 3: The five runbooks

**Files:** Create `docs/runbooks/{site-down,quiz-cannot-start,cbt-degraded,email-worker-stalled,db-locked}.md`

Each runbook, ≤ 120 lines: **Symptoms** → **Confirm in 2 min** (`/api/health`, Sentry issue, Vercel logs, Supabase status) → **Mitigate** (rollback command `vercel rollback <deployment-url>`, flag flips, disable cron by commenting schedule — never edit applied migrations, forward-fix) → **Comms** (pre-written student banner + WhatsApp copy) → **Escalate** (owner phone; Supabase support only for DB corruption; GH status page) → **After** (postmortem within 72 h, template link).

- [ ] `quiz-cannot-start` special: check `quiz_sessions.state`, `player count`, the 60 s `quiz-tick` cron (`cron.job_run_details`) and whether `open_join` flipped; the fix is usually a stuck session state — SQL recipe provided in the runbook, wrapped in a transaction, admin-only.

## Task 4: Exam-week protocol

- [ ] ADMIN.md gains "## Exam Week (CBT) Protocol": 72 h before — config freeze (no non-essential deploys), verify rollback target, staffed coverage 08:00–17:00, student-facing FAQ pre-posted, flags pre-checked (`cbt_enabled=true`), `/api/health` UptimeRobot alert acknowledged.
- [ ] 1 h before — smoke: join CBT with the fixture student end-to-end on the live site.

## Task 5: Postmortem template + tabletop

**Files:** Create `docs/postmortems/TEMPLATE.md` (context / impact / timeline / root cause / contributing factors / action items with owners + dates)

- [ ] Run one tabletop ("CBT submit returns 500 for 15 minutes") with the owner; capture gaps as issues.

## Rollback

Flag helper is additive; switches read new flags defaulting on — deleting the migration rows disables the flags (features stay on). Runbooks are docs; delete freely.
