# Quiz Character Art Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the 50 characters' drawing out of `src/components/quiz/Character.jsx` into one pure module in `api/_lib/`, so the browser and the server-side result card draw characters from the same code and any character spec — not just the 50 — can be drawn at all.

**Architecture:** A new pure module `api/_lib/quizCharacterArt.js` holds the part tables, the body geometry, the built-in roster and a small element serialiser. It returns SVG **strings**, not React elements, because `react-dom/server` inside a Vercel function is the exact failure already recorded at `api/_lib/characterSvg.js:9-12`. `Character.jsx` becomes a thin wrapper that injects that string, and `api/_lib/characterSvg.js` stops reading a generated table.

**Tech Stack:** Plain ESM JavaScript (no TypeScript anywhere in this repo), React 19, Vite, Vitest, Vercel serverless functions, `@napi-rs/canvas`.

**Spec:** `docs/superpowers/specs/2026-10-12-quiz-character-cast-design.md` §4.

---

## The one thing to get right

This phase must change **nothing a player can see**. The same 50 characters, drawn by the same shapes, on every screen. The safety net is
`api/_lib/characterArtParity.test.js`, which compares the new string builder against the markup that is already committed in
`api/_lib/quizCharacterMarkup.js` — 250 strings, byte for byte. That test is the whole reason this plan is safe, and it is deleted only in
Task 8, after it has passed.

Do not delete or regenerate `api/_lib/quizCharacterMarkup.js` before Task 8. It is the oracle.

---

## File structure

| File | Responsibility |
|---|---|
| `api/_lib/quizCharacterArt.js` | **Create.** Part tables, body geometry, the 50-character roster, `h()`/`toSvg()`, `characterSvgBody`, `characterSvgMarkup`, `avatarInfo`, `normalizeAvatarId`, `randomAvatarId`, `BUILTIN_COUNT`. Pure: no `window`, no Supabase, no Node built-ins, no React. |
| `api/_lib/quizCharacterArt.test.js` | **Create.** The roster assertions moved from `src/data/quizCharacters.test.js`, plus the serialiser's own tests. |
| `api/_lib/characterArtParity.test.js` | **Create in Task 1, delete in Task 8.** Byte-for-byte comparison against the committed markup. |
| `api/_lib/characterSvg.js` | **Modify.** Reads the builder instead of the generated table. |
| `api/_lib/characterSvg.test.js` | **Modify.** Import path only. |
| `src/components/quiz/Character.jsx` | **Modify.** Becomes a wrapper. |
| `src/data/quizCharacters.js` | **Delete in Task 7.** Its contents move to the art module. |
| `src/data/quiz.js` | **Modify.** Line 29 re-exports from the new path. |
| `src/data/quizCharacters.test.js` | **Move** to `api/_lib/quizCharacterArt.test.js` in Task 7. |
| `api/_lib/quizCharacterMarkup.js` | **Delete in Task 8.** The oracle until then. |
| `scripts/quizCharacterMarkup.test.js` | **Delete in Task 8.** |
| `scripts/regenerateCharacters.mjs` | **Delete in Task 8.** |
| `package.json` | **Modify.** Remove `cards:characters`. |

---

### Task 1: The parity test, before anything moves

This test fails, because nothing exists yet. That is the point: it is the contract the rest of the phase is written against.

**Files:**
- Create: `api/_lib/characterArtParity.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { CHARACTER_MARKUP } from './quizCharacterMarkup.js'
import { characterSvgMarkup, avatarInfo, BUILTIN_COUNT } from './quizCharacterArt.js'

// The oracle. api/_lib/quizCharacterMarkup.js is generated from Character.jsx by scripts/quizCharacterMarkup.test.js and is
// committed, so it records exactly what the 50 characters look like today, with the animation classes already stripped.
//
// This phase replaces the JSX with a string builder. Until that is byte-identical to this file, the drawing has not moved
// safely — and this test is the only thing standing between a refactor and 50 quietly different characters.

const stored = (id, mood) => CHARACTER_MARKUP[`${id}:${mood}`]

// The builder keeps the animation classes, because the browser needs them. The stored markup had them removed when it
// was generated, so both sides are stripped before they are compared.
const strip = (svg) => svg.replace(/\sclass="[^"]*"/g, '')

describe('the string builder against the committed markup', () => {
  it('reproduces every stored character, in every mood', () => {
    const drifted = Object.keys(CHARACTER_MARKUP)
      .filter((key) => {
        const [id, mood] = key.split(':')
        return strip(characterSvgMarkup(avatarInfo(Number(id)), mood)) !== stored(Number(id), mood)
      })
      .sort()
    expect(drifted, `${drifted.length} character(s) no longer match. First: ${drifted[0]}`).toEqual([])
  })

  it('covers all 50 characters and 5 moods', () => {
    expect(Object.keys(CHARACTER_MARKUP)).toHaveLength(BUILTIN_COUNT * 5)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run api/_lib/characterArtParity.test.js`
Expected: FAIL — `Cannot find module './quizCharacterArt.js'`.

- [ ] **Step 3: Commit the failing test**

```bash
git add api/_lib/characterArtParity.test.js
git commit -m "test(quiz): pin the current character markup before it moves"
```

---

### Task 2: The serialiser

The drawing stays recognisable by building a tiny element tree rather than concatenating strings by hand. `h()` returns a
plain object; `toSvg()` walks it. Writing 250 SVG fragments as string concatenation would be the largest source of typos in
this phase, and the parity test would catch every one of them.

**Files:**
- Modify: `api/_lib/quizCharacterArt.js` (create it with just this section)

- [ ] **Step 1: Write the failing serialiser test**

Append to `api/_lib/quizCharacterArt.test.js` (create the file if it does not exist yet):

```js
import { describe, it, expect } from 'vitest'
import { h, toSvg } from './quizCharacterArt.js'

describe('h and toSvg', () => {
  it('writes a tag, its attributes and its closing tag', () => {
    expect(toSvg(h('rect', { x: 1, y: 2, width: 3, height: 4 }))).toBe('<rect x="1" y="2" width="3" height="4"></rect>')
  })

  it('kebab-cases camelCase attribute names, the way React does for SVG', () => {
    expect(toSvg(h('path', { d: 'M0 0', strokeWidth: 2.5, strokeLinecap: 'round' })))
      .toBe('<path d="M0 0" stroke-width="2.5" stroke-linecap="round"></path>')
  })

  it('keeps lowercase and dashed attribute names as they are', () => {
    expect(toSvg(h('g', { class: 'qz-body' }))).toBe('<g class="qz-body"></g>')
    expect(toSvg(h('path', { 'stroke-linejoin': 'round' }))).toBe('<path stroke-linejoin="round"></path>')
  })

  it('drops undefined, null and false attributes, and keeps zero', () => {
    expect(toSvg(h('g', { a: undefined, b: null, c: false, d: 0 }))).toBe('<g d="0"></g>')
  })

  it('flattens arrays of children and ignores nullish ones', () => {
    expect(toSvg(h('g', null, [h('circle', { r: 1 }), null, [h('circle', { r: 2 })]])))
      .toBe('<g><circle r="1"></circle><circle r="2"></circle></g>')
  })

  it('escapes the five characters that would break the attribute', () => {
    expect(toSvg(h('text', { 'font-family': "Georgia, 'Times New Roman', serif" })))
      .toBe('<text font-family="Georgia, \'Times New Roman\', serif"></text>')
    expect(toSvg(h('text', { title: 'a & b < c > d " e' })))
      .toBe('<text title="a &amp; b &lt; c &gt; d &quot; e"></text>')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run api/_lib/quizCharacterArt.test.js`
Expected: FAIL — `Cannot find module './quizCharacterArt.js'`.

- [ ] **Step 3: Write the serialiser**

Create `api/_lib/quizCharacterArt.js` with this header and this section, and nothing else yet:

```js
// The 50 quiz characters, as data, and the one place they are drawn.
//
// Every character is a spec: a body, a headpiece, a face, something to wear, maybe a floating prop, a colour, and its
// own moves. This module holds the part lists, the built-in roster, and the drawing itself, so the browser and the
// server-side result card draw from the same code instead of from a generated copy of it.
//
// It is imported by src/ as well as by api/, so it must stay pure: no window, no Supabase client, no Node built-ins,
// no React. The drawing returns SVG strings rather than React elements because react-dom/server inside a Vercel
// function is the failure mode recorded at api/_lib/characterSvg.js.

const CAMEL = /[A-Z]/g
const DROP = new Set(['key', 'ref'])

// React escapes these inside an attribute value, and the committed markup was produced by React, so escaping has to
// match it exactly or the parity test fails on characters nobody changed.
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }

export function h(tag, attrs = null, children = null) {
  return { tag, attrs, children }
}

function attribute(name, value) {
  if (value === null || value === undefined || value === false) return null
  const text = String(value).replace(/[&<>"']/g, (c) => ESCAPES[c])
  return `${name.replace(CAMEL, (c) => `-${c.toLowerCase()}`)}="${text}"`
}

function children(node) {
  if (node === null || node === undefined || node === false) return ''
  if (Array.isArray(node)) return node.map(children).join('')
  return node.tag ? toSvg(node) : String(node)
}

export function toSvg(node) {
  const attrs = Object.entries(node.attrs ?? {})
    .filter(([name]) => !DROP.has(name))
    .map(([name, value]) => attribute(name, value))
    .filter(Boolean)
    .join(' ')
  const open = attrs ? `<${node.tag} ${attrs}>` : `<${node.tag}>`
  return `${open}${children(node.children)}</${node.tag}>`
}
```

- [ ] **Step 4: Run the serialiser test**

Run: `npx vitest run api/_lib/quizCharacterArt.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/quizCharacterArt.js api/_lib/quizCharacterArt.test.js
git commit -m "feat(quiz): add the element serialiser the character drawing will use"
```

---

### Task 3: The data, moved out of `src/data/quizCharacters.js`

Move the tables and the roster verbatim. Only `colourFor` changes shape, because a custom character will bring its own
colour later and the built-ins must keep theirs.

**Files:**
- Modify: `api/_lib/quizCharacterArt.js`

- [ ] **Step 1: Write the failing roster test**

Copy `src/data/quizCharacters.test.js` to `api/_lib/quizCharacterArt.test.js` — keeping every existing assertion, changing
only the import to `from './quizCharacterArt.js'` and dropping the duplicate `describe('h and toSvg')` block from Task 2 by
merging the two files into one. Every assertion stays; the roster must not change.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run api/_lib/quizCharacterArt.test.js`
Expected: FAIL — the module does not export `AVATAR_COUNT`, `avatarInfo`, `BODIES` and the rest yet.

- [ ] **Step 3: Move the data in**

Copy into `api/_lib/quizCharacterArt.js`, below the serialiser, unchanged except for the four items below:

```js
export const BODIES = ['blob', 'box', 'round', 'bean', 'ghost', 'onigiri', 'cloud', 'drop', 'loaf', 'hexagon', 'pear', 'jelly', 'diamond']
export const TOPPERS = ['none', 'cat', 'bunny', 'bear', 'horns', 'antenna', 'bugs', 'sprout', 'spikes', 'floppy', 'halo', 'tuft']
export const EYES = ['round', 'dot', 'sleepy', 'wide', 'wink', 'star', 'slit', 'lash', 'cyclops', 'spiral']
export const MOUTHS = ['smile', 'grin', 'cat', 'o', 'smirk', 'tongue', 'fang', 'flat']
export const ACCESSORIES = [
  'none', 'sunglasses', 'glasses', 'headphones', 'bowtie', 'tie', 'scarf', 'monocle', 'eyepatch', 'ninja',
  'hero', 'flower', 'crown', 'gradcap', 'partyhat', 'goggles', 'mustache', 'cap', 'chef', 'beanie',
]
export const PROPS = ['none', 'bulb', 'book', 'star', 'heart', 'note', 'pi', 'sigma', 'sqrt', 'infinity', 'balloon', 'trophy']

export const IDLE_MOVES = ['bob', 'sway', 'breathe', 'hover', 'nervous', 'hop', 'tilt', 'pulse', 'doze', 'glitch', 'wobble']
export const WIN_MOVES = ['jump', 'spin', 'flip', 'shimmy', 'pogo', 'headbang', 'stretch', 'zoom', 'moonwalk', 'tada']
export const SAD_MOVES = ['droop', 'shake', 'sink', 'tremble']
export const HELLO_MOVES = ['wave', 'salute', 'flex', 'cheer', 'point', 'hips', 'clap', 'shrug']

const IDLE_LABELS = ['Bobs gently', 'Sways side to side', 'Breathes deeply', 'Hovers', 'Shivers nervously', 'Hops on the spot', 'Tilts its head', 'Pulses', 'Dozes off', 'Glitches', 'Wobbles']
const WIN_LABELS = ['Jumps for joy', 'Spins', 'Backflips', 'Shimmies', 'Pogo-hops', 'Headbangs', 'Stretches', 'Zooms', 'Moonwalks', 'Does a ta-da']
const HELLO_LABELS = ['Waves', 'Salutes', 'Flexes', 'Cheers', 'Points', 'Strikes a pose', 'Claps', 'Shrugs']

const ROSTER = [
  // Copy these 50 rows verbatim from src/data/quizCharacters.js:27-78. Do not retype them and do not reorder them:
  // the parity test in Task 4 compares every one of them against committed markup, so a typo here is a red test that
  // says a character changed when nothing did.
]

export const BUILTIN_COUNT = ROSTER.length
```

The four changes:

1. **`ROSTER` is unexported.** A cast is not in this module yet; nothing outside needs the raw rows.
2. **`SPECIAL_COLOURS`, `TONES`, `hsl` and `colourFor` move in unexported**, with `colourFor` renamed to `builtinColour` so the
   name does not promise a general answer.
3. **`AVATAR_COUNT` becomes `BUILTIN_COUNT`**, and `export const AVATAR_COUNT = BUILTIN_COUNT` is **not** added. The name lies
   once a quiz has a cast, and `api/_lib/quiz.js:11` is repointed in Task 7.
4. **`avatarInfo`, `normalizeAvatarId` and `randomAvatarId` keep their bodies and their exports**, unchanged, so the four
   player screens that import them keep working.

- [ ] **Step 4: Run the roster test**

Run: `npx vitest run api/_lib/quizCharacterArt.test.js`
Expected: PASS — every existing roster assertion, unchanged.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/quizCharacterArt.js api/_lib/quizCharacterArt.test.js
git commit -m "refactor(quiz): move the character roster into the art module"
```

---

### Task 4: The drawing, moved out of `Character.jsx`

The whole mechanical heart of the phase.

**Files:**
- Modify: `api/_lib/quizCharacterArt.js`
- Modify: `src/components/quiz/Character.jsx` (unchanged in this task — still the browser's drawing)

- [ ] **Step 1: Write the failing test**

Append to `api/_lib/characterArtParity.test.js`:

```js
import { characterSvgBody } from './quizCharacterArt.js'

describe('characterSvgBody', () => {
  it('draws the shadow, the prop, the body group and nothing else', () => {
    const out = characterSvgBody(avatarInfo(0), 'idle')
    expect(out.startsWith('<ellipse cx="50" cy="90"')).toBe(true)
    expect(out).toContain('<g class="qz-body">')
  })

  it('takes its mood from the argument, not from the spec', () => {
    expect(characterSvgBody(avatarInfo(0), 'sad')).toContain('cx="38"')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run api/_lib/characterArtParity.test.js`
Expected: FAIL — `characterSvgBody` is not exported.

- [ ] **Step 3: Move the geometry and the eight part functions in**

Move from `Character.jsx` into the art module, converting JSX to `h()` calls:

| From | To |
|---|---|
| `const INK` (`:7`) | `const INK`, module-private |
| `const BODY` (`:11-25`) | `BODY`, module-private |
| `function Body` (`:27-93`) | module-private |
| `function Topper` (`:96-190`) | module-private |
| `const STAR` (`:192`) | module-private |
| `function Eye` (`:194-264`) | module-private |
| `function Mouth` (`:266-296`) | module-private |
| `function Face` (`:298-351`) | module-private |
| `function Accessory` (`:353-513`) | module-private |
| `function Prop` (`:516-594`) | module-private |
| `function Arms` (`:596-610`) | module-private |

The conversion rules, applied mechanically:

- `<tag a={v} b="s">` → `h('tag', { a: v, b: 's' })`
- `<tag a={v}>` with children → `h('tag', { a: v }, child)`; children go in the **third** argument, never the second
- `<>…</>` → an array, which `children` already flattens
- `key={n}` → **delete it**. `toSvg` drops `key` anyway; leave it out rather than relying on that
- `style={{ transformOrigin: '50px 88px' }}` → `'style': 'transform-origin:50px 88px'`. There are exactly two such uses, in `Arms`
- `className` → `class`
- `switch`/`case`/`default` bodies become `return h(...)`; a `case` that returns several siblings returns an array
- A `const line = { stroke: … }` object spread stays an object spread: `h('path', { d, ...line })`

Then add the two exported drawing functions:

```js
// The whole character, animation classes and all. The card uses this; the browser builds the same thing in Task 5 by
// putting the root svg in JSX and injecting characterSvgBody into it.
//
// The root carries no role or aria-label: labelling belongs to whoever renders it, and Character.jsx already owns that.
// A function of `spec.name` would put aria-label on all 50 and break parity with the committed markup, which was
// generated with no title.
export function characterSvgMarkup(spec, mood = 'happy') {
  const classes = [
    'qz-char', `qz-mood-${mood}`, `qz-i-${spec.idle}`, `qz-w-${spec.win}`, `qz-s-${spec.sad}`, `qz-h-${spec.hello}`,
  ].join(' ')
  return toSvg(h('svg', { class: classes, viewBox: '0 0 100 100' }, characterSvgBody(spec, mood)))
}

// Everything inside the <svg>, so Character.jsx can own the root element and its classes itself.
export function characterSvgBody(spec, mood = 'idle') {
  const shape = BODY[spec.body] ?? BODY.blob
  return toSvg([
    h('ellipse', { cx: 50, cy: 90, rx: 24, ry: 4, fill: '#000', opacity: '0.12' }),
    prop(spec.prop),
    h('g', { class: 'qz-body' }, [
      topper(spec.topper, spec.body, spec.color),
      body(spec.body, spec.color),
      arms(spec.body, spec.color),
      face(mood, spec.eyes, spec.mouth, shape.eyeY, spec.color),
      accessory(spec.accessory, shape.top, shape.eyeY, shape.neckY),
    ]),
  ])
}
```

Rename the eight moved functions to lowercase module-private names — `body`, `topper`, `eye`, `mouth`, `face`, `accessory`,
`prop`, `arms` — so they cannot be mistaken for components. The `Face` helper keeps its `happy`/`sad` branches: those change
the eyes and mouth and ignore the `Mouth` kind entirely, and the parity test is what proves it still does.

- [ ] **Step 4: Run the parity test and fix what it finds**

Run: `npx vitest run api/_lib/characterArtParity.test.js`
Expected: either PASS, or a list of drifted keys.

If it drifts, the message names the first failure. In order of likelihood:

| Symptom | Cause |
|---|---|
| Every character drifts, diff shows `strokeWidth` | The kebab-case rule is not applied to attributes |
| Only characters with `opacity` drift | React renders `opacity={0.12}` as `opacity="0.12"`; the builder is emitting `0.12` unquoted or dropping it as falsy |
| Only `Prop` characters drift | `fontFamily` is not kebab-cased, or `'` is being escaped where React leaves it |
| The `flower` or `star` props drift | Their `.map()` keys leaked into the output |

Compare one drifted pair directly:

```bash
node -e "import('./api/_lib/quizCharacterMarkup.js').then(async m=>{const a=await import('./api/_lib/quizCharacterArt.js');const s=m.CHARACTER_MARKUP['13:happy'];const b=a.characterSvgMarkup(a.avatarInfo(13),'happy');for(let i=0;i<Math.max(s.length,b.length);i++){if(s[i]!==b[i]){console.log('first diff at',i);console.log('stored:',JSON.stringify(s.slice(Math.max(0,i-60),i+60)));console.log('built :',JSON.stringify(b.slice(Math.max(0,i-60),i+60)));break}}})"
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS. Nothing else imports the art module yet, so this is the roster tests, the serialiser tests and the parity tests.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/quizCharacterArt.js api/_lib/characterArtParity.test.js
git commit -m "refactor(quiz): draw characters from the art module, byte for byte"
```

---

### Task 5: `Character.jsx` becomes a wrapper

Nothing changes on screen, in the DOM, or in the CSS. The component keeps rendering a real `<svg>` with the same classes
and the same attribute order, and injects only the **inside** of it — which is exactly what `characterSvgBody` is for.

Keeping the root element is what makes this safe. A `<div>` wrapper would have meant moving `overflow: visible` and the
`transform-box: view-box` rules in `characters.css` onto a different element, and a character that stopped animating is
not something a test suite would have caught.

**Files:**
- Modify: `src/components/quiz/Character.jsx`
- Modify: `api/_lib/characterSvg.test.js`

- [ ] **Step 1: Write the failing test**

Append to `api/_lib/characterArtParity.test.js`:

```js
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import Character from '../../src/components/quiz/Character.jsx'

describe('the component and the builder agree', () => {
  it('renders exactly the stored markup for a character', () => {
    expect(strip(renderToStaticMarkup(createElement(Character, { id: 13, mood: 'happy' }))))
      .toBe(stored(13, 'happy'))
  })

  it('still renders an svg root, so the animations and the callers are unaffected', () => {
    const html = renderToStaticMarkup(createElement(Character, { id: 13, mood: 'idle', className: 'h-16 w-16' }))
    expect(html.startsWith('<svg')).toBe(true)
    expect(html).toContain('h-16 w-16')
    expect(html).toContain('qz-i-bob')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run api/_lib/characterArtParity.test.js`
Expected: FAIL — the component still draws its own JSX tree, which differs from the committed markup in the attribute
order and in the `style` attributes `Arms` writes.

- [ ] **Step 3: Rewrite the component**

Replace all of `src/components/quiz/Character.jsx` with:

```jsx
import { characterSvgBody, avatarInfo } from '../../../api/_lib/quizCharacterArt.js'

// One of the quiz characters, drawn from the shared art module (api/_lib/quizCharacterArt.js), which the result cards
// draw from too. Who it is comes from `id`; the module says which body, headpiece, face, outfit and moves it has, and
// `mood` changes the face and the movement: idle, happy, dance, sad or wave.
//
// Only the inside of the svg comes from the module, as a string, so that this file stays a component the browser can
// render while the same drawing can be parsed by a server that cannot load a .jsx file. Nothing admin-authored reaches
// that string: every part is a key in a fixed table and the colour is a validated hex.
//
// The attributes below are in this order on purpose — React writes them in the order they are written, and the
// characterMarkup parity test compares this component's output against markup generated from the previous version.

export default function Character({ id, mood = 'idle', className = 'h-full w-full', title }) {
  const info = avatarInfo(id)
  return (
    <svg
      viewBox="0 0 100 100"
      className={`qz-char qz-mood-${mood} qz-i-${info.idle} qz-w-${info.win} qz-s-${info.sad} qz-h-${info.hello} ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: characterSvgBody(info, mood) }}
    />
  )
}
```

**No CSS change.** `.qz-char { overflow: visible }` and `.qz-char .qz-body { transform-box: view-box; transform-origin: 50px 88px }`
(`characters.css:6-9`) still apply to exactly the elements they applied to before.

- [ ] **Step 4: Run the parity test**

Run: `npx vitest run api/_lib/characterArtParity.test.js`
Expected: PASS, including the two new component tests.

- [ ] **Step 5: Fix the stylesheet-reach test**

`api/_lib/characterSvg.test.js:5` imports `AVATAR_COUNT` from `../../src/data/quizCharacters.js`, which Task 7 deletes. Repoint it now:

```js
import { BUILTIN_COUNT } from './quizCharacterArt.js'
```

and replace every use of `AVATAR_COUNT` in that file with `BUILTIN_COUNT`.

The other assertion in that file — that `Character.jsx` must **not** import `characters.css`, because the card loads this
component on a server where Node cannot parse a stylesheet — still holds, and is now more load-bearing than ever, because
the card no longer reads a generated table and instead goes through this module.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Look at it before committing**

Run: `npm run dev`, open a practice quiz and a hosted game's lobby, and check a character moves. **This is the one step a
test cannot do.** If the characters are static, the `.qz-char` classes are not reaching the animated element — go back to
Step 3.

- [ ] **Step 8: Commit**

```bash
git add src/components/quiz/Character.jsx api/_lib/characterSvg.test.js api/_lib/characterArtParity.test.js
git commit -m "refactor(quiz): render characters from the shared art module"
```

---

### Task 6: The card draws from the module too

**Files:**
- Modify: `api/_lib/characterSvg.js`

- [ ] **Step 1: Write the failing test**

Append to `api/_lib/characterSvg.test.js`:

```js
import { BUILTIN_COUNT, avatarInfo, characterSvgMarkup } from './quizCharacterArt.js'

describe('characterSvg for the card', () => {
  it('adds xmlns and a size so the canvas can parse it standalone', () => {
    const svg = characterSvg(7, { size: 160 })
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"')).toBe(true)
  })

  it('strips the animation classes, which mean nothing without the stylesheet', () => {
    expect(characterSvg(7)).not.toContain('qz-i-')
    expect(characterSvg(7)).not.toContain('class=')
  })

  it('draws the same picture the module builds', () => {
    expect(characterSvg(7)).toBe(
      characterSvgMarkup(avatarInfo(7), 'happy').replace(/\sclass="[^"]*"/g, ''),
    )
  })

  it('falls back to character 0 for an id it does not know', () => {
    expect(characterSvg(9999)).toBe(characterSvg(0))
  })

  it('draws all 50', () => {
    for (let id = 0; id < BUILTIN_COUNT; id++) expect(characterSvg(id)).toContain('<svg')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run api/_lib/characterSvg.test.js`
Expected: FAIL — `characterSvg` still reads the generated table, which happens to pass some of these and fail the
"draws the same picture" one only if the table and the builder ever disagree. If it passes everything, that is the point:
the table is still correct. The failure comes on Task 7 when the table is deleted.

- [ ] **Step 3: Rewrite the module**

Replace `api/_lib/characterSvg.js` with:

```js
import { characterSvgMarkup, avatarInfo, normalizeAvatarId } from './quizCharacterArt.js'

// The characters as SVG strings, for the result cards.
//
// @napi-rs/canvas parses a standalone SVG, and xmlns is what makes the string standalone. The animation classes
// (qz-i-*, qz-w-*, qz-h-*) are stripped here: they mean nothing without characters.css attached, which is exactly right
// for a still card.
//
// The drawing comes from api/_lib/quizCharacterArt.js, which src/components/quiz/Character.jsx draws from too, so the
// browser and the card cannot disagree about what a character looks like.
export function characterSvg(id, { mood = 'happy', size = 100 } = {}) {
  const px = Number(size) > 0 ? Math.round(Number(size)) : 100
  const markup = characterSvgMarkup(avatarInfo(normalizeAvatarId(id)), mood).replace(/\sclass="[^"]*"/g, '')
  return markup.replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}"`)
}
```

- [ ] **Step 4: Run the card tests**

Run: `npx vitest run api/_lib/characterSvg.test.js api/_lib/quizCardRender.test.js`
Expected: PASS. `quizCardRender.js` calls `characterSvg(avatarId, …)` and is untouched.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/characterSvg.js api/_lib/characterSvg.test.js
git commit -m "refactor(quiz): draw the result card's characters from the art module"
```

---

### Task 7: One home for the roster

**Files:**
- Modify: `api/_lib/quiz.js` (line 11)
- Modify: `src/data/quiz.js` (line 29)
- Delete: `src/data/quizCharacters.js`
- Delete: `src/data/quizCharacters.test.js`

- [ ] **Step 1: Repoint the two re-export sites**

`src/data/quiz.js:29`:

```js
export { BUILTIN_COUNT as AVATAR_COUNT, avatarInfo, normalizeAvatarId, randomAvatarId } from '../../../api/_lib/quizCharacterArt.js'
```

The alias keeps the four player screens (`PlayQuiz.jsx:4`, `PlayBattle.jsx:3`, `PlayPractice.jsx:3`, `HostQuiz.jsx`) untouched.
Rename it at the call sites in a later phase, not now.

`api/_lib/quiz.js:11`:

```js
import { BUILTIN_COUNT } from './quizCharacterArt.js'
```

replacing `export const AVATAR_COUNT = 50`, and:

```js
export { BUILTIN_COUNT }
export const AVATAR_COUNT = BUILTIN_COUNT
```

so `quiz-host.js:242`, `quiz-battle.js:588` and the handlers that import `AVATAR_COUNT` from `_lib/quiz.js` keep working.

- [ ] **Step 2: Repoint the two direct importers**

- `src/components/admin/quizStudio/CharacterGallery.jsx:2` → `from '../../../api/_lib/quizCharacterArt.js'`, with
  `AVATAR_COUNT` renamed to `BUILTIN_COUNT` in the three places it is used.
- `src/components/admin/quizStudio/quizStudio.test.jsx:8` → same.

`src/components/quiz/Character.jsx` was already repointed in Task 5.

- [ ] **Step 3: Delete the old module and its test**

```bash
git rm src/data/quizCharacters.js src/data/quizCharacters.test.js
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Lint and build**

Run: `npm run lint` — expected exit 0, warnings tolerated per `AGENTS.md`.
Run: `npm run build` — expected success.

- [ ] **Step 6: Commit**

```bash
git add -A src/data api/_lib/quiz.js src/components/admin/quizStudio
git commit -m "refactor(quiz): give the character roster one home"
```

---

### Task 8: Delete the generated copy

The last thing, because `api/_lib/quizCharacterMarkup.js` has been the oracle for every task above.

**Files:**
- Delete: `api/_lib/quizCharacterMarkup.js`
- Delete: `scripts/quizCharacterMarkup.test.js`
- Delete: `scripts/regenerateCharacters.mjs`
- Delete: `api/_lib/characterArtParity.test.js`
- Modify: `package.json`

- [ ] **Step 1: Prove the parity one last time**

Run: `npx vitest run api/_lib/characterArtParity.test.js`
Expected: PASS, all 250 stored strings reproduced.

If this fails, **stop**. The drawing is not identical to what shipped and something has changed on screen.

- [ ] **Step 2: Delete the oracle and the generator**

```bash
git rm api/_lib/quizCharacterMarkup.js scripts/quizCharacterMarkup.test.js scripts/regenerateCharacters.mjs api/_lib/characterArtParity.test.js
```

- [ ] **Step 3: Remove the npm script**

Delete this line from `package.json`:

```json
"cards:characters": "node scripts/regenerateCharacters.mjs",
```

Keep the comma handling valid — it is in the `"scripts"` block, so check the neighbouring lines before deleting.

- [ ] **Step 4: Confirm nothing still points at the deleted files**

Run: `npx vitest run 2>&1 | Select-String -Pattern "quizCharacterMarkup|regenerateCharacters"`
Expected: no matches.

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Lint and build**

Run: `npm run lint` — expected exit 0.
Run: `npm run build` — expected success.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(quiz): drop the generated character markup the art module replaces"
```

---

### Task 9: Record the new rule

`AGENTS.md` is the file agents read. This phase creates a new rule worth writing down, and deletes an old one.

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add the rule**

Add to the domain notes, after the "live quiz is all synthesised" entry:

```md
- **`api/_lib/quizCharacterArt.js` is the only place a character is drawn.** It returns SVG *strings*, not React elements,
  because a Vercel function cannot load a `.jsx` file — that failure is recorded in `api/_lib/characterSvg.js`. The browser
  injects the string with `dangerouslySetInnerHTML` and the card parses it with `@napi-rs/canvas`, so neither side can
  disagree about what a character looks like. **Nothing admin-authored may reach that markup**: every part is a key in a
  fixed table and the colour is a validated hex, and a character's name is never drawn into the SVG at all. Adding a
  `react-dom/server` call to a serverless function, or a second drawing of a character anywhere, both undo this.
```

- [ ] **Step 2: Remove the stale entry**

Delete the `quizCardRender.js`, `awardCardRender.js` and `fonts.js` sentence's claim about `Character.jsx` if it now
contradicts the above. Read the paragraph first; `AGENTS.md` lists `quizCharacterMarkup.js` nowhere, so this is likely a
no-op — verify rather than assume.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs(quiz): record where a character is drawn"
```

---

## Before you call this done

1. `npm test` — all suites pass.
2. `npm run lint` — exit 0.
3. `npm run build` — succeeds.
4. **Look at a character moving.** Task 5 Step 7 is the only check that the `div` wrapper did not break the animations, and
   the suite cannot see it. Open a practice run and a hosted lobby and watch one.
5. **Look at a result card.** `npm run dev`, finish a practice run, download the card. It must be pixel-identical to one
   downloaded before this phase. If it is not, the parity test lied somewhere.

**Say plainly that the result has not been seen in a real game unless you have.** Steps 4 and 5 need a Supabase login and a
real game; they cannot be faked.