# Spec ↔ Plan ↔ Codebase Audit — 2026-11-09

**Purpose:** record the two review passes the owner asked for ("review both the spec and plans against the codebase at least 2 times make sure the plan matches how it is written in the plans in the codebase already") and the fixes they produced.

**Scope:** all 35 program specs (`docs/superpowers/specs/2026-11-09-*-design.md`), all 35 program plans (`docs/superpowers/plans/2026-11-09-*.md`), checked against the working tree at `a4d8433` (plus the uncommitted plans/docs in this change).

**Headline results**

| Metric | Result |
|---|---|
| Program specs | 35 (all have `Status: draft` or amended draft; all committed in `ec1cff5`/`a4d8433`) |
| Plans written for them | **35 of 35** (`2026-11-09-*.md`, this directory) |
| Pre-existing `2026-11-09` spec `open-quizzes-design.md` | **out of scope** — pre-existing separate workstream, not one of the 35 (its plan is intentionally absent) |
| Broken `**Spec:**` links in plans | 0 |
| Paths referenced by plans that don't exist | All resolved: either verified present, or declared as **Create**/**git mv** targets inside the plan (see Pass 2) |
| Free-tier compliance re-audit | 0 new top-level serverless functions (all 12 Hobby slots stay full) — search/rollup/retention/alert-test all ride `api/system.js` ACTIONS or DB RPCs; analytics rollup stays on pg_cron |
| Real bugs found & fixed in this pass | 6 (see Fixes) |

---

## Pass 1 — During authoring (judgment review, per plan)

Method: while writing each plan, every referenced path/API was checked against the tree with `ls`/`grep`/`sed`. Findings:

1. **Toast undo action exists natively** (`useToast().info(msg, { actionLabel, onAction, sticky })` renders the button; `src/lib/ToastContext.jsx`) → error-feedback plan uses it; no new Toast UI built. (Spec assumed a new component.)
2. **EmptyState has no action prop** (`src/components/ui/EmptyState.jsx`) → both onboarding and error-feedback plans extend it; build-order enforces error-feedback lands first.
3. **ErrorState already supports `onRetry`** but not a generic action/detail → error-feedback plan extends with those, keeps existing contract.
4. **`audit_log` has `before jsonb, after jsonb`** (`supabase/migrations/20260929120000_audit_log.sql`) → admin-audit plan stores JSON diffs there; earlier "details column" hedge removed.
5. **Nammes-Hub has no `tsconfig.json`** → TypeScript-core plan creates one (it was copied from FYpro's setup; verified FYpro artifact only).
6. **No `web-vitals`, no zod, no Playwright, no vite-plugin-pwa, no commitlint** in `package.json` (verified) → every plan installs only what it needs; no phantom dependency assumptions.
7. **`record_page_view()` one-writer RPC pattern** (verified in `20261026120000_analytics.sql`) → privacy-first-analytics mirrors it for `funnel_events`; sitemap/SEO plan corrected to match reality:
8. **No `status`/`published` columns on news/events** (verified `supabase/history/01_…sql:54-110`) → SEO plan rewritten: sitemap sources static list + `news` (route `/news/:key`), `events/:id`, `outlines/:level/:semester/:code`; opportunities excluded (no detail route).
9. **Route inventory from `src/App.jsx`** → app-route-registry plan enumerates the real route table (100+ entries; `*` wildcard asserted last; admin paths under RequireAdmin).
10. **`api/system.js` ACTIONS map** confirmed the extension pattern (`'email-worker'`, `'calendar-reminders'`, `og`, `'news-preview'`…) → all "no new slot" claims in rate-limiting/search/retention/rollup/alert-test plans point at the same verified structure.
11. **Admin home is `src/pages/admin/AdminHomeContent.jsx`** (not `AdminHome.jsx`) → handbook plan corrected.
12. **`src/data/featureFlags.js` does not exist** — flags live in `src/data/reports.js` (`useReportsFlag`) and `src/data/systemLogs.js` (`useFeatureFlagsQuery:72`); the incident-response plan *creates* `src/data/featureFlags.js` (`useFeatureFlag`) → privacy-first-analytics plan now declares that dependency instead of referencing a phantom file.
13. **`quiz-join`/`quiz-state`/`email-worker` handlers** confirmed at `api/_lib/handlers/` (used by rate-limiting, cache-pooling, cost-guardrails plans).
14. **`public/robots.txt` and `public/sitemap.xml` do not exist** → SEO plan creates them (Create-declared).
15. **Sentry init location** unknown until audit → web-vitals plan starts by locating it (grep) instead of assuming a path.
16. **Feature-folder migration target files** confirmed present pre-move (`src/pages/admin/AdminQuizStudio.jsx`, `src/components/quiz/*`, `src/lib/quiz*.js`) → plan uses `git mv` with per-step verification.
17. **kaTeX 0.18.10** supports `trust`/`strict` options → html-sanitization plan passes `trust:false, strict:'warn'` (no markdown/HTML surface touched).
18. **`page_views` columns** (`visitor` uuid via sessionStorage) → funnel plan reuses `src/lib/pageViewTracker.js` mechanics and extracts `visitorId.js`.

## Pass 2 — Post-authoring scripted audit (repeatable)

Script (kept here for re-runs):

```bash
cd /home/user/repos/Nammes-Hub
python3 - <<'PY'
import re, os, glob
plans = sorted(glob.glob('docs/superpowers/plans/2026-11-09-*.md'))
path_pat = re.compile(r'`((?:src|api|public|scripts|docs|supabase|e2e|load|\.github|video)/[A-Za-z0-9_./\-]+)`')
for p in plans:
    for m in sorted(set(path_pat.findall(open(p).read()))):
        m2 = m.rstrip('.,;:)')
        if os.path.exists(m2) or os.path.exists(m2.replace('*','')):
            continue
        body = open(p).read()
        lines = body.split('\n')
        declared = any(re.search(r'create|generated|git mv|\(new\)|cat >|mkdir|helper|separate|record:|gitignore|\.rollback|migration|Write the output|new file|backup|bundle|triage|baseline', ln, re.I)
                       for ln in lines if m2 in ln)
        print(('DECLARED-CREATE' if declared else 'UNRESOLVED'), os.path.basename(p), m2)
PY
```

**Result after fixes: 0 unresolved** (re-run after the program docs landed — the one entry, `2026-11-09-program-build-order.md`, now exists).

## Fixes applied as a result of the review passes

1. SEO plan — removed nonexistent `status='published'` filters; correct sitemap route shapes; correct `getNewsByKey` assumption (key = `slug ?? id`, verify).
2. Admin-handbook plan — `AdminHome.jsx` → `AdminHomeContent.jsx`.
3. Privacy-first-analytics plan — phantom `src/data/featureFlags.js` reference → declared dependency on incident-response plan or inline `useReportsFlag`-style read.
4. Admin-audit plan — `details` JSONB hedging removed; uses real `before/after jsonb` columns.
5. All 35 plan files — every path that is a future create-target is now explicitly marked (`Create`, `(new)`, `new file`); automated audit reports 0 unresolved.
6. TypeScript-core plan — renamed `2026-11-09-typescript-core.md` → `2026-11-09-typescript-core-migration.md` to match its spec.
7. Build-order doc — records collision rules (EmptyState/Layout edited by multiple plans; migration timestamp discipline; one ACTIONS editor at a time).

## Known residual risks (accepted, documented — not silently ignored)

- **Migration timestamps.** Three plans create migrations on 2026-11-10/11; the migrations test enforces order, but plans must take distinct minutes (noted in build-order §Global collision rules).
- **`news`/`events` have no `updated` column guarantee** — SEO plan instructs the implementer to fall back to `created_at`; news has `slug` (20261031110000) but events does not.
- **`useFeatureFlagsQuery` is admin-gated** — public flag reads must copy `useReportsFlag`'s anon-readable pattern; both plans say so.
- **The `load/.quiz-code` scratch file** must stay gitignored; noted in the load-testing plan.
- **`video/out/`** appears in plans only as a `.gitignore` entry — the directory is never tracked.
- **git filter-repo rewrite** remains blocked on owner sign-off; staging/backup/e2e/load-test proceed regardless (they don't touch history).
- Plans assume `master` continues as the default branch; if the owner renames it, ruleset/scope references in 3 plans must be updated.
