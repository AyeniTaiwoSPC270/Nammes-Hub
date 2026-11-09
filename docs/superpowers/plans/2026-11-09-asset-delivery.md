# Asset Delivery: Handbook PDF and Media Diet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Get the 9.3 MB handbook PDF out of the repo and the deploy, and keep every future `public/` file under 2 MB by CI gate.

**Architecture:** PDF moves to a public Supabase Storage bucket (`documents`) with content-hashed name; the two code references switch to `VITE_HANDBOOK_URL` with a Storage fallback; a CI script fails if any `public/` file exceeds 2 MB.

**Tech Stack:** Supabase Storage (free 1 GB), GitHub Actions, `VITE_*` env, no new deps.

**Spec:** `docs/superpowers/specs/2026-11-09-asset-delivery-design.md`

## Global Constraints

- The Storage object name is immutable — if content changes, upload `…-v2.pdf` and update the link, never overwrite.
- Keep one fallback mirror (GitHub Release asset) for the handbook in case Storage is ever unreachable; document it in ADMIN.md.

---

## Task 1: Stage the move (no deletions yet)

- [ ] Create bucket `documents` (public) in **both** prod and staging Supabase projects.
- [ ] Upload `public/documents/NAMMES-Hub-Handbook.pdf` as `nammes-hub-handbook-2nd-ed.pdf` (check `docs/superpowers/specs/2026-10-10-handbook-second-edition-design.md` for the current edition). Note the public URL.
- [ ] Test the URL incognito; content-type must be `application/pdf`; range requests must work (`curl -I`).

## Task 2: Point the app at it

- [ ] `grep -rn "NAMMES-Hub-Handbook" src public index.html` — expect ≤ 3 hits (link in a page + print CSS?). Replace with `import.meta.env.VITE_HANDBOOK_URL ?? 'https://<ref>.supabase.co/storage/v1/object/public/documents/nammes-hub-handbook-2nd-ed.pdf'`.
- [ ] If any hit is in `index.html` (preload/print), switch it to the same env-backed URL via `%VITE_HANDBOOK_URL%` or leave to the React page.
- [ ] Add `VITE_HANDBOOK_URL=` to `.env.example`.
- [ ] Commit: `git commit -m "feat(handbook): serve PDF from Supabase Storage"`

## Task 3: Delete from repo + CI gate

**Files:** Create `scripts/check-public-size.mjs`

```js
import { walkSync } from 'node:fs' // implement simply — no dep
// walk public/, stat every file, fail if any > 2 MB or total > 25 MB; print top offenders
```

- [ ] Also upload the PDF as a GitHub Release asset `handbook-2nd-edition` for the fallback mirror.
- [ ] `git rm public/documents/NAMMES-Hub-Handbook.pdf` (and `mme-ccmas.pdf`? — user decision needed if that one is app-referenced; check references first: `grep -rn mme-ccmas src` → if referenced as course material, move it too; else leave).
- [ ] Add `npm run check:public` to `package.json`; wire into `ci.yml` before build.
- [ ] ADMIN.md: handbook now hosted in Storage; how to publish a new edition (`-v<N>` name, update `VITE_HANDBOOK_URL`, never overwrite).
- [ ] Commit.

## Task 4: Images sweep (best-effort, no re-upload pipeline here)

- [ ] `grep -rn '<img' src --include='*.jsx' -l | xargs grep -l 'gallery\|events\|news'` — add `loading="lazy"` + `decoding="async"` where missing (≤ 20 lines changed expected). Prime above-the-fold images stay eager.
- [ ] Commit.

## Task 5: Verify

- [ ] `du -sh public` (expect ≤ 2 MB), `git clone` fresh → size noted, CI green with the new gate, dev-server click-through of every handbook link including print view.

## Rollback

Restore the PDF from git history (`git checkout <pre-delete-sha> -- public/documents/NAMMES-Hub-Handbook.pdf`) and revert the links commit; Storage object can stay.
