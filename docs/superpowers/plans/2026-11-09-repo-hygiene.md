# Repo Hygiene: Purge video/, Prune Branches, Protect master — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. IRREVERSIBLE STEP REQUIRES OWNER SIGN-OFF FIRST.

**Goal:** Remove ~478 MB of rendered videos from git history, triage 122 remote branches, and require green CI on `master`.

**Architecture:** A one-time `git filter-repo` rewrite on a fresh clone, followed by force-push (owner approval), upload of the video masters to a GitHub Release, branch triage by script, and GitHub ruleset configuration (manual).

**Tech Stack:** `git filter-repo`, GitHub Releases, GitHub rulesets, bash.

**Spec:** `docs/superpowers/specs/2026-11-09-repo-hygiene-design.md`

## Global Constraints

- **STOP** at Task 3 until the owner explicitly OKs the force-push in writing (issue comment or message). Everything before Task 3 is safe and reversible.
- Before force-push: `git bundle create /Volumes/backup/nammes-hub-backup.bundle --all` and store off-platform.
- All work on a throwaway clone (e.g. `/tmp/nammes-hub-clean`), never the owner's working clone.
- Video assets move to Releases, not to exclusion-without-upload — the org may re-render someday.

---

## Task 1: Inventory and announce

- [ ] **Step 1:** Fresh clone: `git clone --mirror https://github.com/AyeniTaiwoSPC270/Nammes-Hub.git /tmp/nammes-hub-clean` (expect ~800 MB).
- [ ] **Step 2:** Size report: `du -sh /tmp/nammes-hub-clean`; top offenders: `git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | awk '/^blob/{print $3, $4}' | sort -rn | head -20 > docs/repo/video-bloat-report.txt`
- [ ] **Step 3:** Commit the report + a dated announcement in `AGENTS.md` ("History rewrite planned for YYYY-MM-DD; all clones must be re-cloned afterwards") on a normal branch, merge via PR.

## Task 2: Backup bundle

- [ ] **Step 1:** `cd /tmp/nammes-hub-clean && git bundle create /tmp/nammes-hub-backup.bundle --all && ls -lh /tmp/nammes-hub-backup.bundle`
- [ ] **Step 2 (manual):** Copy the bundle to two locations off this machine (external drive + cloud). Record checksum: `shasum -a 256 /tmp/nammes-hub-backup.bundle`.

## Task 3: Rewrite — OWNER SIGN-OFF REQUIRED

- [ ] **Step 0:** Obtain written owner approval ("approved: force-push master" in the hygiene PR). Do not proceed without it.
- [ ] **Step 1:** `cd /tmp/nammes-hub-clean && git filter-repo --path video --invert-paths`
- [ ] **Step 2:** Verify: `git rev-list --objects --all | grep -c ^.*video` ≈ 0; `git log --oneline | wc -l` close to 712 (minus video-only commits); `du -sh .git`.
- [ ] **Step 3:** `git push origin --force --all` and `git push origin --force --tags`.
- [ ] **Step 4:** GitHub Release `video-assets-v1`: upload the current `video/out/*.mp4` and `video/public/audio/*.wav` from the pre-rewrite mirror; description links them.

## Task 4: Branch triage

**Files:** Create `scripts/branch-triage.sh`

- [ ] **Step 1:** Script: for every remote branch besides `master`: merged (`git branch -r --merged origin/master`) → push delete; last commit > 90 days (`git log -1 --format=%ct origin/<branch>`) → create tag `archive/<branch>` then delete; else keep and print.
- [ ] **Step 2:** Run in dry-run (echo only); paste output into `docs/repo/branch-triage-2026-11.md`; owner reviews list; rerun with `--apply`.
- [ ] **Step 3:** Commit scripts + report: `git commit -m "chore(repo): branch triage script and report"`.
- [ ] **Step 4:** Target: ≤ 10 remaining branches. Any important unmerged work gets a fresh PR opened first.

## Task 5: Protection (manual GitHub settings)

- [ ] **Step 1:** Settings → Branches → add ruleset for `master`: require status checks `test`, `secrets`, `build`; require pull request before merge (1 approval, owner can bypass only in declared emergency); block force-pushes; require linear history.
- [ ] **Step 2:** Settings → General → enable "Automatically delete head branches".
- [ ] **Step 3:** Test: open a throwaway PR with a failing check; confirm merge is blocked; close it unmerged; delete branch.

## Task 6: Housekeeping

- [ ] **Step 1:** `.gitignore` += `video/out/`; commit.
- [ ] **Step 2:** Update `README.md` (clone instructions mention the smaller clone + video assets Release link). Commit.
- [ ] **Step 3:** All contributors re-clone; the owner's working clone is replaced from origin (its history is invalid now).

## Rollback

The bundle is the rollback: clone it, force-push its refs. Test the bundle restores before rewriting (unbundle into a scratch dir and count refs).
