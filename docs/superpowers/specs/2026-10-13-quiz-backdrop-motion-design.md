# Quiz Backdrop Motion Design

The quiz Design Studio can change every part of the backdrop except whether it moves. Twelve patterns, four sliders, a
picture upload and a fit mode — and all of it is frozen. The projector shows a still wall of maths symbols for a whole
evening, and the one thing an audience notices about a big screen is that nothing on it is alive.

**Status:** approved. **Date:** 2026-10-13. **Plan:** `docs/superpowers/plans/2026-10-13-quiz-backdrop-motion.md`

---

## 1. Scope

### In

| Area | Change |
|---|---|
| Theme shape | Three fields: `backdropMotion`, `backdropMotionSpeed`, `backdropMotionOnPhones` |
| Styles | Eight named loops, plus `off`: drift, orbit, breathe, bounce, float, cascade, twinkle, pan |
| Speed | One 1–5 slider labelled Calm / Gentle / Steady / Brisk / Lively |
| Phones | A separate toggle, so the projector can move while fifty handsets stay still |
| Screens | Every visible backdrop can animate; image backdrops remain projector-only, and the phone toggle only affects backdrops actually drawn on phones |
| Accessibility | Every new class joins the existing `prefers-reduced-motion` block |

### Out

- **Animation on the result card.** The card is a static PNG drawn server-side (§2).
- **Stacking several styles.** One style at a time, chosen from a list. The admin asked for a picker, not toggles, and a
  theme with three simultaneous motions is a theme nobody can tune.
- **Motion amplitude control.** Speed only. "How far it moves" is what the existing Size and Strength sliders already do
  to the marks themselves.
- **Motion on the award cards** (`api/_lib/awardCardRender.js`). A different feature with a different column, and it never
  read the quiz theme.
- **Per-screen motion.** No way to animate the question screen but not the lobby. The one exception is phones vs projector,
  which is in scope because fifty animated handsets is a battery question, not a taste question.

---

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Result card | **Still.** `quizCardRender.js` is untouched | A card is one image downloaded once and often re-shared for days. There is no frame rate to animate it at. Baking one offset frame would also mean every card a quiz produces looks different, for a difference nobody consciously chose |
| Styles vs toggles | A single `backdropMotion` naming one of eight | Asked for. It also keeps the field to one string, which is what the 4,000-byte `theme` budget and the allow-list sanitiser both prefer |
| Default | `off`, for every existing quiz | A projector may already be on air. Games snapshot `theme` at start (`handlers/quiz-create.js:111`), so a new default can never restyle a running game — but it would restyle every *next* game, unasked |
| Speed | 1–5 slider with the five labels printed under the ticks | A named stop is friendlier than a bare number, but a fixed 1–5 range is testable the way `BACKDROP_RANGES` already is. Storing the number keeps the sanitiser's `num()` path unchanged |
| Phones | Separate boolean toggle, default on | The admin asked for it, and it is the one surface where "will this drain the room's batteries" is a real objection. Default on because the toggle is moot while `backdropMotion` is `off`. If the selected pattern is an uploaded image, phones draw no backdrop at all and motion resolves to off there regardless of the toggle |
| Whole-layer styles | Animate `transform` on the one layer `QuizParts.jsx:305` already sizes | Dots, grid and stripes are CSS gradients; animating `background-position` is a repaint per frame on every device in the room. One transform path covers all four styles and all twelve patterns and stays on the compositor |
| Per-mark styles | Animate the CSS `translate` property, not `transform` | Marks already carry an inline `transform: rotate(…) scale(…)` (`QuizParts.jsx:160`, `:206`). An animation writing `transform` silently discards that rotation. `translate` is a separate property that composes with it, so no field has to be restructured |
| Durations | A shared table in `quizTheme.js`, applied inline | Same shape as `Confetti` (`QuizParts.jsx:368`), which already sets `animationDuration` from a JS table. Keyframe *names* stay out of the pure file — that is the `characters.css` boundary |
| Picture-only styles | `pan` is greyed out **and** falls back to `off` | Asked for, and it mirrors `cleanPattern` (`quizTheme.js:311`), which already turns `pattern: 'image'` into `none` when the picture is missing. Both halves are needed: the studio for a real admin, the sanitiser for a hand-edited row |
| Markless patterns | Per-mark styles resolve to a whole-layer stand-in at render time | See §5.2. Six of twelve patterns have no discrete marks to float, and greying out three of eight buttons across those patterns is a picker nobody can read |

### The two calls made without asking

The user was asked what "bounce" should do and answered "what u recommend", and answered the speed question with "1 and 2".
Both are recorded here so either is a one-line reversal: **bounce is a whole-backdrop springy scale** (§5.1), and **speed is
one 1–5 slider whose ticks carry the five labels** — which is what "1 and 2" describes once the two options stop being
alternatives.

---

## 3. The gap this fills

`DEFAULT_THEME` (`quizTheme.js:200-222`) has no animation, loop, drift, float, spin or duration field of any kind.
`BACKDROP_RANGES` (`quizTheme.js:193-198`) has four entries and all four are static. The only motion in the live quiz is
one-shot entrance animation (`qz-pop`, `qz-rise`, `qz-grow`), the confetti fall, and the characters' own move vocabulary
(`api/_lib/quizCharacterArt.js:86`) — and the backdrop is in none of them.

This is not a gap in the vocabulary either. `PATTERN_GLYPHS` and `PATTERN_GEOMETRY` (`quizTheme.js:81-102`) hold
characters and measurements, and nothing else. There is no existing vocabulary a motion style has to fit into; it has to
be built.

The one thing the repo does already have is a precedent for exactly this shape: a **named motion, chosen by an author, acted
on by a stylesheet** — `IDLE_MOVES` and `WIN_MOVES` in `quizCharacterArt.js:86-87`, dispatched by `characters.css:93-98`.
The backdrop is the second consumer of that idea, and unlike the first it does not need to survive a server-side SVG
serialiser, because the card is out of scope.

### 3.1 The three places a new theme field has to be added

`sanitizeTheme` (`quizTheme.js:325-352`) is an allow-list by construction: it builds a fresh literal and returns it, so a
key it does not name cannot survive. A `backdrop.motion` added to `DEFAULT_THEME` alone is dropped silently, and nothing
logs it. Three edits are required, and they are the same three every previous field needed:

1. `DEFAULT_THEME` (`quizTheme.js:200`)
2. The returned literal in `sanitizeTheme` (`quizTheme.js:329`)
3. `BACKDROP_RANGES` — **only if** the field is a slider, and the name must derive correctly (§4.2)

---

## 4. Data model

### 4.1 The three fields

Flat, because all six existing backdrop fields are flat and `quizTheme.test.js:504` derives field names mechanically from
`BACKDROP_RANGES`.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `backdropMotion` | key of `THEME_BACKDROP_MOTION` | `'off'` | Which loop, or none |
| `backdropMotionSpeed` | int 1–5 | `3` | How fast, `3` being the reference speed |
| `backdropMotionOnPhones` | boolean | `true` | Whether handsets animate too |

`backdropMotionOnPhones` follows the `showSponsors` shape (`quizTheme.js:347`): `!== false`, so anything that is not an
explicit `false` animates. That matches how every other on/off in this file is read, and it means a hand-edited row that
lost the field gets the common case rather than the quiet one.

Three short fields against a 4,000-byte `pg_column_size` budget, of which the fullest theme already spends ~2,100
(`20260930190000_quiz_theme.sql`). No migration: both columns are jsonb with a size check only.

### 4.2 Why the speed range is named `motionSpeed`

`quizTheme.test.js:504` builds the field name as `` `backdrop${name[0].toUpperCase()}${name.slice(1)}` `` and round-trips
`min` and `max` through `sanitizeTheme`. A range named `motion` derives the field `backdropMotion` — which is the **style**,
not the speed, and the test would then be asserting that the *style* field round-trips 1 and 5.

So the range is `motionSpeed`, deriving `backdropMotionSpeed`. The test then covers the speed slider for free, and the one
place where the naming convention has to bend is visible in the diff.

```js
export const BACKDROP_RANGES = {
  opacity: { min: 0, max: 100, step: 1, unit: '%' },
  scale: { min: 50, max: 200, step: 5, unit: '%' },
  blur: { min: 0, max: 24, step: 1, unit: 'px' },
  dim: { min: 0, max: 90, step: 5, unit: '%' },
  motionSpeed: { min: 1, max: 5, step: 1, unit: '' },
}
```

### 4.3 The vocabulary

```js
// 'off' is first because it is the default. The eight after it are one loop each, named for what an admin sees rather
// than than how it is drawn: nothing in a theme may be free text that reaches CSS.
export const THEME_BACKDROP_MOTION = {
  off: 'Still',
  drift: 'Drift',
  orbit: 'Orbit',
  breathe: 'Breathe',
  bounce: 'Bounce',
  float: 'Float',
  cascade: 'Cascade',
  twinkle: 'Twinkle',
  pan: 'Pan',
}

// The one style with nothing to move but a photograph. Kept beside PATTERN_UNDRAWN, which does the same job for patterns.
export const MOTION_PICTURE_ONLY = ['pan']

// The styles that need discrete marks to move individually. Everything else moves one layer.
export const MOTION_PER_MARK = ['float', 'cascade', 'twinkle']

// What a per-mark style becomes on a pattern with no marks to move. See 5.2.
export const MOTION_MARKLESS_STANDIN = { float: 'breathe', cascade: 'drift', twinkle: 'breathe' }

// Seconds per cycle at the reference speed of 3. Speed divides, so Lively (5) is 1.67x and Calm (1) is a third.
export const MOTION_DURATIONS = {
  drift: 44, orbit: 58, breathe: 16, bounce: 4.5, float: 7, cascade: 9, twinkle: 6, pan: 30,
}

export const MOTION_SPEED_LABELS = ['Calm', 'Gentle', 'Steady', 'Brisk', 'Lively']

// Translation amplitude and independent bleed, both as percentages. Bleed covers the expanded layer's own transform
// reference box plus Orbit's vertical and rotational excursion on portrait and landscape screens.
export const MOTION_DISTANCE = { drift: 5, orbit: 5 }
export const MOTION_BLEED = { drift: 15, orbit: 15 }
```

`MOTION_DURATIONS` has no `off` entry and no picture key; `off` never reaches a duration lookup, and `pan` is in there
because the photograph moves even though the pattern layer does not.

---

## 5. The eight styles

### 5.1 The list

| Key | Label | What moves | Layer | Works on |
|---|---|---|---|---|
| `drift` | Drift | the whole pattern slides sideways and back | one | every drawn pattern, on both enabled surfaces |
| `orbit` | Orbit | the same slide, diagonally, with a gentle tilt | one | every drawn pattern, on both enabled surfaces |
| `breathe` | Breathe | the whole backdrop swells in and out, slowly | one | every drawn pattern, on both enabled surfaces |
| `bounce` | Bounce | the whole backdrop springs outward in scale with overshoot | one | every drawn pattern, on both enabled surfaces |
| `float` | Float | each mark bobs on its own phase | marks | marked patterns; layer stand-in otherwise |
| `cascade` | Cascade | each mark falls across the viewport, fading out as it goes | marks | marked patterns; layer stand-in otherwise |
| `twinkle` | Twinkle | each mark fades in and out softly | marks | marked patterns; layer stand-in otherwise |
| `pan` | Pan | the uploaded picture zooms and drifts | picture | projector with `image`; still zoom retained under reduced motion |

**Bounce is a springy scale, not a hop.** `breathe` is the slow organic swell; `bounce` is the same axis with overshoot and
a fourth of the cycle, so it reads as a trampoline rather than a pulse. The alternative — each mark hopping on its own
phase — was rejected because `float` and `cascade` already move marks vertically, and a third vertical mark motion would
have been the same idea twice.

### 5.2 Six of twelve patterns have no discrete marks

`math`, `notes`, `stars` (glyph fields) and `hexagons`, `rings`, `party` (`ShapeField`) draw discrete marks that can each
carry their own animation. `dots`, `grid`, `stripes` and `waves` are continuous: a tiled gradient or a single SVG band.
`image` draws one photograph on the projector and nothing on phones; `none` draws nothing anywhere. That makes six
patterns with no discrete marks, though `none` resolves to Still and `image` uses its picture on the projector.

Rather than grey out three buttons whenever the pattern changes, each per-mark style resolves to a whole-layer stand-in:

| On a markless pattern | `float` | `cascade` | `twinkle` |
|---|---|---|---|
| becomes | `breathe` | `drift` | `breathe` |

This resolution happens **at render time, not in the sanitiser.** The stored value stays whatever the admin picked, so
switching Dots → Maths → Dots restores Float rather than silently leaving the admin on Breathe. The studio names the
substitution on the button — "Float · becomes Breathe on Dots" — so it is never a surprise on the projector.

This is deliberately **different** from `pan`, which is *rejected* rather than resolved (§6). The distinction is
categorical: a photograph panned with no photograph is a settings error with no synonym, whereas marks that cannot float
because there are none still have an obvious near-equivalent.

`pattern: 'none'` resolves to `off` outright. There is nothing to animate, and a drifting empty div is waste.

### 5.3 Looping without a jump

Three of these cannot loop by simply repeating, and getting it wrong is the single most visible way this feature could
look broken:

- **Drift and orbit** translate. Repeating a translate snaps back to the start. Both **ping-pong** with
  `animation-direction: alternate`, so the reversal is the loop rather than a jump. This is also why they cannot use the
  translate-by-one-tile trick that works for a seamless gradient — a tiled gradient has no period a scattered glyph
  pattern shares.
- **Cascade** falls across the viewport. Its `vh` travel distance is relative to the screen rather than the mark's own
  tiny transform box; repeating would teleport every mark from the bottom to the top. It copies `qz-fall`
  (`index.css:165-169`), which is invisible-reset instead: `opacity: 0` at 0%, in by 12%, out by 100%. The confetti has
  shipped this way for a year. Cascade adds no rotation and is much slower.
- **Breathe, bounce, float and twinkle** return to their start state naturally, and loop by repeating.

### 5.4 Phases come from the index, never from a random number

`scatter` (`QuizParts.jsx:134`) and `GlyphField` (`QuizParts.jsx:144`) both place marks from the index rather than
`Math.random()`, and the comment at `QuizParts.jsx:126` says why: a backdrop that rearranges itself on reload reads as a
bug, and a card and a screen showing the same theme must put their marks in the same spots.

Per-mark motion keeps that promise and adds one more rule. `animationDelay` is **negative**, derived from the index —
`-(((i * 7) % 11) / 11) * duration` — so the marks are already mid-loop on first paint. Positive delays would make every
mark start together, which reads as a single pulse and then settles: a visible "wind-up" in the first second of a game.

---

## 6. Sanitisation

```js
function cleanMotion(value, pattern) {
  const motion = oneOf(THEME_BACKDROP_MOTION, value, DEFAULT_THEME.backdropMotion)
  // A picture has nothing to pan without a picture, and there is no synonym for it: the same double defence
  // cleanPattern applies to 'image' with no upload. `pattern` rather than `image` on purpose — a kept picture with a
  // changed pattern should stop panning, not keep panning the picture nobody is drawing.
  return MOTION_PICTURE_ONLY.includes(motion) && pattern !== 'image' ? DEFAULT_THEME.backdropMotion : motion
}
```

Testing `pattern`, not `image`, matters: an admin can upload a photo, choose Pan, then switch the pattern to Maths and
keep the picture for later. The picture survives `cleanPath` for exactly that reason (`quizTheme.js:471`). Panning it
anyway would be an animation of nothing.

Nothing else is cleaned beyond `num(BACKDROP_RANGES.motionSpeed, …)` and `!== false`, because `THEME_BACKDROP_MOTION` is
a fixed list and `oneOf` already rejects `__proto__`, `constructor` and arrays-as-strings (`quizTheme.js:245`).

---

## 7. How motion reaches the screens

### 7.1 The layer

`QuizBackdrop` (`QuizParts.jsx:300-409`) already renders the right box. The inner layer's `inset` comes from `softened`
(`QuizParts.jsx:328-337`): blur grows it in px, and the translating styles grow it equally on all four sides by
`MOTION_BLEED`. `MOTION_DISTANCE` is the amplitude, not the bleed — percentages in `translate` are measured against the
already-expanded layer, and Orbit also moves vertically and rotates.

The motion layer is therefore that same div, with `transform` and `will-change: transform` added. Bounce never scales
below 1, so scaling does not expose an edge.

`pan` animates the `<img>`'s own transform at `QuizParts.jsx:357-362`. Its inline transform always retains the Size slider's
static zoom, and the keyframes multiply an additional zoom and drift into it. When reduced-motion disables the keyframes,
the static image zoom remains in effect. The loop's minimum zoom stays above 1 so it does not expose the image boundary.

### 7.2 Reduced motion

The new classes join the block at `index.css:267-274` alongside the six that are already there. Pan keeps the configured
static image zoom after its animation is disabled. A motion theme is still legible when frozen — every style is a loop, so
a still frame is a valid still — which is why this is a media query rather than a studio setting an admin has to remember
to use.

---

## 8. Studio

Three controls under the existing Backdrop section (`AdminQuizStudio.jsx:485-587`), after the sliders:

1. **Style** — a row of `Choice` buttons over `THEME_BACKDROP_MOTION`, matching the pattern picker directly above it.
   `pan` is natively disabled and described for assistive technology unless a validated picture is selected.
2. **Speed** — a 1–5 slider over `BACKDROP_RANGES.motionSpeed`, with the five labels under the ticks. Hidden while
   `backdropMotion` is `off`, since there is no speed to set.
3. **Move on phones** — a checkbox. Hidden while `backdropMotion` is `off`; disabled with a reason for any image pattern,
   because phones never draw the uploaded picture or an alternative backdrop (`QuizParts.jsx:302,312`). A phone image
   pattern resolves to Still even if a hand-edited theme enables the toggle, avoiding an invisible animation.

The studio's preview is `StudioPreview` (`StudioPreview.jsx:207-213`), which already renders the **real** `QuizBackdrop`
rather than a mock. Motion therefore appears in the preview with no work, and because it passes `surface`, switching the
preview between Projector and Phone shows the phone toggle taking effect. The existing "a picture shows on the projector
only" hint is the right place to say that Pan is projector-only too.

The result card preview is unaffected and needs nothing: the card never reads a motion field (§2), so `PREVIEW_THEME_KEYS`
(`api/_lib/quizCard.js:65-70`) stays at eight keys.

---

## 9. Tests

| Test | Asserts |
|---|---|
| `api/_lib/quizTheme.test.js` (updated) | the full-theme fixture at `:17` and the snapshot assertions carry the three new keys |
| `api/_lib/quizTheme.test.js` (new) | a bad `backdropMotion` falls back to `off`; `pan` falls back to `off` unless `pattern === 'image'`; a kept picture with a changed pattern stops panning |
| `api/_lib/quizTheme.test.js` (new) | speed clamps 1–5, and `BACKDROP_RANGES.motionSpeed` is round-tripped by the existing mechanical test at `:502` |
| `api/_lib/quizTheme.test.js` (new) | **every key in `THEME_BACKDROP_MOTION` has a duration, `@keyframes`, a matching `animation-name`, and an infinite loop in `index.css`**, source-scanned |
| `api/_lib/quizTheme.test.js` (new) | every style resolves to a drawable loop on supported patterns; `none` resolves to Still and Pan resolves to Still unless a picture pattern is active |
| `api/_lib/quizTheme.test.js` (new) | every per-mark style has a stand-in, and every whole-layer style has no entry in `MOTION_PER_MARK` |
| `src/components/admin/quizStudio/quizStudio.test.jsx` (updated) | the existing every-look × every-pattern loop plus a motion × pattern loop for the projector |
| `src/components/admin/quizStudio/quizStudio.test.jsx` (new) | image phones get no empty animation; Pan retains static zoom; Pan zoom never falls below 1; Drift/Orbit bleed covers all edges; Bounce never shrinks; Cascade uses viewport distance; unavailable Pan is a native disabled button |
| `src/components/quiz/quizBackdrop.test.js` | unchanged — every new class mounts on the layer already covered by the `isolate` ancestor rule |
| existing shape assertions | `quizHandlers.test.js:51` and `:279` gain the three keys |

The rule the new source-scan enforces: **a motion style cannot be added to `THEME_BACKDROP_MOTION` without a `@keyframes`
and a duration.** Without it, a typo in a class name is a silently still projector — the exact failure the pattern
vocabulary tests were written to prevent, in the same place.

Three assertions will **fail on the first run** and are updated rather than avoided. That is the correct outcome: they are
exact-shape assertions on the theme, and the theme's shape is what is changing.

---

## 10. Accessibility

- **Reduced motion is honoured** (`index.css:197`), so the feature is off for anyone who has asked the OS for that. Every
  style is a loop, which means a frozen frame is always a presentable still — no style can look broken when switched off.
- **Nothing is carried by motion alone.** The style is named in text on the button, the speed is a labelled slider, and the
  backdrop never moves text or interactive targets — `QuizBackdrop` is `pointer-events-none` and `aria-hidden` already.
- **The phone toggle is the battery and comfort control.** Fifty handsets is where motion becomes a cost, which is why it
  is a separate switch rather than a per-style detail.
- **Touch targets are unchanged.** The new controls reuse `Choice` and the existing slider primitive.

---

## 11. Delivery order

Each step leaves `npm test` green.

1. **`quizTheme.js`** — the three fields, the four vocabulary exports, `cleanMotion`, the range. Tests 1–3 of §9.
2. **`index.css`** — the `@keyframes`, the classes, the reduced-motion block. Test 4 of §9.
3. **`QuizParts.jsx`** — the layer transform, per-mark phases, the picture pan, the twinkle opacity refactor (§12).
4. **`AdminQuizStudio.jsx`** — the three controls. §8.
5. **AGENTS.md** — the motion note, alongside the existing audio and theme-shape rules.

---

## 12. Risks

- **Unverified without a real session.** Whether any of the eight looks right, whether the ping-pong reversal reads as
  smooth or as a wobble, and whether fifty animated phones hold a battery through a full game all need a Supabase login
  and a real room. Tests prove the code path; they cannot prove a projector.
- **Twinkle is the only style that restructures existing code.** It animates opacity, which every mark currently carries as
  an inline style that an animation would override. Per-mark opacity moves to the field container so the animated value
  has somewhere to live. It is contained to `GlyphField` and `ShapeField`, but it is the one edit here that is not purely
  additive.
- **Nine settings on twelve patterns is a matrix nobody has drawn.** A style that reads well on Maths may read as noise on
  Party Shapes, which draws sixteen large marks where Maths draws fourteen small glyphs. The `bounce` and `cascade`
  durations are the most likely to need retuning after a real look.
- **`MOTION_DURATIONS` is a second source for timing.** Characters keep their durations in `characters.css` and confetti
  derives them in JS. The backdrop follows confetti because its durations depend on a second theme field, which a
  stylesheet cannot read. The source-scan test is what keeps the table and the keyframes from drifting apart.
- **The speed slider bends the naming convention** (`motionSpeed`, §4.2). It is the one place where `BACKDROP_RANGES` no
  longer reads as a clean `backdrop<Name>` mapping, and the reason is recorded here rather than left to be rediscovered.
