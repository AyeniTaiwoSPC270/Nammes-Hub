# News slugs, share button and link previews — design

Date: 2026-10-31
Status: agreed, ready to plan

## Goal

Every news article gets a readable URL, a share button that works on a phone, and a proper preview
card when its link is pasted into WhatsApp, Telegram or X — without breaking a single link that
already exists.

## Decisions

| Question | Decision |
|---|---|
| Slugs | `news.slug`, generated in SQL from the title, `unique`, nullable |
| Old URLs | **`/news/:id` keeps working** — one resolver accepts a UUID or a slug |
| Canonical URL | The slug; emitted by the share button, `og:url` and the client `canonical` |
| Who may change a slug | Nobody — generated once, never in an edit payload |
| Share control | `navigator.share` where available, "Copy link" and "WhatsApp" fallbacks |
| Preview rendering | Extend the existing `og` handler; no new serverless entry point |
| Preview image | A generated **1200×630** PNG; article image as background, Hub fallback |
| Kill switch | `feature_flags` key `news_share`, seeded **off** |
| Architecture | Existing handler + one rewrite — not a separate `/share/` URL |

## URLs and slugs

`news.slug text` with a `unique` index and a `before insert` trigger that fills it when null:

- `news_slug(title, id)` — ASCII-folds, lowercases, collapses anything not `[a-z0-9]` to `-`,
  trims, caps at 60 characters, and on collision appends `-` plus the first 6 characters of the
  id. One SQL function, used by the trigger **and** by the backfill, so a backfilled row and a row
  created tomorrow get identical treatment.
- Existing rows are backfilled in the same migration.
- `slug` is **not** named in `apply_change_request`'s `update` branch for `news`, so an approved
  non-owner edit can never rewrite a published URL. The insert branch needs no change either — the
  trigger fills it. (This is the opposite of the `news_video` case: there a column had to be *added*
  to the function because an edit must be able to carry it; a slug must never be carried by an
  edit.)

**Route.** `App.jsx` keeps a single `news/:key` route. `NewsDetail` resolves a UUID against `id`,
anything else against `slug`, and a miss renders the existing not-found state. A visit by id
renders normally and swaps the `canonical` link to the slug form, so the id URL stays valid without
becoming the advertised one.

**Consequence elsewhere:** `admin_analytics` joins page views on `t.path = '/news/' || n.id`. Once
articles are shared by slug that join stops matching. It becomes
`t.path in ('/news/' || n.id, '/news/' || n.slug)`.

## Share button

`src/lib/share.js` — a pure helper with no dependencies:

- `shareArticle({ title, path })` tries `navigator.share` and reports success/failure; the caller
  falls back only when it throws `AbortError` (user closed the sheet) versus any other error.
- `copyLink(path)` uses `navigator.clipboard.writeText` with a `document.execCommand('copy')`
  fallback on insecure contexts.
- `whatsappUrl(text, path)` builds `https://wa.me/?text=` with `encodeURIComponent`.

`NewsDetail` renders a `share` glyph button (already in `icon_names=`) opening a small menu: the
native share sheet when `navigator.share` exists, then **Copy link**, then **WhatsApp**. The whole
control is absent when `news_share` is off.

## Link previews

The shared URL is the article's own, so one URL must answer both a crawler and a browser. This is
what `api/_lib/handlers/og.js` already does for quiz links — `looksLikeBrowser`, escaping, and the
fail-safe default — so the mechanism is reused, not rebuilt.

**Rewrite.** `vercel.json` gains
`{ "source": "/news/(.*)", "destination": "/api/system?action=news-preview&key=$1" }` placed
**before** the catch-all `/((?!api/).*)` rewrite, which stays last.

**Handler** (`action = 'news-preview'`, registered in the `ACTIONS` map on `api/system.js`):

1. Look the key up as a UUID first, then as a slug, with the service key. Read `title, body,
   image_url, slug, updated_at`.
2. `news_share` off → serve the app shell to everyone. Crawlers therefore see exactly the baseline
   `og:` tags already in `index.html`, which is today's behaviour.
3. Browser (`looksLikeBrowser`) → serve the built **`dist/index.html`** with
   `Cache-Control: public, max-age=0, must-revalidate`. The quiz handler can redirect because its
   target path is a *different* URL; here the browser is already at the right one, so a redirect
   would loop. `dist/index.html` is added to `includeFiles` on `api/system.js` in `vercel.json`.
4. Crawler → the existing `renderPage()` with the article's title, a 160-character excerpt of
   `body` (plain text, whitespace collapsed), `og:url` in slug form, and `og:image` pointing at the
   generated card. `Cache-Control: public, s-maxage=3600`.
5. Unknown key → the app shell, never a 404: the SPA decides whether the link is real, which is
   what keeps `/news/:id` and typo'd slugs working through the same rewrite.

**Card image** (`action = 'news-image&key='`, same function): a new `api/_lib/newsCardRender.js`
draws a 1200×630 PNG on `@napi-rs/canvas`, following `quizCardRender.js` — a server-only module,
SVG-free, using `fonts.js` for the one font it needs. Background is the article's `image_url`
fetched with a 3-second timeout under a dark scrim, title wrapped to at most three lines in white;
on any fetch failure or a missing image it draws the Hub gradient and logo instead. Served with
`Cache-Control: public, s-maxage=86400`, plus `og:image:width`/`height` of 1200/630.

**Why generate rather than pass the article image through:** WhatsApp crops what you give it, and
an arbitrary portrait screenshot with no title on it previews as an unidentifiable sliver. The
card is the one place the title is guaranteed to be in the image.

**Why not a `/share/news/:slug` URL:** the preview must describe the link that was actually pasted.
A separate URL previews a page nobody visits, and the share sheet would have to hand out the ugly
one.

## Failure modes

| Failure | Behaviour |
|---|---|
| Flag off | No share button; crawlers get the baseline `index.html` tags |
| Slug collision | Handled at insert by the id suffix; the unique index is the backstop |
| Article image fetch fails/times out | Gradient + logo card, never a broken image |
| Key matches nothing | App shell served; the SPA shows its not-found state |
| `index.html` missing from the bundle | Handler logs and serves the shell-less 500 — caught in a build check, not in production |
| Old shared links | Resolve by id exactly as today |
| WhatsApp's cache | Unavoidable; verify with a never-before-shared link |

## Testing

- **`api/_lib/handlers/og.test.js`** (extend): article found by slug and by id, unknown key falls
  to the shell, flag-off falls to the shell, excerpt truncation, escaping of an admin-authored
  title containing `<`, `"` and `'`, and that the image URL is absolute.
- **`api/_lib/newsCardRender.test.js`** (new): renders a 1200×630 buffer with no image; with a
  stubbed fetch; with a failing fetch (gradient path). No network in the test.
- **`src/lib/share.test.js`** (new): `whatsappUrl` encoding, `shareArticle` mapping abort vs error,
  `copyLink` fallback ordering.
- **`supabase/migrations.test.js`** (extend): the trigger fills a null slug, a duplicate title
  produces a distinct slug, `slug` is absent from `apply_change_request`'s news `update` branch,
  and the `news_share` flag row exists.
- **Rewrite order test**: `vercel.json`'s `/news/` entry appears before the catch-all.

`npm test`, `npm run lint`, `npm run build`.

## Files touched

`supabase/migrations/<ts>_news_slug.sql`, `vercel.json`, `api/system.js`,
`api/_lib/handlers/og.js` + test, new `api/_lib/newsCardRender.js` + test, `App.jsx`,
`src/pages/NewsDetail.jsx`, new `src/lib/share.js` + test, `src/data/news.js` (slug-aware query),
`supabase/migrations/20261026120000_analytics.sql` (path join re-declared in the new migration),
a per-key flag hook beside the pattern in `src/data/news.js`, this spec.

## Out of scope

- Slugs for events, outlines, resources or opportunities.
- Editing or deleting a slug after publication.
- Open Graph for any page other than a news article.
- Unfurl support for Discord, Slack, iMessage (the same tags serve them, but they are not tested).
- Serving previews for `/news/:id` — id links preview with the article's own slug in `og:url`.

## Verification limits

Tests, lint and build can be verified locally. **No preview has been seen in WhatsApp, Telegram or
X** — that needs a deployed URL, a never-before-shared link, and time for their caches. The card's
appearance in a real share sheet, the phone's native share sheet, and the browser path through the
rewrite are all unverified without a browser and a deployment.
