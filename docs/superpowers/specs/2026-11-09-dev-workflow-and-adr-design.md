# Dev Workflow: Commits, PR Discipline, and ADRs

Process artifacts are informal: no commit convention, no PR template, no ADRs — yet the repo carries
load-bearing decisions (RLS model, outbox pattern, AAL2 admin auth) that future maintainers must not
reverse accidentally.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Commit convention | Conventional Commits (`feat:`, `fix:`, `chore:`…); `commitlint` + Husky `commit-msg` hook |
| PR template | `.github/PULL_REQUEST_TEMPLATE.md` — spec link, screenshots, migration?, rollback plan |
| ADRs | `docs/adr/NNNN-title.md` — one per load-bearing decision, 3–10 paragraphs each |
| Seed ADRs | 0001 RLS-everywhere, 0002 email outbox worker, 0003 AAL2 for admin mutations, 0004 quiz realtime strategy, 0005 sparse-checkout video policy |
| Branch protection link | references `2026-11-09-repo-hygiene-design.md` |

### Out

- **Rewriting git history to conform.** Applies from next commit forward.
- **Heavy release process.** No versioning ceremony; deploy = merge to master via Vercel.

---

## 2. The problem

712 commits of valuable history with no parseable semantics ("fix", "update") makes archaeology
hand-work. New admins/maintainers (the org turns over every session) inherit decisions implicitly.
AGENTS.md is excellent but is *how to work*, not *why it is this way*.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Convention | Conventional Commits, scope optional (`feat(quiz): …`) | Cheap, enables changelog generation later |
| Hook | `commitlint` on `commit-msg`; CI re-checks PR title | Humans forget; CI doesn't |
| Template | Mandatory: spec link or "no spec — trivial" checkbox, migration checkbox, rollback note | 60-second accountability |
| ADRs | MADR-lite format; numbered immutable; superseded ADRs get a line, not a rewrite | Decisions evolve, ledger stays honest |
| Review | Owner review required except docs-only (repo ruleset) | Solo-maintainer pragmatism |

## 4. The change

Add dev deps (`@commitlint/cli`, `@commitlint/config-conventional`, `husky`); `npx husky init`;
`commitlint.config.js`; `.husky/commit-msg`; PR template; `docs/adr/0001…0005` seed docs (authored from
existing AGENTS.md + code, ~60 lines each).

## 5. Verification

1. `git commit -m "wip"` rejected locally; `git commit -m "feat(quiz): x"` accepted.
2. Open a test PR — template pre-fills; CI title check enforced.
3. The five ADRs reviewed by the owner for being true to the code, not aspirational.

## 6. Risk

Hook friction drives `--no-verify` — keep the config minimal and the error message instructive.
ADRs that lie (written aspirationally) are worse than none — seed ADRs only from verified code/behavior.
