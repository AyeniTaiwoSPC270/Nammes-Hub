# Quiz Scheme Colours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin replace a colour scheme's own four colours — the screen glow and the dark banner gradient — in the Quiz Design Studio, and have the result card and its preview follow.

**Architecture:** Four nullable `#rrggbb` keys on the theme (`glowA`, `glowB`, `deepA`, `deepB`), cleaned by the `cleanHexColor` that already governs `accent` and `page`, with `null` meaning "the scheme's own colour" — which is what every theme saved before this exists holds, so there is no migration and no change to a live quiz. One helper, `withSchemeColors(theme, patch)`, takes the whole patch so the four fields share one rule. `themeCssVars` resolves each var as *explicit colour → accent (glow-a only) → preset*. The studio's two new rows read their resolved colours back out of `themeCssVars` rather than re-deriving the chain, and the result card's `palette()` takes the theme's banner with the card's own background colour still winning.

**Tech Stack:** React 19 (plain JSX, no TypeScript), Tailwind v4 design tokens, Vitest + `@napi-rs/canvas`, oxlint, Vite.

**Spec:** `docs/superpowers/specs/2026-10-12-quiz-scheme-colours-design.md`

---

## File structure

| File | Responsibility after this change |
|---|---|
| `api/_lib/quizTheme.js` | Owns the four keys, their cleaning, their precedence in `themeCssVars`, and `withSchemeColors`. The only place a scheme colour is resolved. |
| `api/_lib/quizCardRender.js` | `palette()` gains the theme's banner behind the card's own colour. Exports `palette` so the branch is directly testable. |
| `api/_lib/quizCard.js` | `PREVIEW_THEME_KEYS` carries the banner so the card preview follows unsaved edits. |
| `src/components/admin/quizStudio/SchemeColours.jsx` | **New.** The Glow and Banner rows: gradient chip, two pickers, a clear button, the white-text warning. Takes a `theme` and an `onChange` patch callback; writes nothing itself. |
| `src/pages/admin/AdminQuizStudio.jsx` | Renders `<SchemeColours>` inside the Colour scheme section, routes its patch through `withSchemeColors`, and reads its own resolved vars for the card background input. |

**Why the rows are their own file:** the studio page is already 691 lines and four pickers are identical four times. It sits with `StudioPreview.jsx` and `SoundLab.jsx` and is imported the same way.

**Why `onChange` takes a patch and not a theme:** the helper lives in `quizTheme.js` beside `withAccent` and `withPage`, and the studio is the only thing that can hold a draft. Passing a patch in keeps the rule in one file, exactly as the existing rows do.

---

### Task 1: The four keys, their cleaning, and their precedence

**Files:**
- Modify: `api/_lib/quizTheme.js`
- Modify: `api/_lib/quizTheme.test.js`
- Modify: `api/_lib/quizHandlers.test.js`

- [ ] **Step 1: Write the failing test**

In `api/_lib/quizTheme.test.js`, add `withSchemeColors` and `SCHEME_COLOR_KEYS` to the import at line 6-7, then add this describe block after the `describe('picking a colour', …)` block that ends at line 357:

```js
describe('the scheme’s own four colours', () => {
  const none = sanitizeTheme({ look: 'ocean' })
  const set = withSchemeColors(none, { deepA: '#0a1b2c' })

  it('starts on the scheme’s colours, so every quiz saved before this is untouched', () => {
    for (const key of SCHEME_COLOR_KEYS) expect(DEFAULT_THEME[key], key).toBeNull()
    expect(none).toMatchObject({ glowA: null, glowB: null, deepA: null, deepB: null })
  })

  it('takes #rrggbb and nothing else, exactly as the accent does', () => {
    const four = sanitizeTheme({ glowA: '#AbCdEf', glowB: '#123456', deepA: '#0B2417', deepB: '#17492f' })
    expect(four).toMatchObject({ glowA: '#abcdef', glowB: '#123456', deepA: '#0b2417', deepB: '#17492f' })
    for (const bad of ['red', '#fff', 'rgb(0,0,0)', '#000000;}', 12, null]) {
      expect(sanitizeTheme({ glowA: bad }).glowA, String(bad)).toBeNull()
      expect(sanitizeTheme({ deepB: bad }).deepB, String(bad)).toBeNull()
    }
  })

  it('sets one end of a gradient without disturbing the other three colours', () => {
    const vars = themeCssVars({ look: 'ocean', deepA: '#ff0000' })
    expect(vars['--qz-deep-a']).toBe('#ff0000')
    expect(vars['--qz-deep-b'], 'the other end is a separate decision').toBe(THEME_LOOKS.ocean.deep[1])
    expect(vars['--qz-glow-a']).toBe(THEME_LOOKS.ocean.glow[0])
    expect(vars['--qz-glow-b']).toBe(THEME_LOOKS.ocean.glow[1])
  })

  it('falls back to the scheme’s tint, not to its button colour', () => {
    // ocean’s accent and its glow[0] are different colours, so conflating them is invisible on a look where the two happen
    // to match and wrong on the ones where they do not. The neighbouring variable is named `accent`, which makes the slip
    // an easy one to make.
    expect(THEME_LOOKS.ocean.accent).not.toBe(THEME_LOOKS.ocean.glow[0])
    expect(themeCssVars({ look: 'ocean' })['--qz-glow-a']).toBe(THEME_LOOKS.ocean.glow[0])
  })

  it('keeps the accent’s place in the glow, below an explicit colour and above the scheme', () => {
    expect(themeCssVars({ look: 'ocean', accent: '#00ff00' })['--qz-glow-a'], 'a custom accent tints the glow, as it always has').toBe('#00ff00')
    expect(themeCssVars({ look: 'ocean', accent: '#00ff00', glowA: '#ff0000' })['--qz-glow-a'], 'an explicit colour wins').toBe('#ff0000')
    expect(themeCssVars({ look: 'ocean', accent: '#00ff00', glowA: null })['--qz-glow-a'], 'handing the glow back gives it to the accent again').toBe('#00ff00')
  })

  it('changes a colour and nothing else', () => {
    expect(set.deepA).toBe('#0a1b2c')
    expect(set.look, 'a colour must not change the scheme').toBe('ocean')
    expect(set.accent, 'and must not disturb the accent').toBeNull()
    expect(set.glowA).toBeNull()
    expect(withSchemeColors(set, { deepA: null, deepB: null }).deepA, 'clearing a pair').toBeNull()
    expect(withSchemeColors(set, {}).deepA, 'an absent key leaves what is already set alone').toBe('#0a1b2c')
  })

  it('refuses a key it does not own, so a patch cannot reach through and change something else', () => {
    // The patch is looser than withAccent’s single value, so the key check is the part that has to hold.
    for (const patch of [{ accent: '#123456' }, { look: 'royal' }, { page: '#000000' }, JSON.parse('{"__proto__":"#123456"}')]) {
      const out = withSchemeColors(none, patch)
      expect(out.accent, JSON.stringify(patch)).toBeNull()
      expect(out.look, JSON.stringify(patch)).toBe('ocean')
      expect(Object.keys(out).sort(), JSON.stringify(patch)).toEqual(Object.keys(none).sort())
    }
  })

  it('refuses a value it cannot use, and a patch that is not a patch', () => {
    for (const bad of ['red', '#fff', 'var(--x)', 12, null]) expect(withSchemeColors(set, { deepA: bad }).deepA, String(bad)).toBeNull()
    // A patch that is not an object changes nothing at all, rather than throwing or wiping a colour that was set.
    for (const bad of [null, 5, 'red', [], '#0a1b2c']) expect(withSchemeColors(set, bad).deepA, String(bad)).toBe('#0a1b2c')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run api/_lib/quizTheme.test.js`
Expected: FAIL — `withSchemeColors` and `SCHEME_COLOR_KEYS` are not exported by `quizTheme.js`.

- [ ] **Step 3: Fix the two full-shape fixtures the new keys break**

These assert the whole sanitised theme by equality, so they must carry the four new keys.

In `api/_lib/quizTheme.test.js` line 16, add the four to the fixture object:

```js
    const t = { look: 'midnight', accent: '#AbCdEf', page: '#101010', glowA: null, glowB: null, deepA: null, deepB: null, pattern: 'waves', image: null, backdropOpacity: 30, backdropScale: 150, backdropBlur: 6, backdropDim: 20, backdropFit: 'contain', confetti: 'petals', headline: 'Quiz Night', tagline: 'Phones out', sound: chosen, logo: null, sponsors: [], showSponsors: { lobby: false, finish: true } }
```

In `api/_lib/quizTheme.test.js` lines 143-147, widen the fixture so it measures the theme the app can now produce, and say so in the comment above it:

```js
    // accent, page and the four scheme colours are set explicitly rather than left to default. A fixture that leaves them
    // null measures a theme the app cannot produce, and the size check would stop noticing a field that started costing
    // real space.
    const custom = { music: 'm'.repeat(40), effects: Object.fromEntries(Object.keys(THEME_EFFECTS).map((name) => [name, 'e'.repeat(40)])) }
    const full = sanitizeTheme({ accent: '#010203', page: '#040506', glowA: '#070809', glowB: '#0a0b0c', deepA: '#0d0e0f', deepB: '#101112', headline: 'h'.repeat(60), tagline: 't'.repeat(80), pattern: 'image', image: good, logo: good, sponsors: Array.from({ length: 6 }, () => ({ name: 'n'.repeat(40), path: good })), sound: { music: 'custom', off: Object.keys(THEME_EFFECTS), custom } }, { quizId: QUIZ_A })
    expect(full.accent).toBe('#010203')
    expect(full.page).toBe('#040506')
    expect(full.deepA).toBe('#0d0e0f')
```

In `api/_lib/quizHandlers.test.js` line 51, add the four nulls:

```js
    expect(db.tables.quiz_sessions.at(-1).theme).toEqual({ look: 'royal', accent: '#ff00aa', page: null, glowA: null, glowB: null, deepA: null, deepB: null, pattern: 'math', image: null, backdropOpacity: 8, backdropScale: 100, backdropBlur: 0, backdropDim: 0, backdropFit: 'cover', confetti: 'math', headline: 'Freshers Night', tagline: '', sound: DEFAULT_THEME.sound, logo: null, sponsors: [], showSponsors: { lobby: true, finish: true } })
```

And line 245 the same way, on the theme it returns:

```js
    expect(res.body.theme).toEqual({ look: 'ocean', accent: null, page: null, glowA: null, glowB: null, deepA: null, deepB: null, pattern: 'math', image: null, backdropOpacity: 8, backdropScale: 100, backdropBlur: 0, backdropDim: 0, backdropFit: 'cover', confetti: 'math', headline: 'Hello', tagline: '', sound: DEFAULT_THEME.sound, logo: null, sponsors: [], showSponsors: { lobby: true, finish: true } })
```

- [ ] **Step 4: Add the keys, the cleaning and the helper**

In `api/_lib/quizTheme.js`, add after `THEME_LOOKS` (line 16):

```js
// The four colours a scheme owns, each of which the admin may replace in the studio. They are one list because they
// share one rule and one function: a colour is a #rrggbb or it is nothing, and null means "the scheme’s own colour"
// — which is what every theme saved before this existed holds, so a live quiz changes for no one.
export const SCHEME_COLOR_KEYS = Object.freeze(['glowA', 'glowB', 'deepA', 'deepB'])
```

In `DEFAULT_THEME` (line 195-197), after `page: null,`:

```js
    glowA: null,
    glowB: null,
    deepA: null,
    deepB: null,
```

After `cleanPage`’s helper `withPage` (line 357-359), add:

```js
// The admin’s own four scheme colours. Only keys this file names are read, so a theme carrying a patch-shaped object
// cannot reach through and change a field it was never given: SCHEME_COLOR_KEYS is the whole surface.
function cleanSchemeColors(input) {
  const t = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const out = {}
  for (const key of SCHEME_COLOR_KEYS) out[key] = cleanHexColor(t[key])
  return out
}

// The four scheme colours are one decision with four ends, so one function takes the whole patch rather than four
// functions each taking one value. A key absent from the patch is left alone; a key present but unusable clears, which
// is how the studio’s own clear button hands a pair back to the scheme.
export function withSchemeColors(theme, patch) {
  const next = { ...theme }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return next
  for (const key of SCHEME_COLOR_KEYS) {
    if (!Object.hasOwn(patch, key)) continue
    next[key] = cleanHexColor(patch[key])
  }
  return next
}
```

In `sanitizeTheme` (line 314), after `page: cleanHexColor(t.page),`:

```js
    ...cleanSchemeColors(t),
```

- [ ] **Step 5: Resolve each variable in `themeCssVars`**

In `api/_lib/quizTheme.js` lines 414-417, replace:

```js
    '--qz-glow-a': t.accent ?? look.glow[0],
    '--qz-glow-b': look.glow[1],
    '--qz-deep-a': look.deep[0],
    '--qz-deep-b': look.deep[1],
```

with:

```js
    // The accent sits above the scheme’s tint and below the admin’s own, which is today’s order with one step
    // added. The fallback is look.glow[0] and deliberately not `accent`: that variable holds the scheme’s *button*
    // colour, which is a different value that merely happens to match on some looks.
    '--qz-glow-a': t.glowA ?? t.accent ?? look.glow[0],
    '--qz-glow-b': t.glowB ?? look.glow[1],
    '--qz-deep-a': t.deepA ?? look.deep[0],
    '--qz-deep-b': t.deepB ?? look.deep[1],
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/quizTheme.test.js api/_lib/quizHandlers.test.js`
Expected: PASS, both files.

- [ ] **Step 7: Commit**

```bash
git add api/_lib/quizTheme.js api/_lib/quizTheme.test.js api/_lib/quizHandlers.test.js
git commit -m "feat(quiz): let a theme override its scheme's own glow and banner colours"
```

---

### Task 2: The result card follows the banner

**Files:**
- Modify: `api/_lib/quizCardRender.js:93-105`
- Modify: `api/_lib/quizCardRender.test.js`

- [ ] **Step 1: Write the failing test**

In `api/_lib/quizCardRender.test.js`, add `palette` to the import at line 5 and add this test inside the `describe('every look stays legible', …)` block, after the test that ends at line 300:

```js
  it('gives the card the banner the theme asks for, and the card’s own colour the last word', () => {
    const look = THEME_LOOKS[THEME.look]
    expect(palette(DEFAULT_CARD, THEME)).toMatchObject({ deepA: look.deep[0], deepB: look.deep[1] })
    expect(palette(DEFAULT_CARD, { ...THEME, deepA: '#3b0764', deepB: '#1a0033' })).toMatchObject({ deepA: '#3b0764', deepB: '#1a0033' })
    // The card tab’s own background colour is a different decision and still wins, or that control would do nothing.
    expect(palette({ ...DEFAULT_CARD, backgroundColor: '#0b2417' }, { ...THEME, deepA: '#3b0764' })).toMatchObject({ deepA: '#0b2417', deepB: '#0b2417' })
  })

  it('prints the score white on a pale banner the admin chose, rather than in a matching accent', () => {
    // The studio warns about a pale banner rather than refusing it, so this is a state the app deliberately allows and
    // the card has to survive. The card draws its score in the accent on the background, the opposite of what the screens
    // do, so the same white fallback that covers the presets has to cover a colour of the admin’s own too.
    const pale = { ...THEME, deepA: '#f6f3f2', deepB: '#ffffff' }
    expect(palette(DEFAULT_CARD, pale).accent, 'the accent itself is untouched').toBe(THEME_LOOKS[THEME.look].accent)
    expect(palette(DEFAULT_CARD, pale).onBackground, 'but the score is drawn in white').toBe('#ffffff')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run api/_lib/quizCardRender.test.js -t 'every look stays legible'`
Expected: FAIL — `palette` is not exported from `quizCardRender.js`.

- [ ] **Step 3: Implement it**

In `api/_lib/quizCardRender.js` lines 87-105, replace the whole comment block and the head of the function so the new step is not invisible:

```js
// The card's palette: the studio's own choice first, then the theme's accent, then the look's own accent. The same
// precedence themeAccent uses, so a card never disagrees with the screens it was shared from.
//
// Three sources for the background, in order: the card tab's own colour, then the banner the screens are using, then the
// scheme's. A shareable image that shows a different gradient to the room is the defect that middle step removes.
//
// A colour of the admin's own replaces both ends of the gradient, which flattens the fill. The contrast check then runs
// against *that* colour rather than the scheme's, so an accent that would be muddy on it still falls back to white
// instead of printing an unreadable score.
export function palette(card, theme) {
  const t = sanitizeTheme(theme)
  const look = THEME_LOOKS[t.look]
  const accent = card.accent ?? t.accent ?? look.accent
  const flat = card.backgroundColor ?? null
  const deepA = flat ?? t.deepA ?? look.deep[0]
  const deepB = flat ?? t.deepB ?? look.deep[1]
  // Several looks are close in tone to their own background (mono grey on near-black, forest green on dark green),
  // and the live screens never notice because they put white text *on* an accent. The card does the opposite, so it
  // has to check: an accent too close to the background falls back to white rather than rendering a muddy score.
  const onBackground = contrastRatio(accent, deepB) >= 3 ? accent : '#ffffff'
  return { accent, onBackground, deepA, deepB }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/quizCardRender.test.js`
Expected: PASS. If it times out rather than fails, the canvas suite is slow by nature — re-run with the full file and allow the 120s budget the neighbouring tests already declare.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/quizCardRender.js api/_lib/quizCardRender.test.js
git commit -m "feat(quiz): paint the result card with the theme's own banner"
```

---

### Task 3: The card preview follows an unsaved banner

**Files:**
- Modify: `api/_lib/quizCard.js:64-68`
- Modify: `api/_lib/quizCard.test.js`

- [ ] **Step 1: Write the failing test**

In `api/_lib/quizCard.test.js`, replace the test at lines 35-41 with:

```js
  it('carries the backdrop theme fragment on the preview url, and only eight fields of it', () => {
    // Eight fields because the preview endpoint renders a card, not a screen: sponsors, sound and picture paths would
    // make the url unusable, and the cap is shared with the card draft beside it. deepA and deepB are here because the
    // card paints the banner; the glow pair is not, because the card draws no glow.
    expect(PREVIEW_THEME_KEYS).toEqual(['look', 'accent', 'page', 'deepA', 'deepB', 'pattern', 'backdropOpacity', 'backdropScale'])
    const back = decodeThemePreview(encodeThemePreview({ look: 'ocean', accent: '#123456', deepA: '#3b0764', pattern: 'rings', headline: 'x'.repeat(60), sponsor: 'nope' }))
    expect(back).toMatchObject({ look: 'ocean', accent: '#123456', deepA: '#3b0764', pattern: 'rings', headline: '' })
  })

  it('leaves the glow off the url, because the card draws no glow', () => {
    expect(decodeThemePreview(encodeThemePreview({ look: 'ocean', glowA: '#ff0000', glowB: '#00ff00' }))).toMatchObject({ glowA: null, glowB: null })
  })
```

And replace the cap test at lines 48-52 so it measures the fragment as it will actually be sent:

```js
  it('keeps the whole preview url inside its cap with both payloads on it', () => {
    const theme = encodeThemePreview({ look: 'ocean', accent: '#123456', page: '#3b0764', deepA: '#0b2417', deepB: '#17492f', pattern: 'rings', backdropOpacity: 80, backdropScale: 150 })
    const card = encodeCardPreview({ ...DEFAULT_CARD, accent: '#abcdef', pattern: 'hexagons', backgroundColor: '#3b0764' }, { quizId: QUIZ })
    expect(theme.length + card.length).toBeLessThanOrEqual(700)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run api/_lib/quizCard.test.js`
Expected: FAIL — `PREVIEW_THEME_KEYS` does not yet contain `deepA` and `deepB`.

- [ ] **Step 3: Implement it**

In `api/_lib/quizCard.js` lines 64-68, replace the comment and the constant:

```js
// A theme fragment for the studio’s preview, so "same as the game" shows the backdrop currently on screen rather than
// the last one saved. Eight fields, not the whole theme: sponsors, sound and picture paths would make the url unusable.
// deepA and deepB travel because the card paints the banner the screens are using; the glow pair does not, because the
// card draws no glow and the url should not carry it. Both sides clean it, so the preview endpoint is never handed a
// colour or a pattern name it has not already validated.
export const PREVIEW_THEME_KEYS = Object.freeze(['look', 'accent', 'page', 'deepA', 'deepB', 'pattern', 'backdropOpacity', 'backdropScale'])
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/quizCard.test.js`
Expected: PASS. If the cap test fails, read the number it printed and raise `PREVIEW_MAX_CHARS` — but check first that the fragment really is only the eight named fields.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/quizCard.js api/_lib/quizCard.test.js
git commit -m "feat(quiz): carry the banner on the card preview url"
```

---

### Task 4: The two rows in the studio

**Files:**
- Create: `src/components/admin/quizStudio/SchemeColours.jsx`
- Modify: `src/pages/admin/AdminQuizStudio.jsx` (imports at 9-29, colour computed at 106-122, card input at 273, Colour scheme section at 391-404)
- Modify: `src/components/admin/quizStudio/quizStudio.test.jsx`

- [ ] **Step 1: Write the failing test**

In `src/components/admin/quizStudio/quizStudio.test.jsx`, add `SchemeColours` to the imports and add a const beside the existing `STUDIO`:

```js
import SchemeColours from './SchemeColours'

const SCHEME_COLOURS = 'src/components/admin/quizStudio/SchemeColours.jsx'
```

Then add this describe block after the `describe('the studio colour controls', …)` block that ends at line 61:

```js
describe('the scheme colour rows', () => {
  // These render, unlike the rest of this file. The rows take a plain theme and a plain callback, so there is no router,
  // toast or query to mount around them, and rendering is the only way to prove which colour each input actually shows.
  const row = (theme) => renderToStaticMarkup(<SchemeColours theme={theme} onChange={() => {}} />)

  it('shows the colour in effect in every picker, because a colour input cannot show nothing', () => {
    const html = row({ look: 'ocean' })
    expect(html).toContain('value="#0891b2"') // ocean glow[0]
    expect(html).toContain('value="#2563eb"') // ocean glow[1]
    expect(html).toContain('value="#083344"') // ocean deep[0]
    expect(html).toContain('value="#164e63"') // ocean deep[1]
  })

  it('follows the accent on the glow until the admin says otherwise, which is what it has always done', () => {
    // ocean’s accent (#0e7490) and its glow[0] (#0891b2) are different colours, so a row that showed the accent where
    // the scheme’s tint belongs is visibly wrong here rather than only on a look where the two happen to match.
    const custom = row({ look: 'ocean', accent: '#00ff00' })
    expect(custom).toContain('value="#00ff00"')
    expect(custom).not.toContain('value="#0891b2"')
    expect(row({ look: 'ocean', accent: '#00ff00', glowA: '#ff0000' }), 'an explicit colour beats the accent').toContain('value="#ff0000"')
  })

  it('warns about a banner white text cannot be read on, and says nothing about the glow', () => {
    // text-white is hardcoded on every qz-deep panel, so a pale banner is legible enough to be allowed and not legible
    // enough to be safe. The glow is two radial gradients at 14% alpha behind text and cannot cause that.
    expect(row({ look: 'ocean', deepA: '#f6f3f2', deepB: '#ffffff' })).toContain('role="status"')
    expect(row({ look: 'ocean', glowA: '#f6f3f2', glowB: '#ffffff' })).not.toContain('role="status"')
    expect(row({ look: 'ocean' }), 'no built-in scheme may trip the warning').not.toContain('role="status"')
  })

  it('offers no clear button until there is something of the admin’s own to clear', () => {
    expect(row({ look: 'ocean', deepB: '#083344' })).not.toContain('Use the scheme’s glow')
    expect(row({ look: 'ocean', deepB: '#083344' })).toContain('Use the scheme’s banner')
  })

  it('marks a swatch chosen only when the admin chose it, not when the scheme happens to use it', () => {
    // Every scheme’s own colours are in every strip, so keying the pressed state off the resolved colour would show one
    // as picked when the admin had only picked a scheme. This is the defect the Accent row already had.
    expect(row({ look: 'ocean' })).not.toContain('aria-pressed="true"')
    expect(row({ look: 'ocean', deepA: '#083344' })).toContain('aria-pressed="true"')
  })

  it('takes every colour it displays from themeCssVars rather than deriving it again', () => {
    // The precedence chain is easy to get wrong and is unit-tested exactly once, in quizTheme.js. A second copy in a
    // component would be a second place to get it wrong with nothing noticing.
    const source = readFileSync(SCHEME_COLOURS, 'utf8')
    expect(source).toContain('themeCssVars(theme)')
    expect(source, 'the swatch strips may read the presets; nothing else may').not.toMatch(/value=\{look\./)
  })
})

describe('the studio wiring', () => {
  it('writes the four scheme colours only through withSchemeColors', () => {
    const source = readFileSync(STUDIO, 'utf8')
    expect(source, 'the rows should hand their patch to the helper').toContain('withSchemeColors(theme,')
    // Reaching past the helper would be a second way to write a colour, which is how the accent regressed in the first place.
    expect(source).not.toMatch(/change\(\{[^}]*\b(glowA|glowB|deepA|deepB)\s*:/)
  })

  it('shows the card background input the banner the card would actually use', () => {
    const source = readFileSync(STUDIO, 'utf8')
    expect(source).toContain("value={card.backgroundColor ?? vars['--qz-deep-a']}")
    expect(source, 'the old fallback showed a colour the card was not using').not.toContain('value={card.backgroundColor ?? look.deep[0]}')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/quizStudio/quizStudio.test.jsx`
Expected: FAIL — `SchemeColours.jsx` does not exist.

- [ ] **Step 3: Write the component**

Create `src/components/admin/quizStudio/SchemeColours.jsx`:

```jsx
import { THEME_LOOKS, themeCssVars, contrastWithWhite } from '../../../../api/_lib/quizTheme.js'
import Button from '../../ui/Button'

// The two rows under the colour scheme buttons: the faint tint behind every screen, and the dark gradient behind the
// "Join the game" banner and the podium. Each row is a pair because each is drawn as a gradient — one end on its own is
// not a state an admin ever wants.
//
// Every colour shown here is the *resolved* one, read back out of themeCssVars rather than derived in this file: the
// precedence chain is easy to get wrong and is unit-tested exactly once, in quizTheme.js. Only the chosen-ring reads the
// raw value, so a preset colour is never shown as picked when the admin has only picked a scheme.

const PAIRS = [
  {
    keys: ['glowA', 'glowB'],
    vars: { glowA: '--qz-glow-a', glowB: '--qz-glow-b' },
    label: 'Glow',
    hint: 'The faint tint behind every screen. It follows your accent until you set it yourself.',
    clear: 'Use the scheme’s glow',
    // Each picker swatches the same end of the gradient across every scheme, so one can be lifted onto another.
    from: { glowA: (look) => look.glow[0], glowB: (look) => look.glow[1] },
    warn: null,
  },
  {
    keys: ['deepA', 'deepB'],
    vars: { deepA: '--qz-deep-a', deepB: '--qz-deep-b' },
    label: 'Banner',
    hint: 'The dark gradient behind “Join the game” and the podium.',
    clear: 'Use the scheme’s banner',
    from: { deepA: (look) => look.deep[0], deepB: (look) => look.deep[1] },
    // White text sits on the banner by construction — text-white is hardcoded on every qz-deep panel — so a pale banner
    // is something the admin has to be told about rather than refused. 4.5 is the body-text threshold; every preset
    // measures 7 or more, so no built-in scheme can trip it.
    warn: {
      below: 4.5,
      text: 'White text on this banner is hard to read on a projector. A darker shade reads better.',
    },
  },
]

function Picker({ label, raw, shown, from, onPick }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(THEME_LOOKS).map(([id, look]) => {
          const hex = from(look)
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPick(hex)}
              aria-label={`${label}: ${look.name} ${hex}`}
              aria-pressed={raw === hex}
              className={['h-9 w-9 cursor-pointer rounded-full border-2', raw === hex ? 'border-ink-900 ring-2 ring-offset-2 ring-ink-900/30' : 'border-transparent'].join(' ')}
              style={{ background: hex }}
            />
          )
        })}
        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-hairline px-3 py-1.5 text-sm font-semibold text-ink-900">
          <input
            type="color"
            value={shown}
            onChange={(e) => onPick(e.target.value)}
            className="h-7 w-7 cursor-pointer border-0 bg-transparent p-0"
            aria-label={`Custom ${label.toLowerCase()} colour`}
          />
          Custom
        </label>
      </div>
    </div>
  )
}

export default function SchemeColours({ theme, onChange }) {
  const vars = themeCssVars(theme)
  return (
    <div className="mt-4 flex flex-col gap-5 border-t border-hairline pt-4">
      {PAIRS.map(({ keys, vars: names, label, hint, clear, from, warn }) => {
        const [aKey, bKey] = keys
        // A missing key means the scheme's own colour, exactly as a null one does, so a partial theme renders the clear
        // button no more than a saved one does.
        const customised = keys.some((k) => (theme[k] ?? null) !== null)
        const worst = warn ? Math.min(contrastWithWhite(vars[names[aKey]]), contrastWithWhite(vars[names[bKey]])) : Infinity
        return (
          <div key={aKey}>
            <div className="flex flex-wrap items-start gap-3">
              <span
                className="mt-6 h-11 w-11 shrink-0 rounded-xl border border-black/10"
                style={{ background: `linear-gradient(135deg, ${vars[names[aKey]]}, ${vars[names[bKey]]})` }}
                aria-hidden="true"
              />
              <Picker label={`${label} A`} raw={theme[aKey] ?? null} shown={vars[names[aKey]]} from={from[aKey]} onPick={(hex) => onChange({ [aKey]: hex })} />
              <Picker label={`${label} B`} raw={theme[bKey] ?? null} shown={vars[names[bKey]]} from={from[bKey]} onPick={(hex) => onChange({ [bKey]: hex })} />
              {customised && (
                <Button variant="secondary" size="sm" onClick={() => onChange({ [aKey]: null, [bKey]: null })}>{clear}</Button>
              )}
            </div>
            <p className="mt-2 text-sm text-ink-muted">{hint}</p>
            {warn && worst < warn.below && (
              <p role="status" className="mt-2 rounded-lg bg-orange-500/10 p-3 text-sm text-ink-900">{warn.text}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify the rows pass**

Run: `npx vitest run src/components/admin/quizStudio/quizStudio.test.jsx`
Expected: the `describe('the scheme colour rows')` tests PASS; the two in `describe('the studio wiring')` FAIL — the studio does not use the helper yet.

- [ ] **Step 5: Wire the rows into the studio**

In `src/pages/admin/AdminQuizStudio.jsx`:

1. Add `themeCssVars` and `withSchemeColors` to the `quizTheme.js` import block (lines 9-29), and add `SchemeColours` beside the `StudioPreview` import at line 36:

```js
  themeCssVars,
  withSchemeColors,
```

```js
import SchemeColours from '../../components/admin/quizStudio/SchemeColours'
```

2. After `const look = THEME_LOOKS[theme.look]` (line 121), add:

```js
  // The resolved CSS variables, so the card's colour input and the scheme colour rows show what is actually on screen
  // rather than re-deriving the precedence chain a second time.
  const vars = themeCssVars(theme)
```

3. In the Colour scheme `<Section>`, after the closing `</div>` of the look-button grid (line 403) and before the section's `</Section>` (line 404):

```jsx
              <SchemeColours theme={theme} onChange={(patch) => change(withSchemeColors(theme, patch))} />
```

4. Change the card background input at line 273 from `value={card.backgroundColor ?? look.deep[0]}` to:

```jsx
                    value={card.backgroundColor ?? vars['--qz-deep-a']}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/admin/quizStudio/quizStudio.test.jsx`
Expected: PASS, all of it.

- [ ] **Step 7: Check the icon font and the linter**

Run: `npx vitest run src/lib/iconFont.test.js && npm run lint`
Expected: PASS, and `npm run lint` exits 0. No icon was added — `Settings`, `tune` and the two existing labels are plain text — but the check is cheap and the rows are new markup.

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/quizStudio/SchemeColours.jsx src/pages/admin/AdminQuizStudio.jsx src/components/admin/quizStudio/quizStudio.test.jsx
git commit -m "feat(studio): add glow and banner colour rows to the colour scheme"
```

---

### Task 5: The whole suite, the linter and the build

**Files:** none changed. This task only verifies.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: every suite passes. If `quizCardRender.test.js` is the slow one, that is its existing 120s canvas budget, not a regression.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: exit 0. Pre-existing warnings are fine; a new one is not.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Say plainly what has not been checked**

This change touches quiz screens, so per `AGENTS.md` it must be reported as unverified in a real game: the banner on the
projector lobby, on a phone and on the podium, and the exported result card, all need a Supabase login and a real session.
Say so rather than implying the studio was looked at.

- [ ] **Step 5: Commit any test-only tidy-ups**

Only if Step 1-3 turned up something to fix. Otherwise there is nothing to commit and the branch is ready for review.