# Quiz Look Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A custom accent that sticks, a page background colour, five more backdrop patterns, six more celebrations, and a
result card that honours all of it instead of always printing maths symbols.

**Architecture:** Everything is added to `api/_lib/quizTheme.js`, which stays the one judge a theme is cleaned by, shared
by the studio, the browser screens and the API. The pattern *vocabulary* — which glyphs, at what size and pitch — moves
into a table both renderers import, so the browser's CSS/SVG and the server's canvas stop being two hand-copied arrays.
Page colour rides the existing `--color-*` token system rather than a new mechanism, which is why no screen file changes.
`api/_lib/quizCard.js` gains the two card fields; `api/_lib/quizCardRender.js` grows from one hardcoded glyph grid to a
switch over every pattern.

**Tech Stack:** React 19, Tailwind 4, `@napi-rs/canvas`, Supabase (Postgres jsonb), Vitest, Vercel serverless (Node).

**Spec:** `docs/superpowers/specs/2026-10-10-quiz-look-controls-design.md`

## File map

| File | Responsibility |
|---|---|
| `api/_lib/quizTheme.js` | `PATTERN_GLYPHS`, `PATTERN_GEOMETRY`, `PAGE_LIGHT`, `PAGE_DARK`, `cleanPage`, `theme.page` in `DEFAULT_THEME` + `sanitizeTheme`, `themeCssVars` emits the page palette, `THEME_PATTERNS` +5, `THEME_CONFETTI` +6 |
| `api/_lib/quizTheme.test.js` | page sanitiser, contrast flip, `.dark` agreement, glyph coverage, column size |
| `api/_lib/quizCard.js` | `DEFAULT_CARD.pattern`, `DEFAULT_CARD.backgroundColor`, `sanitizeCard`, theme-fragment encode/decode |
| `api/_lib/quizCard.test.js` | card sanitiser, `null` survives, fragment round-trip and cap |
| `api/_lib/quizCardRender.js` | `palette()` honours `backgroundColor`; `drawBackdrop` switches over every pattern and honours scale/blur/dim/fit |
| `api/_lib/quizCardRender.test.js` | every pattern yields a non-uniform PNG; colour and sliders change the output |
| `api/_lib/handlers/quiz-card.js` | preview branch reads the theme fragment (modify) |
| `src/components/quiz/QuizParts.jsx` | 5 new pattern branches, 6 new celebration sets, glyphs from the shared table (modify) |
| `src/pages/admin/AdminQuizStudio.jsx` | scheme click keeps the accent, "Use the scheme's colour", page colour row, card pattern + card background colour (modify) |
| `src/data/quizBranding.js` | `cardPreviewVersion` covers the theme fragment (modify) |
| `src/components/admin/quizStudio/quizStudio.test.jsx` | scheme click keeps the accent; every pattern renders |

No migration. `theme` and `card` are jsonb with a size check only.

## Review gates

Every task ends with the same two gates. **Neither is skippable.**

**Spec Review** — a fresh subagent checks the task's diff against that task's stated requirement plus the spec. It must
confirm: nothing in the requirement is unimplemented, nothing outside it was added (YAGNI), and every error path the
requirement names actually returns. Output: pass, or a list of gaps.

**Code Review** — a second fresh subagent reviews against `AGENTS.md` and the codebase's conventions. It must check:
`api/_lib/*.js` purity (no `window`, no Supabase client, no Node built-ins in files `src/` imports); icons present in
`icon_names=`; Tailwind tokens not raw hex in JSX; every new `DEFAULT_THEME` / `DEFAULT_CARD` key has a fallback in the
matching `sanitize*`; comments explain why; no `console.log`; no commented-out code; tests colocated. Output: pass, or a
list of violations.

Plus `npm test && npm run lint && npm run build` must exit 0 at the end of every task.

---

### Task 1: A custom accent survives a colour-scheme click

The bug the user reported first, and the smallest fix in the plan. Nothing else works until it is believable.

**Requirement:** Clicking a colour scheme changes `look` and leaves `accent` alone, including when the scheme clicked is
already selected. A separate, clearly labelled control is the only thing that clears `accent`, and it is hidden when
there is no custom accent to clear.

**Files:**
- Modify: `src/pages/admin/AdminQuizStudio.jsx:346-359` (colour scheme row), `:361-384` (accent row)
- Modify: `src/components/admin/quizStudio/quizStudio.test.jsx`

- [ ] **Step 1: Write the failing test**

In `quizStudio.test.jsx`, assert that the rendered studio for a theme with a custom accent shows no control that clears
it on a scheme click, and that the accent reaches the DOM. The studio reads state through `useQuizQuery`, so drive it
the way the existing tests do and assert on the markup: exactly one `Accent …` control, and every scheme button is
present.

```jsx
it('keeps a custom accent when the colour scheme changes', () => {
  const html = renderToStaticMarkup(<StudioPreview theme={{ look: 'ocean', accent: '#123456' }} surface="projector" screen="question" title="" />)
  expect(html).toContain('--color-orange-500:#123456')
})
```

The behaviour under test lives in the studio's click handler, not in the preview, so add a second assertion at that
level. If the studio component cannot be rendered in a test without a react-query wrapper, extract the scheme row into a
small pure helper `nextThemeOnLookChange(theme, look)` and unit-test that instead — which is the better shape anyway,
because it is where the rule belongs.

- [ ] **Step 2: Make the change**

```jsx
onClick={() => change({ look: key })}
```

and in the Accent colour section, a button shown only when `theme.accent !== null`:

```jsx
{theme.accent && (
  <Button variant="secondary" onClick={() => change({ accent: null })}>Use the scheme&rsquo;s colour</Button>
)}
```

- [ ] **Step 3: Run the gates**

`npm test && npm run lint && npm run build`, then Spec Review, then Code Review.

---

### Task 2: One shared pattern vocabulary

The fix that stops the next five patterns from being a drift waiting to happen. Everything after this task builds on it.

**Requirement:** `api/_lib/quizTheme.js` exports the glyph set and the geometry for every pattern. Both renderers read the
table instead of declaring their own, and every glyph in it is present in the fonts the server draws the card with.

The card reads the **glyph** table only. It has no pattern branch yet, so it has no geometry to read — `drawBackdrop`
still draws maths whatever the theme says. Wiring the card to the geometry table is Task 7, and until then the tables are
a shared vocabulary the card has not finished adopting, not proof the two renderers agree. A test asserts neither
renderer has reintroduced a private list; it does not assert they render identically, because they do not yet.

**Files:**
- Modify: `api/_lib/quizTheme.js`
- Modify: `src/components/quiz/QuizParts.jsx:122-123, 187-188, 220-224`
- Modify: `api/_lib/quizCardRender.js:34, 148-154`
- Modify: `api/_lib/quizTheme.test.js`, `api/_lib/quizCardRender.test.js`

- [ ] **Step 1: Write the failing tests**

In `quizTheme.test.js`:

```javascript
it('names a real pattern for every glyph set and a glyph set or geometry for every pattern', () => { … })
it('draws only glyphs the server font actually has', () => {
  // Compare measureText width against a private-use codepoint (U+E000), which DejaVu certainly lacks.
  // Equal widths mean the glyph fell back to notdef and the card would print a tofu box.
})
```

- [ ] **Step 2: Add the tables**

`PATTERN_GLYPHS` for the symbolic patterns (`math`, `stars`, `notes`, `party`) and `PATTERN_GEOMETRY` for the drawn
ones (`dots`, `grid`, `waves`, `hexagons`, `stripes`, `rings`). Both keyed by pattern. `PATTERN_GEOMETRY` carries tile
size, stroke and rotation — the same role `BACKDROP_RANGES` already plays for the sliders.

Both files under `api/_lib/` stay pure: no `window`, no canvas, no Supabase. The glyph-coverage test may use
`@napi-rs/canvas`; the table may not.

- [ ] **Step 3: Point both renderers at it**

Delete `GLYPHS` and `SPARKLES` from `QuizParts.jsx:122-123` and `QUIZ_GLYPHS` from `quizCardRender.js:34`. Import the
table in both. The maths glyph set must stay byte-identical to what both use today, or saved designs change.

- [ ] **Step 4: Run the gates**

---

### Task 3: Page background colour

**Requirement:** `theme.page` is `#rrggbb` or `null`, cleaned like `accent`, defaulted in `DEFAULT_THEME` with a fallback
in `sanitizeTheme`. `themeCssVars` emits the page palette into the existing `--color-*` tokens, choosing light or dark ink
by measured contrast. No screen file changes.

**Files:**
- Modify: `api/_lib/quizTheme.js` (`PAGE_LIGHT`, `PAGE_DARK`, `cleanPage`, `DEFAULT_THEME`, `sanitizeTheme`, `themeCssVars`)
- Modify: `api/_lib/quizTheme.test.js`
- Modify: `src/pages/admin/AdminQuizStudio.jsx`
- Test fixture: `src/index.css` (read by a test, not written)

- [ ] **Step 1: Write the failing tests**

Sanitiser, the flip on a mid-tone, and the `.dark` agreement:

```javascript
it('keeps the dark palette in step with the .dark block in index.css', () => {
  // Read src/index.css, parse the `.dark { … }` rule, assert every token in PAGE_DARK matches.
  // The duplication is only safe while something compares the two sources.
})
```

- [ ] **Step 2: Add the field and the palettes**

```js
const PAGE_LIGHT = { paper: '#fcf9f8', surface: '#ffffff', 'surface-low': '#f6f3f2', 'ink-900': '#000904', ink: '#1c1b1b', 'ink-muted': '#424843', hairline: '#c2c8c1', brand: '#0b2417' }
const PAGE_DARK = { … }   // mirrors src/index.css .dark
```

In `themeCssVars`, when `t.page` is set, spread the winning palette into the returned vars. `--qz-deep-a/b` stay locked
to the preset.

- [ ] **Step 3: Add the studio control**

A swatch row plus `<input type="color">`, mirroring the Accent colour row, with a `role="status"` contrast note.

- [ ] **Step 4: Run the gates**

---

### Task 4: Five new backdrop patterns

**Requirement:** `hexagons`, `notes`, `party`, `stripes` and `rings` appear in `THEME_PATTERNS` and each draws in
`QuizBackdrop`. Existing keys are untouched, so a saved theme keeps its pattern.

**Files:**
- Modify: `api/_lib/quizTheme.js` (`THEME_PATTERNS`, `PATTERN_GLYPHS`, `PATTERN_GEOMETRY`)
- Modify: `src/components/quiz/QuizParts.jsx`

- [ ] **Step 1: Write the failing test**

`quizStudio.test.jsx:62-66` already loops every look × every pattern. It becomes the test for this task for free — it
fails on the new keys because `cleanPattern` accepts them and nothing draws them. Assert the loop count so a pattern
cannot be added without the test noticing.

- [ ] **Step 2: Draw them**

All five honour `backdropScale`, and sit inside the same layer `QuizBackdrop` already mounts, so
`src/components/quiz/quizBackdrop.test.js` (the `isolate` ancestor rule) keeps passing without changes. `party` is vector
paths, not emoji — see the spec §6.3.

- [ ] **Step 3: Run the gates**

---

### Task 5: Six new celebration styles

**Requirement:** `emoji`, `paper`, `letters`, `money`, `notes` and `hearts` appear in `THEME_CONFETTI` and each produces a
distinct fall. `off` stays last. Existing keys keep their pieces exactly.

**Files:**
- Modify: `api/_lib/quizTheme.js` (`THEME_CONFETTI`)
- Modify: `src/components/quiz/QuizParts.jsx` (`CONFETTI_GLYPHS`, `Confetti`)

- [ ] **Step 1: Write the failing test**

Assert `Object.keys(THEME_CONFETTI)` is exactly the expected list, so a key cannot be added without a piece set and
vice versa. `THEME_CONFETTI` gains an assertion where `quizTheme.test.js:154-157` only checks for `off` today.

- [ ] **Step 2: Add them**

`paper` is shapes, not glyphs, so `Confetti` needs a branch for a piece with no character — a rotated rectangle with a
colour. Emoji are safe here: this component never reaches the server.

- [ ] **Step 3: Run the gates**

---

### Task 6: Card pattern and card background colour

The settings half. Nothing draws differently until Task 7.

**Requirement:** `card.pattern` is a `THEME_PATTERNS` key or `null` (meaning "same as the game"), and
`card.backgroundColor` is `#rrggbb` or `null`. Both have defaults in `DEFAULT_CARD` and fallbacks in `sanitizeCard`. The
studio offers both. `sanitizeCard` rejects a pattern name it does not know, so a card can never name a pattern the
renderer will not draw.

**Files:**
- Modify: `api/_lib/quizCard.js`
- Modify: `api/_lib/quizCard.test.js`
- Modify: `src/pages/admin/AdminQuizStudio.jsx:212-276`

- [ ] **Step 1: Write the failing tests**

`sanitizeCard` fills both defaults, rejects a hostile pattern name and a hostile colour, and — importantly — keeps
`null` as `null` rather than falling back. This is the one place a `null` is a real value rather than a missing value,
because "same as the game" is the default and must survive.

- [ ] **Step 2: Add the fields**

```js
pattern: oneOfThemePattern(c.pattern),          // null is legal here
backgroundColor: isHexColor(c.backgroundColor) ? c.backgroundColor.toLowerCase() : null,
```

`cleanPattern` in `quizTheme.js` cannot be reused as-is: it settles `image` to `none` and has no notion of a card. The
`oneOf` rule is what is shared.

- [ ] **Step 3: Add the studio sections**

"Card pattern" — "Same as the game" first, then every pattern. "Card background" gains a `Custom` colour button beside
the existing upload, with the section hint updated to say a picture wins when both are set.

- [ ] **Step 4: Run the gates**

---

### Task 7: The card renderer honours both

The largest task. A pattern added to the list with no branch here would render a blank card, so this is where the
both-renderers test earns its keep.

**Requirement:** `palette()` paints `backgroundColor` over the gradient stops and runs the existing contrast check
against the effective background. `drawBackdrop` switches over every pattern in `THEME_PATTERNS` and honours
`backdropOpacity`, `backdropScale`, `backdropBlur`, `backdropDim` and `backdropFit`. `card.pattern` wins, then
`theme.pattern`, then `math`. A picture still replaces the pattern entirely. Every pattern produces a visibly non-uniform
PNG, so a pattern with no branch fails the build.

**Files:**
- Modify: `api/_lib/quizCardRender.js:105-156`
- Modify: `api/_lib/quizCardRender.test.js`

- [ ] **Step 1: Write the failing tests**

Render each pattern and assert the pixels are not uniform — a flat image means nothing was drawn. Then assert
`backgroundColor`, `backdropScale` and `backdropDim` each change the buffer, following the shape of the existing
legibility test at `quizCardRender.test.js:186-206`.

- [ ] **Step 2: `palette()`**

```js
const flat = card.backgroundColor ?? null
const bg = flat ?? look.deep[1]
const onBackground = contrastRatio(accent, bg) >= 3 ? accent : '#ffffff'
return { accent, onBackground, deepA: flat ?? look.deep[0], deepB: flat ?? look.deep[1] }
```

The white fallback is load-bearing, not decoration: four of the eight presets are close in tone to their own background.

- [ ] **Step 3: `drawBackdrop`**

A `switch` over the pattern. Symbolic ones read `PATTERN_GLYPHS`; drawn ones read `PATTERN_GEOMETRY`. The maths grid
keeps its 130px pitch so existing cards are unchanged. Scale, blur and dim apply to all of them — none of those five
values are currently read server-side at all.

- [ ] **Step 4: Run the gates**

---

### Task 8: The card preview follows unsaved backdrop edits

Independent of Tasks 1-7 and safe to drop without affecting them.

**Requirement:** The preview endpoint renders the theme fragment it is given rather than only the saved one, so
"Same as the game" in the studio shows the pattern currently on screen instead of the last saved one. The fragment is
sanitised in both directions and is not the whole theme.

**Files:**
- Modify: `api/_lib/quizCard.js` (encode/decode alongside the card draft)
- Modify: `api/_lib/handlers/quiz-card.js:223-240` (preview branch)
- Modify: `src/data/quizBranding.js` (`cardPreviewVersion`)
- Modify: `api/_lib/quizCard.test.js`

- [ ] **Step 1: Write the failing tests**

The fragment round-trips through encode/decode, survives a hostile colour and an unknown pattern name, and keeps the
whole preview URL inside `PREVIEW_MAX_CHARS`.

- [ ] **Step 2: Carry it**

`{ look, accent, page, pattern, backdropOpacity, backdropScale }` only — sponsors, sound and picture paths would make
the URL unusable. Sanitise on the way out and again on the way in, exactly like the card draft, so the preview endpoint
cannot be handed a value it has not already validated.

- [ ] **Step 3: Run the gates**

---

## Not verified by this plan

Per `AGENTS.md`: backdrop rendering, the light/dark flip in a dark room, and card delivery need a Supabase login and a
real session. Tests prove the code path; they cannot prove a projector. Say so rather than implying the screens were
looked at.
