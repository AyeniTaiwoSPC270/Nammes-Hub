# Quiz Scheme Colours Design

The Colour scheme row in the Quiz Design Studio could not be customised. It only writes `look`, and a look's own four
colours — the `glow` pair behind every screen and the `deep` pair behind the "Join the game" banner and the podium — are
read straight off the preset in `themeCssVars` and have never been editable.

**Status:** approved. **Date:** 2026-10-12. **Predecessor:** `2026-10-10-quiz-look-controls-design.md`, whose §1 deferred
this ("a future spec can add editable glow/deep pairs").

---

## 1. Scope

### In

| Area | Change |
|---|---|
| Scheme colours | `glowA` / `glowB` / `deepA` / `deepB` on the theme, each `#rrggbb` or `null` |
| Precedence | An explicit colour wins; the scheme's preset is the fallback |
| Studio | Two rows in the existing Colour scheme section: Glow and Banner, each a gradient chip, two pickers and one clear button |
| Banner legibility | A warning when white text would be hard to read on the chosen banner |
| Result card | Follows the theme's banner; the card's own background colour still wins |
| Preview | The card preview follows unsaved banner edits |

### Out

- **Editing the presets themselves.** `THEME_LOOKS` stays code. A built-in scheme is still one row and one click.
- **Auto-flipping the banner's text.** `text-white` is hardcoded on ~10 `qz-deep` panels across 6 files. Repainting
  those is a site-wide colour pass; warning is the cheaper, already-precedented answer.
- **The award cards** (`api/_lib/awardCardRender.js`). A different feature with a different column, and it reads none
  of `THEME_LOOKS` today.
- **The look buttons' own swatches.** A button means "pick this scheme", so it keeps showing the preset's colours.
  The custom colours show on the rows below them.
- **A glow warning.** The glow is two radial gradients at 14% and 12% alpha behind text (`QuizParts.jsx:297`). It cannot
  produce a legibility failure, so a warning would be noise.

---

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| What becomes editable | All four — glow pair and deep pair | The glow is only half the scheme; editing the banner alone leaves a theme whose tint and banner disagree |
| Storage | Four nullable hex keys, same rule as `accent` and `page` | `null` means "the scheme's own colour", so every existing quiz is unchanged and there is nothing to migrate |
| Helper shape | One `withSchemeColors(theme, patch)`, not four `with*` functions | Four near-identical functions is four places a rule can drift; the patch takes the pair an admin is actually editing |
| Clearing | One button per pair; both sides go to `null` together | A half-preset gradient is not a state anyone asked for |
| Pale banner | Warn, do not prevent | The Accent and Page rows already warn rather than refuse, and a picker that silently drops a choice is worse than a legible warning |
| Warning threshold | `contrastWithWhite(stop) < 4.5` | Body-text threshold. Every preset measures ≥ 7 (`quizTheme.test.js:363`), so no built-in scheme can trigger it |
| Card | Follows the theme's banner | A shareable result image that shows a different gradient than the room is the exact defect the card tab already fixes for the backdrop pattern |
| Glow on the card | Still not drawn | The canvas has no radial glow layer; adding one is a renderer feature, not a theme field |

---

## 3. The defect this fixes

`themeCssVars` (`api/_lib/quizTheme.js:405-419`) emits:

```js
'--qz-glow-a': t.accent ?? look.glow[0],
'--qz-glow-b': look.glow[1],
'--qz-deep-a': look.deep[0],
'--qz-deep-b': look.deep[1],
```

Three of the four are unreachable by any admin. `glow[1]` and both `deep` stops are the preset's, always; `glow[0]` is
reachable only as a side effect of the Accent row, which was never intended to also own the tint behind every screen.

The theme row's own hint — "Sets the glow and the dark banner behind every screen" — describes two controls that did
not exist. `sanitizeTheme` had no key to clean because there was nothing to clean.

---

## 4. Data model

```js
glowA: null, glowB: null,   // '#rrggbb' or null
deepA: null, deepB: null,   // '#rrggbb' or null
```

Cleaned by the one `cleanHexColor` the accent and page colours already use (`quizTheme.js:224`), so there is still a
single answer to "what is a colour a theme may hold". All four default to `null` in `DEFAULT_THEME` and fall back to
`null` in `sanitizeTheme`, which is what `quizTheme.test.js:12` (`sanitizeTheme(junk) === DEFAULT_THEME`) enforces.

**No migration.** `quizzes.theme` and `quiz_sessions.theme` are jsonb with a size check only
(`pg_column_size(theme) < 4000`, `20260930190000_quiz_theme.sql`). Four hex fields add ~60 characters to the largest
theme the app can produce, which already measures under 2,500 against that budget.

### Precedence

| Var | Resolves to |
|---|---|
| `--qz-glow-a` | `glowA ?? accent ?? look.glow[0]` |
| `--qz-glow-b` | `glowB ?? look.glow[1]` |
| `--qz-deep-a` | `deepA ?? look.deep[0]` |
| `--qz-deep-b` | `deepB ?? look.deep[1]` |

The accent's place in the glow-a chain is today's behaviour and is kept: a custom accent has always tinted the screen
glow, and an admin who has dialled in an accent should not have to re-derive it here. An explicit `glowA` sits above it,
so the two controls cannot fight each other — the explicit pick wins, and clearing it hands the glow back to the accent.

### The helper

```js
export function withSchemeColors(theme, patch)
```

`patch` is a partial of the four keys, each a hex or `null`. Unknown keys are refused. One function rather than four,
because the four fields share one rule and one is the only thing that has to change when it moves.

---

## 5. Studio

### 5.1 The rows

Two rows added inside the existing **Colour scheme** section, below the eight look buttons — not new sections, because
they are the same decision.

```
Glow     ▓▓▓▓  A ▉▉▉▉▉▉▉▉▉ [colour input]   B ▉▉▉▉▉▉▉▉▉ [colour input]   [Use the scheme's glow]
Banner   ▓▓▓▓  A ▉▉▉▉▉▉▉▉▉ [colour input]   B ▉▉▉▉▉▉▉▉▉ [colour input]   [Use the scheme's banner]
```

Each row carries a chip painted `linear-gradient(135deg, a, b)` from the **resolved** pair, so it shows what the screen
shows. The chip is `aria-hidden`: it communicates nothing the two labelled inputs do not.

Each picker carries **one swatch strip and one `<input type="color">`**, and they are separate per picker:

| Picker | Strip |
|---|---|
| Glow A | `glow[0]` of all eight looks, in `THEME_LOOKS` order |
| Glow B | `glow[1]` of all eight looks, in `THEME_LOOKS` order |
| Banner A | `deep[0]` of all eight looks, in `THEME_LOOKS` order |
| Banner B | `deep[1]` of all eight looks, in `THEME_LOOKS` order |

Eight fixed swatches per strip, as `ACCENT_SWATCHES` and `PAGE_SWATCHES` already are. The strip is the fast path — an
admin can lift one end of one scheme onto another — and the colour input is the escape hatch. Both are needed; neither
replaces the other.

### 5.2 The resolved values come from `themeCssVars`, not from JSX

`StudioPreview` computes `themeCssVars` today and the studio page does not import it. §7 is what puts it there; the rows
then read their colours out of the same call:

```js
const vars = themeCssVars(theme)   // already computed for the live preview
const glow = [vars['--qz-glow-a'], vars['--qz-glow-b']]
const banner = [vars['--qz-deep-a'], vars['--qz-deep-b']]
```

The chip, both colour inputs and the warning all read those. The studio must not re-derive the precedence chain in JSX:
the accent's place in glow-a is a rule that is easy to get wrong and is unit-tested exactly once, in `quizTheme.js`.
Reading it back out of the function that already computes it is what keeps a second copy from appearing.

### 5.3 Two rules copied from the Accent row

**A colour input cannot show `null`,** so it shows the colour in effect from `vars` — which is why §5.2 matters here.

**`aria-pressed` and the chosen-ring key off the raw value,** never the resolved one. Each strip is all eight looks'
colours for that stop, so the colour in effect is always in the strip; keying off the resolved value would show a swatch
as picked when the admin had only picked a scheme. This is the defect `quizStudio.test.jsx:52-60` already guards for
accents.

### 5.4 Where the row lives

`src/components/admin/quizStudio/SchemeColours.jsx`. The studio page is already 691 lines and four pickers would add
forty more of markup that is identical four times. The file is colocated with `StudioPreview.jsx` and `SoundLab.jsx` and
is imported the same way.

### 5.5 The warning

A `role="status"` line under the Banner row when `contrastWithWhite` on either resolved banner stop is under 4.5,
matching the Accent row's posture and the Page row's. `contrastWithWhite` is already exported and tested; nothing new
measures contrast.

---

## 6. The result card

`palette()` (`api/_lib/quizCardRender.js:93-105`):

```js
const deepA = flat ?? t.deepA ?? look.deep[0]
const deepB = flat ?? t.deepB ?? look.deep[1]
```

`card.backgroundColor` still wins, so nothing set in the card tab is lost. The score's white fallback
(`contrastRatio(accent, deepB) >= 3`) already measures against `deepB`, so a pale custom banner falls back to white
without a new branch.

### The preview

`PREVIEW_THEME_KEYS` (`api/_lib/quizCard.js:68`) gains `deepA` and `deepB` and not the glow pair: the card draws the
gradient but has no radial glow layer, so sending the glow would enlarge the URL to carry nothing. Both sides still
`sanitizeTheme` the fragment, so the preview endpoint cannot be handed a colour it has not already validated.

Measured, with both payloads on the URL and every colour set: **461 of 700 characters**, up from 415.

---

## 7. One adjacent line

`AdminQuizStudio.jsx:273` feeds `look.deep[0]` to the card background colour input as the value shown when the card has
no colour of its own. With a custom banner that would show a colour the card is not using, so it reads `vars['--qz-deep-a']`
like every other resolved colour in the studio.

---

## 8. Tests

| Test | Asserts |
|---|---|
| `api/_lib/quizTheme.test.js` | The four default to `null` and junk falls back to `null`; each var resolves by its documented chain; a custom accent still wins over `look.glow[0]` when `glowA` is `null`, and an explicit `glowA` wins over the accent; `withSchemeColors` refuses an unknown key and a bad hex and leaves the other three keys alone; the largest-theme fixture sets all six colours explicitly and stays under budget |
| `api/_lib/quizCardRender.test.js` | A theme `deepA`/`deepB` reaches the painted gradient; `card.backgroundColor` still beats both; a pale custom banner still triggers the white-score fallback |
| `api/_lib/quizCard.test.js` | The fragment carries `deepA`/`deepB`; the URL cap test now covers them |
| `src/components/admin/quizStudio/quizStudio.test.jsx` | The four fields are written only through `withSchemeColors`; each pair is cleared in exactly one place; the inputs and the card background input read the resolved colour out of `themeCssVars` rather than re-deriving the chain; `aria-pressed` reads the raw value |
| `api/_lib/quizHandlers.test.js` | The theme copied into a session carries the four `null`s |

---

## 9. Accessibility

- Nothing is communicated by colour alone. Each row is labelled, each picker is an `aria-label`ed control, and the
  gradient chip is hidden from the tree.
- The banner warning is a `role="status"` line, matching the Accent and Page rows.
- A pale banner is warned about, not refused — the same posture the other two colour rows take.
- Touch targets are unchanged: the rows reuse the studio's existing pill and swatch sizing.

---

## 10. Risks

- **`text-white` is hardcoded on every banner panel.** A pale banner is warned, not prevented, and a warning read in
  the studio at night is not the same as reading it from a bright hall with the projector up.
- **Unverified without a real session.** Banner rendering across the look, phone and podium screens needs a Supabase
  login and a real game. Tests prove the code path; they cannot prove a projector.
- **`withSchemeColors` is looser than `withAccent`/`withPage`.** It takes a patch rather than a value, so the key check
  is the part that matters. It is refused rather than ignored, and that refusal is unit-tested.
- **Four more keys on a jsonb column with a hard size check.** Comfortable today (§4) and the fixture will keep saying so.
- **The studio now reads a resolved colour out of `themeCssVars`.** That is deliberate (§5.2) — one precedence chain,
  computed once — but it means the rows are only as correct as that function, which is why the precedence test is in
  `quizTheme.test.js` and not in the studio test.