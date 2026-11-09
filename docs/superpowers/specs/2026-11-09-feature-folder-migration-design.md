# Feature-Folder Migration and God-File Splits

The codebase organizes by file type (`components/`, `pages/`, `lib/`) instead of by domain, and three
files exceed 950 LOC (`AdminQuizStudio` 950, `HostQuiz` 1647, `quizCharacterArt` 1249) — domain changes
touch six directories at once.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Target layout | `src/features/{quiz,cbt,cgpa,awards,outlines,forms,calendar,admin}/{components,hooks,pages}` |
| Phase 1 | `features/quiz/` — the hottest domain (HostQuiz/PlayQuiz/PlayBattle + quiz lib imports) |
| God-file splits | `AdminQuizStudio` → `studio/{Toolbar,QuestionList,EditorPanel,PreviewPane}.jsx`; `quizCharacterArt` → `art/{data,render}.js` |
| Barrel rules | `features/<domain>/index.js` exports only the public surface |
| Mechanical PR cadence | One domain per PR; `git mv` to preserve blame |

### Out

- **Big-bang rewrite.** Domain-by-domain, behind green CI.
- **Renaming shared `ui/` primitives.** `Button/ErrorState/Skeleton` stay where they are.

---

## 2. The problem

Quiz edits touch `components/quiz`, `pages/admin/AdminQuizStudio`, `pages/HostQuiz`, `pages/PlayQuiz`,
`lib/quiz*`, and `api/_lib/*quiz*`. New contributors cannot find "the quiz code" in under a minute —
they find *types of* files instead. God-files accumulate unrelated logic and become unreviewable.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Boundary | Domain owns everything from UI to client-side logic; server stays in `api/` | Matches feature-folder convention people know |
| Import rule | No cross-domain imports except through `index.js` barrels | Prevents spaghetti re-forming |
| Order | quiz → cbt → awards → outlines → forms → calendar → admin misc | Highest churn first, biggest payoff |
| CharacterArt | Split data tables (SVG geometry/palettes) from render code; data moves to `*.data.js` | 1249 lines of geometry are not "logic" |
| Lint | `eslint-plugin-import` no-restricted-paths for cross-domain deep imports | Rules, not reminders |

## 4. The change

`git mv` batches per domain; barrels export { HostQuiz, PlayQuiz, PlayBattle, AdminQuizStudio }; root imports updated; codemod for relative paths (`npx jscodeshift` or careful sed + `vitest` per batch). CharacterArt split with snapshot tests of generated SVG to prove byte-identical output.

## 5. Verification

1. `npm test` green per phase; no coverage drop.
2. `git log --follow` shows history through the moves.
3. Build succeeds; chunk graph shows quiz code no longer leaks into public entry.
4. New-contributor test: time a fresh reader locating quiz state logic (< 60 s).

## 6. Risk

Import-path breakage — mitigated by mechanical batches + vitest per batch. Snapshot tests for CharacterArt are the safety net for the riskiest split. Avoid renaming exported component names at the same time as the moves.
