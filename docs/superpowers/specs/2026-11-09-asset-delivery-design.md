# Asset Delivery: Handbook PDF and Media Diet

`public/documents/NAMMES-Hub-Handbook.pdf` is **9.3 MB** shipped inside every deploy and clone, and the
`video/` pipeline is not the only large-payload offender the browser can inherit.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Handbook PDF | Move to Supabase Storage (or Releases) + CDN URL; repo keeps a pointer |
| Images | `srcset`/`loading="lazy"` audit for events/news galleries; WebP where tooling allows |
| `public/` budget | CI check: no single file in `public/` > 2 MB; total `public/` tracked |
| Cache headers | Storage objects served with `max-age=31536000, immutable` (content-named) |

### Out

- **The `video/` git-history purge.** Covered by `2026-11-09-repo-hygiene-design.md`.
- **A CMS image pipeline (sharp/resizer).** Deliberate second step; this spec stops the bleeding.

---

## 2. The problem

`du -sh public` → 11 MB; `public/documents/NAMMES-Hub-Handbook.pdf` → **9.3 MB**, `mme-ccmas.pdf` →
815 KB. Every `git clone`, every Vercel build upload, and every cold start ships these bytes. Any page
that links the handbook hands a student a multi-megabyte download on a metered connection.

Gallery images (events/news) are user-uploaded JPEGs of arbitrary dimension; there is no enforced
delivery format or lazy-loading guarantee below the fold.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Handbook host | Supabase Storage public bucket, content-hashed filename | CDN-cached, range-request friendly, out of the git loop |
| Pointer | `docs/handbook/README.md` records the canonical URL + hash | Discoverability without the bytes |
| Download UX | Button shows size ("Handbook · 9.3 MB · PDF") | Phones on campus data deserve honesty |
| Images | Enforce WebP re-encode on upload if bucket webhook exists; else lazy-load + max-width via CSS | Cheapest 80% win |
| CI guard | Fail build if any `public/` file > 2 MB | Regression gate |

## 4. The change

Upload PDF → `storage.objects` public bucket `documents`; update the two links (`src/pages/Handbook*.jsx`,
print CSS) to the Storage URL; delete the PDF from `public/`; add `scripts/check-public-size.mjs` to CI.
Storage URL is set via `VITE_HANDBOOK_URL` with the Storage URL as fallback, so previews don't break.

## 5. Verification

1. `du -sh public` < 2 MB; clone time drops measurably.
2. PDF opens from the CDN URL on a fresh incognito session; correct `Content-Type`.
3. CI fails on a planted 3 MB file in `public/`.
4. Lighthouse: total page weight on the handbook page drops ≥ 80%.

## 6. Risk

If Storage egress is ever rate-limited, the handbook needs a mirror — keep the GitHub Release asset as
the documented fallback. The URL must stay stable; treat it as a public API (cache headers immutable,
name contains a version slug).
