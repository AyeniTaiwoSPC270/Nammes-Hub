import { describe, it, expect } from 'vitest'
import {
  h, toSvg, characterSvgBody,
  BUILTIN_COUNT, avatarInfo, normalizeAvatarId, BODIES, TOPPERS, EYES, MOUTHS, ACCESSORIES, PROPS,
  IDLE_MOVES, WIN_MOVES, SAD_MOVES, HELLO_MOVES, BODY, DEFAULT_MOOD,
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

  it('never puts one name in two lists', () => {
    const seen = new Map()
    const clashes = []
    for (const [kind, list] of Object.entries(LISTS)) {
      for (const name of list) {
        if (seen.has(name)) clashes.push(`${name}: ${seen.get(name)} and ${kind}`)
        seen.set(name, kind)
      }
    }
    expect(clashes).toEqual([])
  })

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