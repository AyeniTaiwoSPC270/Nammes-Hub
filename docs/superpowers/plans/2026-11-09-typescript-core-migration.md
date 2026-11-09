# TypeScript for the Risky Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `authz.js`, `webhookAuth.js`, `quizGrading.js`, `quizBattle.js` compile under `strict` TypeScript — the four modules where an interface-drift bug is a security or integrity incident.

**Architecture:** Add `typescript` + a strict `tsconfig.json` covering only `api/_lib/` (rest stays JS); convert the four files; `tsc --noEmit` joins CI. No runtime changes intended — the 99-test quiz suite is the proof.

**Tech Stack:** `typescript`, vitest (esbuild strips types natively), GitHub CI.

**Spec:** `docs/superpowers/specs/2026-11-09-typescript-core-migration-design.md`

## Global Constraints

- `strict: true`, `noEmit`, `allowJs` for mixed imports; scope `include` to `api/_lib/**/*` only — the 58k LOC UI opts out for now.
- `any` requires a trailing comment naming the reason; no `@ts-ignore` without an issue link.
- Zero assertion changes to existing tests — if a test must change, the PR description explains why.

---

## Task 1: Toolchain

- [ ] `npm install -D typescript`
- [ ] **Files:** Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "noEmit": true, "esModuleInterop": true, "skipLibCheck": true,
    "allowJs": true, "checkJs": false, "types": ["node"]
  },
  "include": ["api/_lib/**/*.ts", "api/_lib/**/*.js"]
}
```

- [ ] `package.json` script: `"typecheck": "tsc --noEmit"`; add to CI after lint. Commit.

## Task 2: authz.ts

- [ ] `git mv api/_lib/authz.js api/_lib/authz.ts`
- [ ] Types: `type AdminRow = { is_owner: boolean } | null; export type Caller = { user: { id: string } | null; isAdmin: boolean; isOwner: boolean; error?: [number, string] }` — match the existing test's expectations exactly (`{ user, isAdmin, isOwner }`).
- [ ] Port `bearerToken`/`getCaller` bodies verbatim; fix compiler-flagged narrowings.
- [ ] `npm test`.

## Task 3: webhookAuth.ts

- [ ] `git mv api/_lib/webhookAuth.js api/_lib/webhookAuth.ts`; type the HMAC verify (Buffer, header name union per sender); fix; test.

## Task 4: quizGrading.ts + quizBattle.ts

- [ ] Grading: define `Question`, `Answer`, `GradeResult` interfaces from the actual DB columns read (check the quiz_questions/quiz_answers DDL first); keep functions total (no throw on bad input — return a graded error result, matching current behavior).
- [ ] Battle: `BattleState` from `quiz_battles` columns; the CAS/claim logic gets `readonly` state transitions where cheap.
- [ ] Full `npm test` (quiz suite included); `npm run typecheck` clean.

## Task 5: CI + sweep

- [ ] Verify CI `typecheck` step fails on a planted error (temporarily break a type), then passes after revert.
- [ ] Document in AGENTS.md: new modules in `api/_lib/` are TS from now on; per-module JS→TS happens opportunistically, never in bulk.

## Rollback

`git mv` back + drop the tsconfig/script. Nothing else references the types.
