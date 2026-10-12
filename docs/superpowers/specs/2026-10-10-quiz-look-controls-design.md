# Quiz Look Controls Design

The Quiz Design Studio could not keep a custom colour, had no way to change the page background, offered five backdrop
patterns and three celebrations, and the result card ignored all of it — it always drew maths symbols no matter what was
chosen.

**Status:** approved. **Date:** 2026-10-10. **Plan:** `docs/superpowers/plans/2026-10-10-quiz-look-controls.md`

---

## 1. Scope

### In

| Area | Change |
|---|---|
| Accent colour | A custom accent survives a colour-scheme click; an explicit button clears it |
| Page background | A per-quiz page colour, with the text flipping light/dark to match |
| Backdrop patterns | +5: Hexagons, Music notes, Party shapes, Diagonal stripes, Rings |
| Celebration | +6: Emoji party, Coloured paper, Quiz letters, Money, Music notes, Hearts |
| Result card | Its own backdrop pattern picker (defaults to "same as the game") and a background colour |
| Card rendering | Every pattern drawn server-side; `backdropScale` / `Blur` / `Dim` / `Fit` honoured |
| Vocabulary | One shared glyph + geometry table, replacing two hand-copied arrays |

### Out

- **The dark banner gradient** (`--qz-deep-a/b`, the `qz-deep` panels behind "Join the game" and the podium). It carries
  white text by construction and is already per-scheme. Unchanged.
- **A theme editor** — building a whole bespoke scheme from scratch. Custom accent plus custom page colour is the escape
  hatch; a future spec can add editable glow/deep pairs.
- **Per-pattern opacity/size.** The existing Strength/Size/Blur/Fade sliders already drive every pattern.
- **Phone-specific backdrops.** `QuizBackdrop` deliberately takes `surface` so a picture reaches the projector only. A
  pattern is cheap enough to draw on both and stays there.
- **The award cards** (`api/_lib/awardCardRender.js`). A different feature with a different column.

---

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Custom accent vs scheme | Clicking a scheme **keeps** the custom accent; a separate button clears it | An admin who has dialled in a colour and then checks a different scheme loses it today, silently. That reads as "custom colours don't work" |
| Page colour storage | One `page` hex on the theme, same rule as `accent` | One field, not a gradient. The gradient already exists on the banner |
| Light/dark text | Chosen by **measured contrast**, not a lightness threshold | A mid-grey page is exactly where a fixed threshold guesses wrong. `contrastRatio` already exists and is tested |
| How the flip reaches the screens | Override the existing `--color-*` tokens inside `QuizThemeScope` | The screens already read `bg-paper` / `text-ink-900`. Zero edits to `HostQuiz`, `PlayQuiz` or any screen, and `bg-paper/85` bars follow for free |
| New patterns | Shared glyph + geometry table in `quizTheme.js` | `QuizParts.jsx:122` and `quizCardRender.js:34` are hand-copied today with no test. Adding patterns to a table both sides import is the fix, not the duplication |
| Card pattern | Its own picker, `null` = "same as the game" | A card is a shareable image with its own audience; but "same as the game" must be the default so the common case is no extra decision |
| Card background | One solid colour, `null` = the scheme's gradient | Same reasoning as the page colour. A gradient picker is two controls to get wrong for a card that is one image |
| Emoji on the card | **Banned.** Party shapes are vector paths; notes use `♪ ♫ ♩` | The server ships DejaVu + Public Sans + Playfair only (`api/_lib/fonts/`) — no emoji font. 🎈 renders as tofu |
| Emoji in celebration | Allowed | `Confetti` is a browser component and never reaches the canvas |
| Card preview | A ~60-char theme fragment joins the card draft on the URL | Otherwise "same as the game" shows the last **saved** pattern until save, and the feature looks broken |
| Migration | None | `theme` and `card` are jsonb with a size check only; ~30 chars against a 2,100-of-4,000 budget |

### The two calls made without asking

The user was asked whether the card preview should follow unsaved edits and whether to keep the exact pattern and
celebration lists they had ticked, and answered with a process instruction instead. Both were decided as **yes** and
**as ticked**, and are flagged here so either is a one-line reversal.

---

## 3. The defects this fixes

### 3.1 A custom accent is deleted by clicking a colour scheme

`src/pages/admin/AdminQuizStudio.jsx:349`:

```jsx
<Choice key={key} selected={theme.look === key} onClick={() => change({ look: key, accent: null })} …>
```

Every scheme button, **including the one already selected**, unconditionally writes `accent: null`. An admin who picks a
custom colour and then touches the row — or merely re-clicks their own scheme — silently loses it. There is no warning
and no undo; the button just jumps back to the preset.

This is the whole of "I can't use custom colours on the colour screen".

### 3.2 There is no background colour control, because there is no background colour

`DEFAULT_THEME` (`api/_lib/quizTheme.js:113`) has exactly one colour field, `accent`. There is no `background`, `page` or
`surface` key, and therefore no `clean*` fallback for one either.

The two backgrounds a quiz actually has both come from somewhere an admin cannot reach:

- The **page** is the site token `--color-paper` (`src/index.css:13`, `#fcf9f8`), used as `bg-paper` on every quiz
  screen. `QuizThemeScope` never overrides it.
- The **banner** is `--qz-deep-a/b`, which `themeCssVars` (`quizTheme.js:285-286`) reads **only** from the preset. A
  custom accent cannot touch it — by design, see Scope.

So "I can't change the background colour" is not a broken control. It is an absent one.

### 3.3 The result card ignores every backdrop choice

`api/_lib/quizCardRender.js:34` hardcodes:

```js
const QUIZ_GLYPHS = ['π', 'Σ', '∫', '√', 'Δ', 'λ', 'θ', '∞', '≈', '±']
```

and `drawBackdrop` (lines 145-155) draws them unconditionally. `theme.pattern` is never read. Measured against the
renderer: `backdropOpacity` is used; `pattern`, `backdropScale`, `backdropBlur`, `backdropDim` and `backdropFit` are all
dead server-side. Choosing Dots on the screens still puts maths symbols on the card.

The card's background is also a picture **or** a gradient locked to `THEME_LOOKS[t.look].deep` — the studio's "Card
background" section (`AdminQuizStudio.jsx:238`) accepts a file and nothing else.

### 3.4 The glyph lists can drift, and nothing would say so

`src/components/quiz/QuizParts.jsx:122` and `api/_lib/quizCardRender.js:34` hold byte-identical arrays maintained by hand.
Contrast this with sound, where `THEME_MUSIC` ↔ `STYLES` and `THEME_EFFECTS` ↔ `EFFECT_GROUPS` are asserted equal by
`src/lib/quizSound.test.js:303-354`. The precedent exists; the quiz theme just never adopted it.

### 3.5 One adjacent defect, recorded and left alone

- **"My image" does not stick.** `cleanPattern` (`quizTheme.js:299-302`) turns `pattern: 'image'` into `'none'` when the
  picture is missing or rejected by `cleanPath`, but the studio's selected-state reads the raw draft
  (`AdminQuizStudio.jsx:474`). The button stays lit while the preview, the saved row and every real game render Plain.

The card preview is the mirror image of this one and **is** fixed (§8.3): the endpoint rendered the saved theme, so the
card's "same as the game" pattern showed the last *saved* backdrop until save. Fixed in Task 8 by carrying a six-field
theme fragment on the preview url. The two are separate defects with separate causes — one is the studio reading the wrong
field, the other is the endpoint reading the wrong row — so fixing one would not have fixed the other.

---

## 4. Data model

Two new keys on the theme, two on the card. No migration: both columns are jsonb with a size check only.

### 4.1 `theme.page`

```js
page: null,   // '#rrggbb' or null
```

Cleaned exactly as `accent` is — `isHexColor` or nothing:

```js
page: isHexColor(t.page) ? t.page.toLowerCase() : null,
```

`null` means "the scheme's page", which is the light cream `--color-paper`. Default `null` in `DEFAULT_THEME`, fallback in
`sanitizeTheme`. Per the AGENTS.md rule, a new `DEFAULT_THEME` key needs both, or a hand-edited row can put junk on the
projector.

### 4.2 `card.pattern` and `card.backgroundColor`

```js
pattern: null,          // a THEME_PATTERNS key, or null = same as the game
backgroundColor: null,  // '#rrggbb' or null = the scheme's gradient
```

`card.pattern` is cleaned by the same `oneOf(THEME_PATTERNS, …)` rule as the theme's, so a card can never name a pattern
the renderers do not know. `null` is a legal value here and means "follow the game", so unlike `cleanPattern` there is
no fallback to a neutral — the fallback for `null` is `null`.

---

## 5. Page colour and the light/dark flip

### 5.1 Two palettes, chosen by measured contrast

`quizTheme.js` gains `PAGE_LIGHT` and `PAGE_DARK`, token maps covering exactly the vars the quiz screens read:

| Token | Role |
|---|---|
| `--color-paper` | the page itself, and every translucent `bg-paper/85` bar |
| `--color-surface` | cards and the header bar |
| `--color-surface-low` | chips, wells, inputs |
| `--color-ink-900` | headings and the default body ink |
| `--color-ink` | body text |
| `--color-ink-muted` | secondary text |
| `--color-hairline` | borders |
| `--color-brand` | links and focus rings |

`PAGE_DARK` mirrors the `.dark` block in `src/index.css:51-64` exactly. That duplication is deliberate and **enforced**:
a test reads `index.css`, parses the `.dark` block and asserts every token matches, the same way
`src/lib/iconFont.test.js` reads `index.html`. Two sources for one palette is only safe if something compares them.

### 5.2 The flip

`themeCssVars` picks a palette by measurement, not by threshold:

```js
const dark = contrastRatio(page, PAGE_DARK.ink900) > contrastRatio(page, PAGE_LIGHT.ink900)
```

Whichever ink reads better on the chosen page wins. A mid-tone lands correctly instead of on a guessed boundary, and the
existing tested `contrastRatio` does the arithmetic.

### 5.3 Why no per-screen edits

`QuizThemeScope` (`src/components/quiz/QuizTheme.jsx:14`) already sets a style object of CSS variables on a wrapper with
`className="contents"` by default — it adds no box of its own. Overriding the token vars there means every descendant
that already says `bg-paper` picks up the new page automatically. `HostQuiz.jsx:1427` and `PlayQuiz.jsx:297` wrap their
whole app, so the screens need no change at all.

`StudioPreview.jsx:210` wraps only the mock-up frames, so the studio's own cream chrome is untouched — which is exactly
what is wanted: you must be able to see the control panel while previewing a dark page.

One consequence to accept: `QuizBackdrop`'s "Fade back" wash (`QuizParts.jsx:214`) is `bg-paper`, so with a custom page
colour it fades towards *that* colour. That is the correct behaviour — a picture should be washed back to the page it
sits on.

### 5.5 The limit of this: hardcoded chip colours do not follow

The flip covers the eight tokens the pages themselves are made of. It does not cover the handful of places a quiz screen
paints something with a fixed Tailwind colour instead of a token — `text-green-700` on the answer-reveal chip
(`PlayQuiz.jsx:619`), `text-red-600` on the streak chip (`HostQuiz.jsx:709`, `:306`) and the timer ring
(`QuizParts.jsx:113,117`). Measured on a `#0d1310` page those drop to between 2.9:1 and 3.9:1.

This is **not new**: `.dark` overrides the same eight tokens and nothing else, so those chips already lose contrast in
the site's own dark mode. Repainting them is a site-wide colour pass that belongs with the dark-mode work, not with a
page colour that happens to be dark. Recorded here so it is a known edge rather than a surprise on a projector.

A second consequence of the same kind: `--shadow-*` is not in either palette, so cards lose their drop shadow on a dark
page exactly as they do in the site's dark mode today.

### 5.4 What it does not touch

`--color-orange-500`, `--color-orange-600`, `--color-orange-100` and `--color-brand-orange` are already derived from the
accent and are emitted by the existing code. `--qz-deep-a/b` stay locked to the preset (Scope). `--color-green-900` is
the solid brand fill used by buttons and is not part of the quiz's palette.

---

## 6. Backdrop patterns

### 6.1 The list

`THEME_PATTERNS` gains five keys. Existing keys are untouched, so saved themes keep working.

| Key | Label | Draws as |
|---|---|---|
| `hexagons` | Hexagons | Outlined honeycomb, flat-topped, tiled |
| `notes` | Music notes | Scattered glyphs, rotated, larger than the maths set |
| `party` | Party shapes | Balloons, streamer curls, party hats, confetti rectangles |
| `stripes` | Diagonal stripes | A repeating 45° linear gradient |
| `rings` | Rings | Concentric circles in a jittered scatter |

### 6.2 One vocabulary, two renderers

A pattern's **drawing** is necessarily different on each side — CSS/SVG in the browser, canvas paths on the server. Its
**vocabulary** is not, so that is what gets shared:

```js
export const PATTERN_GLYPHS = { math: [...], stars: [...], notes: [...] }
export const PATTERN_GEOMETRY = { dots: {...}, grid: {...}, waves: {...}, hexagons: {...}, stripes: {...}, rings: {...}, party: {...} }
export const PATTERN_UNDRAWN = ['image', 'none']
```

`PATTERN_GLYPHS` for the patterns made of characters, `PATTERN_GEOMETRY` for the ones made of shapes. `party` is in the
second: a balloon and a party hat have no character to fall back on, and an emoji standing in for one is a tofu box on
every card. `image` and `none` are named rather than tabulated, which is what lets the invariant be total — a pattern in
no table and not named here is one a renderer has to silently skip.

`PATTERN_GEOMETRY` carries the tile size, stroke width, rotation and counts, so the browser's `26 * scale` and the card's
equivalent pitch cannot drift. It is the same idea as `BACKDROP_RANGES`, which already exists to stop a slider drifting
from its sanitiser.

Both `QuizParts.jsx` and `quizCardRender.js` import these. The two hand-copied arrays are deleted.

### 6.3 The font constraint, and the test that guards it

`api/_lib/fonts/` holds four families: DejaVu Sans (regular + bold), Public Sans (regular + bold) and Playfair Display.
There is **no emoji font**.

- `notes` uses `♪ ♫ ♩` (U+266A, U+266B, U+2669), which DejaVu covers. Not 🎵 (U+1F3B5), which it does not.
- `party` is drawn as **vector paths** — balloon ellipse + string, streamer curve, hat triangle, confetti rectangles. Not
  emoji. This is not a stylistic preference: an emoji on the card is a tofu box.

A test measures every glyph in `PATTERN_GLYPHS` with `measureText` and compares the width to that of a private-use
codepoint (U+E000), which DejaVu certainly lacks. Equal widths mean the glyph fell back to notdef and the card would
print a box. This test fails the build rather than shipping a broken card.

---

## 7. Celebration

`THEME_CONFETTI` gains six keys. `off` stays last, as `THEME_MUSIC` puts `off` first because it is the default.

| Key | Label | Pieces |
|---|---|---|
| `emoji` | Emoji party | 🎉 🎊 🥳 🙌 🎈 |
| `paper` | Coloured paper | Rotating rectangles and ribbons in mixed colours |
| `letters` | Quiz letters | A B C D — the four answer options |
| `money` | Money | 💰 🪙 💵 💸 🤑 |
| `notes` | Music notes | ♪ ♫ ♩ 🎶 |
| `hearts` | Hearts | ♥ ❤ 💕 |

`paper` is not glyphs at all — it is shapes with a colour, so it needs its own branch in the piece renderer rather than a
character. Emoji are safe here: `Confetti` is a browser component and is never rendered server-side.

---

## 8. The result card

### 8.1 Background colour

`palette()` (`quizCardRender.js:105-114`) becomes:

```js
const page = card.backgroundColor ?? null
const deepA = page ?? look.deep[0]
const deepB = page ?? look.deep[1]
```

A solid colour is painted over both gradient stops, so the fill becomes flat and the existing contrast check still runs:
`contrastRatio(accent, look.deep[1]) >= 3 ? accent : '#ffffff'` moves its second argument to the effective background, so
a card accent that clashes with a custom background still falls back to white rather than printing a muddy score. That
fallback is load-bearing, not decoration — four of the eight presets are close in tone to their own background.

### 8.2 The pattern

`drawBackdrop` becomes a `switch` over `THEME_PATTERNS`, honouring `backdropOpacity`, `backdropScale`, `backdropBlur`,
`backdropDim` and `backdropFit`. `card.pattern` wins; otherwise `theme.pattern`; otherwise `math`. The picture still
replaces the pattern entirely — two busy layers read as noise, and that judgement has not changed.

A card is 1080×1920 and the maths grid is drawn at a 130px pitch. The other patterns are scaled to that canvas rather than
copied from the browser's rem-based CSS, but their geometry comes from `PATTERN_GEOMETRY` so the proportions survive.
`backdropScale`, `backdropOpacity`, `backdropBlur` and `backdropDim` are all honoured — `backdropDim` as a wash over an
uploaded picture, as the browser does it.

**Blur is applied to a finished layer, not to the marks.** Setting `ctx.filter` and then issuing the few thousand draw
calls a pattern needs pushes every one of them through the filter pipeline: measured at over two minutes for a single card,
which would time the request out on Vercel. Drawing the pattern on its own canvas and compositing it once under the filter
costs about 13ms. This is the reason `drawBackdrop` is exported: proving a pattern draws something by rendering whole cards
meant thirty React character renders per test, which is minutes of suite time for a question about the bottom layer alone.

### 8.3 The preview

`servePreview` reads the **saved** theme; only the card draft travels the URL. A small fragment —
`{ look, accent, page, pattern, backdropOpacity, backdropScale }` — joins it, so the card preview follows unsaved backdrop
edits the same way it already follows unsaved card edits (`quizCard.js:37-39`). It is deliberately **not** the whole
theme: sponsors, sound and picture paths would make the URL unusable, and `PREVIEW_MAX_CHARS` is 700.

The theme fragment is sanitised on the way out and on the way in, exactly like the card draft, so the preview endpoint
cannot be handed a colour or a pattern name it has not already validated.

---

## 9. Studio

Four new or changed controls on `/admin/quizzes/:id/studio`.

### 9.1 Colour scheme

Clicking a scheme changes `look` and nothing else. A separate **"Use the scheme's colour"** button clears `accent`, and
is the only thing that does. The button is hidden when `accent` is already `null`, so it appears exactly when there is
a custom colour to discard.

### 9.2 Page colour

A row of swatches (cream, midnight ink, deep green, midnight navy, plum, slate) plus a `<input type="color">`, mirroring
the existing Accent colour row. A contrast note appears when the text on the chosen page would be hard to read, using
`contrastWithWhite` or its inverse as appropriate.

### 9.3 Backdrop and Celebration

No structural change. Both grids read `THEME_PATTERNS` and `THEME_CONFETTI`, so the new keys appear on their own.

### 9.4 Result card

Two new sections on the Card tab:

- **Card pattern** — "Same as the game" first, then every pattern.
- **Card background** gains a `Custom` colour button beside the existing upload. Picture wins when both are set, which is
  what the section already says.

---

## 10. Tests

| Test | Asserts |
|---|---|
| `api/_lib/quizTheme.test.js` | `page` sanitiser rejects junk; CSS vars flip light/dark on a mid-tone; `PAGE_DARK` equals the `.dark` block in `index.css`; every `DEFAULT_THEME` key has a sanitiser fallback; column size still under budget |
| `api/_lib/quizTheme.test.js` (new) | every glyph in `PATTERN_GLYPHS` is present in DejaVu; every glyph set names a real pattern; every pattern is in exactly one of glyph/geometry |
| `api/_lib/quizCardRender.test.js` | every pattern produces a non-uniform PNG; a pattern with no branch fails loudly; `backgroundColor` changes the output; scale/blur/dim change the output |
| `api/_lib/quizCard.test.js` | `pattern` and `backgroundColor` sanitised; `null` survives as `null`; the preview fragment round-trips and is capped |
| `src/components/admin/quizStudio/quizStudio.test.jsx` | clicking a scheme does not clear the accent; every pattern × every look renders (the existing loop, now over 12 patterns) |
| `src/components/quiz/quizBackdrop.test.js` | unchanged — the `isolate` ancestor rule still holds for every new pattern, since they all mount inside the same layer |
| existing shape assertions | `quizHandlers.test.js`, `quizSound.test.js` updated for the new theme keys |

The rule the pattern tests enforce: **a pattern cannot be added to `THEME_PATTERNS` without a branch in both renderers.**
The browser loop already gives this for free (`quizStudio.test.jsx:62-66`); the card needs the same idea, or a pattern
silently renders nothing on a shareable image.

---

## 11. Accessibility

- Nothing is communicated by colour alone. Every choice in the studio is a labelled control, and the pattern buttons
  carry text, not just a swatch.
- The contrast warning on a dark page colour is a `role="status"` line, matching the existing accent one.
- A page colour that cannot be read on a projector is warned about, not silently refused — the same posture the accent
  row takes today.
- Touch targets are unchanged: the new pattern and celebration buttons reuse `Choice`, which is already used everywhere.

---

## 12. Risks

- **Unverified without a real session.** Backdrop rendering, the light/dark flip in a dark room and card delivery all
  need a Supabase login and a real game. Tests prove the code path; they cannot prove a projector.
- **`PAGE_DARK` duplicates `.dark` in `index.css`.** Two sources for one palette. The source-reading test is what makes
  that safe — if it is deleted, the duplication becomes a bug waiting for a dark-mode change.
- **Twelve patterns across two renderers** is a lot of surface for a shared table to keep honest. The glyph-coverage
  test and the both-renderers test are the only things standing between a new pattern and a blank card.
- **The dark page colour is new territory.** The studio chrome stays cream while the preview goes dark, which is correct
  but may read oddly on first use.
