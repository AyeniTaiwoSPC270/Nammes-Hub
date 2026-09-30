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
    const t = { look: 'midnight', accent: '#AbCdEf', pattern: 'waves', confetti: 'petals', headline: 'Quiz Night', tagline: 'Phones out', sound: { music: 'hype', effects: false }, logo: null, sponsors: [], showSponsors: { lobby: false, finish: true } }
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

const QUIZ_A = '11111111-1111-4111-8111-111111111111'
const QUIZ_B = '22222222-2222-4222-8222-222222222222'
const FILE = '33333333-3333-4333-8333-333333333333'

describe('branding: logo and sponsors', () => {
  const good = `${QUIZ_A}/${FILE}-1767261600000.webp`
  it('keeps an uploaded logo and sponsors that belong to the quiz', () => {
    const t = sanitizeTheme({ logo: good, sponsors: [{ name: ' Acme  Ltd ', path: good }] }, { quizId: QUIZ_A })
    expect(t.logo).toBe(good)
    expect(t.sponsors).toEqual([{ name: 'Acme Ltd', path: good }])
  })
  it("drops another quiz's pictures and anything that is not an uploaded-image path", () => {
    const evil = ['https://evil.example/x.png', '../x.png', `${QUIZ_B}/${FILE}.webp`, `${QUIZ_A}/${FILE}.svg`, 'javascript:alert(1)', 5, null]
    for (const path of evil) {
      const t = sanitizeTheme({ logo: path, sponsors: [{ name: 'X', path }] }, { quizId: QUIZ_A })
      expect(t.logo, String(path)).toBeNull()
      expect(t.sponsors, String(path)).toEqual([])
    }
  })
  it('still checks the shape when the quiz is not known (the screens)', () => {
    expect(sanitizeTheme({ logo: `${QUIZ_B}/${FILE}.png` }).logo).toBe(`${QUIZ_B}/${FILE}.png`)
    expect(sanitizeTheme({ logo: 'https://evil.example/x.png' }).logo).toBeNull()
  })
  it('allows at most six sponsors, each with a name, and trims long names', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ name: `S${i}`, path: good }))
    expect(sanitizeTheme({ sponsors: many }, { quizId: QUIZ_A }).sponsors).toHaveLength(6)
    expect(sanitizeTheme({ sponsors: [{ name: '', path: good }, { path: good }] }, { quizId: QUIZ_A }).sponsors).toEqual([])
    expect(sanitizeTheme({ sponsors: [{ name: 'n'.repeat(90), path: good }] }, { quizId: QUIZ_A }).sponsors[0].name).toHaveLength(40)
    expect(sanitizeTheme({ sponsors: 'lots' }).sponsors).toEqual([])
  })
  it('shows sponsors on the lobby and the finish unless switched off', () => {
    expect(sanitizeTheme({}).showSponsors).toEqual({ lobby: true, finish: true })
    expect(sanitizeTheme({ showSponsors: { lobby: false } }).showSponsors).toEqual({ lobby: false, finish: true })
  })
  it('stays small enough for the database limit even at the maximum', () => {
    const full = sanitizeTheme({ headline: 'h'.repeat(60), tagline: 't'.repeat(80), logo: good, sponsors: Array.from({ length: 6 }, () => ({ name: 'n'.repeat(40), path: good })) }, { quizId: QUIZ_A })
    expect(JSON.stringify(full).length).toBeLessThan(2000)
  })
})

describe('sound settings', () => {
  it('default to quiet music and effects on', () => {
    expect(sanitizeTheme({}).sound).toEqual({ music: 'off', effects: true })
  })
  it('only accept known music styles, and effects are on unless switched off', () => {
    expect(sanitizeTheme({ sound: { music: 'chill' } }).sound).toEqual({ music: 'chill', effects: true })
    expect(sanitizeTheme({ sound: { music: '__proto__', effects: 'no' } }).sound).toEqual({ music: 'off', effects: true })
    expect(sanitizeTheme({ sound: { effects: false } }).sound.effects).toBe(false)
    expect(sanitizeTheme({ sound: 'loud' }).sound).toEqual({ music: 'off', effects: true })
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
