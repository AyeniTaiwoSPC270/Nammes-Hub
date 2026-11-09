# Dev Workflow: Commits, PRs, ADRs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make history parseable and decisions permanent: Conventional Commits enforced by commitlint, a PR template that asks the right questions, and ADRs for the load-bearing architectural choices.

**Architecture:** Husky + commitlint on `commit-msg` (local) plus a PR-title check in CI (remote); a PR template with spec-link/migration/rollback checkboxes; `docs/adr/NNNN-*.md` seed set written from the actual code.

**Tech Stack:** Husky, commitlint, GitHub Actions, markdown.

**Spec:** `docs/superpowers/specs/2026-11-09-dev-workflow-and-adr-design.md`

## Global Constraints

- Never rewrite history to conform ("fix" commits stay).
- ADRs are immutable; a changed decision is a new ADR that supersedes the old one.
- Hooks must stay fast (< 1 s) or people bypass them; commitlint is light.

---

## Task 1: Husky + commitlint

- [ ] `npm install -D husky @commitlint/cli @commitlint/config-conventional`
- [ ] `npx husky init`
- [ ] `commitlint.config.js`: `module.exports = { extends: ['@commitlint/config-conventional'] }`
- [ ] `.husky/commit-msg`: `npx --no-install commitlint --edit "$1"`
- [ ] `package.json` scripts unchanged (`prepare: husky` added by init).
- [ ] Verify: `git commit -m "wip"` → rejected; `git commit -m "chore: test hook" --allow-empty` → accepted.
- [ ] Commit.

## Task 2: PR title check in CI

- [ ] Add to `ci.yml` a `pr-title` job: `echo "${{ github.event.pull_request.title }}" | npx commitlint` (skip on push).
- [ ] Commit: `git commit -m "ci: enforce conventional PR titles"`

## Task 3: PR template

**Files:** Create `.github/PULL_REQUEST_TEMPLATE.md`

```markdown
## Spec
- [ ] Links a spec in `docs/superpowers/specs/` (or "no spec — trivial")

## What & why

## Migration?
- [ ] No
- [ ] Yes — new timestamped file in `supabase/migrations/`, applied staging → prod, rollback file included

## Rollback
Revert PR / `vercel rollback` / both

## Verification
- [ ] `npm run lint` · `npm run test` · `npm run build`
- [ ] Staging checked (link) if user-facing
```

- [ ] Commit.

## Task 4: Seed ADRs

**Files:** Create `docs/adr/0001-rls-everywhere.md` … `0005-sparse-video.md`

- [ ] **0001 RLS on every table** — verified: `grep -ri "enable row level security" supabase` → 68/68 tables; policies carry the admin checks (`public.is_admin()`, AAL2).
- [ ] **0002 Email outbox + worker** — `email_outbox` drained by `/api/system?action=email-worker`; side effects never inline in request path.
- [ ] **0003 AAL2 (MFA) for admin mutations** — `api/_lib/authz.js` `getCaller()`: `isAdmin && tokenAal(token) !== 'aal2'` → reject.
- [ ] **0004 Quiz realtime = server-owned tick** — `pg_cron` minute-tick on `api/quiz?action=tick` + due-step on `quiz-state` reads; CAS to prevent double-advance (see open-quizzes spec).
- [ ] **0005 Video out of git history** — renders are build artifacts; Remotion source tracked, `video/out/ (gitignore entry — the path is added, not shipped)` not.
- [ ] Each ADR: Context (2–3 sentences, with file refs), Decision, Consequences (good/bad), Status: accepted. Commit: `git commit -m "docs(adr): seed ADRs 0001-0005"`

## Task 5: Conventions doc

- [ ] One section in `AGENTS.md`: commit format + PR template rationale + "if a hook is wrong, fix the hook, don't bypass".

## Rollback
`git revert` the tooling commit; delete `docs/adr` if the team rejects the practice (recorded in a rejected-ADR note, not silently).
