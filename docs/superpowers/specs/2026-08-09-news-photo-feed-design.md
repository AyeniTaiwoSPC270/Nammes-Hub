# News: photo-forward scrolling feed

Date: 2026-08-09

## Problem

`Card`'s `image` prop (added for the flat-illustration work, see `2026-07-26-flat-illustrations-design.md`) renders every image at `h-16 w-16 object-contain` — a small square icon. That's the right size for a category illustration sitting next to a text card, but News now carries real uploaded photos (`image_url` from Supabase, wired up in `e726d8d feat: move News to Supabase with full admin CRUD and image upload`), and those photos are being squashed down to icon size on the News list, the Home "What's happening" teaser, and effectively ignored as a visual element. The user wants News to read as a photo-driven scrolling feed — students checking the latest gist/gossip/news the way they'd scroll a blog or social feed — which means the photo needs to be the dominant element of each card, not a thumbnail next to the text.

This also runs into a documented design-system rule: `DESIGN_SYSTEM.md` currently states imagery is "limited to a small set of custom flat illustrations... no photography, no stock imagery." That rule was true when written (illustrations were the only imagery in the system) but is now contradicted by News' real uploaded photos, so it needs to be corrected rather than left standing.

## Decision

Add an opt-in `imageVariant="cover"` mode to `Card` for full-bleed photo display, leaving the existing behavior (now implicitly `imageVariant="icon"`) as the default so every other `Card` consumer (Events' tone icons, the category-illustration fallback) is unaffected. Apply the new variant to News (list + detail-adjacent teaser on Home), with a stacked (photo-on-top, text-below) layout rather than the reference's side-by-side hero, since NAMMES pages are a narrow single column (`max-w-[880px]`) rather than a wide magazine layout.

## Scope

| Spot | Treatment | Files touched |
|---|---|---|
| `Card` component | New `imageVariant` prop (`'icon'` default / `'cover'`) | `src/components/ui/Card.jsx` |
| News list (`/news`) | Featured post: full-width stacked photo + text below. Grid: 2 columns (not 3), each card photo-on-top | `src/pages/News.jsx` |
| Home news teaser | Same `imageVariant="cover"` treatment as News, for visual consistency between the teaser and the full list | `src/pages/Home.jsx` |
| NewsDetail (`/news/:id`) | Minor polish only: hero image radius `rounded-md` → `rounded-lg` to match the new card convention | `src/pages/NewsDetail.jsx` |
| `DESIGN_SYSTEM.md` | Correct the "no photography" line; document the new `Card` `imageVariant` prop | `DESIGN_SYSTEM.md` |

Out of scope: author avatar photos (no avatar-photo field exists on any author/Exco data today — adding one is a data-model change, not a display fix, and NewsDetail's existing "Posted by {author}" plain-text byline is left as-is); Events, Resources/Outlines level tiles, or any other current `Card` consumer (they keep `imageVariant="icon"`, unchanged); pagination/infinite-scroll on the feed (out of scope per the existing News spec, revisit once real content volume warrants it); masonry/variable-height grid (explicitly rejected below).

## Component change: `Card`

`src/components/ui/Card.jsx` gains `imageVariant = 'icon'`:

- **`'icon'` (default, current behavior, unchanged):** `h-16 w-16 object-contain`, sits above the eyebrow inside the padded content block. Used by Events' tone icons and anywhere a `Card` shows a decorative category glyph rather than a real photo.
- **`'cover'` (new):** image renders full-bleed across the card's own width, `object-cover`, fixed aspect ratio, rounded to match the card's top corners (`rounded-t-lg`), positioned outside the padded content block (so it bleeds to the card edges while text keeps its own padding below). Two aspect ratios, chosen by call site via a second prop `imageAspect` (`'video'` → `aspect-[16/9]` for the featured post, `'standard'` → `aspect-[4/3]` for grid cards, and the default when `imageAspect` is omitted) — both map to Tailwind's built-in `aspect-*` utilities, no new tokens needed.
- **No photo, `imageVariant="cover"`:** if `image` is omitted (post has no `image_url` and no fallback is passed), the image row is skipped entirely — no image element renders. This deliberately does *not* fall back to the small category illustration stretched to cover size, since a stretched icon at banner size would look broken. The card just shows its colored tone block with text, same as it would with the image row absent.
- Everything else about `Card` (tone fills, eyebrow, title, meta, children, `padded`) is unchanged.

## News list (`src/pages/News.jsx`)

- Featured post (`items[0]`): `Card` with `imageVariant="cover" imageAspect="video"`, image on top, text content (eyebrow/title/meta/body/badge) below it in the tone-colored block — stacked, full width of the 880px container.
- Grid (`items[1:]`): `grid-cols-1 sm:grid-cols-2` (drop the current `lg:grid-cols-3`) — a 3-up grid in an 880px container leaves too little width per photo to read as a photo. Each `Card` uses `imageVariant="cover" imageAspect="standard"`.
- `image` passed to `Card` is `featured.image_url ? { src: featured.image_url } : undefined` — no `categoryImage()` fallback in cover mode, per the "no photo → skip image row" rule above. (`categoryImage()` stays in use wherever `imageVariant="icon"` is still used elsewhere.)
- Category filter pills: unchanged.

## Home news teaser (`src/pages/Home.jsx`)

Same change as News' featured+grid block: `imageVariant="cover"`, `imageAspect="video"` for the featured item and `"standard"` for the grid-of-3, `image_url`-or-nothing (no icon fallback). Layout structure (1 featured + `restNews.slice(0, 3)`) is unchanged — only the `Card` image treatment changes.

## NewsDetail (`src/pages/NewsDetail.jsx`)

One-line change: the existing hero `<img>` (full-width, `image_width_pct`-controlled) goes from `rounded-md` to `rounded-lg`, matching the radius now used on News/Home cards. No other change — this page already renders the photo full-bleed and large.

## `DESIGN_SYSTEM.md`

- Replace the "no photography, no stock imagery" line under Visual rules with wording that scopes it correctly: flat illustrations remain the only imagery for decorative/category glyphs (Events, Resources/Outlines), while News uses real uploaded photos as its primary content medium.
- Document `Card`'s `imageVariant` (`'icon'` | `'cover'`) and `imageAspect` (`'video'` | `'standard'`) props alongside the existing `image` prop documentation.

## Accessibility

Cover-mode images are still decorative relative to the surrounding text (title/eyebrow/body already convey the post's content) — `alt=""` / `aria-hidden="true"`, same convention as the existing icon mode. Not a regression: NewsDetail's hero image already follows this pattern today.

## Testing

Presentational-only change, no new logic branches or pure functions to unit test (the existing `filterNewsByCategory`/`getNews` coverage in `news.test.js` is unaffected). Verified by inspection: News list, Home teaser, and NewsDetail rendered in the browser with and without `image_url` set on sample rows, confirming the no-photo case degrades cleanly (no broken image icon, no stretched illustration) and existing `Card` consumers (Events) are visually unchanged.
