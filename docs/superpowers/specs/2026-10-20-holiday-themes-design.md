# Holiday Themes Design

The owner wants to dress the site for holidays — Christmas, Easter, Valentine's, Independence Day — by
choosing or building a theme that repaints everything visitors, admins and quiz players see, then goes back
to normal afterwards. This is the design record: what a theme contains, how one becomes live, and how the
quiz half reaches the existing quiz design system without inventing a second one.

**Status:** approved by owner, implemented — phases 1 and 2, as built. **Date:** 2026-10-20.

---

## 1. What was asked

Confirmed requirement by requirement:

- **Scope:** colours *and* festive decor *and* imagery — the full treatment, not a palette swap alone.
- **Activation:** scheduled by date range, with a manual override on top.
- **Reach:** everything — public pages, admin screens, and the quiz.
- **Quiz link:** one theme, both surfaces. The site paints automatically; the same theme also appears as a
  ready-made option in the quiz studio the host can put on a quiz.
- **Presets:** starter holidays ship already made, editable — not locked, not blank-only.
- **Permissions:** owner only, like `calendar_looks`. A theme repaints the whole site and every live quiz's
  option list; that is an owner decision.
- **Imagery:** one site art image per theme (homepage band, optional logo swap) plus one quiz backdrop,
  reusing the quiz upload pipeline.
- **Decor:** both kinds, per theme — an optional particle effect *and* an optional banner message.
- **Quiz apply:** studio picker only. No auto-application to new quizzes, no apply-everywhere button.

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Storage shape | New `holiday_themes` table + `holiday_settings` singleton | The `content_looks`/`content_settings` precedent: designs in one table, which one is live in one settings row. Extending `content_looks` was rejected — that system's vocabulary is card layouts for `/events` and `/news`, with no schedule, decor, storage or quiz mapping in it, and `content_looks.page` must keep meaning a content page |
| Who resolves "what is live" | A security-definer RPC `active_holiday_theme()` returning one row or null | Visitors need one row, not the whole table, and anon must never read themes directly. The RPC resolves the schedule server-side so the browser cannot disagree with the server about the date |
| Timezone | `Africa/Lagos`, pinned | Vercel runs UTC; the calendar already learned this lesson (`calendarDates.js`, reminder "is today"). A theme whose range contains Dec 25 must switch on Dec 25 in Nigeria, not in UTC |
| Range semantics | `starts_on`/`ends_on` are `date`, both inclusive; either may be null (null = unbounded) | Same reasoning as `academic_calendar`: the holiday is a day-range, not an instant. Two themes in range at once resolve to the later `starts_on`, tie-broken by `id` — deterministic, no ordering surprises |
| Modes | `auto` (follow schedule), `manual` (use `active_theme_id`), `off` (nothing, whatever the calendar says) | The approved "scheduled + manual override" answer: the admin can force one theme on early, or force everything off mid-Christmas |
| Painting the site | Write validated tokens onto `documentElement` as inline custom properties from a `HolidayThemeProvider` | Tailwind classes are static strings; the `.dark` block already works by redefining the same `--color-*` tokens, so repointing them repaints every `bg-surface`, `text-ink-900` and `border-hairline` on the site with zero per-page edits. Inline style beats both `@theme` and `.dark`, so the provider must re-apply on a light/dark toggle — it watches `useTheme()` and writes the matching map |
| Which tokens a theme may set | A fixed allowlist of eleven tokens, per light and dark map: `brand`, `brand-orange`, `green-900`, `orange-500` (hover/focus accent), `paper`, `surface`, `surface-low`, `ink-900`, `ink`, `ink-muted`, `hairline` | Any key outside the list is dropped by the sanitizer. A partial map is legal — unfilled keys fall back to site defaults, so a theme repoints only what it provides |
| The sanitizer | Pure `api/_lib/holidayTheme.js` — `sanitizeHolidayTheme`, `resolveActiveHoliday`, `holidayThemeVars` | The five-studio precedent: one browser+server module that is the only judge of a value. Colours are validated `#rrggbb`; banner text is plain text ≤ 80 chars with no HTML; particles are one of five named ids or none |
| Decor never reaches quiz screens | `HolidayDecor` renders on public + admin only | The projector and phones have their own design system and their own motion budgets; the phone also has the low-data rule (`low: 1` may only subtract). A snow layer over a live game would be a bug report, not festivity |
| Particles | CSS-only, five named effects (`snow`, `petals`, `sparks`, `confetti`, `leaves`), keyframes `holiday-p-<name>` in `src/index.css`, all disabled under `prefers-reduced-motion` | The backdrop-motion precedent: named styles with keyframes the stylesheet owns, and a source-scan test so an effect cannot be added without its keyframes. No image files, no JS animation loops |
| Banner | Plain text under the navbar on public + admin, `pointer-events` normal, dismissible for the session (`sessionStorage`) | A greeting nobody can dismiss becomes a complaint; per-session keeps it simple — reload brings it back |
| Imagery storage | Own bucket `holiday-themes`, paths `themeId/<uuid>.webp` | Every feature owns its bucket (`page-banners`, `quiz-branding`, `event-images`…). Site band and logo display via `getPublicUrl`, same as the other admin upload fields |
| Quiz backdrop + `sanitizeTheme` | The holiday backdrop lives in `holiday-themes/<id>/…`; **applying the look to a quiz copies the object into that quiz's own `quiz-images/<quizId>/` folder first** | `sanitizeTheme(look.design, { quizId })` strips storage paths outside the quiz's folder — the AGENTS.md rule that keeps a quiz's pictures inside the quiz. Copying at apply time honours the rule instead of weakening it |
| Quiz delivery | The theme's quiz mapping is synced into a `quiz_looks` row named after the theme; the theme stores that row's id | The studio's saved-looks picker then shows the holiday look through today's code path. A second picker, a `kind` column on `quiz_looks`, or any merging of the five preset tables was rejected per AGENTS.md — `calendar_looks` is the model, and each studio keeps its own table |
| Quiz application | Host picks the look in the quiz studio like any saved look; it saves to the quiz's draft and snapshots into `quiz_sessions.theme` at game start | The approved "studio picker only" answer, and the existing snapshot rule: editing a theme never restyles a game already running |
| Who may read a theme | Owner-write; reads reach owner and admin, anon only through the RPC | The "owner only" answer above is about who MANAGES a theme, and writes stay owner. But the quiz studio is an admin surface: applying a holiday look there reads the `quiz` mapping as whichever admin is in the studio, and an owner-only read silently dropped the backdrop picture for every non-owner admin (found in review, fixed as built). The row is presentation the same RPC already paints for anon, so a wider read exposes nothing new |
| Kill switch | `feature_flags` key `holidays` | The calendar precedent: nav tile, provider and RPC all honour it. One row flips the whole feature off without a deploy |
| Admin screen | `/admin/holidays`, owner-gated, behind the flag | One route, one tile on the Admin home, like Calendar |
| Presets | Migration seeds four editable themes: Christmas/New Year, Easter, Valentine's, Nigeria Independence Day — each with a light+dark palette, a decor suggestion, empty imagery, and a quiz mapping in `DEFAULT_THEME` vocabulary | "Starter presets, editable": the owner tweaks and saves, or builds from blank. Seeded rows are ordinary rows — editing one is not special |

## 3. Changes

Phase 1 — the site:

| File | Change |
|---|---|
| `supabase/migrations/<timestamp>_holiday_themes.sql` | The two tables, owner-only RLS on both, `holidays` row in `feature_flags`, the `active_holiday_theme()` RPC (Lagos-pinned, honours the flag), four seeded presets, `holiday-themes` storage bucket |
| `api/_lib/holidayTheme.js` | Pure module: `sanitizeHolidayTheme`, `resolveActiveHoliday`, `holidayThemeVars`, `HOLIDAY_PARTICLES` |
| `src/data/holidays.js` | React-query hooks + owner writes (list, save, delete, set mode/active theme) |
| `src/lib/HolidayThemeProvider.jsx` | Fetches the active theme once per app load; writes the token map onto `documentElement`; re-applies on `useTheme()` change; no-ops on error or flag off |
| `src/components/site/HolidayDecor.jsx` | Particle layer (fixed, `pointer-events-none`) + session-dismissible banner |
| `src/index.css` | `holiday-p-*` keyframes (five effects), reduced-motion off-switch |
| `src/pages/admin/AdminHolidays.jsx` | Owner screen: list, create from preset or blank, palette/decor/schedule/imagery editor with live preview, Auto/Manual/Off control |
| `src/pages/Admin.jsx` | Admin → Holiday themes tile in `ADMIN_SECTIONS`, behind the flag |
| `src/pages/Home.jsx` | Renders the theme's band image at the top of the homepage — below the navbar, above the hero — when present |
| `index.html` | Any new Material Symbol names added to `icon_names=` in alphabetical order |

Phase 2 — the quiz surface:

| File | Change |
|---|---|
| `api/_lib/holidayTheme.js` | Extend the sanitizer to judge `quiz` mapping (subset of `DEFAULT_THEME` vocabulary: stage colours, backdrop pattern + colour + motion, music id from `THEME_MUSIC`) |
| `src/pages/admin/AdminHolidays.jsx` | Quiz mapping editor (the studio's theme controls, subset) with a preview using the same quiz renderers the studio uses |
| `src/data/holidays.js` | On save, upsert the linked `quiz_looks` row through `sanitizeTheme`; store the look id in `holiday_themes.quiz.look_id` |
| `src/pages/admin/AdminQuizzes.jsx` / quiz studio apply path | Applying the holiday look copies the backdrop object from `holiday-themes/<id>/` into `quiz-images/<quizId>/` and rewrites the path before `sanitizeTheme` sees it |

## 4. Verification

- `api/_lib/holidayTheme.test.js`: sanitizer (hex validation, allowlist drop, banner cap, particle enum,
  junk settles to defaults), `resolveActiveHoliday` (in-range, inclusive boundaries, overlap rule, manual
  override, off, flag off, null ranges), `holidayThemeVars` (partial map fills only its keys, dark map
  selection).
- A source-scan test that every id in `HOLIDAY_PARTICLES` has `holiday-p-<id>` keyframes in `src/index.css`
  — the backdrop-motion pattern.
- Provider tests with a fake Supabase: sets vars, re-applies on mode change, removes them when the theme
  goes away, paints nothing on error.
- Phase 2: the `quiz_looks` sync runs every design through `sanitizeTheme`, and the apply path copies the
  image before sanitising.
- `npm test`, `npm run lint` (exit 0, no new warnings), `npm run build` all pass.
- **Not verified by any of this:** how the snow looks falling, whether each palette reads well across the
  dark-mode swatch set, and whether the banner fights the navbar on a phone. Those need a real browser and
  a login; the design does not claim otherwise.

## 5. Known gaps

1. **The RPC reads the clock at call time.** A visitor who keeps a tab open past midnight keeps the theme
   they loaded. Refreshing fixes it; there is no background refresher, and there should not be one.
2. **Logo swap is a whole-image replacement**, not a recolour. A holiday wordmark has to be supplied as an
   image; the site will not redraw its existing logo.
3. **The quiz backdrop copy is one-way.** Deleting the holiday theme leaves copies inside quizzes that used
   it — deliberately, because those quizzes' drafts now point at their own copy and must keep working.
4. **Seeded presets are ordinary rows.** Editing one freely is the point, but there is no "reset to
   original" — a mangled preset has to be fixed by hand or replaced by a fresh migration.
5. **Phase 2 ships after phase 1.** The site can go festive before the quiz half exists; `holiday_themes.quiz`
   is simply ignored until the studio reads it.
