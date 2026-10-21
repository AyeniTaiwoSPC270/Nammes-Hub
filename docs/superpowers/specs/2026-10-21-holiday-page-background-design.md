# Holiday Page Background Design

An extension of the holiday themes system (`2026-10-20-holiday-themes-design.md`): a theme may now paint
the whole page background — an uploaded festive picture, or a palette-derived colour fallback — instead of
the app's plain `bg-paper`. Confirmed by the owner through a visual companion session, choice by choice.

**Status:** approved by owner, 2026-10-21.

---

## 1. What was asked

- The owner wants a live holiday to look like the season, not just tint the tokens: Christmas should be
  *red with decorations* behind the content, not the app's usual near-white page.
- "An option to use that specific theme as the background" — per theme, switchable, not automatic.

Confirmed requirements (owner answers, in order):

1. **Reach: everywhere.** Public pages and admin screens alike — matching how the palette repaint works.
   Quiz screens stay excluded (the standing rule: they own their look system).
2. **Form: both.** An uploaded picture when the theme has one; otherwise a festive colour + decorations
   fallback built from the theme's own palette. Every preset works with no upload.
3. **The option: an on/off toggle per theme.** A theme can carry a background and still keep it off —
   band + palette only.
4. **Dark mode: same picture, both modes.** A readability wash adapts to the mode instead of a second upload.
5. **Readability: a soft wash over the picture.** Opaque cards keep their surfaces; the picture shows in
   gutters, hero areas and section gaps, veiled so text always reads.

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Storage | New `background` jsonb column on `holiday_themes`, shape `{ enabled: boolean, image: text\|null }`, default `{ enabled: false }` | The row already carries jsonb halves (`palette`, `decor`, `imagery`, `quiz`); one more key is the pattern, and a column per idea would churn the table. The RPC returns `to_jsonb(t)`, so the new key reaches the browser with **no RPC change** |
| Sanitizer | `sanitizeBackground(input, { themeId })` in `api/_lib/holidayTheme.js`, included in `sanitizeHolidayTheme` | One judge, same as every other half of a theme. `enabled` is a real boolean (default false); `image` must be a valid `holiday-themes/<themeId>/` path (`isHolidayImagePath`), else null |
| Painting | New fixed layer `src/components/site/HolidayBackground.jsx`, mounted by `Layout` and `AdminLayout` as their first child | The `HolidayDecor` precedent: a fixed, `pointer-events-none` layer with no per-page edits. It mounts in the two shells rather than the provider because "drop the page's own `bg-paper`" is a place in the page, and the provider wraps quiz routes that must never see it |
| Making the page show it | When a background is live, `Layout` and `AdminLayout` drop their wrapper's `bg-paper` (the layer fills that role) | The wrapper is opaque `bg-paper` today; a layer behind it would be invisible. Two shell edits, zero page edits. Cards/inputs keep `bg-surface`/`bg-paper` and stay opaque, so the picture reads behind and between them |
| The wash | One veil over the picture: `rgba(255,255,255,0.55)` in light mode, `rgba(10,10,10,0.6)` in dark, read from `useTheme()` | The approved mockup B. A translucent veil keeps hero text and headings readable over any picture; one picture serves both modes |
| Fallback (no picture) | A fixed gradient from the theme's own palette tokens (`--color-surface-low` → `--color-paper`) | The palette is already the theme's colour voice; a gradient needs no new field, no new validation, and works for every seeded preset the moment the toggle is flipped. Decorations for this mode are the theme's existing particle effect |
| Quiz exclusion | `HolidayBackground` reuses the **same** `QUIZ_PREFIXES` exclusion as `HolidayDecor` — the list moves to one export both components read | One list, one rule. A background under a live game is the snow-over-a-game bug report again |
| Image upload | New `background` kind in `uploadHolidayImage`, ~1920px longest edge through the existing `processQuizImage` pipeline | The pipeline and bucket already exist; a page background is the largest image the site draws, so it gets the largest cap but stays a webp/jpg the same way |
| Fallback decorations | None new — the theme's particle effect is the decoration | The five effects already exist with reduced-motion support; a second decorative system would double the motion budget for the same job |
| Kill switch | Unchanged: the `holidays` flag | The background only ever comes from the live theme row the RPC already gates |

## 3. Changes

| File | Change |
|---|---|
| `supabase/migrations/<timestamp>_holiday_background.sql` | `alter table public.holiday_themes add column background jsonb not null default '{"enabled": false}'` |
| `api/_lib/holidayTheme.js` | `sanitizeBackground`; `sanitizeHolidayTheme` carries `background` |
| `src/data/holidays.js` | `background` upload kind (1920px) |
| `src/components/site/HolidayBackground.jsx` | New: the fixed layer — picture + wash, or palette gradient; same quiz-prefix exclusion as `HolidayDecor` |
| `src/components/site/HolidayDecor.jsx` | Export `QUIZ_PREFIXES` (moved, not copied) |
| `src/components/Layout.jsx`, `src/components/admin/AdminLayout.jsx` | Mount `<HolidayBackground />`; drop wrapper `bg-paper` while one is live |
| `src/pages/admin/AdminHolidays.jsx` | "Use as page background" checkbox + background image slot (same `ImageSlot` as band/logo) |

## 4. Verification

- `api/_lib/holidayTheme.test.js`: `sanitizeBackground` (boolean settle, foreign-folder path dropped,
  junk settles to `{ enabled: false, image: null }`), `sanitizeHolidayTheme` carries it.
- `src/lib/holidayThemeProvider.test.js` source-scans (node environment, no DOM — same as today):
  both shells mount the layer and drop `bg-paper` when live; the quiz-prefix exclusion is present and
  shared with `HolidayDecor`; the wash reads the light/dark mode.
- The existing migration test conventions still pass.
- `npm test`, `npm run lint`, `npm run build` pass.
- **Not verified by any of this:** how a real Christmas image looks under the wash, and whether the
  gradient fallback reads festive rather than flat. Those need a browser and a login.

## 5. Known gaps

1. **The gradient fallback is colour, not decoration.** It reads as a festive page only as well as the
   theme's palette does; motifs (garlands, borders) were deliberately left out — the particles carry it.
2. **One picture for both modes.** A picture that is dark-on-dark can fight the light-mode wash; the
   owner picks art with the wash in mind. A per-mode picture was priced and declined.
3. **Section backgrounds still win.** A card with `bg-surface` is opaque by design; the picture shows
   around it, never through it. That is the approved readability trade.
