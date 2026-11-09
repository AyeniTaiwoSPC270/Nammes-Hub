# Repo Hygiene: Purge video/, Prune Branches, Protect master

`video/` holds ~478 MB of rendered MP4s/WAVs in git history; 121 remote branches drift unmerged;
`master` is not known to require green CI.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| History rewrite | `git filter-repo --path video --invert-paths` on a fresh clone; force-push after admin sign-off |
| Ignore | `video/out/` (render outputs) gitignored; keep `video/src` (Remotion project) tracked |
| Branch prune | Inventory 122 branches; merged→delete, stale→archive tags, active→rebase; target ≤ 10 |
| Branch protection | `master`: require `test` + `secrets` + `build` green, linear history, no direct pushes |
| Auto-delete | "Automatically delete head branches" after merge |

### Out

- **Deleting Remotion source.** It is the only sane way to re-render explainers; keep `video/src`, `video/public` (audio) if needed — evaluate audio assets for LFS/Releases.
- **Squashing all of history.** Covered (analysis only) by the migration-hygiene spec's approach; separate operation.

---

## 2. The problem

Clone = 287 MB pack (unfiltered) vs 20 MB filtered. Every contributor/CI run pays it. 121 non-master branches make it impossible to know what shipped vs what is abandoned — review fatigue becomes a security control failure. Without branch protection, `master` can receive unreviewed direct pushes.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Rewrite method | `git filter-repo` (not BFG) — faster, recommended by Git docs for this | One operation, verifiable result |
| Before rewrite | Announce in AGENTS.md/ADMIN.md 1 week ahead; all contributors re-clone after | Force-push invalidates local clones |
| Videos after purge | Upload masters to a GitHub Release (`video-assets-v1`) + Supabase storage for site use | Assets remain one click away, zero git cost |
| Branch triage | Script: merged → delete; last-commit > 90 days → archive-tag `archive/<name>` then delete; else keep | Deterministic, no guessing |
| Protection | Require status checks + 1 review (owner may self-merge own PRs via bypass only in emergency) | Solo-maintainer pragmatism |

## 4. The change

1. Fresh bare clone → `git filter-repo --path video --invert-paths` → verify `du -sh .git`.
2. Force-push `master` (+tags). 3. Release with video assets. 4. `.gitignore` += `video/out/`. 5. Branch triage script output committed to `docs/repo/branch-triage-2026-11.md`. 6. GitHub settings: branch ruleset on `master`; auto-delete head branches on.

## 5. Verification

1. Fresh clone < 60 MB; `git log -- video/` empty; history otherwise intact (`git rev-list --count` matches pre-rewrite minus video-only commits).
2. Release assets downloadable; playable H.264.
3. Push to `master` without PR rejected (test with a revertible commit or a dry-run ruleset).

## 6. Risk

History rewrite is irreversible for collaborators — full backup bundle (`git bundle create backup-mirror.git --all`) BEFORE rewriting, stored off-platform. Any open PRs will need rebase; prune PRs first (there are none stale that matter — triage confirms).
