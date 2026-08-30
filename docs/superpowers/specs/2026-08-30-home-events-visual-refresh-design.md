# Home + Events visual refresh: shared page banner, photo-forward Home, denser Events grid

Date: 2026-08-30

## Problem

NAMMES Hub currently reads as static and generic next to comparable department/faculty sites (e.g. the University of Lagos Engineering Society site, used as a structural reference — not copied). Two concrete gaps drive that:

1. **No shared page-header pattern.** Events, Resources, Outlines, and Opportunities each open with a bare `<h1>` on a plain white background — no visual identity, no consistency between pages.
2. **No real people, anywhere.** Home's hero is a flat illustration, there's no leadership/welcome presence, and the Excos section (`src/pages/Home.jsx`) treats every executive identically regardless of seniority. Events cards show a generic tone icon instead of a real photo.

The fix is a photo-forward treatment (real photos later, an honest gradient placeholder now) applied consistently via one new shared component, plus targeted upgrades to Home and Events.

## Decision

Introduce a single reusable `PageHeader` banner component and a shared "duotone placeholder" background treatment, then apply it to Home's hero and to Events/Resources/Outlines/Opportunities' page tops. Rework Home's Excos section to give the top 3 (by existing `sort_order`) more visual weight, and add a new Welcome Message section. For Events, execute the already-written `2026-08-10-events-photo-upload` spec (unimplemented — admin upload field, `image_url` column, storage bucket) as-is, and widen its grid to 3 columns now that cards carry real photos.

No real photography exists yet — every "photo" in this phase is a CSS gradient placeholder, structured so a real image can drop in later (as a `background-image` + duotone blend) without changing any component's API or callers.

## Scope

| Area | Change |
|---|---|
| `src/components/PageHeader.jsx` (new) | Full-bleed banner: eyebrow + title + subtitle over a duotone-placeholder background. Used by Events/Resources/Outlines/Opportunities. |
| Shared placeholder treatment | A `duotone-placeholder` background (CSS gradient, no image asset) shared by `PageHeader` and the Home hero, with a documented path to swap in a real photo later. |
| `src/pages/Home.jsx` | Hero: illustration + decorative circle → full-bleed photo-band hero (same placeholder treatment, larger) with existing CTAs overlaid. New Welcome Message section (placeholder photo + copy + signature) inserted after the hero, before "Department news". Excos: top 3 by `sort_order` promoted to a larger "featured" row; rest stay in the existing smaller grid. |
| `src/pages/Events.jsx` | Adopts `PageHeader`. Grid: `sm:grid-cols-2` → `sm:grid-cols-2 lg:grid-cols-3`. Executes the existing `2026-08-10-events-photo-upload` spec/plan (admin `image_url` upload field + storage bucket + `Card` `imageVariant="cover"`), which was written but never implemented. |
| `src/pages/Resources.jsx`, `src/pages/Outlines.jsx`, `src/pages/Opportunities.jsx` | Bare `<h1>` block swapped for `PageHeader`. No other layout change in this phase. |
| `DESIGN_SYSTEM.md` | Document `PageHeader`, the duotone-placeholder treatment, and the updated Excos/Events/Home descriptions. |

Out of scope (confirmed during design): countdown/urgency banners, a stats bar, blog/voice changes, nav/IA restructuring (Associations, Stories, Student Aids-style dropdowns), and any layout change to Resources/Outlines/Opportunities beyond the header swap. These may be revisited in a later phase once this one ships and is evaluated.

## `PageHeader` component

Props: `eyebrow` (string, optional), `title` (string, required), `subtitle` (string, optional). No CTA slot — buttons stay specific to Home's hero, not this shared banner.

```jsx
<PageHeader
  eyebrow="Activities"
  title="Events"
  subtitle="See all programs and activities of NAMMES"
/>
```

Rendering: full-bleed band (breaks out of the page's `max-w-[880px]` content column, same technique the current Home hero already uses), `duotone-placeholder` background, dark bottom-to-top gradient overlay for text legibility, `py-14 px-6 sm:px-8`. Inner content constrained to `max-w-[880px] mx-auto`:

- Eyebrow: `font-mono text-xs uppercase tracking-[.04em] font-semibold text-orange-400` (only rendered if passed).
- Title: `font-display text-3xl sm:text-4xl text-white mt-2`.
- Subtitle: `text-white/90 max-w-2xl mt-3` (only rendered if passed).

## Duotone placeholder treatment

No image asset in this phase. Implemented as a CSS gradient class (e.g. `bg-gradient-to-br from-green-900 via-green-700 to-orange-600`, no raw hex — tokens only) applied to the banner's background layer, with the existing decorative-circle motif optionally retained as a subtle accent within it.

Future upgrade path (not built now, just designed for): the same background layer accepts an optional photo — `<img>` with `filter: grayscale(1) contrast(1.1)` plus a `mix-blend-mode` gradient overlay in `green-900`/`orange-600` — so swapping in a real photo later is a prop addition (`photo={src}`) on `PageHeader` and the Home hero, not a rewrite.

## Home page

### Hero

Replaces the current `bg-orange-500` block + `HERO_ILLUSTRATION` + decorative circle with the full-bleed `duotone-placeholder` treatment (larger than `PageHeader`'s, same mechanism). Content overlaid directly on the band, centered in the content column:

- Existing eyebrow pill ("NAMMES · 2025/2026 SESSION").
- Existing H1 and subtitle copy, unchanged text, now white-on-photo instead of white-on-orange.
- Existing CTAs ("Browse outlines", "See events") — `Button` variants unchanged, both already read fine on a dark background.

The side-by-side illustration layout is dropped; text now sits full-width on the band, matching the reference site's hero pattern.

### Welcome Message (new)

New section between the hero and "Department news". Two-column on `sm:` and up (photo one side, text the other), stacked on mobile:

- Framed photo placeholder: a square/portrait box with a white border frame (visual echo of the reference site's framed photo), placeholder image.
- Eyebrow "Welcome Message", `h2`, 2-3 short paragraphs, and a signature block — all placeholder copy, clearly written as such (e.g. "Leader Name — President, NAMMES, 2025/2026 Session") for the user to replace with real content later.

### Excos

Top 3 rows by the existing `sort_order` (already the field the query sorts by — no schema change) render as a "featured" row above the current grid: larger circular photos (160px vs. today's 120px) on `green-700` cards, name/role in white. Remaining excos keep today's smaller 4-column grid below. Photo/initials-fallback logic is unchanged, just reused at a larger size for the featured three.

## Events

- `PageHeader` replaces the current `<h1>` block (`eyebrow="Activities"`, `title="Events"`, a short subtitle).
- Grid: `grid-cols-1 sm:grid-cols-2` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- Photo support: execute `docs/superpowers/plans/2026-08-10-events-photo-upload.md` as written (it was never implemented) — `image_url` column on `events`, `event-images` storage bucket, `EventImageUploadField`, `Card` switches from `imageVariant="icon"` to `imageVariant="cover" imageAspect="standard"`. No changes to that spec's decisions.

## Resources / Outlines / Opportunities

Only change in this phase: the bare `<h1>` block at the top of each is replaced with `PageHeader` (appropriate eyebrow/title/subtitle per page). Internal layouts (level-picker grid on Resources/Outlines, list on Opportunities) are unchanged — a lighter pass is planned for a later phase once this one ships.

## Testing

Presentational changes throughout — no new pure functions beyond what the existing Events photo-upload plan already specifies testing for. Verified by inspection per page:

- `PageHeader` renders correctly with/without `eyebrow`/`subtitle`, full-bleed on mobile and desktop.
- Home hero: CTAs remain clickable and legible on the placeholder background; Welcome Message section renders correctly at mobile/desktop widths; Excos featured row shows exactly the first 3 by `sort_order`, gracefully handles fewer than 3 total excos.
- Events: grid reflows correctly at `sm`/`lg` breakpoints; existing photo-upload plan's own testing notes cover the upload/display path.
- Resources/Outlines/Opportunities: header swap doesn't affect any routing or data below it.
- `npm run lint` and `npm run build` stay clean throughout, per existing repo convention.
