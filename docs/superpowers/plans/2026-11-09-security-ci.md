# Security CI: CodeQL and Dependency Automerge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add static security analysis (CodeQL), dependency update automation, and patch/minor automerge to the public repo — all free.

**Architecture:** Two new workflows (`codeql.yml`, `dependabot-auto-merge.yml`) plus `.github/dependabot.yml`. Existing `ci.yml` (lint → test → audit → build, gitleaks) stays untouched. Automerge fires only on green CI for patch/minor bumps via the GitHub CLI.

**Tech Stack:** GitHub Actions, CodeQL (free for public repos), Dependabot, `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-11-09-security-ci-design.md`

## Global Constraints

- Only additive workflows; do not weaken `ci.yml` or raise audit levels.
- Merge gate stays: tests + audit + build must be green for automerge — no exceptions, no `continue-on-error`.
- Pin action versions by SHA or major tag matching repo style (`@v4`).

---

## Task 1: Dependabot config

**Files:** Create `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly, day: monday }
    open-pull-requests-limit: 5
    versioning-strategy: increase
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly, day: monday }
```

- [ ] Commit: `git add .github/dependabot.yml && git commit -m "ci: dependabot for npm and actions"`

## Task 2: CodeQL

**Files:** Create `.github/workflows/codeql.yml`

```yaml
name: codeql
on:
  pull_request: { branches: [master] }
  schedule: [{ cron: '0 5 * * 1' }]
permissions:
  security-events: write
  contents: read
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with: { languages: javascript-typescript, queries: security-extended,quality-extended }
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

- [ ] Commit; open a PR touching nothing but the workflow; confirm the job runs and reports.
- [ ] Triage findings: for each alert, fix, dismiss with reason, or open an issue. Record count/disposition in the PR description.

## Task 3: Automerge

**Files:** Create `.github/workflows/dependabot-auto-merge.yml`

```yaml
name: dependabot-auto-merge
on: pull_request
permissions: { contents: write, pull-requests: write }
jobs:
  automerge:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Auto-merge patch/minor
        run: |
          gh pr view "$PR_URL" --json title,labels -q '.title'
          LEVEL=$(gh pr view "$PR_URL" --json title -q '.title' | grep -oE '(patch|minor|major)' || true)
          if [ "$LEVEL" = major ]; then echo "major bump — manual review"; exit 0; fi
          gh pr merge "$PR_URL" --auto --squash
        env: { GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}, PR_URL: ${{ github.event.pull_request.html_url }} }
```

- [ ] Commit; enable auto-merge on the repo (Settings → General → Allow auto-merge).
- [ ] Verify the first real Dependabot PR: patch bump → CI green → squash-merged without human click.

## Task 4: Audit gate docs

- [ ] Add one paragraph to `AGENTS.md`: how to respond to a failing `npm audit --omit=dev --audit-level=high` (upgrade first; `overrides` only with a linked CVE + comment).
- [ ] Commit.

## Rollback

Delete the two workflows + dependabot.yml. CodeQL alerts remain in the Security tab until dismissed; leave them.
