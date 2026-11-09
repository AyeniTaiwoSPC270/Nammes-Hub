# SEO and Structured Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the hub discoverable: `robots.txt`, a generated `sitemap.xml`, canonical tags, JSON-LD on article/event pages, per-route titles/descriptions, Google Search Console verification — zero spend.

**Architecture:** Build-time `scripts/generate-sitemap.mjs` reads Supabase (anon key, public rows only) and emits `public/sitemap.xml` on CI build; per-route meta via a small `useDocumentMeta` hook; JSON-LD via `src/components/seo/JsonLd.jsx`; robots.txt static.

**Tech Stack:** Node script (service-role never needed — anon key), React, `@supabase/supabase-js` (present), Google Search Console (free).

**Spec:** `docs/superpowers/specs/2026-11-09-seo-structured-data-design.md`

## Global Constraints

- Only public, indexable content in the sitemap — never `/admin*`, `/api/*`, `/play` join links, or CBT result pages.
- JSON-LD must validate (Google Rich Results test) — keep to `NewsArticle`, `Event`, `LearningResource`/`Article`, `Organization`, `WebSite`.
- OG images: reuse the existing `news-preview` generation path; do not build a new OG service in this plan.

---

## Task 1: robots.txt

**Files:** Create `public/robots.txt`

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /play?
Disallow: /*?state=
Sitemap: https://www.nammeshub.com.ng/sitemap.xml
```

- [ ] Commit.

## Task 2: Sitemap generator

**Files:** Create `scripts/generate-sitemap.mjs`; wire into `package.json` (`"sitemap": "node scripts/generate-sitemap.mjs"`) and CI (run before build; `public/sitemap.xml` committed? — generate on CI only, gitignored; verify `public/` is in the deploy as generated file).

- [ ] Sources: static list (`/`, `/about`, `/outlines`, `/timetable`, `/news`, `/events`, `/resources`, `/opportunities`, `/cgpa`, `/forms`) + Supabase tables, using the anon key (these tables are anon-readable by design): `news` (route is `/news/:key` — use `` `slug ?? id` `` as key; verify what `getNewsByKey` matches in `src/lib` or `src/data/news.js` before wiring), `events` → `/events/:id`, `outlines` → `/outlines/:level/:semester/:code`. `opportunities` has no detail route (list only) — sitemap gains no detail URLs from it. Use `createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)` and select only the needed columns (`id, slug, updated`-class fields; news has `updated`? — fall back to `created_at` if `updated` is absent; verify with `sed -n '1,20p' supabase/migrations/20261031110000_news_slug.sql`).
- [ ] Output: XML with `<url><loc>…<lastmod>…` — escape entities; cap 5,000 URLs (free tier fine).
- [ ] Run locally; sanity-check with `xmllint --noout public/sitemap.xml` if available; open in browser; 30+ URLs expected.

## Task 3: Canonical + per-route meta

**Files:** Create `src/lib/useDocumentMeta.js`

```js
export function useDocumentMeta({ title, description, canonical }) {
  useEffect(() => {
    document.title = title ? `${title} · NAMMES Hub` : 'NAMMES Hub';
    setMeta('description', description);
    setLink('canonical', canonical ?? `https://www.nammeshub.com.ng${location.pathname}`);
    setMeta('og:title', …); setMeta('og:description', …);
  }, [title, description, canonical]);
}
```

- [ ] Apply to: home, outlines list + course, news list + detail, events list + detail, resources, opportunities, forms landing, CBT practice info (no-auth part), about.
- [ ] Remove any duplicated `<title>` defaults in index.html? Keep index.html as the fallback — per-route calls override at runtime.

## Task 4: JSON-LD

**Files:** Create `src/components/seo/JsonLd.jsx` — `export const JsonLd = ({ data }) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />`

- [ ] Home: `Organization` (name NAMMES, url, logo) + `WebSite` (with `SearchAction`? no — no search endpoint; plain WebSite).
- [ ] News detail: `NewsArticle` (headline, datePublished, image, publisher).
- [ ] Event detail: `Event` (name, startDate, location, organizer, url).
- [ ] Validate the three with Google's Rich Results Test on the staging/preview URL before prod deploy.

## Task 5: Search Console (manual)

- [ ] Verify property `www.nammeshub.com.ng` via DNS TXT (domain property) or HTML file; submit `sitemap.xml`; request indexing of the 5 money pages; set preferred domain (www vs apex — match Vercel's redirect: check `vercel.json` redirects and keep one).
- [ ] ADMIN.md: record verification date + monthly "Coverage" glance.

## Task 6: Verify

- [ ] `npm run build`; `npx vite preview` → view-source checks on `/`, a news detail and an event; `curl robots.txt`, `curl sitemap.xml`; Rich Results for the three page types.

## Rollback

robots.txt/sitemap/JsonLd additive; remove files and hook calls; Search Console property stays (harmless).
