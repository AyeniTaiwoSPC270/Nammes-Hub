# Improvement Plan

Follow-up to the project review. Each section covers one weakness: why it matters, what to do, how to know it is
done, and a rough effort. Findings come from reading the repo (structure, history, CI config, file sizes). The
app was not run and the test suite was not executed as part of the review, so verify the baseline first (see
"Before you start").

## Summary

| # | Weakness | Priority | Effort | Status |
|---|---|---|---|---|
| 1 | README was the Vite template | High | 1 hour | **Done**, see `README.md` |
| 2 | Very large files (quiz pages and handlers) | Medium | 3–5 days, spread over PRs | Planned |
| 3 | Thin UI and end-to-end test coverage | High | 3–4 days | Planned |
| 4 | No TypeScript | Low–Medium | Incremental | Planned |
| 5 | Heavy serverless dependencies | Medium | 1–2 days to measure, more to change | Planned |
| 6 | Two commit identities in history | Low | 10 minutes | Planned |
| 7 | Live quiz / CBT never load-tested | High | 1–2 days | Planned |

Suggested order: baseline check, then 6 (quick), 3, 7, 2, 5, 4.

## Before you start

Run the checks CI runs, so you know the starting point:

```bash
npm ci && npm run lint && npm test && npm run build
```

Record any failures. Do not start refactoring on a red baseline.

---

## 1. README (done)

`README.md` now covers features, tech stack, setup, every environment variable, database rebuild steps, scripts,
project structure, CI, deployment, security and contributing.

Keep it honest: update it when env vars, scripts, or the deploy setup change. Optional extras: a screenshot or two
near the top, and a short architecture diagram (browser → Vercel `api/` → Supabase, plus Resend, Turnstile, Sentry).

---

## 2. Split the very large files

**Why:** the biggest files are `src/pages/HostQuiz.jsx` (1,282 lines), `PlayQuiz.jsx` (817),
`PlayBattle.jsx` (735), `api/_lib/handlers/quiz-battle.js` (781), `api/_lib/emailDesign.js` (795),
`src/components/quiz/Character.jsx` (636) and `src/pages/Cgpa.jsx` (625). Large files are slow to review, easy to
break, and hard to test in pieces.

**Good news:** `HostQuiz.jsx` is already organised as small named components in one file (`Stage`, `Chip`,
`ActionButton`, `Lobby`, `QuestionScreen`, `RevealScreen`, `AnimatedBoard`, `LeaderboardScreen`, `FinishedScreen`,
then the `HostQuiz` page itself). That makes it a mechanical split, not a redesign.

**Plan**
1. Do one file per PR. Do not mix a refactor with behaviour changes.
2. For `HostQuiz.jsx`, create `src/components/quiz/host/` and move, in this order:
   - Shared bits first: `Stage`, `Chip`, `ActionButton`, `ControlButton`, `QuestionHeading`, `AutoAdvance`
     into `hostParts.jsx`
   - Then one file per screen: `Lobby.jsx`, `QuestionScreen.jsx`, `RevealScreen.jsx`, `Leaderboard.jsx` (with
     `AnimatedBoard`, `ScoreCounter`, `TeamStandings`), `FinishedScreen.jsx`
   - Leave `HostQuiz` (data fetching, realtime subscription, state machine) in `src/pages/HostQuiz.jsx`
3. Pull non-UI logic (`toView`, `typedGroups`, `downloadCsv`, medal and podium constants) into
   `src/lib/quizHost.js` so it can be unit-tested.
4. Extract the page's state and realtime handling into a `useHostSession` hook once the screens are out.
5. Repeat for `PlayQuiz.jsx` and `PlayBattle.jsx`; they likely share pieces with the host screens (question
   display, timers), so look for shared components before copying.
6. For `quiz-battle.js`, separate request validation, state transitions and database writes into functions in
   `api/_lib/quizBattle*.js` (the engine and math already live there), leaving the handler as a thin router. The
   existing `quizBattleHandler.test.js` is the safety net.
7. Check with a size budget: add a lint rule or a CI script that warns above about 500 lines per file.

**Done when:** no page or handler in the quiz area exceeds about 500 lines, `npm test` and `npm run build` are
unchanged, and a manual run of host → play → reveal → leaderboard → finish behaves the same.

**Risk:** moving code can change import cycles and `memo`/`lazy` behaviour. Keep each PR small and play a full
quiz before merging.

---

## 3. Add UI and end-to-end tests

**Why:** server logic and data access are well covered (about 79 test files, mostly in `api/_lib`, `src/data`,
`src/lib`). The user-facing flows are not, and they are where regressions land: sign-in, quiz join, CBT submission.

**Plan**
1. Add **Playwright** (`@playwright/test`) with a `tests/e2e/` folder and `npm run test:e2e`. Chromium is the only
   browser needed at first.
2. Run against a **separate Supabase project** (or a local `supabase start`), never production. Seed it with
   `scripts/seed-*.mjs` plus a test student, a test admin and one small quiz.
3. Write these first, in order of value:
   1. Sign up / sign in / sign out
   2. Join a live quiz by code, answer a question, see the leaderboard (two browser contexts: host and player)
   3. Start a CBT exam, answer, submit, see the result; also the timer expiring
   4. Admin: create a news item and see it on `/news`
   5. Awards: nominate and vote, with a non-department account being refused
   6. A page smoke test that visits every public route and fails on console errors or a blank page
4. Add component tests with Vitest + Testing Library for pure UI logic (CGPA form, `projectorFit`, answer tiles).
   Vitest is already installed; add `jsdom` and `@testing-library/react`.
5. Add a CI job `e2e` after `test`. Secrets for the test Supabase project go in GitHub Actions secrets.
   Start it as non-blocking, make it required once it has been stable for a week.

**Done when:** the six flows above run in CI on every PR and a deliberately broken join flow makes CI fail.

**Risk:** flaky realtime tests. Wait on visible UI state (`expect(...).toBeVisible()`), never fixed sleeps.

---

## 4. Move toward TypeScript, gradually

**Why:** with this much code and many shared data shapes (questions, sessions, players, awards), types catch
mistakes before runtime. A big-bang rewrite is not worth it.

**Plan**
1. Add `tsconfig.json` with `allowJs: true`, `checkJs: false`, `strict: true`. Add `npm run typecheck` (`tsc
   --noEmit`). Do not make it required in CI yet.
2. Start with the most reused, least UI-heavy code and rename `.js` → `.ts`:
   `api/_lib/validate.js`, `quiz.js`, `quizGrading.js`, `cbt.js`, then `src/data/*`, then `src/lib/*`.
3. Define shared types in one place (for example `src/types/quiz.ts`) and import them from both the API and the
   frontend.
4. Generate database types with `supabase gen types typescript` and use them in `src/data/*`.
5. New files are `.ts`/`.tsx` from now on. Convert components only when you are already editing them.
6. When most of `api/_lib` and `src/data` is typed, make `typecheck` a required CI step.

**Done when:** `npm run typecheck` passes in CI, and new code is TypeScript by default.

**Alternative if migration feels too heavy:** keep JavaScript and add JSDoc types with `checkJs: true` on the
same folders. Smaller win, almost no friction.

---

## 5. Review the heavy serverless dependencies

**Why:** `puppeteer-core` and `@sparticuz/chromium` (a headless browser) and `@napi-rs/canvas` increase bundle
size, slow cold starts, and raise memory use.

**What the code shows:** they are used in specific places, not site-wide:
- `api/_lib/handbookBuild.js` (handbook PDF generation) and `scripts/manual/*` (manual build tooling)
- `api/_lib/awardCardRender.js` (award card images, via canvas)

**Plan**
1. Measure first. Check Vercel function size and cold-start time for `api/system.js` (which bundles the handbook
   build and the email worker together under a 300 s limit) and `api/award-card.js`.
2. Isolate: move the handbook build into its own function (its own file in `api/`) so the email worker and other
   `system` actions do not carry Chromium. Add a rewrite for it in `vercel.json`.
3. Decide whether the handbook needs a real browser. If the layout is simple, a pure-JS PDF path (`jspdf`, already
   a dependency) could replace Chromium. If the design needs HTML/CSS fidelity, keep Chromium but only in that one
   function.
4. Make sure `@napi-rs/canvas` is only imported lazily inside the award-card handler.
5. Run `npm audit` and keep the CI gate. These packages release often; keep Dependabot enabled.

**Done when:** the email worker and quiz endpoints no longer ship Chromium, and cold-start numbers are recorded
before and after.

---

## 6. Tidy the commit identities

**Why:** history shows two author names (`AyeniTaiwoSPC270` and `ayeni taiwo`). It makes contributor stats and
blame look like two people.

**Plan**
1. Add a `.mailmap` at the repo root mapping both names and emails to one canonical identity (use
   `git shortlog -sne` to see the exact emails):
   ```
   Canonical Name <canonical@email> Old Name <old@email>
   ```
2. Set the same identity everywhere: `git config --global user.name` and `user.email`, and make sure the email
   is verified on GitHub.
3. Do **not** rewrite history to fix this; `.mailmap` is enough and safe.

**Done when:** `git shortlog -sn` shows one line for this author.

---

## 7. Load-test live quiz and CBT

**Why:** the main risk is exam and quiz time, when a whole class joins at once, all submitting answers within the
same second. This has not been measured. Supabase plan limits (concurrent realtime connections, database
connections, API rate) and Vercel function concurrency can all become the bottleneck.

**Plan**
1. Write down the target: for example "150 students join one live quiz, and 300 students take a CBT exam, with
   answer latency under 1 s at p95 and zero lost submissions".
2. Check your Supabase and Vercel plan limits against that target before testing.
3. Build a load script with **k6** (or Artillery) that: creates players, joins a session, answers each question
   at random times, and for CBT starts, saves and submits. Run it against a staging project, never production.
4. Test the realtime path separately: open N websocket subscribers and measure how long a host "advance" takes to
   reach all of them.
5. Watch for: duplicate or lost answers (the server must stay the source of truth for scoring and time), slow
   queries (add indexes where `EXPLAIN` shows scans), connection exhaustion, and function timeouts.
6. Fix the top bottleneck, re-run, and write the numbers in this folder (for example `docs/load-test-results.md`).
7. Before a real exam, do a dress rehearsal with a small group and have a fallback plan (for example a fixed
   paper version and a way to extend the timer).

**Done when:** the target is met in staging, results are written down, and the limits are known.

---

## Tracking

Turn each section into a GitHub issue (labels like `quality`, `testing`, `performance`) and link PRs to them.
Close this document's table row by row as the work lands.
