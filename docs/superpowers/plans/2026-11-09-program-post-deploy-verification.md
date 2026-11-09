# NAMMES Hub Improvement Program — Post-Execute / Post-Deploy Verification

**Date:** 2026-11-09. **How to use this file:** after executing a plan (or a batch of plans), work through (1) the Global Smoke below, (2) that plan's row in the Per-Plan Matrix, (3) the Program Sweeps after each phase, and (4) the Break/Fix triage tree when something fails. Sign off each phase in the Program Log at the bottom. Everything here is designed to run with the free accounts in the setup checklist.

**Legend:** STG = run on staging before prod; PROD = run on production after deploy; both are written as copy-paste checks. Pass = the stated outcome. If a check fails, jump to §Break/Fix.

---

## 1. Global smoke (run after EVERY deploy, ~10 min)

1. `git status` clean; `npm run lint && npm test && npm run build` green locally on the branch you deployed from.
2. `curl -s -o /dev/null -w '%{http_code}\n' https://www.nammeshub.com.ng/` → `200`; same for `/outlines`, `/news`, `/cgpa`, `/login`, `/api/health` (expect `200` + `{ ok: true … }`).
3. `curl -sI https://www.nammeshub.com.ng/ | grep -iE 'content-security-policy|x-frame-options|cache-control'` → all present (they are vercel.json-managed today; flag any regression).
4. Browser: open the site in a fresh profile → DevTools Console → **zero red errors** on `/` and on one dynamic page (`/news` and one news item). A missing-chunk 404 after a deploy is the classic PWA/cache symptom — if seen, hard-refresh (Ctrl+Shift+R); if it persists for other users, see §Break/Fix → "Stale chunk / white page".
5. UptimeRobot still shows the monitor green; Sentry has no new issue after deploy (wait 10 min).
6. `npm run preview` locally (the build artifact you shipped): spot-test `/`, `/outlines`, `/cgpa`, `/admin` redirect.

## 2. Per-plan verification matrix (all 35)

### Phase 1 — Repo & CI

**P1 `dev-workflow-and-adr`** — STG/n/a → PROD:
- Commit with a bad message (`git commit -m "stuff"`) → blocked locally by commitlint; PR with a failing check → cannot merge (ruleset). Pass = both blocks fire.
- `docs/adr/0001…0005` exist; ADMIN.md links them; `npx commitlint --version` works.

**P2 `security-ci`** — PROD:
- GitHub → Security tab: CodeQL default setup shows results; a Dependabot PR appears (or has appeared); `npm audit --omit=dev --audit-level=high` is wired into CI (introduce a temp high-sev dep on a throwaway branch → CI fails → delete branch). Auto-merge only for patch/minor bumps.

**P3 `repo-hygiene`** — STG:
- `git log --oneline | head` on a fresh clone shows no `video/` paths (`git log --name-only | grep -c '^video/'` = 0). Repo size: `du -sh .git` meaningfully smaller; clone time in seconds. `.gitignore` covers `video/out/`. Pass = zero video blobs + CI green after the rewrite.
- Verify Release `video-assets-v1` exists with the video masters downloadable.

### Phase 2 — Staging & backups

**P4 `staging-environment`** — STG (the whole point):
- Staging renders signup → login → a CBT practice flow → quiz join; `/api/health` returns `{ ok: true }`; **no real student data** anywhere (spot-check `profiles` row count = fixture only).
- PR preview envs are absent; only branch `staging` shows a live URL; prod/staging env keys are distinct (`curl` both health endpoints → distinct `version` SHAs).
- Keep-alive workflow ran this week (Actions tab) — prevents auto-pause.

**P5 `backup-and-restore-drill`** — STG + PROD:
- Actions → backup: latest release `backup-YYYY-MM-DD` exists, asset age < 26 h.
- Quarterly drill log (`docs/runbooks/restore-drill.md` — appended after every drill) shows the last drill passed with row-count reconciliation ±0.
- PROD: `pg_dump` ran with role `backup_reader` (check the workflow log line `role=backup_reader`) — the dump is **never** restorable without the offline `age` key.

### Phase 3 — Security hardening

**P6 `rate-limiting`** — STG then PROD:
- Auth endpoint burst: `for i in $(seq 1 15); do curl -s -o /dev/null -w '%{http_code} ' -X POST $BASE/api/system?action=… ; done` → `429` after the 10th (auth bucket, fail-closed). Normal interactive submit → fine at 1 req/2 s.
- Campus-NAT sanity: two different students behind the same IP still load pages (read routes are fail-open).
- Vercel logs show `[rate-limit] redis unavailable` only during a deliberate Upstash pause drill; site still serves.

**P7 `input-validation-zod`** — STG:
- `curl -X POST $STG/api/submit-public -d '{}' -H 'content-type: application/json'` → `400 {"error":"…"}` with a human sentence. Contact form with 5-char message → 400 with "at least a sentence". Quiz join with `CODE!` → 400.
- Every previously-working form still works (regression sweep of the top 8 forms).

**P8 `html-sanitization`** — PROD:
- In any quiz with math, an outline or news containing `$\href{javascript:alert(1)}{x}$` renders as plain text **without executing** (check by source inspection of the HTML output — no `href="javascript:"`).
- Character SVG snapshot tests green (`npm test`); inspect a generated SVG for no `<script`/` on*=`.

**P9 `admin-audit-and-least-privilege`** — PROD:
- Disable a test user → `select * from audit_log order by at desc limit 1` shows `action='disable-user', entity='profile'`, actor = your admin id, `after` jsonb contains the changed fields only.
- `scripts/check-service-role.mjs` passes in CI; grep `SUPABASE_SERVICE_ROLE_KEY` outside `api/_lib/` → no hits.
- ADMIN.md rotation table present with dates.

**P10 `slo-and-alerting`** — PROD:
- UptimeRobot shows green; temporarily stop a critical service on staging → Telegram alert arrives ≤ 10 min (test with `?action=alert-test` as admin instead of killing prod).
- Sentry: one resolved test issue visible; baselines recorded in `docs/runbooks/slo-baseline.md`.

**P11 `incident-response-and-runbooks`** — STG:
- Flip `battles_enabled=false` in feature_flags → battle join page shows the notice within 30 s; flip back → battle usable. Same for `cbt_enabled`.
- Runbook spot-check: read `docs/runbooks/site-down.md` top-to-bottom once; time a tabletop "CBT 500 for 15 minutes".

**P12 `database-migration-hygiene`** — STG then PROD:
- Re-run `scripts/sql/audit-fk-indexes.sql` on both → zero rows missing an index.
- `page_views_daily` populated after the cron/sweep ran (`select max(day) from page_views_daily` = yesterday); raw `page_views` retention sweep batch-deleted only rows > 13 months (audit_log row `entity='retention-sweep'` exists).
- `npm test` migrations guard green.

### Phase 4 — Performance

**P13 `cache-and-pooling`** — STG then PROD:
- `curl -sI $STG/…outlines…` shows `cache-control: s-maxage=60, stale-while-revalidate=300`; Upstash dashboard shows >0 commands/day; editing a resource in staging admin reflects on the site ≤ 60 s (bust works).
- Supabase dashboard → DB connections: prod drop after pooler URL set (before/after screenshot in the PR).
- Quiz join → answer → leaderboard flow unchanged (2 s max staleness acceptable).

**P14 `api-payload-and-pagination`** — STG:
- `grep -rn "select('\*')" src api` → 0 hits; `GET /api/system?action=…&page=99999&pageSize=9999` clamps to 100 (not 500); list endpoint returns `{ rows, meta { page, pageSize, total } }`.
- Admin inbox page 1→2 renders and "total" is sane.

**P15 `bundle-and-chunking`** — PROD:
- `npm run build:analyze` → entry ≤ 250 KB gzip, react vendor ≤ 160 KB; `npm run size` passes; `dist/assets/index-*.js` doesn't include recharts/jspdf (`grep -l recharts dist/assets/*.js` → no hit for entry chunk).
- Throttled Lighthouse LCP on `/` improved vs baseline doc; hover `/outlines` → network shows chunk prefetch.

**P16 `asset-delivery`** — PROD:
- Handbook PDF served from `documents` bucket (open incognito; URL contains `/storage/v1/object/public/documents/`), range requests 206; `public/documents/` is empty in the repo; CI `check:public` fails if anything > 2 MB is added (test by dropping a 3 MB file on a branch → CI red).
- Image sweep: outlines/gallery images have `loading="lazy"`.

**P17 `web-vitals-rum`** — PROD:
- Sentry → Explore/Insights shows `web-vitals` events from real browsers within 48 h; route tags appear; no emails in query strings (`beforeSend` verified — send a test event with a fake email in the URL, confirm redaction).

**P18 `admin-analytics-rollup`** — PROD:
- Admin analytics page p95 measured before/after (baseline doc updated); N+1 report committed; no per-row awaits remain (`node scripts/find-nplus1.mjs` hits only false positives marked).
- If Phase B ran: `analytics_daily` rows reconcile (sum(today± window) vs `admin_analytics()` RPC within 0 delta); PDF export < 30 s.

**P19 `load-testing-live-quiz`** — STG only:
- k6 run at 100/300 VUs: p95 join < 1.5 s, answer-success ≥ 99.5%, error rate < 0.5%. At 600 VUs: documented knee point. Report committed at `docs/load/2026-11-quiz.md`.

### Phase 5 — UX

**P20 `error-feedback-and-undo`** — STG:
- Kill network (DevTools offline), trigger a save → toast reads "You're offline…" not a raw error; restore network → toast retries. Delete a bookmark → Undo restores it within 8 s and it disappears after.
- Force a mutation 500 (block the API in DevTools request-blocking) → curated sentence, logged error, no stack trace anywhere in the UI.

**P21 `accessibility-completion`** — PROD:
- axe DevTools on `/`, `/outlines`, `/play`, `/admin/login`: 0 critical violations (documented exceptions only).
- Keyboard: Tab order sane on signup → outlines search → CBT start; skip link appears on first Tab press; Escape closes modals; focus returns to invoker.
- Screen reader (NVDA/VoiceOver) reads Toast messages and the quiz countdown without extra noise.

**P22 `ux-onboarding-and-guidance`** — STG:
- Fresh account → tour appears once; steps highlight outlines/CGPA/quizzes/CBT; skip and complete both persist (`select onboarding_step from profiles`); revisits don't re-show; exec persona sees the 3-step tour on `/admin` (or the honest "student tour only" limitation is recorded if admin detection wasn't possible).
- Empty state with an action renders e.g. "No resources yet — **Submit past questions**" and navigates correctly.

**P23 `pwa-offline`** — PROD:
- DevTools → Application: SW `activated`, manifest loaded, no CSP violations; `/offline` renders when offline; `/api/*` never served from cache; on `/cbt`, no reload prompt appears during an active exam; "New version available — Reload" appears on other routes after a new deploy.
- Lighthouse PWA ≥ 90.

**P24 `mobile-quiz-host`** — PROD on a real phone:
- iPhone/Android portrait: host joins, QR visible without scroll, 2×2 answer grid tap ≥ 44 px, reveal/next/end reachable one-thumb; battle screen usable in portrait; nothing clipped at 320 px width.

**P25 `content-search`** — STG then PROD:
- `⌘K` opens palette; typing `csc` surfaces outlines grouped results ≤ 60 ms server, 250 ms debounce; arrow keys + Enter navigate; `Escape` closes; zero-result query logs (Vercel logs) the term; admin search unaffected.

### Phase 6 — Structure

**P26 `app-route-registry`** — PROD:
- `npm test` incl. route snapshot green; spot click 12 routes; `*` 404 page renders for `/definitely-not-a-page`; admin redirects unchanged.

**P27 `feature-folder-migration`** — PROD:
- Quiz flows unchanged (host/play/battle/studio); bundle sizes flat or better; no deep imports outside the quiz domain (lint/boundary check green).

**P28 `typescript-core-migration`** — PROD:
- `npm run typecheck` green in CI; the four `.ts` modules behave identically (quiz suite green); no `any` without a reason comment.

**P29 `e2e-and-dead-code`** — PROD:
- CI `e2e` job green on master; knip report committed; dead imports/deps removed; quarterly knip reminder exists in ADMIN.md.

**P30 `design-system-governance`** — PROD:
- Contrast test green on master; drift report artifact produced on the first post-merge run; `DEPRECATED.md` exists; no `#`-hex introduced in the handover PR itself.

### Phase 7 — Privacy, SEO, cost, handover

**P31 `privacy-first-analytics`** — PROD:
- `select event, count(*) from funnel_events group by 1` after a day of real use shows the 7 events; admin dashboard renders funnel + North Star; anon cannot read rows (RLS — verify with anon key: permission denied); query strings carry no emails.

**P32 `data-governance-ndpr`** — PROD (owner-supervised):
- `docs/privacy/inventory.md` merged and **owner-read** (date recorded); privacy notice visible at signup + footer; Sentry `beforeSend` verified (fake email test); erasure drill executed on staging fixture and receipt filed at `docs/privacy/erasure-drills.md`; export endpoint returns the fixture student's JSON; `retention-sweep` purged nothing it shouldn't have (page_views counts before/after logged).

**P33 `seo-structured-data`** — PROD:
- `curl https://www.nammeshub.com.ng/robots.txt` shows sitemap line; `sitemap.xml` lists ≥ 30 URLs and validates; view-source: canonical present on `/`, a news article, an event; Rich Results Test: NewsArticle + Event + Organization all valid; Search Console property verified, sitemap submitted, first coverage report lands within days.

**P34 `cost-guardrails`** — PROD:
- Every row of `docs/ops/cost-inventory.md` filled from dashboards; one month-end cost line appended to ADMIN.md; email worker test with `EMAIL_MONTHLY_CAP=1` paused the queue and flagged `email_quota_paused` (then unflagged); 80% alert emails armed in Vercel/Supabase/Resend/Sentry dashboards.

**P35 `admin-handbook-and-handover`** — PROD:
- ADMIN.md ≥ 500 lines with all click-paths verified on staging this cycle; `docs/admin/handover.md` printed/signed by incoming exec; "First time?" card visible to a fresh admin login and dismissible; owner review date recorded.

## 3. Program-wide sweeps (after each phase)

1. **Health & SLOs** — /api/health 200; UptimeRobot green ≥ 99.5% rolling; Sentry error rate unchanged vs pre-phase baseline; no rollback needed.
2. **Data safety** — `select count(*)` on profiles, page_views, quiz_sessions within expected ranges; no orphaned fixtures in prod; audit_log has phase-relevant entries.
3. **Perf** — bundle report (if in scope), list-endpoint p95, admin analytics p95.
4. **Security** — no new secrets in repo (`git log -p -S 'SERVICE_ROLE' | grep -v '^-' | grep -i service_role` → empty), ruleset still enforcing PRs, CodeQL clean.
5. **Free-tier headroom** — Upstash commands today ≤ 80% of daily cap; Supabase DB size delta since phase start recorded; Resend monthly usage noted.
6. **Docs** — AGENTS.md + ADMIN.md updated if any path moved; spec "Status" stays accurate.

## 4. Break/Fix triage tree

**Symptom → where to look first → fix**

- **White page / missing chunk after deploy** → dist asset hash changed, SW stale → user hard-refresh; if widespread: redeploy (Vercel rollback), then check PWA config (`navigateFallback`/cleanupOutdatedCaches).
- **429s for legitimate students on campus Wi-Fi** → NAT bucket too tight → raise IP bucket in `api/_lib/rate-limit.js` for read routes (keep auth strict); redeploy.
- **CBT or quiz advance not firing (setTimeout stalls)** → outbox/poll failure → check `api/health`, Vercel logs for `/api/quiz`, quiz-tick cron in SQL (`cron.job_run_details`); flag `cbt_enabled=false` if meltdown; page owner.
- **Writes failing 500 with "audit" in logs** → `audit_log` RLS/insert issue → wrapper never throws, so site works; fix policy/connection; replay missed rows manually from Vercel logs if needed.
- **Resend sends zero** → quota guard tripped (`email_quota_paused=true`) → verify cap vs dashboard; raise cap only if free allowance resets next month; else wait for reset.
- **Admin analytics blank** → RPC error (search Sentry) or rollup preference broke → disable the rollup-preference branch (revert to pure RPC) in one commit; the RPC path is the permanent fallback.
- **Restore drill count mismatch** → staging schema drifted vs prod → diff `supabase/history` application order; fix seed, never the drill expectation.
- **Offline page never shows / SW error** → DevTools Application panel → unregister SW → fix `vite.config.js` VitePWA block → redeploy; old clients self-heal on next visit.
- **Search palette empty but API works** → debounce/index bug → check `⌘K` handler logs; `pg_trgm` on staging? Re-run the migration; zero-result logging tells you if it's data vs code.
- **Exam morning (CBT) incident** → flip `cbt_enabled=false`; announce via broadcast; switch to paper fallback per school SOP; post-incident postmortem within 72 h (template in `docs/postmortems/TEMPLATE.md`).

**Rollback hierarchy:** feature flag → Vercel `rollback` (instant previous deployment) → `git revert` + redeploy → Supabase migration rollback file (only if schema changed; forward-fix preferred) → backup restore (last resort, owner decision, implies 15–30 min RPO).

## 5. Program log (sign-off per phase)

| Phase | Plans | STG sign-off (who/when) | PROD sign-off | Notes |
|---|---|---|---|---|
| 0 Setup | checklist | | | |
| 1 Repo/CI | dev-workflow, security-ci, repo-hygiene | | | |
| 2 Staging/backup | staging, backup | | | |
| 3 Security | rate-limit, zod, sanitization, audit, slo, incident, migration-hygiene | | | |
| 4 Performance | cache, pagination, bundle, asset, vitals, rollup, load | | | |
| 5 UX | error-feedback, a11y, onboarding, pwa, mobile-quiz, search | | | |
| 6 Structure | routes, features, TS, e2e, design-system | | | |
| 7 Privacy/etc | analytics, ndpr, seo, cost, handbook | | | |

**Final acceptance:** owner confirms every row signed + one CBT exam-week rehearsal completed on staging + backup restore drill within the last 90 days.
