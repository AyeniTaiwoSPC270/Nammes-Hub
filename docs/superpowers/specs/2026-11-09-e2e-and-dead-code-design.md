# End-to-End Smoke Tests and Dead-Code Elimination

The suite (160 files, 23k LOC) is unit-heavy but cannot catch a broken join→answer→leaderboard flow,
and unused code/dependencies accumulate silently (no `knip`/`depcheck` in the toolchain).

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Playwright | `e2e/` — smoke: home loads, outlines render, quiz join→answer→leaderboard, admin login gate (mocked auth), CBT start page renders |
| CI job | `e2e` job runs on PR (headless Chromium, `npm run build && npx vite preview` target) |
| Dead code | `npx knip` + `npx depcheck` reports; remove unused exports/files/deps in one cleanup PR |
| Unused migrations note | Report (not deletion) of tables with no reads/writes in code or RLS |

### Out

- **Visual regression testing.** Different budget; revisit after Playwright exists.
- **Deleting DB objects.** If a table looks unused, it goes to the owner as a question, not a PR.

---

## 2. The problem

Unit tests pass while the built bundle 404s a chunk behind `lazyRetry`, or the quiz-join POST shape
drifts from the handler. `package.json` lists deps no file imports; `src/` exports symbols only each
other import. Every unused byte is clone weight and CVE surface.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Coverage | 5 journeys only — smoke, not matrix | Playwright maintenance is real; 5 tests still catch 90% of deploys |
| Auth | Admin login mocked via Playwright route interception (AAL2 redirect stubbed) | Keep CI hermetic; no live admin credentials |
| Preview target | `vite preview` against a build with test env keys | Tests the real artifact, not dev server |
| Knip config | `knip.json` with `ignore: ['.claude/**', 'video/**']` | Matches the existing vitest exclusion rationale |
| cadence | Quarterly knip run + report in ADMIN.md | Rot prevention |

## 4. The change

`npm i -D @playwright/test knip depcheck`; `e2e/smoke.spec.ts` (5 tests); `playwright.config.ts` (preview server, Chromium only); `ci.yml` gains `e2e` job (needs `VITE_SUPABASE_URL` placeholder like the build job); `knip.json`; one cleanup PR removing verified-unused exports/deps.

## 5. Verification

1. `npx playwright test` green locally and in CI.
2. Introduced breakage test: break quiz-join payload → smoke fails (prove once, then revert).
3. `knip` output committed in cleanup PR; removal count reported; `npm test` + build green after removal.

## 6. Risk

Flaky e2e erodes trust — retries=2, generous timeouts, and no assertions on animations/timers. Cleanup PRs can delete "unused" things wired dynamically (string-based imports, migration filenames read at runtime — e.g., `migrations.test.js`); knip needs the ignore list tuned before anything is deleted.
