# TypeScript for the Risky Core

The repo is ~2.4% TypeScript (111 KB) while the riskiest modules — authz, quiz grading/battle, webhook
auth — run on untyped JS with only tests as a net; a wrong prop refactor can ship silently.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Phase 1 | `api/_lib/authz.js`, `webhookAuth.js`, `quizGrading.js`, `quizBattle.js` → `.ts` |
| Phase 2 | `api/_lib/rate-limit.js`, `listQuery.js`, `cache.js` (whatever lands from those specs) |
| Phase 3 | `src/lib/supabaseClient.js`, `analyticsPdf.js` types (if/when rolled) |
| Config | `tsconfig` `checkJs: false`, `strict: true`, `noEmit`; CI `tsc --noEmit` step |
| Types | Hand-written types for DB rows actually touched (generate later via `supabase gen types` if adopted) |

### Out

- **Whole-repo TS conversion.** Explicitly not; the 58k LOC UI stays JS with JSDoc where cheap.
- **`any` escape hatches.** Every `any` needs a comment naming why.

---

## 2. The problem

Tests catch behavior regressions, not interface drift: a handler returning `{ data }` renamed to `{ rows }`
compiles fine in JS until runtime. `authz` is the security keystone — its types are the cheapest
documentation of who may do what. All four Phase 1 files already have strong tests to keep the
conversion honest.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Strictness | `strict: true`, no implicit any | The whole point is catching drift |
| DB types | Manual interfaces for `profiles`, `admins`, quiz tables read in Phase 1 | Avoids blocking on `supabase gen types` adoption; swap later |
| Test interop | Vitest runs TS out of the box (esbuild) | No new toolchain |
| CI | `tsc --noEmit` in `ci.yml` after lint | Gate, not advisory |
| Mixed imports | Allow JS→TS imports without `.js` extensions disabled | Minimal diff churn |

## 4. The change

Rename the Phase 1 files, add types (`AdminRow`, `AuthzResult`, `QuizAnswer`, `BattleState`), fix the
handful of real bugs the compiler finds (it will find some), add `tsc` to `package.json` + CI. No
runtime behavior change intended — the test suite is the proof.

## 5. Verification

1. `tsc --noEmit` clean; `npm test` green with zero assertion changes (any behavior-affecting fix is its own commit with a note).
2. Compiler-driven fixes itemized in PR description.
3. Build passes; no new bundle bytes (types erased).

## 6. Risk

Type-modeling rabbit holes (exact literal unions for quiz states) — timebox per file; when two engineers
disagree, `string` wins and a TODO records it. `strict` on Phase 1 only; keep the rest of the JS untouched.
