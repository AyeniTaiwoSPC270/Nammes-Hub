# Security CI: CodeQL and Dependency Automerge

`ci.yml` runs lint/test/build, `npm audit`, and gitleaks — but there is no CodeQL analysis, and no
automated dependency patching, so classes of vulnerable code ship without a static scan.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

| Piece | What it is |
|---|---|
| `codeql.yml` | CodeQL for JS/TS on PR + weekly schedule (copy from FYpro-v2) |
| secrets-scan | Already present via gitleaks in `ci.yml` — verify it runs on PRs, keep |
| Dependabot | `.github/dependabot.yml`: weekly npm + github-actions; auto-merge **patch/minor** via workflow with `gh pr merge --auto --squash` gated on green CI |
| Audit gate | Keep `npm audit --omit=dev --audit-level=high`; add `audit-ci` config `audit-ci.jsonc` to pin/allow known-false-positives |

### Out

- **SAST beyond CodeQL.** One scanner, tuned, beats three noisy ones.
- **Blocking merges on every Dependabot PR.** Only green+patch/minor automerge.

---

## 2. The problem

CI today (`ci.yml`) covers correctness, not vulnerability classes. Dependabot updates require manual review, so patches lag. FYpro-v2 already ships `codeql.yml`, `secrets-scan.yml`, and `dependabot-auto-merge.yml` — proven patterns, same repo owner, same Node stack.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| CodeQL packs | `javascript-security-extended`, `javascript-quality-extended` | Catches injection + unsafe patterns with false-positive rate we can live with |
| Schedule | Weekly Monday 06:00 UTC + on `pull_request` | Reviewable digest, not per-push noise |
| Automerge | patch+minor only, `gh pr merge --auto --squash`, requires CI success | Security patches land without human latency |
| Failure policy | audit-ci fails on high/critical; allowlist only with justification comment | No silent suppressions |

## 4. The change

Copy the three workflow files from FYpro-v2 verbatim; adjust branch to `master`; add `.github/dependabot.yml`; add `audit-ci.jsonc` modeled on FYpro-v2's. Enable auto-merge in repo settings; document in ADMIN.md.

## 5. Verification

1. CodeQL workflow completes; zero unclassified high findings (or all triaged in-issue).
2. A test Dependabot patch PR auto-merges after green CI.
3. `npx audit-ci --config audit-ci.jsonc` exits 0; removing an allowlist entry fails it.

## 6. Risk

CodeQL false positives on generated SVG/string templates — triage weekly, dismiss with reason. Automerge can still ship a bad patch — mitigated by full CI gate + ability to revert via `vercel rollback`.
