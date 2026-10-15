import { describe, it, expect } from 'vitest'

// An import smoke test, not a behaviour test: resolution and compilation.
//
// Every other suite reaches api/_lib/contentTheme.js through a data module, so the card and control
// components were never imported by `npm test` at all -- and a wrong relative path in one of them passed
// 3541 tests, then failed in `npm run build`. Importing each module here makes that fail in the fast suite
// instead, and checks `staggerDelay` at the same time because it is the one piece of pure logic that lives
// in the components file rather than beside the sanitiser it reads.
import { ContentLook, staggerDelay } from './ContentCards.jsx'
import { applyControl, pageLabel } from './ContentDesignControls.jsx'
import { PAGES, defaultTheme, sanitizeTheme } from '../../../api/_lib/contentTheme.js'

describe('the shared content components resolve and compile', () => {
  it('are the same components the four public surfaces import', () => {
    expect(typeof ContentLook).toBe('function')
    expect(typeof staggerDelay).toBe('function')
    expect(typeof pageLabel).toBe('function')
    expect(typeof applyControl).toBe('function')
  })

  it('names the page it was asked about', () => {
    expect(pageLabel('events')).toBe('Events')
    expect(pageLabel('news')).toBe('News')
    expect(pageLabel('calendar')).toBe('Content')
  })
})

// THE regression test for a bug every control in the studio shared.
//
// `ContentDesignControls` took `path` and destructured it as `[group, key]`, but every call site passes a
// single GROUP NAME -- `set('card', ...)` -- so `[...]= 'card'` gave `'c'` and `'a'`. The draft gained junk
// keys, sanitizeTheme dropped them, nothing rendered any differently, `dirty` never became true and Save
// stayed disabled. Every swatch, segment and slider was a no-op, and 3561 tests passed.
//
// Nothing rendered the panel, so this asserts the write itself: the key the control names must be the key
// that changes, and the result must survive a trip through the one function that judges a theme.
describe('a control writes the group it names', () => {
  const GROUPS = ['accent', 'card', 'type', 'layout']

  it('puts the value under the group name, not under the string it starts with', () => {
    const draft = defaultTheme('news')
    for (const group of GROUPS) {
      const next = applyControl(draft, group, { touched: group })
      expect(Object.keys(next).sort(), group).toEqual([...GROUPS].sort())
      expect(next[group], group).toEqual({ touched: group })
      expect(next, group).not.toHaveProperty(group[0])
    }
  })

  it('leaves the other groups alone', () => {
    const draft = defaultTheme('news')
    const next = applyControl(draft, 'card', { ...draft.card, radius: 'sm' })
    expect(next.card).toEqual({ ...draft.card, radius: 'sm' })
    for (const group of GROUPS.filter((g) => g !== 'card')) {
      expect(next[group], group).toEqual(draft[group])
    }
  })

  it('does not mutate the draft it was given', () => {
    const draft = defaultTheme('news')
    const before = JSON.stringify(draft)
    applyControl(draft, 'layout', { ...draft.layout, columns: 1 })
    expect(JSON.stringify(draft)).toBe(before)
  })

  it('survives sanitizeTheme, which is the only judge a real control write has to pass', () => {
    // Each pair is (group, the change one control makes). If a control writes to the wrong key this is the
    // assertion that fails, because the cleaned theme comes back with the default.
    const CHANGES = [
      ['accent', (t) => ({ ...t.accent, color: 'flame' }), (t) => t.accent.color === 'flame'],
      ['card', (t) => ({ ...t.card, radius: 'sm' }), (t) => t.card.radius === 'sm'],
      ['card', (t) => ({ ...t.card, shadow: 'none' }), (t) => t.card.shadow === 'none'],
      ['card', (t) => ({ ...t.card, image: 'none' }), (t) => t.card.image === 'none'],
      ['card', (t) => ({ ...t.card, density: 'compact' }), (t) => t.card.density === 'compact'],
      ['type', (t) => ({ ...t.type, titleSize: 'xl' }), (t) => t.type.titleSize === 'xl'],
      ['type', (t) => ({ ...t.type, clamp: 5 }), (t) => t.type.clamp === 5],
      ['layout', (t) => ({ ...t.layout, columns: 1 }), (t) => t.layout.columns === 1],
      ['layout', (t) => ({ ...t.layout, imageAspect: 'short' }), (t) => t.layout.imageAspect === 'short'],
      ['layout', (t) => ({ ...t.layout, stagger: false }), (t) => t.layout.stagger === false],
    ]

    for (const page of PAGES) {
      for (const [group, change, changed] of CHANGES) {
        const draft = defaultTheme(page)
        const next = applyControl(draft, group, change(draft))
        const cleaned = sanitizeTheme(next, page)
        expect(changed(cleaned), `${page}.${group}`).toBe(true)
      }
    }
  })

  it('leaves the lead-story control able to turn itself off', () => {
    // News only. `layout.featured` is forced to 'none' on the events page by the sanitiser, so this is the
    // one control whose effect cannot be checked on both.
    const draft = defaultTheme('news')
    const next = applyControl(draft, 'layout', { ...draft.layout, featured: 'none' })
    expect(sanitizeTheme(next, 'news').layout.featured).toBe('none')
  })
})

describe('staggerDelay', () => {
  it('spaces the cards out while the cascade is on', () => {
    const theme = defaultTheme('news')
    expect(staggerDelay(theme, 0)).toBe(0)
    expect(staggerDelay(theme, 1)).toBeCloseTo(0.06)
    // Capped, so a long list does not take a second and a half to finish arriving.
    expect(staggerDelay(theme, 999)).toBe(0.3)
  })

  it('is all at once when the cascade is off, which is what "off" has to mean', () => {
    const theme = { ...defaultTheme('news'), layout: { ...defaultTheme('news').layout, stagger: false } }
    for (const i of [0, 1, 5, 99]) expect(staggerDelay(theme, i)).toBe(0)
  })

  it('does not throw on a theme that never loaded', () => {
    expect(staggerDelay(undefined, 3)).toBe(0)
    expect(staggerDelay({}, 3)).toBe(0)
  })
})