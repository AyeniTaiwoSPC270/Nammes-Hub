# Feature-Folder Migration (Quiz First) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the codebase from type-folders (`components/`, `pages/`, `lib/`) toward domain folders (`src/features/<domain>/`), starting with the hottest domain (quiz), split the god-files, and preserve history with `git mv`.

**Architecture:** Domain folders own pages+components+client hooks/logic; `api/` stays server-side. Barrels (`index.js`) expose a domain's public surface; cross-domain deep imports are banned by an ESLint boundary rule.

**Tech Stack:** `git mv`, existing vitest suite (incl. `quizTheme`, `quizBattle` tests), `eslint-plugin-import` (or the flat-config equivalent in `eslint.config.js`).

**Spec:** `docs/superpowers/specs/2026-11-09-feature-folder-migration-design.md`

## Global Constraints

- Migration is mechanical: **no behavior changes** ride along. Extraction bugs are the only allowed fixes, and they get their own commits.
- Domain order: quiz → cbt → awards → outlines → forms → calendar → admin-misc. This plan covers **quiz**; the rest follow the same recipe in later PRs.
- `git mv` always (history follows); never delete-and-recreate.

---

## Task 1: Baseline

- [ ] `grep -rln "quiz" src --include='*.jsx' --include='*.js' --exclude-dir=api | sort` → the touch list. Expect: `pages/{HostQuiz,PlayQuiz,PlayBattle}.jsx`, `pages/admin/AdminQuizStudio.jsx`, `components/quiz/*`, `components/admin/quiz{Editor,Library,Studio}*`, `lib/quiz*.js`, `lib/lazyRetry`? no. `data/quiz.js`.
- [ ] `npm test` green (it is today — confirm).

## Task 2: Create the skeleton

- [ ] `src/features/quiz/{pages,components,lib,hooks}/index.js` (barrel). Move leaf files deepest-first:
  1. `git mv src/lib/quizSound.js src/features/quiz/lib/quizSound.js`
  2. `git mv src/lib/quizTheme.js src/features/quiz/lib/quizTheme.js`
  3. `git mv src/components/quiz src/features/quiz/components` (whole dir)
  4. `git mv src/pages/HostQuiz.jsx src/features/quiz/pages/HostQuiz.jsx`
  5. `git mv src/pages/PlayQuiz.jsx src/features/quiz/pages/PlayQuiz.jsx`
  6. `git mv src/pages/PlayBattle.jsx src/features/quiz/pages/PlayBattle.jsx`
  7. `git mv src/pages/admin/AdminQuizStudio.jsx src/features/quiz/pages/AdminQuizStudio.jsx`
- [ ] Fix imports per move: `grep -rln "lib/quizSound\|lib/quizTheme" src | xargs sed -i '' -E 's#(\.\./)*lib/#../#g'` is **too blunt** — instead use absolute imports from the alias (`src/`) if the repo uses one (check `vite.config.js` `resolve.alias`; if none, relative paths carefully or one pass of `npx jscodeshift --extensions=jsx,js -p m 'import-declaration'` updating specifier strings). Verify with `rg "quiz(Sound|Theme)" --count src`.
- [ ] `npm test` after step 2..7 each; `npm run lint`; `npm run build`.

## Task 3: Barrels + boundary rule

- [ ] **Create** `src/features/quiz/index.js`: `export { default as HostQuiz } from './pages/HostQuiz'; …` — only what App.jsx/router need.
- [ ] Update the router (post-registry plan) or App.jsx import to `import { HostQuiz, … } from './features/quiz'`.
- [ ] `eslint.config.js`: no-restricted-imports pattern banning `features/quiz/**` deep imports outside the domain (peer domains must use the barrel). If flat config is fiddly, a `yarn lint`-time shell check script is acceptable interim.

## Task 4: Split the god-files

- [ ] **Create** `src/features/quiz/components/art/` (character art) by splitting — that file is **server-side** (in `_lib`); leave it. Client-side: split `src/features/quiz/pages/AdminQuizStudio.jsx` → `studio/{QuestionEditor,DrawSettings,PreviewPane}.jsx` with the parent orchestrating (target ≤ 250 LOC per file).
- [ ] `HostQuiz.jsx` (1647): extract `useHostQuizState()` hook (all React Query + reducer logic) from presentational JSX. One commit; suite must stay green.
- [ ] Snapshot the generated SVG (Character component) pre/post any render split — output must be byte-identical (the existing quizTheme tests get you most of the way).

## Task 5: Docs

- [ ] AGENTS.md layout section updated (paths). Conventional commits throughout (`refactor(quiz): move …`).
- [ ] Note in the next program doc how to repeat for CBT (same pattern, list its touch points).

## Rollback

Each `git mv` step reverts cleanly; the barrier is imports — fix forward with the alias codemod rather than reverting blindly.
