import { describe, it, expect } from 'vitest'

// An import smoke test, not a behaviour test: resolution and compilation.
//
// Every other suite reaches api/_lib/contentTheme.js through a data module, so the card and control
// components were never imported by `npm test` at all -- and a wrong relative path in one of them passed
// 3541 tests, then failed in `npm run build`. Importing each module here makes that fail in the fast suite
// instead, and checks `staggerDelay` at the same time because it is the one piece of pure logic that lives
// in the components file rather than beside the sanitiser it reads.
import { ContentLook, staggerDelay } from './ContentCards.jsx'
import { pageLabel } from './ContentDesignControls.jsx'
import { defaultTheme } from '../../../api/_lib/contentTheme.js'

describe('the shared content components resolve and compile', () => {
  it('are the same components the four public surfaces import', () => {
    expect(typeof ContentLook).toBe('function')
    expect(typeof staggerDelay).toBe('function')
    expect(typeof pageLabel).toBe('function')
  })

  it('names the page it was asked about', () => {
    expect(pageLabel('events')).toBe('Events')
    expect(pageLabel('news')).toBe('News')
    expect(pageLabel('calendar')).toBe('Content')
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