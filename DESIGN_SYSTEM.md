# NAMMES Hub — Design System

Working identity. Forest green + orange, Newsreader for display type, Public Sans for body/UI, IBM Plex Mono for data and labels. Flat, borderless, colored-fill surfaces with a playful/energetic tone — cards use solid tone fills rather than hairline borders, pills are fully rounded, hover states scale up. Single light theme by design — no dark mode.

Tokens live in `src/index.css` as CSS custom properties inside `@theme` (Tailwind v4), so every value below is available as a utility class (`bg-green-700`, `text-ink-muted`, `font-display`, `rounded-lg`, …). This file is generated from the design handoff at `../NAMMES Hub Design System/design_handoff_nammes_hub/` — treat that folder as the source of truth for anything not covered here.

## Color

| Token | Value | Use |
|---|---|---|
| `green-900` | `#0b2417` | Headings (`h1`–`h3`), wordmark, footer background |
| `green-700` | `#127a3e` | Primary buttons, active nav, links (`--primary`) |
| `green-600` | `#1c9950` | Rarely used directly — mid green |
| `green-400` | `#4fc27f` | Rarely used directly — light green |
| `green-100` | `#e2f7ea` | Secondary button fill, table header bg, active nav bg (`--primary-tint`) |
| `orange-600` | `#d94e0f` | Accent button hover, "new" badge text |
| `orange-500` | `#ff5a1f` | Accent buttons, focus ring, hero background (`--accent`) |
| `orange-400` | `#ff8f52` | Eyebrow text on green-tone cards |
| `orange-100` | `#fff0e6` | Orange-tone card background, "new" badge bg (`--accent-tint`) |
| `paper` / `surface` | `#ffffff` | Page background / card background |
| `ink` | `#191813` | Body text |
| `ink-muted` | `#6b6558` | Secondary text, meta, placeholders |
| `hairline` | `#e4e0d6` | Borders, dividers, neutral badge bg |
| `success` / `success-bg` | `#1c6b3a` / `#e6f0ea` | "Updated" badge, confirmations |
| `warning` / `warning-bg` | `#a85c00` / `#fdece0` | Caution states |
| `danger` / `danger-bg` | `#a02f22` / `#f7e2dd` | Destructive actions, validation errors, "restricted" badge — a muted rust, not stock red |

**Don't** put brand hex values directly in components — always go through the token (`bg-green-700`, not `bg-[#127a3e]`).

Visual rules: backgrounds are flat, no gradients/patterns. Decorative imagery (category glyphs on Events/Resources/Outlines, the Home hero) is limited to a small set of custom flat illustrations (see "Illustration" below) plus the one decorative shape (a solid green circle bleeding off the Home hero) — no stock imagery for decorative use. News is the exception: its cards show real uploaded photos full-bleed (`Card`'s `imageVariant="cover"`) as the primary content medium, not a decorative accent. Translucent blur is used exactly once — the sticky Navbar (`bg-white/95` + `backdrop-blur-sm`). Borders are flat hairlines on tables/inputs only; cards are borderless colored fills. Shadow (`shadow-sm`/`shadow-md`) reserved for floating elements — modals, dropdowns.

## Typography

- **Display** — `font-display` (Newsreader, serif, weight 600). `h1`–`h3` only. Never body copy, table cells, or buttons.
- **Body / UI** — `font-body` (Public Sans). Everything else: paragraphs, labels, buttons, nav, inputs.
- **Data / labels** — `font-mono` (IBM Plex Mono). Eyebrows, uppercase kickers, course codes, timestamps, table headers, badges.

Type scale (Tailwind defaults, `text-xs` through `text-4xl`) — don't invent new sizes. Line-height: `leading-tight` (1.15) for headings via the base `h1,h2,h3` rule, `leading-normal`/`leading-relaxed` for body copy in cards.

| Role | Class | Notes |
|---|---|---|
| Eyebrow / kicker | `font-mono text-xs uppercase tracking-[.04em] font-semibold` | e.g. "Home", "Department news" |
| H1 | `text-3xl sm:text-4xl` (or explicit px per screen, see kit) | One per page |
| H2 | `text-2xl` / `text-[28px]` | Section headings |
| H3 | `text-xl` | Card titles |
| Body | `text-base leading-relaxed` | 16px minimum |
| Small / meta | `text-sm text-ink-muted` | Timestamps, helper text |

Line length: cap prose at `max-w-2xl` to stay in the 65–75 character range.

## Spacing & shape

Tailwind's default spacing scale (4px increments, including fractional multiples like `py-3.5`/`px-4.5` — Tailwind v4 computes any multiple on demand). Section rhythm follows the kit: `py-14`/`pb-18` between major Home sections, `gap-4`/`gap-5` within a grid, `gap-2` between tightly related items (label + input).

Radius tokens are overridden directly on Tailwind's built-in scale, so the standard utilities carry the brand shape everywhere:
- `rounded-sm` → 6px (buttons, inputs)
- `rounded-md` → 20px (tables)
- `rounded-lg` → 24px (cards)
- `rounded-full` → pill (buttons, badges, nav pills, avatars)

Shadow: `shadow-sm` for subtle lift, `shadow-md` for floating elements (modals, dropdowns) only — overridden to match the handoff's exact values. Motion: `duration-150` (150ms) for hover/transition.

## Components

All in `src/components/ui/` (`Button`, `Card`, `Badge`, `Table`, `FormField`) plus `src/components/Navbar.jsx` and `src/components/Footer.jsx`.

### Button

Props: `variant` (`primary`|`secondary`|`accent`|`destructive`|`ghost`), `size` (`md`|`sm`), `loading`, `disabled`, `onClick`, `type`.
- Pill-shaped (`rounded-full`), 2px border matching fill color, `font-semibold`, sentence case labels, no icons.
- primary: green-700 fill/border, white text, hover → green-900. secondary: green-100 fill, green-700 text, transparent border. accent: orange-500 fill/border, white text, hover → orange-600 — use sparingly, never as the default. destructive: danger fill/border, white text, hover → `#7d2015`. ghost: transparent, green-100 on hover.
- Hover: background swap + `scale-105`-ish (`hover:scale-[1.03]`), 150ms ease.
- Disabled/loading: `opacity-50`, `cursor-not-allowed`, loading replaces children with "Loading…".
- md: `28px`/`14px` padding, base text. sm: `18px`/`8px` padding, sm text.

### Card

Props: `eyebrow`, `title`, `meta`, `children`, `padded` (default true), `tone` (`neutral`|`green`|`orange`), `image` (`{ src }`, optional), `imageVariant` (`icon` default | `cover`), `imageAspect` (`standard` default | `video`, only relevant when `imageVariant="cover"`).
- `rounded-lg` (24px), borderless, colored fill, `p-6`, flex column, `gap-2`.
- neutral: white bg, muted eyebrow, heading-color title. green: green-700 fill, orange-400 eyebrow, white title/body (70–90% white). orange: orange-100 fill, orange-600 eyebrow, green-900 title. Used for news, events, outlines callouts.
- eyebrow: mono, xs, uppercase, `.04em` tracking, semibold. title: h3-style, xl. meta: mono, sm, muted. body: base, relaxed line-height.
- `image` + `imageVariant="icon"` (default): renders as a 64×64 badge (`object-contain`, not cropped) above the eyebrow, inside the card's own padding. The illustration assets are self-contained circular badges (icon + soft circle backdrop) — `object-contain` keeps the full badge intact rather than cropping it into a photo-style banner. Always decorative (`alt=""`, `aria-hidden`) — the category/context is already conveyed by the eyebrow text next to it. See "Illustration" below for the asset set.
- `image` + `imageVariant="cover"`: renders full-bleed above the card's padded content, `object-cover`, `rounded-t-lg` to match the card's own `rounded-lg`. Fixed aspect ratio via `imageAspect`: `standard` (4:3, default — grid cards) or `video` (16:9 — featured/hero cards). Used for real uploaded photos (News) rather than decorative illustrations; if `image` is omitted, no image row renders at all — never falls back to a stretched icon. Always decorative (`alt=""`, `aria-hidden`).

### Badge

Props: `tone` (`new`|`updated`|`restricted`|`neutral`), `children`. Word only, no icons/emoji.
- Inline pill, `10px`/`2px` padding, `rounded-full`, mono, xs, uppercase, `.03em` tracking, medium weight.
- new: orange-100 bg / orange-600 text (draws the eye to fresh posts). updated: success-bg / success (green tint). restricted: danger-bg / danger (Exco-only content). neutral: hairline bg / muted text.

### Table

Props: `columns` (string[]), `rows` (string[][]). Bordered, flat, mono header on green-100. Used for Outlines and any future Admin listing.
- `rounded-md` (20px, overflow hidden), 1px hairline border, `w-full border-collapse`.
- Header row: green-100 bg, mono, xs, uppercase, `.04em` tracking, green-900 text, `10px/16px` cell padding.
- Body cells: `12px/16px` padding, sm text, hairline bottom border between rows (last row borderless). Course codes/dates stay mono in the cell content where relevant.
- Always wrap in `.nm-table-wrap` (`overflow-x-auto`) — never let a table push the page into horizontal scroll.

### FormField

Props: `label`, `type` (`text`|`email`|`password`|`select`|…), `value`, `onChange`, `placeholder`, `helper`, `error`, `options` (for select). Used on Login and future Admin forms.
- Label: sm, medium weight, green-900, `gap-1.5` above control.
- Input/select: `12px/10px` padding, `rounded-sm` (6px), base text, 1px hairline border (danger when `error` is set).
- Helper/error text below the control (never a top-of-form-only summary) — error in danger takes priority over helper.

### PageHeader

Props: `eyebrow` (optional), `title`, `subtitle` (optional). Full-bleed banner used at the top of every inner page (Events, Resources, Outlines, Opportunities) in place of a bare `<h1>`.
- Background: duotone-gradient placeholder (`bg-gradient-to-br from-green-900 via-green-700 to-orange-600`) — stands in for a real photo until the department has one; built so a `photo` prop can be added later without changing layout.
- Content constrained to `max-w-[880px]`, `py-14`/`px-6 sm:px-8`. Eyebrow: mono/xs/uppercase/orange-400. Title: `font-display text-3xl sm:text-4xl` white. Subtitle: `text-white/90 max-w-2xl`.

### Navbar

Props: `links`, `active`, `brand`. Sticky, `z-30`, translucent (`bg-white/95` + `backdrop-blur-sm`) — the one place translucency is used in this system, 1px hairline bottom border.
- Brand: 32×32 `/logo.png` + Newsreader wordmark, 600 weight, lg size.
- Links: sm, semibold, `rounded-full` pill, `8px/16px` padding; active gets green-100 bg + green-700 text.
- **Mobile (≤ `sm` breakpoint)**: hamburger toggle (3 stacked 22×2px bars) replaces the link row; tapping opens a fixed full-width dropdown panel below the navbar (white bg, `shadow-md`, hairline bottom border).

### Footer

Props: `brand`, `tagline`, `links`, `year`. Dark green (`green-900`) band, `white/72` base text, `48px/32px/28px` padding.
- Content max-width 880px, centered, flex row space-between wrap, `gap-8`.
- Left block: brand (logo + Newsreader white wordmark) + tagline (sm, relaxed line-height).
- Link groups: mono uppercase xs heading (`white/50`) + column of sm links (`white/80`, no underline).
- Bottom bar: 1px top border (`white/15`), space-between row, xs text (`white/50`) — copyright + "University of Lagos, Faculty of Engineering".

## Illustration

Custom flat 2D vector-style illustrations, generated per a locked style prompt (see `docs/superpowers/specs/2026-07-26-flat-illustrations-design.md` for the full prompt set), used to add visual warmth without stock photography. No photorealism, no embedded text, palette drawn from the existing brand tokens (green-700/900/100, orange-500/100, white) — generation in practice also introduced thin outlines and a few off-palette neutrals (skin tone, hair, gray tool shapes) on figurative pieces, which is an accepted deviation rather than strict palette purity.

Assets live in `src/assets/illustrations/*.png`, mapped to usage keys in `src/lib/illustrations.js` (`HERO_ILLUSTRATION`, `CATEGORY_ICONS`, `LEVEL_ICONS`, `EVENT_TONE_ICONS`) so pages never import files directly. 14 images total:
- **Hero** (1) — Home page hero; stacked below the heading/copy on mobile (smaller, centered), right side alongside the text on `sm:` and up.
- **Category icons** (6) — Academics, Governance, Welfare, Industry, Call for papers, Resources. Used via `Card`'s `image` prop on Home's news cards and on the News page.
- **Level icons** (5) — 100–500, shown above the level number on the Outlines/Resources level-picker tiles.
- **Event-tone icons** (2) — one per `Card` `tone` (green/orange), used on Events cards via `Card`'s `image` prop.

All illustration images are decorative: `alt=""` + `aria-hidden="true"` everywhere, never real alt text, since the adjacent text (eyebrow, level number, heading) already conveys the information.

## Pages implemented from the handoff UI kit

- **Home** (`src/pages/Home.jsx`) — duotone-gradient hero (placeholder for a real department photo), a Welcome Message section (`src/components/WelcomeMessage.jsx`, placeholder leader photo/copy), department news section (1 featured green Card + 3-col grid of Cards, each with a category illustration via `Card`'s `image` prop), then Excos: a featured row (top 3 by `sort_order`, larger circular photos on green cards) plus a smaller 4-col grid for the rest — circular initial avatars stand in for real photos until the department supplies them.
- **Outlines** — drill-down flow: level picker (`src/pages/Outlines.jsx`, 5 tiles for 100–500 Level) → semester picker (`src/pages/outlines/OutlineLevel.jsx`, First/Second Semester) → course `Table` (`src/pages/outlines/OutlineCourses.jsx`, code/title/units + "View outline" per row) → detail (`src/pages/outlines/OutlineDetail.jsx`, description + topics-covered `Card`). Routes: `/outlines`, `/outlines/:level`, `/outlines/:level/:semester`, `/outlines/:level/:semester/:code`. Sample course data lives in `src/data/outlines.js` — swap for Supabase once outlines are scoped for Admin CRUD. Shared `Breadcrumbs` component (`src/components/Breadcrumbs.jsx`) is used across all three sub-pages.
- **Events** (`src/pages/Events.jsx`) — `PageHeader` banner, then a 3-col grid of Cards showing a full-bleed cover photo (`imageVariant="cover"`) when an event has one uploaded, otherwise just the colored tone block (no icon).
- **News** (`src/pages/News.jsx`) — full reverse-chronological list from Supabase (1 featured Card with a full-bleed cover photo + 2-col grid of cover-photo Cards, same pattern as Home's teaser), category filter pills (`All` + the 6 `NEWS_CATEGORIES`) driven by `?category=` in the URL, each card links to `/news/:id`. **NewsDetail** (`src/pages/NewsDetail.jsx`) — full post view (category, title, byline, date, badge, body) reached at `/news/:id`; unknown ids redirect to `/news`. **Opportunities** (`src/pages/Opportunities.jsx`) — `Table` of scholarships/internships from `src/data/opportunities.js`, sorted soonest-deadline-first, external "Apply" links, list-only (no detail route, no filter). Sample data in `src/data/news.js` and `src/data/opportunities.js` — swap for Supabase once these domains are scoped for Admin CRUD, matching the existing convention for `outlines.js`/`resources.js`.
- **Login** (`src/pages/Login.jsx`) — sign-in card (email + password `FormField`s, primary submit with `loading`, ghost cancel), plus links to Create account and Forgot password. Framed as a plain sign-in, not an "Exco-only" page — Exco members log in the same way as any other account holder would, there's no separate Exco flow. Reached via a "Sign in" link in the Navbar (and Footer), not a floating button. Shows a success banner when arriving via `?created=1` (from Signup) or `?reset=1` (from Reset password).
- **Signup** (`src/pages/Signup.jsx`) — name/email/password/confirm-password, client-side validation (university email domain, 8+ char password, matching confirmation), redirects to `/login?created=1` on success.
- **Forgot password** (`src/pages/ForgotPassword.jsx`) — email only; always shows the same non-leaking "check your email" confirmation on submit, regardless of whether the account exists.
- **Reset password** (`src/pages/ResetPassword.jsx`) — reached via `?token=…`; shows a "link expired" state if no token is present, otherwise a new-password + confirm form that redirects to `/login?reset=1` on success.

All four auth pages share a centered-card shell (`src/components/AuthCard.jsx`) and the handoff's placeholder validation logic (a ~900ms simulated request, then client-side checks — no network call). Swap for real Supabase auth (`src/lib/supabaseClient.js`) when that's scoped: sign-in/sign-up calls, `resetPasswordForEmail`, and reading Supabase's own recovery token instead of a generic `?token=`.

Resources now has a real layout (`src/pages/Resources.jsx`, `PageHeader` banner + level-picker grid identical in structure to Outlines) rather than `PagePlaceholder` — this note was stale. Admin isn't in the handoff kit; build its real layout as that design arrives, following the component specs above rather than ad hoc styling.

## Accessibility checklist (project-specific)

- Green-700-on-paper and ink-on-paper both clear 4.5:1 — re-verify manually if either token changes.
- `:focus-visible` ring is global (orange-500, 2px, 2px offset) — don't override it per-component.
- Admin delete actions need a confirmation step (native `confirm()` is acceptable for v1) — never a one-click destructive action.
- Course/event/resource lists will eventually be data-driven and potentially long — plan for pagination once real content exceeds ~50 rows.

## What's deliberately out of scope for v1

- No dark mode — single light theme by design, per the handoff.
- No manual light/dark toggle.
- No structural/UI icon set chosen yet (nav, buttons, form controls) — when adding those, pick one SVG set (e.g. Lucide) and stay consistent; no emoji as structural icons. The illustration set above is decorative content, not a UI icon system, and doesn't set precedent for one.
- Exco photo upload (the handoff's `image-slot` drag-drop prototype) — replaced with initial-avatar placeholders until there's a real upload flow.
