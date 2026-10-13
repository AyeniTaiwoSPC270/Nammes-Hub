import { describe, it, expect } from 'vitest'
import {
  h, toSvg, characterSvgBody,
  BUILTIN_COUNT, avatarInfo, normalizeAvatarId, BODIES, TOPPERS, EYES, MOUTHS, ACCESSORIES, PROPS,
  IDLE_MOVES, WIN_MOVES, SAD_MOVES, HELLO_MOVES, BODY, DEFAULT_MOOD,
  sanitizeCharacterSpec, sanitizeCharacterMoves, sanitizeCast, deriveColour, castIds, allowedAvatarIds,
  characterSpec, sameDesign, nextCastSlot, MAX_CAST,
} from './quizCharacterArt.js'

const all = Array.from({ length: BUILTIN_COUNT }, (_, id) => avatarInfo(id))
const HATS = ['cap', 'chef', 'beanie', 'gradcap', 'partyhat', 'crown']
const TALL_TOPPERS = ['bunny', 'horns', 'antenna', 'bugs', 'sprout', 'spikes', 'tuft', 'halo', 'cat']

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
      .toBe('<text font-family="Georgia, &#x27;Times New Roman&#x27;, serif"></text>')
    expect(toSvg(h('text', { title: 'a & b < c > d " e' })))
      .toBe('<text title="a &amp; b &lt; c &gt; d &quot; e"></text>')
  })
})

describe('the 50 characters', () => {
  it('has exactly 50', () => {
    expect(BUILTIN_COUNT).toBe(50)
  })

  it('gives every character its own name', () => {
    expect(new Set(all.map((c) => c.name)).size).toBe(50)
  })

  it('gives every character its own colour', () => {
    expect(new Set(all.map((c) => c.color.main)).size).toBe(50)
  })

  it('never repeats a body with the same headpiece', () => {
    expect(new Set(all.map((c) => `${c.body}/${c.topper}`)).size).toBe(50)
  })

  it('never repeats a full look (body, headpiece, face, outfit, prop and colour)', () => {
    const looks = new Set(all.map((c) => [c.body, c.topper, c.eyes, c.mouth, c.accessory, c.prop, c.color.main].join('|')))
    expect(looks.size).toBe(50)
  })

  it('never repeats how a character idles and celebrates', () => {
    expect(new Set(all.map((c) => `${c.idle}/${c.win}`)).size).toBe(50)
  })

  it('gives every character its own set of moves (idle, win and hello together with its sad move)', () => {
    expect(new Set(all.map((c) => `${c.idle}/${c.win}/${c.hello}/${c.sad}`)).size).toBe(50)
  })

  // One direction only. The original test also asserted that every part in every list is used by one of the 50, which
  // stopped a part being added to a list and never drawn. The drawer is now bigger than the roster — a quiz's own
  // characters use parts the 50 never touch — so that direction no longer holds. The other half of it, "every part in a
  // list draws", lives in the drawer tests above and below, which is where a new part can actually be forgotten.
  it('uses only parts that are in the lists', () => {
    const lists = { body: BODIES, topper: TOPPERS, eyes: EYES, mouth: MOUTHS, accessory: ACCESSORIES, prop: PROPS, idle: IDLE_MOVES, win: WIN_MOVES, sad: SAD_MOVES, hello: HELLO_MOVES }
    for (const [key, list] of Object.entries(lists)) {
      for (const value of new Set(all.map((c) => c[key]))) expect(list, `${key}: ${value}`).toContain(value)
    }
  })

  it('keeps hats off characters with a tall headpiece', () => {
    for (const c of all) {
      if (HATS.includes(c.accessory)) expect(TALL_TOPPERS, `${c.name} wears a hat over ${c.topper}`).not.toContain(c.topper)
    }
  })

  it('describes the moves in words', () => {
    for (const c of all) for (const text of Object.values(c.moves)) expect(text.length).toBeGreaterThan(2)
  })

  it('falls back to the first character for a bad id', () => {
    for (const bad of [-1, 50, 2.5, null, undefined, '7']) expect(normalizeAvatarId(bad)).toBe(0)
    expect(avatarInfo(99).name).toBe(avatarInfo(0).name)
  })
})

// ---- the drawer -----------------------------------------------------------------------------------------------------

// These six lists are what an admin builds a quiz's own characters from. The list is the contract: a new part is
// named here first, and the suite stays red until it has been drawn. Drawing them and looking at them are two
// separate things, and only the first is a task a machine can finish.

const NEW_PARTS = {
  bodies: ['pot', 'capsule', 'puck', 'cup', 'cone', 'moon'],
  toppers: ['fin', 'mohawk', 'beret', 'headband-over', 'leafcrown', 'antennae', 'braid', 'pigtails', 'curls', 'bandana', 'cowlick', 'tiara'],
  eyes: ['goggles-round', 'sleep', 'wink-left', 'shades', 'heart-eyes', 'hollow', 'glasses-dot', 'squint'],
  mouths: ['zigzag', 'smiley', 'open-smile', 'flat-wide', 'smirk-left', 'stitched'],
  accessories: ['weldmask', 'labcoat', 'goggles-on-hat', 'headband', 'apron', 'earmuffs', 'medal', 'scarf-long', 'gloves', 'toolbelt', 'armband', 'pocketwatch', 'ribbon', 'chain', 'badge', 'flask'],
  props: ['calipers', 'ingot', 'gear', 'beaker', 'micrometer', 'anvil', 'wrench', 'magnet', 'bead', 'crystal', 'seedling', 'kite', 'lantern', 'dice'],
}

const LISTS = { bodies: BODIES, toppers: TOPPERS, eyes: EYES, mouths: MOUTHS, accessories: ACCESSORIES, props: PROPS }
const FIELDS = { bodies: 'body', toppers: 'topper', eyes: 'eyes', mouths: 'mouth', accessories: 'accessory', props: 'prop' }

describe('the drawer', () => {
  it.each(Object.entries(NEW_PARTS))('lists every new %s', (kind, names) => {
    const missing = names.filter((name) => !LISTS[kind].includes(name))
    expect(missing, `${kind} missing from its list`).toEqual([])
  })

  it.each(Object.entries(NEW_PARTS))('draws every new %s', (kind, names) => {
    for (const name of names) {
      expect(() => characterSvgBody({ ...DEFAULT_MOOD, [FIELDS[kind]]: name }, 'idle'), `${FIELDS[kind]} ${name}`).not.toThrow()
    }
  })

  it('holds 137 parts in total', () => {
    expect(Object.values(LISTS).flat()).toHaveLength(137)
  })

  // Deliberately no test that a name appears in only one list: 'round' is both a body and an eye, 'cat' is both a
  // topper and a mouth, 'none' is in three of them, and 'star' is both an eye and a prop. Each list is its own
  // namespace and a part is looked up in exactly one of them, so sharing a word across lists is not a collision.
  // What does matter is that the geometry table has a row for every body, which the next describe checks.

  // The new parts are for a quiz's own characters. If one of them reached a roster row, the 50 would change and
  // everyone who knows them would find a different character where they expected an old friend.
  it('leaves the built-in 50 on exactly the parts they already use', () => {
    const freshByField = Object.fromEntries(Object.entries(FIELDS).map(([kind, field]) => [field, NEW_PARTS[kind]]))
    for (const c of all) {
      for (const [field, fresh] of Object.entries(freshByField)) {
        expect(fresh.includes(c[field]), `${c.name} uses ${c[field]}, which is a new part`).toBe(false)
      }
    }
  })
})

describe('body geometry', () => {
  it('gives every body a row', () => {
    for (const kind of BODIES) expect(BODY[kind], `no geometry row for ${kind}`).toBeDefined()
  })

  it('puts the eyes below the head top and above the neck', () => {
    for (const [kind, g] of Object.entries(BODY)) {
      expect(g.eyeY, kind).toBeGreaterThan(g.top)
      expect(g.neckY, kind).toBeGreaterThan(g.eyeY)
    }
  })

  it('keeps ear and arm anchors inside the canvas', () => {
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

// Nothing drawn off the canvas. This is the one thing about the new art a machine can judge: a part at x = -40 is a bug
// in any renderer, and the bounds here are deliberately loose (-2 to 102) because a hat brim or a shadow is allowed to
// bleed slightly, since `.qz-char { overflow: visible }` is there so it can.
//
// The walk follows translate groups, because a part drawn inside one uses coordinates relative to it: the flower puts
// its petals at cy = -6 inside a group moved to the side of the head, which is on the canvas even though -6 is not.
function numbersIn(svg) {
  const found = []
  const stack = []
  let offsetX = 0
  let offsetY = 0
  for (const tag of svg.match(/<[^>]+>/g) ?? []) {
    if (tag.startsWith('</g')) {
      const back = stack.pop()
      if (back) {
        offsetX -= back[0]
        offsetY -= back[1]
      }
      continue
    }
    if (tag.startsWith('<g')) {
      const move = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(tag)
      const dx = move ? Number(move[1]) : 0
      const dy = move ? Number(move[2]) : 0
      stack.push([dx, dy])
      offsetX += dx
      offsetY += dy
    }
    for (const [, name, value] of tag.matchAll(/\b(cx|cy|x|y|x1|y1|x2|y2|rx|ry|r)="(-?[\d.]+)"/g)) {
      found.push(Number(value) + (/y/.test(name) ? offsetY : offsetX))
    }
    const points = /points="([^"]+)"/.exec(tag)
    if (points) {
      for (const pair of points[1].trim().split(/\s+/)) {
        const [x, y] = pair.split(',').map(Number)
        found.push(x + offsetX, y + offsetY)
      }
    }
  }
  return found
}

describe('nothing is drawn off the canvas', () => {
  it.each(BODIES)('%s keeps every part inside the box', (bodyKind) => {
    const base = { ...DEFAULT_MOOD, body: bodyKind }
    const offenders = []
    const check = (spec, label) => {
      const bad = numbersIn(characterSvgBody(spec, 'idle')).filter((n) => n < -2 || n > 102)
      if (bad.length) offenders.push(`${label} on ${bodyKind}: ${bad.join(', ')}`)
    }
    for (const part of TOPPERS) check({ ...base, topper: part }, `topper ${part}`)
    for (const part of ACCESSORIES) check({ ...base, accessory: part }, `accessory ${part}`)
    for (const part of PROPS) check({ ...base, prop: part }, `prop ${part}`)
    for (const part of EYES) check({ ...base, eyes: part }, `eyes ${part}`)
    for (const part of MOUTHS) check({ ...base, mouth: part }, `mouth ${part}`)
    expect(offenders).toEqual([])
  })

  it('never draws a part name into the markup, whatever an admin sends', () => {
    // The sanitiser is the boundary that makes dangerouslySetInnerHTML safe. A name that reached the markup would be a
    // door, so prove the drawing has no path for one: these strings are values, and no part function reads a value.
    const hostile = { ...DEFAULT_MOOD, name: '<script>alert(1)</script>', topper: 'cat', prop: 'book' }
    const svg = characterSvgBody(hostile, 'idle')
    expect(svg).not.toContain('script')
    expect(svg).not.toContain('alert')
    expect(svg).not.toContain(hostile.name)
  })
})

function lightness(hex) {
  const n = parseInt(hex.slice(1), 16)
  return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}

describe('sanitizeCharacterSpec', () => {
  it('keeps a valid custom spec and only its drawing fields', () => {
    const spec = { body: 'pot', topper: 'beret', eyes: 'sleep', mouth: 'stitched', accessory: 'weldmask', prop: 'ingot', color: '#ff5a1f' }
    expect(sanitizeCharacterSpec({ ...spec, extra: 'ignored' })).toEqual(spec)
  })

  it('replaces values not found in their part lists', () => {
    expect(sanitizeCharacterSpec({ body: 'nope', topper: 42, eyes: { toString: 'x' } }))
      .toMatchObject({ body: 'blob', topper: 'none', eyes: 'round' })
  })

  it('accepts only a six-digit hex colour', () => {
    for (const color of ['red', '#ff5a', 'javascript:alert(1)', null]) {
      expect(sanitizeCharacterSpec({ color }).color).toBeNull()
    }
    expect(sanitizeCharacterSpec({ color: '#ff5a1f' }).color).toBe('#ff5a1f')
  })

  it('survives a non-object input', () => {
    for (const input of [null, 'blob', [1, 2, 3]]) expect(() => sanitizeCharacterSpec(input)).not.toThrow()
  })
})

describe('sanitizeCharacterMoves', () => {
  it('keeps supported moves and defaults the rest', () => {
    expect(sanitizeCharacterMoves({ idle: 'sway', win: 'nope', sad: null, hello: 'clap' }))
      .toEqual({ idle: 'sway', win: 'jump', sad: 'droop', hello: 'clap' })
  })
})

describe('deriveColour', () => {
  it('returns darker and lighter variants where the channel has room, and clamps black and white', () => {
    for (const hex of ['#ff5a1f', '#000000', '#ffffff', '#4ade80']) {
      const { main, dark, light } = deriveColour(hex)
      if (hex !== '#000000') expect(lightness(dark)).toBeLessThan(lightness(main))
      else expect(dark).toBe(main)
      if (hex !== '#ffffff') expect(lightness(light)).toBeGreaterThan(lightness(main))
      else expect(light).toBe(main)
    }
  })
})

describe('sanitizeCast and id resolution', () => {
  const one = { slot: 0, name: 'Kola', spec: { body: 'pot' }, moves: { idle: 'sway' } }

  it('defaults to built-ins and an empty cast', () => {
    expect(sanitizeCast(null)).toEqual({ mode: 'builtins', characters: [] })
  })

  it('keeps a valid character and sanitizes its details', () => {
    expect(sanitizeCast({ mode: 'all', characters: [one] })).toMatchObject({
      mode: 'all', characters: [{ slot: 0, name: 'Kola', spec: { body: 'pot' }, moves: { idle: 'sway' } }],
    })
  })

  it('rejects duplicate slots, too many characters and out-of-range slots', () => {
    expect(() => sanitizeCast({ characters: [one, { ...one, name: 'Other' }] })).toThrow(/slot 0/)
    expect(() => sanitizeCast({ characters: Array.from({ length: MAX_CAST + 1 }, (_, slot) => ({ ...one, slot })) })).toThrow(/12/)
    for (const slot of [-1, 12]) expect(() => sanitizeCast({ characters: [{ ...one, slot }] })).toThrow()
  })

  it('does not allow a custom-only mode with no characters to offer', () => {
    expect(() => sanitizeCast({ mode: 'custom', characters: [] })).toThrow(/at least one character/)
  })

  it('does not renumber holes and offers only ids for the selected mode', () => {
    const cast = { mode: 'all', characters: [{ ...one, slot: 2 }, { ...one, slot: 0, name: 'A' }] }
    expect(castIds(cast)).toEqual([...Array.from({ length: 50 }, (_, id) => id), 50, 52])
    expect(castIds({ ...cast, mode: 'custom' })).toEqual([50, 52])
    expect(castIds({ ...cast, mode: 'builtins' })).toEqual(Array.from({ length: 50 }, (_, id) => id))
    expect([...allowedAvatarIds(cast)].sort((a, b) => a - b)).toEqual(castIds(cast))
  })

  it('allocates only never-used slots, not retired holes', () => {
    expect(nextCastSlot({ characters: [{ slot: 1 }], retiredSlots: [0] })).toBe(2)
    expect(nextCastSlot({ characters: [], retiredSlots: Array.from({ length: MAX_CAST }, (_, slot) => slot) })).toBeNull()
  })

  it('resolves built-ins and cast ids, falling back safely when the cast is not offered', () => {
    const cast = sanitizeCast({ mode: 'all', characters: [{ ...one, spec: { body: 'pot', color: '#ff5a1f' } }] })
    expect(characterSpec(0, cast).name).toBe('Pixel')
    expect(characterSpec(50, cast)).toMatchObject({ name: 'Kola', body: 'pot', idle: 'sway' })
    expect(characterSpec(51, cast).name).toBe('Pixel')
    expect(characterSpec(50, { ...cast, mode: 'builtins' }).name).toBe('Pixel')
  })

  it('compares designs across nested cast entries and flat built-in specs', () => {
    const a = { spec: { body: 'blob', topper: 'none', eyes: 'round', mouth: 'smile', accessory: 'none', prop: 'none', color: '#ff0000' } }
    const b = { ...a.spec, color: { main: '#ff0000' } }
    expect(sameDesign(a, b)).toBe(true)
    expect(sameDesign(a, { ...b, prop: 'book' })).toBe(false)
  })
})
