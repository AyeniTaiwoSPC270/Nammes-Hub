# End-to-End Smoke and Dead-Code Elimination — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A 5-journey Playwright smoke suite guarding the money paths in CI, plus a knip pass that deletes provably unused code and dependencies.

**Architecture:** `e2e/smoke.spec.ts` against `vite preview` (the real build artifact) with stubbed env keys; Playwright in a new CI job; `knip` as a report-first, fix-second cleanup.

**Tech Stack:** `@playwright/test` (free), `knip`, `depcheck`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-09-e2e-and-dead-code-design.md`

## Global Constraints

- CI e2e must be hermetic: no live Supabase, no network outside localhost. Public pages render without data? — check which pages render with placeholder keys (CI build already uses `https://example.supabase.co` + `ci-placeholder` anon key and `npm run build` passes today).
- 5 tests, retries: 2, no animation assertions. Not a visual-regression suite.
- knip removal happens in ONE reviewed commit, not drift-by-drift.

---

## Task 1: Playwright setup

- [ ] `npm install -D @playwright/test && npx playwright install --with-deps chromium`
- [ ] **Files:** Create `playwright.config.ts`: `webServer: { command: 'npm run build && npx vite preview --port 4173', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 180_000 }`, use viewport 1280×800, retries CI 2.

## Task 2: The five journeys

**Files:** Create `e2e/smoke.spec.ts`

1. **Home loads** — title contains "NAMMES", hero visible, no console pageerror.
2. **Outlines browse** — navigate `/outlines`, level picker renders, click through to a course if any rows exist (tolerate empty state).
3. **CGPA calculator** — add a semester + course via UI, total appears.
4. **Quiz join form** — `/play` join screen renders (invalid code shows an error toast; do not require a live server).
5. **Admin gate** — `/admin` redirects to login when unauthenticated.

- [ ] All five green locally: `npx playwright test`.
- [ ] Add `ci.yml` job `e2e` (needs the build job's pattern: placeholder envs), `npx playwright install --with-deps chromium`, run spec.
- [ ] Mutation check: temporarily rename the 404 route in App.jsx → test 1 or 5 fails → restore.

## Task 3: knip report-first

- [ ] `npm install -D knip depcheck`
- [ ] `knip.json`: `{ "entry": ["index.html", "src/main.jsx", "api/**/!(*.test).js", "scripts/**/*.mjs", "vite.config.js"], "project": ["src/**/*.{js,jsx,ts,tsx}", "api/**/*.{js,ts}"], "ignore": [".claude/**", "video/**"] }`
- [ ] `npx knip > docs/perf/knip-report-2026-11.md` (commit report). Triage: real-unused vs dynamic (string imports, `migrations.test.js` reads files by name) — mark each hit.
- [ ] One cleanup commit removing only verified-unused exports/files/deps; `npm test` + e2e green after.

## Task 4: Quarterly cadence

- [ ] ADMIN.md: "Dead-code check — quarterly: `npx knip`, review report, merge cleanup PR."

## Rollback

Delete `e2e/` + config; knip report stays as an artifact; revert the cleanup commit if anything dynamic breaks.
