# Backdrop prop editor — design

**Date:** 2026-10-13
**Status:** approved
**Supersedes:** nothing. Builds on `2026-10-10-quiz-look-controls-design.md` (§6, the pattern vocabulary) and `2026-10-13-quiz-backdrop-motion-design.md` (the movement controls that sit beside this tab).

## 1. The problem

A quiz backdrop is today a **choice, not a design**. The studio offers twelve patterns and five sliders, and an admin who wants the maths symbols clustered at the bottom-left rather than scattered edge to edge has nowhere to say so. Props cannot be moved, added, recoloured or removed. Six of the twelve patterns draw discrete marks an admin can see and would reasonably expect to grab; all six are placed by a closed-form formula keyed off the mark's index.

This adds an editor for those marks.

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| 1 | Six prop patterns get full editing: `math`, `notes`, `stars`, `hexagons`, `rings`, `party`. `dots`, `grid`, `stripes`, `waves` get none. | Only these six have marks to grab. See §3.1 for why the tiled four need no new control. |
| 2 | The result card does **not** read the layout. | Two renderers, two aspect ratios. The card is 1080x1920 portrait; a composition tuned for a 16:9 projector sits on a different shape. Motion set the precedent: screens-only, card untouched. |
| 3 | A sixth studio tab, `Backdrop`. | The preview *is* the editor. Dragging needs room, and the studio's tabs already exist to give each kind of editing its own space. |
| 4 | Per prop: move, resize, rotate, recolour, hide, delete, add, reset. | Resize and rotate are what make a prop feel placed rather than nudged. |
| 5 | New props come only from the current pattern's own vocabulary. | Every prop you can add is one the pattern already knows how to draw, in both renderers. |
| 6 | Each pattern keeps **its own** layout, stored only once edited. | Arranging maths then arranging hexagons must not lose the maths. One shared list would make `hexagons` and `rings` the same backdrop with a different outline. |
| 7 | One arrangement for projector and phone. | Marks are already positioned by percentage of whatever box they land in. Two layouts doubles storage and gives the editor two pictures to reason about. The cost is named in §9. |
| 8 | Prop colours: theme swatches **and** a hex field. | Five swatches are one hand and no new vocabulary; the hex field is for a colour the theme does not have. Both go through the existing `cleanHexColor`. |
| 9 | The layout lives in `quizzes.theme`, and the column's size check is raised. | The theme is the snapshot a game copies at start. Staying inside it means the layout is snapshotted, sanitised and preset-carried for free. A side table would move the size pressure to `quiz_sessions` without removing it. |

## 3. What is stored

### 3.1 The vocabulary becomes keyed

`PATTERN_GLYPHS` in `api/_lib/quizTheme.js` becomes an object keyed by a stable prop id:

```js
export const PATTERN_GLYPHS = {
  math:  { pi: 'π', sum: 'Σ', int: '∫', root: '√', delta: 'Δ', lambda: 'λ', theta: 'θ', inf: '∞', approx: '≈', plusminus: '±' },
  notes: { single: '♪', pair: '♫', quarter: '♩', beamed: '♬' },
  stars: { spark: '✦', sparkle: '✧', star: '★', ray: '✶' },
}

// The drawn prop names live as `shapes` arrays inside their PATTERN_GEOMETRY entries. They share the existing geometry
// vocabulary instead of making those three patterns appear in two tables.
```

`propVocabulary(pattern)` is the single answer to "which props does this pattern own", and both the sanitiser and the editor's Add chip row read it:

```js
export function propVocabulary(pattern) {
  return [...Object.keys(PATTERN_GLYPHS[pattern] ?? {}), ...(PATTERN_GEOMETRY[pattern]?.shapes ?? [])]
}
```

`quizCardRender.js` switches to `Object.values(PATTERN_GLYPHS[chosen])`. There is still exactly one copy of every glyph character, which is what the source-scan in `quizTheme.test.js` ("the pattern vocabulary") exists to protect. The existing assertion that every glyph is a real single character moves to `Object.values`.

`PATTERN_GEOMETRY` carries `shapes: ['hex']`, `['ring']`, or `['balloon', 'hat', 'streamer', 'confetti']` beside those patterns' counts, cells and marks. `PATTERN_UNDRAWN` (`image`, `none`) is unchanged and gains no props.

### 3.2 The theme field

One new flat field on the theme:

```js
backdropLayout: {
  math: [
    { k: 'pi',  x: 8,  y: 14, s: 30, r: -12 },
    { k: 'sum', x: 50, y: 8,  s: 22, r: 4, c: '#f0d9a8' },
    { k: 'int', x: 26, y: 56, s: 46, r: -12, h: 1 },
  ],
  hexagons: [ /* … */ ],
}
```

| Key | Meaning | Cleaned as |
|---|---|---|
| `k` | Which prop. Must be a key in `PATTERN_GLYPHS[pattern]` or an item in `PATTERN_GEOMETRY[pattern].shapes`. | Dropped if the pattern does not own it. |
| `x`, `y` | Integer percent of the backdrop, 0–100. | Rounded, clamped. |
| `s` | Size in the pattern's own **unscaled** pixels, so `backdropScale` still multiplies an edited layout at draw time. | Clamped to the pattern's own range (§3.3). |
| `r` | Rotation in degrees, −180…180. | Rounded, clamped. |
| `c` | `#rrggbb`, or **absent** to inherit the backdrop's brand colour. | `cleanHexColor`; absent when null. |
| `h` | Hidden. Absent when false. | Coerced to `true`/absent. |

`c` and `h` are **omitted at their defaults**, so an untouched prop is `{"k":"pi","x":8,"y":14,"s":30,"r":-12}` — 36 characters, not 50. Key names are short because the row has a ceiling; this is the one place in the theme where brevity wins over legibility, and the shape above is the documentation.

A pattern absent from `backdropLayout` draws `defaultBackdropProps(pattern)`.

### 3.3 Defaults and size ranges

`defaultBackdropProps(pattern)` is pure, lives in `quizTheme.js`, and returns today's marks as records:

- **shape patterns** — `scatter(count, cell, mark)` verbatim: `x = (i*cell + 8) % 92`, `y = (i*cell*1.4 + 5) % 90`, `s = mark + (i*13) % 12`, `r = ((i*41)%50) - 25`
- **glyph patterns** — `GlyphField` verbatim: `x = (i*37 + 8) % 92`, `y = (i*53 + 5) % 90`, `s = 28 + (i*17) % 44`, same `r`
- **party** — cycles `balloon, hat, streamer, confetti` by `i % 4`, as today

`propSizeRange(pattern)` is pure and shared: glyph patterns span `28…72`; shape patterns span `mark…mark + 24` (`hexagons` 46…70, `rings` 62…86, `party` 52…76). Both are clamped by `cleanLayout`.

The two browser formulas collapse into this one function. That is the point: the editor's **Reset** and an unedited backdrop cannot disagree, because there is only one answer to "where does the fourteenth maths symbol sit".

### 3.4 Caps, and the migration

| Cap | Value | Why that number |
|---|---|---|
| Props per pattern | 60 | Above today's busiest pattern (hexagons, 26) with room to crowd. |
| Props across all patterns | 150 | Today the six patterns hold 108 between them; 150 is that plus about 40%. |

The worst-case fixture with optional colours and hidden flags serialises to about 12,400 characters, plus theme and JSONB overhead. The migration gives it headroom with a 16,000-byte check, and the test constructs the maximum sanitized document to verify the bound. So:

```sql
alter table public.quizzes drop constraint if exists quizzes_theme_check;
alter table public.quizzes add constraint quizzes_theme_check check (jsonb_typeof(theme) = 'object' and pg_column_size(theme) < 16000);
alter table public.quiz_sessions drop constraint if exists quiz_sessions_theme_check;
alter table public.quiz_sessions add constraint quiz_sessions_theme_check check (jsonb_typeof(theme) = 'object' and pg_column_size(theme) < 16000);
```

(The existing check constraints are unnamed in Postgres' autogenerated form; the migration resolves them by name on the column's `pg_constraint`, or drops and recreates with an explicit name.)

Both tables move together because `quiz_sessions.theme` is a copy of `quizzes.theme` and would reject a row the quizzes table accepted.

### 3.5 No new control for the tiled four

`dots`, `grid` and `stripes` already derive their tile size from `backdropScale`, and `waves` already derives its band height from it. **Density is the Size slider**, relabelled "Density" in the Backdrop tab when one of those four is selected. Nothing is stored and nothing is added. The tab says so rather than offering an empty editor.

## 4. How it is drawn

`src/components/quiz/QuizParts.jsx`:

- `GlyphField` and `ShapeField` stop computing positions. Each takes a `props` array — the theme's layout for that pattern, or `defaultBackdropProps` — and reads `x`, `y`, `r` off itself.
- **Size is `s × backdropScale` at draw time.** Glyphs set `fontSize`; shapes size their box and keep the SVG's inner `scale(scale)`, so the global Size slider still works on an edited layout. Storing the unscaled number is what makes that possible.
- **`c` becomes an inline `color`** on the mark. Glyph spans take it directly; shape divs take it so the SVG's `currentColor` picks it up.
- A hidden prop is not rendered at all.
- Opacity stays on the field wrapper, never on a mark — Twinkle animates `opacity` and an animation beats an inline value (`QuizParts.jsx`, the note on `GlyphField`).
- Per-mark motion phase stays index-derived (`markMotion`), so removing a prop simply changes who has which phase.

**One deliberate visual change:** a prop's rotation is now **exactly** its `r`. Today a hexagon renders at `r * 0.5` and a balloon at `r * 0.4`. A prop dragged 90° must show 90° and mean 90°, or the editor lies. Default marks keep their old `r` values, so the default hexagon and party backdrops rotate slightly more than they used to. The spread assertions in `quizStudio.test.js` (hexagons/rings/party past 50%/45% of the screen) are unaffected.

### 4.1 The card is not touched

`quizCardRender.js` keeps its own `scatter()`, keeps tiling glyph patterns on a grid, and never reads `backdropLayout`. It changes in exactly one place: `Object.values(PATTERN_GLYPHS[chosen])`. A source-boundary test asserts it never mentions `backdropLayout`; comparing two full 1080×1920 canvases exceeded the renderer test timeout.

## 5. The editor

A sixth tab in `AdminQuizStudio.jsx` (`Look & feel` / `Sound` / `Characters & cast` / `Parts lab` / `Result card` / **`Backdrop`**).

**Left column** — the existing pattern picker (`Choice` grid, unchanged), the existing backdrop sliders, and one line of state: either `18 props · 60 max`, or `No props to arrange — Density sets how big a tile is` for a tiled pattern.

**Centre** — the live preview, reusing `StudioPreview` and its Projector/Phone switch. It renders the **real** `QuizBackdrop`, so the picture is the truth and not a mock.

**Hit layer** — one transparent box per prop, absolutely positioned above the preview with the **same** `left`/`top` percentages as its mark and the mark's **scaled** size (`s × backdropScale`) times `HIT_MARGIN = 1.2`. It uses the same `-backdropBlur` inset as the pattern layer, because marks are percentage-positioned against the blurred layer after it has grown. The preview pauses motion while arranging so animated props cannot slide away from their hit boxes. The margin exists because a glyph's box is not well defined — `fontSize` is a font metric, not a rectangle — and 1.2 is enough to make a 14px symbol hittable with a finger without swallowing its neighbour.

`QuizBackdrop` gains **nothing**: no `editing` prop, no selection state, no handlers. `BackdropPropEditor` is a sibling that sits on top, so a game screen cannot mount half an editor. A source-scan in `quizStudio.test.js` fails the build if `QuizBackdrop` ever grows an `editing`, `selected` or `onPointer` prop.

### 5.1 Interaction

| Action | Result |
|---|---|
| Click a prop | Select it. The inspector opens. |
| Drag a selected or unselected prop | Move it. Percentages follow the pointer; the preview redraws live. |
| `←` `→` `↑` `↓` | Nudge 1%. |
| Shift + arrows | Nudge 5%. |
| `Delete` / `Backspace` | Remove the selected prop. |
| `H` | Hide / unhide. |
| `Esc` | Deselect. |
| `Tab` | Step through props. |
| **Add prop** | A chip row of `propVocabulary(pattern)`. Choosing one drops the prop at `x: 50, y: 50` with `r: 0`, no `c`, and `s` at the **midpoint** of `propSizeRange(pattern)` — already selected, to drag where you want. |
| **Reset** | That pattern back to `defaultBackdropProps`. Within the draft, undoable by not saving. |

Size `−`/`+` steps 2 unscaled pixels, Rotate `−`/`+` steps 5°. A ring is rotationally symmetric, so its inspector has no rotation control and the sanitiser drops its angle rather than storing an unobservable setting.

Hit boxes are real `<button>` elements with `aria-label` (`π at 8, 14`), so the editor is fully operable without a pointer. Drag uses Pointer Events with pointer capture, which covers mouse and touch with one path.

A prop may be placed anywhere including partly off the edge. The preview shows the truth: an admin who pushes a π to 98% sees it clipped on the phone preview, because that is what a phone will do.

**No reordering.** Order affects only which props overlap and which gets which animation phase; delete-and-add gets there.

### 5.2 Inspector

Size `−`/`+`, Rotate `−`/`+`, a colour swatch row (accent plus the four scheme colours `glowA`, `glowB`, `deepA`, `deepB`) with a hex field beside it, Hide, Delete. Clicking the currently-set colour again clears `c` and hands the prop back to the backdrop.

### 5.3 Saving

Everything lands in the studio draft. Nothing is written until the existing **Save look** button, so an afternoon of dragging cannot half-save. The studio's dirty check (`JSON.stringify(sanitizeTheme(draft)) !== JSON.stringify(saved)`) works unchanged, because the layout is part of the sanitised theme.

Because the layout rides inside the theme, a **saved quiz look** carries the arrangement with it, exactly as the colours and the pattern already do.

### 5.4 Cross-quiz looks

A look saved on quiz A and applied to quiz B drops any `k` that B's pattern does not own, and any pattern key B does not use simply sits in the object doing nothing. Both are the sanitiser's normal work; neither is an error worth reporting to an admin.

## 6. Files

| File | Change |
|---|---|
| `supabase/migrations/20261013120000_quiz_theme_layout_size.sql` | Raise the size check on `quizzes.theme` and `quiz_sessions.theme` to 16000. |
| `api/_lib/quizTheme.js` | `PATTERN_GLYPHS` keyed; shape names within `PATTERN_GEOMETRY`; new `propVocabulary`, `defaultBackdropProps`, `propSizeRange`, `cleanLayout`; `DEFAULT_THEME.backdropLayout = {}`; one field in the `sanitizeTheme` literal. |
| `api/_lib/quizCardRender.js` | `Object.values(PATTERN_GLYPHS[chosen])`. Nothing else. |
| `src/components/quiz/QuizParts.jsx` | `GlyphField`/`ShapeField` take `props`; per-mark `c`, `h`, exact `r`; `scatter`/`GlyphField`'s position maths deleted in favour of `defaultBackdropProps`. |
| `src/pages/admin/AdminQuizStudio.jsx` | Sixth tab; the Backdrop body. |
| `src/components/admin/quizStudio/BackdropPropEditor.jsx` | **New.** Hit layer, pointer/keyboard handling, inspector, add/reset. |
| `index.html` | New Material Symbols in the `icon_names=` list, alphabetical. |

## 7. Tests

`api/_lib/quizTheme.test.js`:
- `defaultBackdropProps` reproduces today's scatter index by index, for a glyph pattern and a shape pattern.
- `backdropLayout` cleaning: unknown `k` dropped, a maths `k` rejected on hexagons, `x`/`y` rounded and clamped, `s` clamped to `propSizeRange`, `c` through `cleanHexColor`, `h` coerced, non-arrays and non-objects rejected, the 60 and 150 caps enforced.
- `sanitizeTheme` stays idempotent with a layout present (the existing round-trip test covers it).
- The glyph vocabulary's single-character assertion moves to `Object.values`; every name in each geometry entry's `shapes` list is valid and unique to one pattern.
- "a theme at its largest" gains a maximal layout and asserts the serialised theme still fits, with the margin stated in the comment — this is the migration's proof.

`api/_lib/quizCardRender.test.js`:
- A source-boundary assertion fails if `quizCardRender.js` mentions `backdropLayout`; full-canvas pixel comparison of both versions exceeded the renderer test timeout.

`src/components/admin/quizStudio/quizStudio.test.jsx`:
- No layout present renders markup byte-identical to today.
- With a layout: `c` reaches `color`, `s` is multiplied by `backdropScale`, rotation is exactly `r`, a hidden prop is absent, `x`/`y` reach `left`/`top`.
- Each hit box's `left`/`top` equals its mark's exactly, and its size equals `s × backdropScale × HIT_MARGIN`.
- The Backdrop tab is reachable and its controls render for a prop pattern and for a tiled one.
- Source-scan: `QuizBackdrop` has no `editing`, `selected` or `onPointer` prop.
- Per-mark motion still never overwrites the inline `transform` now that rotation lives on `r`.

`src/lib/iconFont.test.js`: passes only if the new symbols are registered in `index.html`.

## 8. Risks

| Risk | Answer |
|---|---|
| The size bump bites harder than the character count suggests | `pg_column_size` runs a little above the character count. The sanitiser's caps mean the app cannot produce a row past the new limit, and a test builds the true worst case. |
| A composition tuned on 16:9 reads badly on a phone | Named and accepted (decision 7). Only a real handset settles it. |
| Two renderers, two meanings for "the marks" | The vocabulary and the defaults are shared in `quizTheme.js`; only the *drawing* differs, as it already does for every pattern. The card asserts it is unaffected. |
| A hand-typed hex disappears against the backdrop | Accepted (decision 8). `cleanHexColor` keeps it a valid colour; nothing promises contrast, the same as every other colour in the studio. |
| Per-prop colour multiplies the states the card's contrast check has to reason about | The card never reads `c`. |

## 9. Unverified without a real session

**Motion is unverified without a real session, and so is this.** None of the following can be checked without a Supabase login and a real room, and none of them should be described as though it were:

- whether dragging on the real preview feels right, and whether a composition reads at projector distance
- whether an arrangement tuned on 16:9 survives a tall phone
- whether 60 props a pattern and 150 in total is the right ceiling
- dark mode across the swatch set for a recoloured prop
- whether the default hexagons and party backdrops look right after their rotation stops being damped

## 10. Out of scope

- Editing the uploaded **picture** (decision 1: `image` gets no layout).
- Free props from another pattern's vocabulary (decision 5).
- Separate layouts per surface (decision 7).
- Prop reordering (§5.1).
- Multi-select, marquee drag, alignment guides, snapping, snap-to-centre.
- Undo history. **Reset** plus the draft's own not-saving is the whole of it.
