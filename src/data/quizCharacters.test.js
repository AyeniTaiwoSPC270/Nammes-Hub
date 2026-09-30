import { describe, it, expect } from 'vitest'
import {
  AVATAR_COUNT, avatarInfo, normalizeAvatarId, BODIES, TOPPERS, EYES, MOUTHS, ACCESSORIES, PROPS,
  IDLE_MOVES, WIN_MOVES, SAD_MOVES, HELLO_MOVES,
} from './quizCharacters'

const all = Array.from({ length: AVATAR_COUNT }, (_, id) => avatarInfo(id))
const HATS = ['cap', 'chef', 'beanie', 'gradcap', 'partyhat', 'crown']
const TALL_TOPPERS = ['bunny', 'horns', 'antenna', 'bugs', 'sprout', 'spikes', 'tuft', 'halo', 'cat']

describe('the 50 characters', () => {
  it('has exactly 50, matching the server limit', () => {
    expect(AVATAR_COUNT).toBe(50)
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

  it('uses only known parts, and uses every part at least once', () => {
    const lists = { body: BODIES, topper: TOPPERS, eyes: EYES, mouth: MOUTHS, accessory: ACCESSORIES, prop: PROPS, idle: IDLE_MOVES, win: WIN_MOVES, sad: SAD_MOVES, hello: HELLO_MOVES }
    for (const [key, list] of Object.entries(lists)) {
      const used = new Set(all.map((c) => c[key]))
      for (const value of used) expect(list, `${key}: ${value}`).toContain(value)
      for (const value of list) expect(used.has(value), `${key} "${value}" is never used`).toBe(true)
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
