import { describe, it, expect } from 'vitest'
import {
  sanitizeTheme, DEFAULT_THEME, THEME_LOOKS, THEME_PATTERNS, THEME_CONFETTI, THEME_HEADLINE_MAX, THEME_TAGLINE_MAX,
  themeCssVars, themeAccent, contrastWithWhite, isHexColor,
} from './quizTheme.js'

describe('sanitizeTheme', () => {
  it('turns nothing, junk or the wrong type into the default look', () => {
    for (const bad of [undefined, null, 5, 'x', [], {}]) expect(sanitizeTheme(bad)).toEqual(DEFAULT_THEME)
  })
  it('keeps valid choices', () => {
    const t = { look: 'midnight', accent: '#AbCdEf', pattern: 'waves', confetti: 'petals', headline: 'Quiz Night', tagline: 'Phones out' }
    expect(sanitizeTheme(t)).toEqual({ ...t, accent: '#abcdef' })
  })
  it('drops anything that is not on the fixed lists', () => {
    const t = sanitizeTheme({ look: '__proto__', pattern: 'constructor', confetti: 'toString', accent: 'javascript:alert(1)' })
    expect(t).toEqual(DEFAULT_THEME)
  })
  it('only accepts #rrggbb colours, so nothing else can reach CSS', () => {
    for (const bad of ['#fff', '#12345', '#1234567', 'red', 'rgb(0,0,0)', '#ggg000', '#000000;}', 12, null]) {
      expect(isHexColor(bad), String(bad)).toBe(false)
      expect(sanitizeTheme({ accent: bad }).accent).toBeNull()
    }
    expect(isHexColor('#0a1B2c')).toBe(true)
  })
  it('tidies and limits the text', () => {
    const t = sanitizeTheme({ headline: `  a\n\tb  ${'x'.repeat(200)}`, tagline: 'y'.repeat(200) })
    expect(t.headline.startsWith('a b ')).toBe(true)
    expect(t.headline.length).toBe(THEME_HEADLINE_MAX)
    expect(t.tagline.length).toBe(THEME_TAGLINE_MAX)
    expect(sanitizeTheme({ headline: 42 }).headline).toBe('')
  })
  it('is idempotent and ignores unknown fields', () => {
    const once = sanitizeTheme({ look: 'candy', extra: { a: 1 } })
    expect(once).not.toHaveProperty('extra')
    expect(sanitizeTheme(once)).toEqual(once)
  })
})

describe('looks', () => {
  it('has a readable accent on white for every preset, and dark banner colours that white text reads on', () => {
    for (const [id, look] of Object.entries(THEME_LOOKS)) {
      expect(contrastWithWhite(look.accent), `${id} accent`).toBeGreaterThanOrEqual(3)
      for (const deep of look.deep) expect(contrastWithWhite(deep), `${id} banner`).toBeGreaterThanOrEqual(7)
    }
  })
  it('offers patterns and confetti styles including "none"', () => {
    expect(Object.keys(THEME_PATTERNS)).toContain('none')
    expect(Object.keys(THEME_CONFETTI)).toContain('off')
  })
})

describe('themeCssVars', () => {
  it("uses the look's accent, or the custom accent when one is set", () => {
    expect(themeCssVars({ look: 'ocean' })['--color-orange-500']).toBe(THEME_LOOKS.ocean.accent)
    expect(themeCssVars({ look: 'ocean', accent: '#112233' })['--color-orange-500']).toBe('#112233')
    expect(themeAccent({ look: 'forest' })).toBe(THEME_LOOKS.forest.accent)
  })
  it('only ever produces safe values', () => {
    for (const value of Object.values(themeCssVars({ look: 'royal', accent: '#abcdef' }))) {
      expect(value).toMatch(/^(#[0-9a-f]{6}|color-mix\(in srgb, #[0-9a-f]{6} \d+%, (black|white)\))$/)
    }
  })
  it('measures contrast sensibly', () => {
    expect(contrastWithWhite('#000000')).toBeGreaterThan(20)
    expect(contrastWithWhite('#ffffff')).toBeLessThan(1.1)
    expect(contrastWithWhite('nope')).toBe(1)
  })
})
