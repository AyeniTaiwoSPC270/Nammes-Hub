# SEO and Structured Data

`public/` ships **no `robots.txt` and no `sitemap.xml`**, and pages lack verified JSON-LD/canonical tags —
a public news/events/resources hub is invisible to search, ceding discovery to WhatsApp forwards.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| `robots.txt` | Allow all, point to sitemap; disallow `/admin*`, `/cbt/*` results, `/api/*` |
| `sitemap.xml` | Static build-time generator (script) covering static routes + news/events/resources/outlines slugs from Supabase (anon read) |
| Canonical | `<link rel="canonical">` per route (param-free) |
| JSON-LD | `NewsArticle`/`Event`/`Article` on detail pages; `Organization` + `WebSite` on home |
| OG/Twitter | Verify per-route title/description/image — `news-preview`/OG image generation exists; extend to events/resources |
| Meta hygiene | Unique `<title>` + description per route; no duplicate defaults |

### Out

- **Paid SEO tooling.** Search Console (free) is enough.
- **AMP.** No.

---

## 2. The problem

Public value (scholarships, outlines, event photos) exists behind the login-free pages, but crawlers can't map it: no sitemap, no robots directives for private paths, unverified social cards. Every missed indexing is a student who never finds the scholarship deadline.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Sitemap gen | `scripts/build-sitemap.mjs` at build time; falls back to static-only if Supabase unreachable (build must never fail for SEO) | Deterministic, decoupled from runtime |
| OG images | Reuse `/api/system?action=og` image generation for events/resources (news already wired per specs) | Consistent cards, zero design work |
| Canonical domain | Force `https://www.nammeshub.com.ng` | Matches live site |
| noindex | Admin, CBT results, auth pages, search results, 404 | Keep crawl budget on content |
| Freshness | Sitemap `lastmod` from `updated_at` columns; regenerate nightly via cron commit-less deploy hook if stale | Google rewards fresh paths |

## 4. The change

Add `public/robots.txt`; `scripts/build-sitemap.mjs` writes `public/sitemap.xml` in `prebuild`; inject canonical + JSON-LD in the relevant pages (`Helmet`-style via existing `document.title` pattern or `index.html` templating); extend OG handler params to `type=event|resource`; verify in Search Console; submit sitemap.

## 5. Verification

1. `npm run build` produces valid `sitemap.xml` (XMLLint in CI); robots fetchable.
2. Rich Results Test: Article/Event JSON-LD valid on 3 sampled pages.
3. Search Console: sitemap accepted; coverage grows over 4 weeks (recorded in ADMIN.md).
4. `curl` each page → unique title/description; no `noindex` on public pages.

## 6. Risk

Sitemap from anon reads exposes only public rows (RLS enforces) — confirm no draft/unpublished rows leak by testing with the anon key. JSON-LD with wrong dates can mis-render in SERPs; validate every type with the Rich Results Test before shipping.
