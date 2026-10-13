# Quiz Character Parts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the six part lists from 75 entries to 137 — including 6 new bodies — and add a parts lab in the studio so all of it can be looked at.

**Architecture:** Every part is a pure function in `api/_lib/quizCharacterArt.js` that returns an `h()` tree, appended to the list its kind belongs to. Nothing else changes: a character is still a spec, and a new part is just another key the sanitiser accepts. The parts lab is a read-only studio tab that draws each option on one neutral body.

**Tech Stack:** Plain ESM JavaScript, React 19, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-quiz-character-cast-design.md` §4a, §8a.

**Depends on:** `2026-10-12-quiz-character-art-module.md` must be merged first. These parts are drawn as `h()` trees in the art module, and drawing them twice is not an option.

---

## How this plan is shaped, and why

This is art work, and a plan cannot contain 62 finished drawings without doing the work. What it can do — and what this
one does — is fix everything around the drawings so that the drawings are the only judgement left:

- The **complete list of all 137 names** is in the test file in Task 1. The suite is the contract, and it fails until
  every one of them draws.
- The **6 new body geometry rows** are given as exact numbers in Task 3, because those are what everything else positions
  itself against, and guessing them is how a crown ends up hovering above a head.
- **One worked example per category** is written out in full.
- A **bounds test** proves no part draws outside the 100 × 100 box on any body.

Everything else is the engineer drawing, one part at a time, against a red test.

---

## File structure

| File | Responsibility |
|---|---|
| `api/_lib/quizCharacterArt.js` | **Modify.** `BODY` gains 6 rows; each of the six part lists gains its new names; six functions gain new cases. |
| `api/_lib/quizCharacterArt.test.js` | **Modify.** The full 137-name contract, the geometry invariants, the per-body strip. |
| `src/components/admin/quizStudio/PartsLab.jsx` | **Create.** Read-only browser: six category tabs, a filter, one part at a time. |
| `src/components/admin/quizStudio/PartsLab.test.jsx` | **Create.** |
| `src/pages/admin/AdminQuizStudio.jsx` | **Modify.** One more tab. |
| `src/components/admin/quizStudio/CharacterGallery.jsx` | **Unchanged.** The 50 do not use a single new part. |

---

### Task 1: The contract — all 137 names, and the invariants

**Files:**
- Modify: `api/_lib/quizCharacterArt.test.js`

- [ ] **Step 1: Write the failing test**

Append to `api/_lib/quizCharacterArt.test.js`:

```js
import { BODIES, TOPPERS, EYES, MOUTHS, ACCESSORIES, PROPS, BODY, DEFAULT_MOOD } from './quizCharacterArt.js'

// The drawer. These six lists are what an admin builds a custom character from, so the list is the contract: the suite
// fails until every name in it draws. New parts are added here first, then drawn.

const NEW_PARTS = {
  bodies: ['pot', 'capsule', 'puck', 'cup', 'cone', 'moon'],
  toppers: ['fin', 'mohawk', 'beret', 'headband-over', 'leafcrown', 'antennae', 'braid', 'pigtails', 'curls', 'bandana', 'cowlick', 'tiara'],
  eyes: ['goggles-round', 'sleep', 'wink-left', 'shades', 'heart-eyes', 'hollow', 'glasses-dot', 'squint'],
  mouths: ['zigzag', 'smiley', 'open-smile', 'flat-wide', 'smirk-left', 'stitched'],
  accessories: ['weldmask', 'labcoat', 'goggles-on-hat', 'headband', 'apron', 'earmuffs', 'medal', 'scarf-long', 'gloves', 'toolbelt', 'armband', 'pocketwatch', 'ribbon', 'chain', 'badge', 'flask'],
  props: ['calipers', 'ingot', 'gear', 'beaker', 'micrometer', 'anvil', 'wrench', 'magnet', 'bead', 'crystal', 'seedling', 'kite', 'lantern', 'dice'],
}

const ALL_PARTS = { bodies: BODIES, toppers: TOPPERS, eyes: EYES, mouths: MOUTHS, accessories: ACCESSORIES, props: PROPS }

describe('the drawer', () => {
  it.each(Object.entries(NEW_PARTS))('has drawn every new %s', (kind, names) => {
    const missing = names.filter((name) => !ALL_PARTS[kind].includes(name))
    expect(missing, `${kind} missing from the list`).toEqual([])
  })

  it.each(Object.entries(NEW_PARTS))('draws every new %s', (kind, names) => {
    const field = { bodies: 'body', toppers: 'topper', eyes: 'eyes', mouths: 'mouth', accessories: 'accessory', props: 'prop' }[kind]
    for (const name of names) {
      expect(() => characterSvgBody({ ...DEFAULT_MOOD, [field]: name }, 'idle'), `${field} ${name}`).not.toThrow()
    }
  })

  it('holds 137 parts in total', () => {
    expect(Object.values(ALL_PARTS).flat()).toHaveLength(137)
  })

  it('gives every body a geometry row', () => {
    for (const kind of BODIES) expect(BODY[kind], `no geometry row for ${kind}`).toBeDefined()
  })

  it('puts a body’s eyes above its neck and its head top above its eyes', () => {
    for (const [kind, g] of Object.entries(BODY)) {
      expect(g.eyeY, kind).toBeGreaterThan(g.top)
      expect(g.neckY, kind).toBeGreaterThan(g.eyeY)
    }
  })

  it('keeps ears and arms inside the box', () => {
    for (const [kind, g] of Object.entries(BODY)) {
      for (const [x, y] of [g.ear, g.arm]) {
        expect(x, `${kind} anchor x`).toBeGreaterThan(0)
        expect(x, `${kind} anchor x`).toBeLessThan(50)
        expect(y, `${kind} anchor y`).toBeGreaterThan(0)
        expect(y, `${kind} anchor y`).toBeLessThan(100)
      }
    }
  })
})
```

Then add `DEFAULT_MOOD` to `api/_lib/quizCharacterArt.js`, immediately after the part lists — it is the neutral body every
one of these tests draws on:

```js
// The character the parts lab and these tests draw on: one plain blob, a dot for an eye, a smile, nothing on. Phase 3
// turns this into the starting point the cast editor opens a new character from, so it is exported rather than local.
export const DEFAULT_MOOD = {
  name: '',
  body: 'blob',
  topper: 'none',
  eyes: 'round',
  mouth: 'smile',
  accessory: 'none',
  prop: 'none',
  color: builtinColour(0),
  idle: 'bob',
  win: 'jump',
  sad: 'droop',
  hello: 'wave',
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run api/_lib/quizCharacterArt.test.js`
Expected: FAIL — `DEFAULT_MOOD` is not exported, and every new part is missing from its list.

- [ ] **Step 3: Commit the red test**

```bash
git add api/_lib/quizCharacterArt.test.js
git commit -m "test(quiz): name every part the drawer has to hold"
```

---

### Task 2: The cheap parts — eyes, mouths, toppers

Three categories, 26 new entries, no geometry involved. Start here because it is the fastest way to see the drawer grow.

**Files:**
- Modify: `api/_lib/quizCharacterArt.js`

- [ ] **Step 1: Draw the eyes**

Append to the `eye()` function's `switch`. Each case receives `{ kind, x, y }` and returns one or two `h()` trees. The
existing `dot` case is the model:

```js
    case 'goggles-round':
      return [
        h('circle', { cx: x, cy: y, r: 7, fill: '#fff', stroke: INK, strokeWidth: 1.2 }),
        h('circle', { cx: x + 0.6, cy: y + 0.6, r: 3.6, fill: INK }),
        h('circle', { cx: x - 3.4, cy: y - 3, r: 2.4, fill: '#fff', opacity: '0.7' }),
      ]
    case 'sleep':
      return h('path', { d: `M${x - 6} ${y} q6 5 12 0`, fill: 'none', stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round' })
    case 'wink-left':
      return x < 50
        ? h('path', { d: `M${x - 6} ${y} q6 6 12 0`, fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'round' })
        : h('circle', { cx: x, cy: y, r: 7, fill: '#fff' })
    case 'shades':
      return h('rect', { x: x - 8, y: y - 5, width: 16, height: 9, rx: 3, fill: '#111827', stroke: INK, strokeWidth: 1.4 })
    case 'heart-eyes':
      return h('path', {
        d: `M${x} ${y + 4} C${x - 8} ${y - 2} ${x - 7} ${y - 9} ${x} ${y - 5} C${x + 7} ${y - 9} ${x + 8} ${y - 2} ${x} ${y + 4}z`,
        fill: '#f43f5e', stroke: '#9f1239', strokeWidth: 1.2, strokeLinejoin: 'round',
      })
    case 'hollow':
      return [
        h('circle', { cx: x, cy: y, r: 7, fill: '#0b2417' }),
        h('circle', { cx: x - 2, cy: y - 2, r: 2.2, fill: '#fff', opacity: '0.8' }),
      ]
    case 'glasses-dot':
      return [
        h('circle', { cx: x, cy: y, r: 7.4, fill: '#fff', stroke: '#2563eb', strokeWidth: 1.8 }),
        h('circle', { cx: x + 1, cy: y + 0.5, r: 3.4, fill: INK }),
      ]
    case 'squint':
      return h('path', { d: `M${x - 6} ${y - 2} l12 4`, stroke: INK, strokeWidth: 2.8, strokeLinecap: 'round' })
```

- [ ] **Step 2: Draw the mouths**

Append to `mouth()`'s switch. It receives `{ kind, y }`:

```js
    case 'zigzag':
      return h('path', { d: `M41 ${y + 2}l4 -3 4 3 4 -3 4 3`, fill: 'none', stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' })
    case 'smiley':
      return [
        h('circle', { cx: 50, cy: y - 1, r: 9, fill: '#fff', stroke: INK, strokeWidth: 1.8 }),
        h('path', { d: `M45 ${y + 1}q5 5 10 0`, fill: 'none', stroke: INK, strokeWidth: 2, strokeLinecap: 'round' }),
        h('circle', { cx: 46, cy: y - 4, r: 1.6, fill: INK }),
        h('circle', { cx: 54, cy: y - 4, r: 1.6, fill: INK }),
      ]
    case 'open-smile':
      return h('path', { d: `M41 ${y - 2}q9 14 18 0z`, fill: '#7f1d1d', stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' })
    case 'flat-wide':
      return h('path', { d: `M40 ${y + 2}h20`, stroke: INK, strokeWidth: 3, strokeLinecap: 'round' })
    case 'smirk-left':
      return h('path', { d: `M42 ${y + 3}q8 -5 16 0`, fill: 'none', stroke: INK, strokeWidth: 2.8, strokeLinecap: 'round' })
    case 'stitched':
      return [
        h('path', { d: `M41 ${y + 1}h18`, stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round' }),
        ...[44, 49, 54].map((x) => h('line', { x1: x, y1: y - 1.5, x2: x, y2: y + 3.5, stroke: INK, strokeWidth: 1.6 })),
      ]
```

- [ ] **Step 3: Draw the toppers**

Append to `topper()`'s switch. It receives `{ kind, body, color }` and reads `BODY[body]` for `top` and `ear`, exactly as
the existing cases do. **Every new topper must read `top` or `ear` from that table rather than hard-coding a number**,
because that is the whole reason a topper works on all 19 bodies and the reason a new body does not need 12 redraws.

```js
    case 'fin':
      return h('path', {
        d: `M50 ${top + 4}q-6-14 4-16 8-1 4 9`, fill: 'none', stroke: color.dark, strokeWidth: '3.2', strokeLinecap: 'round',
      })
    case 'mohawk':
      return [40, 46, 52, 58].map((x, i) => h('polygon', {
        points: `${x},${top + 5} ${x + 3},${top - 5 - i * 2} ${x + 6},${top + 5}`,
        fill: color.dark, stroke: color.dark, strokeWidth: '1.6', strokeLinejoin: 'round',
      }))
    case 'beret':
      return [
        h('ellipse', { cx: 50, cy: top + 4, rx: 21, ry: 8, fill: color.dark }),
        h('circle', { cx: 50, cy: top - 5, r: 2.4, fill: color.dark }),
      ]
    case 'headband-over':
      return [
        h('path', { d: `M${50 - ey} ${ey + 2}Q50 ${top - 8} ${50 + ey} ${ey + 2}`, fill: 'none', stroke: '#111827', strokeWidth: '4.4', strokeLinecap: 'round' }),
        h('rect', { x: 50 - ey - 8, y: ey, width: 9, height: 15, rx: 4, fill: color.dark }),
        h('rect', { x: 50 + ey - 1, y: ey, width: 9, height: 15, rx: 4, fill: color.dark }),
      ]
    case 'leafcrown':
      return [36, 44, 56, 64].map((x, i) => h('ellipse', {
        cx: x, cy: top - 2, rx: 6.4, ry: 3.4, transform: `rotate(${i < 2 ? -26 : 26} ${x} ${top - 2})`,
        fill: i % 2 ? '#86efac' : '#4ade80', stroke: '#15803d', strokeWidth: '1.4',
      }))
    case 'antennae':
      return [-1, 1].map((s) => [
        h('path', { d: `M${50 + s * 4} ${top + 4}q${s * 6} -8 ${s * 8} -14`, fill: 'none', stroke: color.dark, strokeWidth: '2.4', strokeLinecap: 'round' }),
        h('circle', { cx: 50 + s * 12, cy: top - 11, r: 3.4, fill: color.light, stroke: color.dark, strokeWidth: '1.8' }),
      ])
    case 'braid':
      return [0, 1, 2].map((i) => h('ellipse', {
        cx: 58, cy: top + 8 + i * 9, rx: 5.4, ry: 4.4, fill: color.main, stroke: color.dark, strokeWidth: '2', strokeLinejoin: 'round',
      }))
    case 'pigtails':
      return [-1, 1].map((s) => h('ellipse', {
        cx: 50 + s * (ex + 6), cy: ey + 10, rx: 7, ry: 12, transform: `rotate(${s * 14} ${50 + s * (ex + 6)} ${ey + 10})`,
        fill: color.main, stroke: color.dark, strokeWidth: '2',
      }))
    case 'curls':
      return [0, 1, 2, 3].map((i) => h('circle', {
        cx: 32 + i * 12, cy: top + 4, r: 6, fill: color.main, stroke: color.dark, strokeWidth: '2',
      }))
    case 'bandana':
      return [
        h('path', { d: `M${50 - ex - 2} ${ey - 4}q${ex + 2} -10 ${ex * 2 + 4} 0z`, fill: '#dc2626', stroke: '#7f1d1d', strokeWidth: '1.8', strokeLinejoin: 'round' }),
        h('path', { d: `M${50 + ex - 2} ${ey - 4}q${-(ex + 2)} -10 ${-(ex * 2 + 4)} 0z`, fill: '#dc2626', stroke: '#7f1d1d', strokeWidth: '1.8', strokeLinejoin: 'round' }),
      ]
    case 'cowlick':
      return h('path', {
        d: `M46 ${top + 6}q2 -14 12 -10t-2 10`, fill: 'none', stroke: color.dark, strokeWidth: '3.4', strokeLinecap: 'round',
      })
    case 'tiara':
      return [
        h('path', { d: `M38 ${top + 5}l-2-11 8 6 6-10 6 10 8-6-2 11z`, fill: '#fbbf24', stroke: '#b45309', strokeWidth: '1.8', strokeLinejoin: 'round' }),
        h('circle', { cx: 50, cy: top - 3, r: 2, fill: '#f43f5e' }),
      ]
```

Then extend the three lists:

```js
export const TOPPERS = ['none', 'cat', 'bunny', 'bear', 'horns', 'antenna', 'bugs', 'sprout', 'spikes', 'floppy', 'halo', 'tuft',
  'fin', 'mohawk', 'beret', 'headband-over', 'leafcrown', 'antennae', 'braid', 'pigtails', 'curls', 'bandana', 'cowlick', 'tiara']
export const EYES = ['round', 'dot', 'sleepy', 'wide', 'wink', 'star', 'slit', 'lash', 'cyclops', 'spiral',
  'goggles-round', 'sleep', 'wink-left', 'shades', 'heart-eyes', 'hollow', 'glasses-dot', 'squint']
export const MOUTHS = ['smile', 'grin', 'cat', 'o', 'smirk', 'tongue', 'fang', 'flat',
  'zigzag', 'smiley', 'open-smile', 'flat-wide', 'smirk-left', 'stitched']
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run api/_lib/quizCharacterArt.test.js`
Expected: FAIL only on `has drawn every new bodies`, `accessories` and `props` — the categories Task 2 does not cover.

- [ ] **Step 5: Look at them**

Run: `npm run dev`, open `/admin/quizzes/<id>/studio`, go to the Characters tab and pick one of the 50. The eyes and
mouths you just drew appear on it. **This is a visual check, not a test** — a mouth that is technically inside the box and
three millimetres too low still passes.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/quizCharacterArt.js api/_lib/quizCharacterArt.test.js
git commit -m "feat(quiz): add 26 eyes, mouths and headpieces to the drawer"
```

---

### Task 3: The six new bodies

The expensive, high-risk task. Every hat, accessory and prop positions itself off these six rows.

**Files:**
- Modify: `api/_lib/quizCharacterArt.js`

- [ ] **Step 1: Write the failing strip test**

Append to `api/_lib/quizCharacterArt.test.js`:

```js
import { characterSvgBody } from './quizCharacterArt.js'

// Every part, on every body. A topper reads its position from the body's geometry row, so a wrong row shows up as a
// hat drawn off to one side — which no single-part test would catch.
describe('every part on every body', () => {
  const NEW = ['pot', 'capsule', 'puck', 'cup', 'cone', 'moon']

  it.each(NEW)('draws %s with nothing on it', (bodyKind) => {
    expect(characterSvgBody({ ...DEFAULT_MOOD, body: bodyKind }, 'idle')).toContain('<svg')
  })

  it.each(NEW)('draws %s with all 24 headpieces, 36 accessories and 26 props', (bodyKind) => {
    const base = { ...DEFAULT_MOOD, body: bodyKind }
    for (const topper of TOPPERS) expect(() => characterSvgBody({ ...base, topper }, 'idle')).not.toThrow()
    for (const accessory of ACCESSORIES) expect(() => characterSvgBody({ ...base, accessory }, 'idle')).not.toThrow()
    for (const prop of PROPS) expect(() => characterSvgBody({ ...base, prop }, 'idle')).not.toThrow()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run api/_lib/quizCharacterArt.test.js`
Expected: FAIL — the six bodies are not in the list yet.

- [ ] **Step 3: Add the geometry rows**

Add to `BODY` in `api/_lib/quizCharacterArt.js`. These are the numbers; do not adjust them to suit a drawing, adjust the
drawing.

```js
const NEW_GEOMETRY = {
  pot:     { eyeY: 56, top: 20, ear: [24, 26], neckY: 74, arm: [30, 64] },
  capsule: { eyeY: 44, top: 10, ear: [14, 24], neckY: 76, arm: [27, 58] },
  puck:    { eyeY: 48, top: 32, ear: [28, 40], neckY: 74, arm: [34, 60] },
  cup:     { eyeY: 52, top: 16, ear: [30, 44], neckY: 74, arm: [26, 64] },
  cone:    { eyeY: 62, top: 12, ear: [22, 34], neckY: 78, arm: [28, 72] },
  moon:    { eyeY: 46, top: 14, ear: [12, 40], neckY: 72, arm: [24, 62] },
}
```

and add the six names to `BODIES`:

```js
export const BODIES = ['blob', 'box', 'round', 'bean', 'ghost', 'onigiri', 'cloud', 'drop', 'loaf', 'hexagon', 'pear', 'jelly', 'diamond',
  'pot', 'capsule', 'puck', 'cup', 'cone', 'moon']
```

**How to sanity-check a row before drawing anything else:** compare it with the existing bodies.

| Row | Reads as |
|---|---|
| `top` | Where a hat's flat base sits. Lower number = taller head. `diamond` is 12; `loaf` is 30 |
| `eyeY` | Must sit between `top` and `neckY`. The tests assert this for every body |
| `ear` | `[x, y]` where an ear, horn or antenna attaches, `x` being the offset from the centreline. Small `x` = a narrow head |
| `neckY` | Where a scarf, tie or bowtie sits. Must be below `eyeY` |
| `arm` | `[x, y]` where the shoulder is, and therefore the pivot the arm rotates about |

- [ ] **Step 4: Draw the six bodies**

Add six cases to `body()`'s switch. Each receives `(kind, color)` and returns the fill plus any shadow feet, exactly as
the existing cases do. `color` gives `{ main, dark, light }`.

```js
    case 'pot':
      return [
        h('path', { d: 'M50 18c-13 0-20 10-22 26-2 18 4 38 22 38s24-20 22-38c-2-16-9-26-22-26z', fill: color.main, ...line }),
        h('rect', { x: 25, y: 14, width: 50, height: 10, rx: 5, fill: color.dark }),
      ]
    case 'capsule':
      return h('rect', { x: 26, y: 10, width: 48, height: 80, rx: 24, ...fill })
    case 'puck':
      return [
        h('rect', { x: 14, y: 34, width: 72, height: 32, rx: 14, ...fill }),
        h('rect', { x: 22, y: 74, width: 10, height: 7, rx: 2.5, fill: color.dark }),
        h('rect', { x: 68, y: 74, width: 10, height: 7, rx: 2.5, fill: color.dark }),
      ]
    case 'cup':
      return [
        h('path', { d: 'M28 16h40v52a12 12 0 0 1-12 12H40a12 12 0 0 1-12-12z', ...fill }),
        h('path', { d: 'M68 30h8a10 10 0 0 1 0 20h-8', fill: 'none', stroke: color.dark, strokeWidth: '4', strokeLinecap: 'round' }),
      ]
    case 'cone':
      return [
        h('path', { d: 'M50 12l22 66H28z', ...fill }),
        h('path', { d: 'M36 52h28', fill: 'none', stroke: color.light, strokeWidth: '4' }),
      ]
    case 'moon':
      return h('path', { d: 'M62 14a34 34 0 1 0 0 72 28 28 0 0 1 0-72z', ...fill })
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run api/_lib/quizCharacterArt.test.js`
Expected: every body test passes; the drawer count still fails, because 16 accessories and 14 props are still missing.

- [ ] **Step 6: Check every topper sits on all six**

Run: `npm run dev`, open the studio, and look at the gallery. **Look at all 24 headpieces on all six new bodies.** A
`loaf`'s geometry works with `curls` because `loaf` is wide and low; a `moon` is a crescent and has no top at all, so a
hat on a `moon` is a judgement call that only you can make.

- [ ] **Step 7: Commit**

```bash
git add api/_lib/quizCharacterArt.js api/_lib/quizCharacterArt.test.js
git commit -m "feat(quiz): add six new bodies to the drawer"
```

---

### Task 4: The bounds test

The one thing that can be proved rather than looked at.

**Files:**
- Modify: `api/_lib/quizCharacterArt.test.js`

- [ ] **Step 1: Write the failing test**

```js
// Every coordinate the drawing emits, checked against the 100 x 100 box. Catches a part drawn off the canvas, which is
// the failure mode that is obvious in the lab and invisible to every other test here.
const COORDS = /\b(?:cx|cy|x|y|x1|y1|x2|y2|rx|ry|r)="(-?[\d.]+)"/g

function coordinatesIn(svg) {
  const found = []
  for (const match of svg.matchAll(COORDS)) found.push(Number(match[1]))
  for (const match of svg.matchAll(/\bpoints="([^"]+)"/g)) {
    for (const pair of match[1].trim().split(/\s+/)) found.push(Number(pair.split(',')[0]), Number(pair.split(',')[1]))
  }
  return found
}

describe('nothing is drawn off the canvas', () => {
  it.each(BODIES)('%s keeps every part inside the box', (bodyKind) => {
    const base = { ...DEFAULT_MOOD, body: bodyKind }
    const offenders = []
    for (const topper of TOPPERS) offenders.push(...check({ ...base, topper }, `topper ${topper}`))
    for (const accessory of ACCESSORIES) offenders.push(...check({ ...base, accessory }, `accessory ${accessory}`))
    for (const prop of PROPS) offenders.push(...check({ ...base, prop }, `prop ${prop}`))
    expect(offenders).toEqual([])
  })

  function check(spec, label) {
    const bad = coordinatesIn(characterSvgBody(spec, 'idle')).filter((n) => n < -2 || n > 102)
    return bad.length ? [`${label} on ${spec.body} has ${bad.length} coordinate(s) out of bounds: ${bad.join(', ')}`] : []
  }
})
```

The bounds are `-2` and `102`, not `0` and `100`, on purpose: a shadow ellipse or an antler is allowed to bleed slightly
off the edge, because `.qz-char { overflow: visible }` is there so it can. A part at `-40` is a bug; a part at `-2` is a
hat brim.

- [ ] **Step 2: Run it**

Run: `npx vitest run api/_lib/quizCharacterArt.test.js`
Expected: FAIL, listing the parts that bleed. Fix each by moving the part, not by widening the bounds.

- [ ] **Step 3: Run it again**

Run: `npx vitest run api/_lib/quizCharacterArt.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add api/_lib/quizCharacterArt.test.js
git commit -m "test(quiz): hold every part inside the canvas"
```

---

### Task 5: Accessories and props, including the seven materials-engineering ones

**Files:**
- Modify: `api/_lib/quizCharacterArt.js`

- [ ] **Step 1: Draw the 16 accessories**

Append to `accessory()`'s switch. It receives `{ kind, top, eyeY, neckY }`. **Follow the existing rule: an accessory
carries its own fixed colours**, the way the crown is gold and the bowtie red. Only the two that must read as cloth —
`apron` and `pocketwatch` — take `color`, and the function signature needs `color` added for those two.

Two worked examples, one of each kind:

```js
    case 'weldmask':
      return [
        h('path', { d: `M25 ${eyeY - 14}h50v12q0 16-25 16t-25-16z`, fill: '#1f2937', stroke: '#111827', strokeWidth: '2', strokeLinejoin: 'round' }),
        h('rect', { x: 33, y: eyeY - 9, width: 12, height: 9, rx: 2, fill: '#0b2417', stroke: '#4b5563', strokeWidth: '1.4' }),
        h('rect', { x: 55, y: eyeY - 9, width: 12, height: 9, rx: 2, fill: '#0b2417', stroke: '#4b5563', strokeWidth: '1.4' }),
      ]
    case 'flask':
      return [
        h('path', { d: `M${50 - 9} ${top + 2}h18v6l6 10v10q0 6-6 6h-18q-6 0-6-6v-10l6-10z`, fill: 'rgba(186,230,253,0.4)', stroke: '#0369a1', strokeWidth: '1.8', strokeLinejoin: 'round' }),
        h('path', { d: `M${50 - 7} ${top + 18}h14v10q0 5-7 5t-7-5z`, fill: '#4ade80', opacity: '0.8' }),
      ]
```

The other fourteen: `labcoat`, `goggles-on-hat`, `headband`, `apron`, `earmuffs`, `medal`, `scarf-long`, `gloves`,
`toolbelt`, `armband`, `pocketwatch`, `ribbon`, `chain`, `badge`.

- [ ] **Step 2: Draw the 14 props**

Append to `prop()`'s switch, which receives `{ kind }` and returns the art inside a `qz-prop` group the existing wrapper
already provides. Fixed colours, as with accessories. Seven of these are the materials-engineering ones; draw those to
be recognisable at 48px, because that is the size they will be seen at in a picker grid.

```js
    case 'calipers':
      return [
        h('path', { d: 'M4 4v14M4 4l14 6', fill: 'none', stroke: '#94a3b8', strokeWidth: '2.4', strokeLinecap: 'round' }),
        h('path', { d: 'M20 4v14M20 4L6 10', fill: 'none', stroke: '#94a3b8', strokeWidth: '2.4', strokeLinecap: 'round' }),
        h('rect', { x: 9, y: 2, width: 6, height: 5, rx: 1, fill: '#475569' }),
      ]
    case 'ingot':
      return [
        h('path', { d: 'M3 12l3-5h12l3 5-3 4H6z', fill: '#9ca3af', stroke: '#4b5563', strokeWidth: '1.4', strokeLinejoin: 'round' }),
        h('path', { d: 'M6 12h12', stroke: '#e5e7eb', strokeWidth: '1.4' }),
      ]
    case 'gear':
      return [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => h('rect', {
        x: 9.5, y: 0.5, width: 3, height: 5, transform: `rotate(${deg} 11 11)`, fill: '#64748b',
      })).concat([
        h('circle', { cx: 11, cy: 11, r: 7.4, fill: '#64748b', stroke: '#334155', strokeWidth: '1.4' }),
        h('circle', { cx: 11, cy: 11, r: 2.6, fill: '#e2e8f0' }),
      ])
```

The other eleven: `beaker`, `micrometer`, `anvil`, `wrench`, `magnet`, `bead`, `crystal`, `seedling`, `kite`, `lantern`, `dice`.

- [ ] **Step 3: Extend the two lists**

```js
export const ACCESSORIES = [
  'none', 'sunglasses', 'glasses', 'headphones', 'bowtie', 'tie', 'scarf', 'monocle', 'eyepatch', 'ninja',
  'hero', 'flower', 'crown', 'gradcap', 'partyhat', 'goggles', 'mustache', 'cap', 'chef', 'beanie',
  'weldmask', 'labcoat', 'goggles-on-hat', 'headband', 'apron', 'earmuffs', 'medal', 'scarf-long', 'gloves', 'toolbelt',
  'armband', 'pocketwatch', 'ribbon', 'chain', 'badge', 'flask',
]
export const PROPS = ['none', 'bulb', 'book', 'star', 'heart', 'note', 'pi', 'sigma', 'sqrt', 'infinity', 'balloon', 'trophy',
  'calipers', 'ingot', 'gear', 'beaker', 'micrometer', 'anvil', 'wrench', 'magnet', 'bead', 'crystal', 'seedling', 'kite', 'lantern', 'dice']
```

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: PASS, including `holds 137 parts in total`.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/quizCharacterArt.js
git commit -m "feat(quiz): add 30 accessories and props to the drawer"
```

---

### Task 6: The parts lab

Now there is something to look at.

**Files:**
- Create: `src/components/admin/quizStudio/PartsLab.jsx`
- Create: `src/components/admin/quizStudio/PartsLab.test.jsx`
- Modify: `src/pages/admin/AdminQuizStudio.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/admin/quizStudio/PartsLab.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PartsLab from './PartsLab'
import { BODIES, TOPPERS, EYES, MOUTHS, ACCESSORIES, PROPS } from '../../../api/_lib/quizCharacterArt.js'

describe('the parts lab', () => {
  it('shows one category at a time, never all 137', () => {
    render(<PartsLab />)
    for (const kind of BODIES) expect(screen.getByRole('button', { name: `body ${kind}` })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `prop ${PROPS[13]}` })).not.toBeInTheDocument()
  })

  it('counts each category on its tab', () => {
    render(<PartsLab />)
    expect(screen.getByRole('tab', { name: `Body (${BODIES.length})` })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: `Prop (${PROPS.length})` })).toBeInTheDocument()
  })

  it('filters by name and can be cleared', async () => {
    render(<PartsLab />)
    const search = screen.getByRole('searchbox', { name: 'Filter parts' })
    await userEvent.type(search, 'weld')
    expect(screen.getByRole('button', { name: 'accessory weldmask' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'accessory crown' })).not.toBeInTheDocument()
  })

  it('writes nothing: there is no save control anywhere in it', () => {
    render(<PartsLab />)
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
  })
})
```

If `@testing-library/react` is not already a dependency — check `package.json` before writing this — then this task becomes
a source-level test in the style of `src/components/admin/quizStudio/quizStudio.test.jsx`, which reads the file and asserts
on its source. Do not add a testing library for this.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/admin/quizStudio/PartsLab.test.jsx`
Expected: FAIL — `PartsLab` does not exist.

- [ ] **Step 3: Write the component**

Create `src/components/admin/quizStudio/PartsLab.jsx`:

```jsx
import { useState } from 'react'
import { BODIES, TOPPERS, EYES, MOUTHS, ACCESSORIES, PROPS, DEFAULT_MOOD } from '../../../api/_lib/quizCharacterArt.js'
import Character from '../../quiz/Character'
import '../../quiz/characters.css'

// Every part in the drawer, one category at a time, drawn on one plain body. Nothing here writes: the cast editor in
// Phase 3 is the only place a character is changed. This exists because 137 parts across six categories in one scroll is
// a list nobody reads, and because new art needs somewhere to be looked at before anyone has built a character with it.

const CATEGORIES = [
  { id: 'body', label: 'Body', field: 'body', parts: BODIES },
  { id: 'topper', label: 'Headpiece', field: 'topper', parts: TOPPERS },
  { id: 'eyes', label: 'Eyes', field: 'eyes', parts: EYES },
  { id: 'mouth', label: 'Mouth', field: 'mouth', parts: MOUTHS },
  { id: 'accessory', label: 'Wears', field: 'accessory', parts: ACCESSORIES },
  { id: 'prop', label: 'Prop', field: 'prop', parts: PROPS },
]

const MOODS = ['idle', 'wave', 'happy', 'dance', 'sad']

export default function PartsLab() {
  const [category, setCategory] = useState(CATEGORIES[0])
  const [filter, setFilter] = useState('')
  const [chosen, setChosen] = useState(null)

  const shown = category.parts.filter((name) => name.includes(filter.trim().toLowerCase()))
  const spec = chosen
    ? { ...DEFAULT_MOOD, [category.field]: chosen }
    : DEFAULT_MOOD

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-hairline bg-surface p-5 text-center shadow-md">
          <div className="mx-auto h-44 w-44">
            <Character key={`${category.field}-${chosen}`} spec={spec} mood="idle" title={chosen ?? 'A plain character'} />
          </div>
          <h3 className="mt-2 text-2xl font-bold text-ink-900">{chosen ?? category.label}</h3>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">
            {shown.length} of {category.parts.length}
          </p>
          {chosen && (
            <div className="mt-3 flex justify-center gap-2">
              {MOODS.map((mood) => (
                <span key={mood} className="h-12 w-12">
                  <Character spec={spec} mood={mood} />
                </span>
              ))}
            </div>
          )}
        </div>
        <label className="block text-sm font-semibold text-ink-900">
          Filter parts
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-base text-ink"
          />
        </label>
      </aside>

      <div>
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Part categories">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === category.id}
              onClick={() => { setCategory(c); setChosen(null); setFilter('') }}
              className={[
                'min-h-11 cursor-pointer rounded-full px-5 text-sm font-bold',
                c.id === category.id ? 'bg-green-900 text-white' : 'border border-hairline bg-surface text-ink-900 hover:bg-surface-low',
              ].join(' ')}
            >
              {c.label} ({c.parts.length})
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p role="status" className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-ink-muted">
            Nothing in {category.label} matches “{filter}”.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
            {shown.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => setChosen(name)}
                  aria-pressed={chosen === name}
                  aria-label={`${category.field} ${name}`}
                  className={[
                    'flex w-full cursor-pointer flex-col items-center gap-1 rounded-2xl border bg-surface p-2 shadow-sm transition-colors',
                    chosen === name ? 'border-orange-500 ring-2 ring-orange-500/40' : 'border-hairline hover:bg-surface-low',
                  ].join(' ')}
                >
                  <span className="block h-16 w-16">
                    <Character spec={{ ...DEFAULT_MOOD, [category.field]: name }} mood="static" />
                  </span>
                  <span className="w-full truncate text-xs font-semibold text-ink-900">{name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

**`Character` needs a `spec` prop for this to work.** Add it in this same task:

```jsx
export default function Character({ id, spec, mood = 'idle', className = 'h-full w-full', title }) {
  const info = spec ?? avatarInfo(id)
  ...
}
```

`id` stays supported so the four player screens, the host board and the gallery keep working untouched. A character with
neither is a programming error, not a user error, so do not add a fallback — let `avatarInfo(undefined)` return
character 0 exactly as it does today.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/components/admin/quizStudio/PartsLab.test.jsx`
Expected: PASS.

- [ ] **Step 5: Add the tab**

In `AdminQuizStudio.jsx`, add after the Characters tab button (line 218):

```jsx
<TabButton active={tab === 'parts'} onClick={() => setTab('parts')}>Parts lab ({BODIES.length + TOPPERS.length + EYES.length + MOUTHS.length + ACCESSORIES.length + PROPS.length})</TabButton>
```

with the six lists imported from `../../../api/_lib/quizCharacterArt.js`, and add the body next to the characters branch:

```jsx
{tab === 'parts' ? (
  <div className="mt-6">
    <PartsLab />
  </div>
) : tab === 'characters' ? (
```

The `tab !== 'characters' && tab !== 'card'` guard on line 203 keeps this tab from showing the look's Save button, which
is correct — the lab saves nothing. Add `&& tab !== 'parts'` to that guard anyway, so a new read-only tab can never show a
Save that does nothing.

- [ ] **Step 6: Run the suite, lint and build**

Run: `npm test` — expected PASS.
Run: `npm run lint` — expected exit 0.
Run: `npm run build` — expected success.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/quizStudio/PartsLab.jsx src/components/admin/quizStudio/PartsLab.test.jsx src/components/quiz/Character.jsx src/pages/admin/AdminQuizStudio.jsx
git commit -m "feat(quiz): add a parts lab to the studio"
```

---

### Task 7: Look at all of it

There is no test for "these 62 parts look right", and this task is the replacement.

- [ ] **Step 1: Open every category**

Run: `npm run dev`, open `/admin/quizzes/<id>/studio`, go to **Parts lab**. Walk all six tabs.

- [ ] **Step 2: Check the five moods on every new part**

Click each new part and watch the five-mood strip. A part that reads at `idle` but disappears at `dance` is a prop
positioned where the arm swings.

- [ ] **Step 3: Check the new bodies against the whole drawer**

For each of `pot`, `capsule`, `puck`, `cup`, `cone` and `moon`, step through all 24 headpieces and all 36 accessories.
This is the 50-minute job that the geometry rows are supposed to make short, and the reason they are specified as numbers.

- [ ] **Step 4: Fix what looks wrong, and commit each fix**

```bash
git add api/_lib/quizCharacterArt.js
git commit -m "fix(quiz): seat the new parts on the new bodies"
```

---

## Before you call this done

1. `npm test` — all suites pass, including `holds 137 parts in total`.
2. `npm run lint` — exit 0.
3. `npm run build` — succeeds.
4. **Task 7, all four steps.** 62 hand-drawn parts and six new necks is visual judgement no suite can make. If it has not
   been opened in the lab and looked at, it has not been reviewed — say so rather than claiming otherwise.
5. `api/_lib/quizCharacterArt.test.js` still asserts the built-in roster is 50 and all distinct. Confirm it: the new parts
   belong to custom characters only, and the 50 must not have quietly changed.
