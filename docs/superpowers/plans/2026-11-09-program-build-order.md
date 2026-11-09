# NAMMES Hub Improvement Program — Build Order

**Date:** 2026-11-09. **Companion docs:** `2026-11-09-program-setup-checklist.md` (accounts/software), `2026-11-09-program-post-deploy-verification.md` (what to verify after each plan lands + after deploy), `2026-11-09-spec-plan-codebase-audit.md` (spec ↔ plan ↔ codebase review results).

This file decides **in what order to execute the 35 implementation plans** (`2026-11-09-*.md` in this directory). The rules:

1. Nothing depends on something unbuilt. Within a phase, order is top-to-bottom; phases are sequential.
2. Every plan validates on **staging** first — staging is Phase 2 and is the hard prerequisite for drills, e2e, and load tests.
3. Anything touching the database assumes the **backup** plan (Phase 2) succeeded.
4. Production deploys are one phase at a time; watch the SLOs (Phase 3) between phases.
5. Phases 6–7 are internal quality work; Phases 1–5 are risk-reducing. Do not reorder risk above quality without a reason.

---

## Phase 0 — Owner accounts and keys (no code)

Do the **setup checklist first** — nothing in Phase 3+ works without the accounts it creates. Summary: second Supabase project (staging), Upstash Redis, UptimeRobot, Telegram bot, Search Console, GitHub ruleset, Resend/Sentry/Vercel dashboard access confirmed, 2FA inventory. See `2026-11-09-program-setup-checklist.md`.

## Phase 1 — Repo safety and CI discipline

| # | Plan | Why here |
|---|---|---|
| 1.1 | `2026-11-09-dev-workflow-and-adr.md` | husky/commitlint/PR template/ADRs — every later commit benefits |
| 1.2 | `2026-11-09-security-ci.md` | CodeQL/Dependabot/audit gate — catches problems from here on |
| 1.3 | `2026-11-09-repo-hygiene.md` | history rewrite + ruleset — **blocked on owner sign-off for the force-push**; safe to do first, may finish last |

## Phase 2 — Staging and restore safety

| # | Plan | Why here |
|---|---|---|
| 2.1 | `2026-11-09-staging-environment.md` | every subsequent DB-bearing plan and every drill runs against staging |
| 2.2 | `2026-11-09-backup-and-restore-drill.md` | backup exists before prod schema changes; restore is rehearsed before we need it |

Gate to Phase 3: staging green end-to-end (signup → CBT → quiz → outlines), nightly backup produced, one restore drill completed.

## Phase 3 — Security and integrity hardening (risk reduction)

| # | Plan | Depends on |
|---|---|---|
| 3.1 | `2026-11-09-rate-limiting.md` | Upstash (Phase 0) |
| 3.2 | `2026-11-09-input-validation-zod.md` | — |
| 3.3 | `2026-11-09-html-sanitization.md` | — |
| 3.4 | `2026-11-09-admin-audit-and-least-privilege.md` | — |
| 3.5 | `2026-11-09-slo-and-alerting.md` | UptimeRobot + Telegram bot (Phase 0) |
| 3.6 | `2026-11-09-incident-response-and-runbooks.md` | creates the `useFeatureFlag` helper + kill-switch flags; **every later "rollback" instruction assumes these flags exist** |
| 3.7 | `2026-11-09-database-migration-hygiene.md` | backup (2.2); creates `page_views_daily` + sweep used by phases 4 & 7 |

Gate to Phase 4: `/api/health` monitor green for 7 days; 429/400 drills passed; audit_log writes observed on staging.

## Phase 4 — Performance and scale

| # | Plan | Depends on |
|---|---|---|
| 4.1 | `2026-11-09-cache-and-pooling.md` | Upstash (Phase 0); pooler before traffic |
| 4.2 | `2026-11-09-api-payload-and-pagination.md` | — |
| 4.3 | `2026-11-09-bundle-and-chunking.md` | — |
| 4.4 | `2026-11-09-asset-delivery.md` | handbook URL switch touches prod content — do after Phase 2 |
| 4.5 | `2026-11-09-web-vitals-rum.md` | Sentry |
| 4.6 | `2026-11-09-admin-analytics-rollup.md` | N+1 audit first; Phase B only if the audit proves it (else close as done) |
| 4.7 | `2026-11-09-load-testing-live-quiz.md` | staging (2.1) + pooler (4.1) + indexes (3.7) |

Gate to Phase 5: load ladder recorded; web-vitals baseline written; admin analytics measured.

## Phase 5 — Usability and UX

| # | Plan | Notes |
|---|---|---|
| 5.1 | `2026-11-09-error-feedback-and-undo.md` | **extends `EmptyState`** — must land before onboarding (also extends it) |
| 5.2 | `2026-11-09-accessibility-completion.md` | touches `Layout.jsx` and every modal; land before onboarding (also touches Layout) |
| 5.3 | `2026-11-09-ux-onboarding-and-guidance.md` | builds on 5.1 + 5.2; includes the exec-persona gate (verify admin detection honestly) |
| 5.4 | `2026-11-09-pwa-offline.md` | after UX stabilizes (SW update prompt must not fight live quizzes) |
| 5.5 | `2026-11-09-mobile-quiz-host.md` | independent |
| 5.6 | `2026-11-09-content-search.md` | independent; add the `search` bucket to the rate-limiter while wiring |

## Phase 6 — Codebase structure (internal quality)

| # | Plan | Depends on |
|---|---|---|
| 6.1 | `2026-11-09-app-route-registry.md` | merge after 5.x (routes settle) |
| 6.2 | `2026-11-09-feature-folder-migration.md` | **6.1** (router imports change location) |
| 6.3 | `2026-11-09-typescript-core-migration.md` | after 6.2 (file moves settle) |
| 6.4 | `2026-11-09-e2e-and-dead-code.md` | staging (2.1); e2e CI job must be green |
| 6.5 | `2026-11-09-design-system-governance.md` | tokens stabilize after phases 1–5 |

## Phase 7 — Privacy, discoverability, cost, handover

| # | Plan | Notes |
|---|---|---|
| 7.1 | `2026-11-09-privacy-first-analytics.md` | extends NDPR inventory (7.2) — or land 7.2 first; both orders work, keep both consistent |
| 7.2 | `2026-11-09-data-governance-ndpr.md` | needs migration-hygiene (3.7) for retention enforcement |
| 7.3 | `2026-11-09-seo-structured-data.md` | independent; safe anytime after Phase 2 |
| 7.4 | `2026-11-09-cost-guardrails.md` | after everything that sends email/rollups exists |
| 7.5 | `2026-11-09-admin-handbook-and-handover.md` | **last** — documents the final state |

---

## Fast lanes (if deploying in small batches)

- **Safety lane** (highest value per day): 1.2 → 2.1 → 2.2 → 3.1 → 3.2 → 3.3. ~1 week.
- **Exam-week lane** (before any CBT window): 3.5 → 3.6 → 4.1 → load-test (4.7) → PWA verify (5.4). Freeze everything else 72 h before.
- **Discoverability lane** (quick wins): 7.3 (SEO) can ship in a day as soon as Phase 2 is green.

## Global collision rules

1. `src/components/ui/EmptyState.jsx` is edited by both 5.1 and 5.3 — 5.1 first.
2. `src/components/Layout.jsx` is edited by 5.2, 5.3, 5.4 — in that order, one phase at a time.
3. `api/system.js` ACTIONS map is edited by 3.4? no — by cost-guardrails (email gate in email-worker, not system.js), migration-hygiene (`retention-sweep`), analytics-rollup (`analytics-rollup`), slo-and-alerting (`alert-test`), content-search (`search`) — all additive map entries; merge order irrelevant, conflicts trivially resolvable, but never two of them in one unreviewed push.
4. `supabase/migrations/` — migration files chain on timestamp order; the migrations test enforces it. Assign each migration plan a distinct minute and never renumber.
5. `vercel.json` — edited only by asset-delivery (headers) and staging (none) — one editor at a time.
6. Feature flags (`feature_flags` table + 3.6 helper) — SLO/incident/cost plans all assume `useFeatureFlag` exists; keep 3.6 ahead of anything that flips flags.

## Definition of done for the program

- All 35 plans executed; `npm run lint && npm test && npm run build` green on master.
- `2026-11-09-program-post-deploy-verification.md` checklist fully executed on production and signed off by the owner.
- One clean restore drill + one CBT exam-week rehearsal on staging.
- ADMIN.md is the single operational source of truth; AGENTS.md reflects the new structure.
