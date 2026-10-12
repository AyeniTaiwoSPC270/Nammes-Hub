import { describe, expect, it } from 'vitest'
import { DEFAULT_CARD, encodeCardPreview, decodeCardPreview, sanitizeCard, encodeThemePreview, decodeThemePreview, PREVIEW_THEME_KEYS } from './quizCard.js'
import { THEME_PATTERNS, PATTERN_GLYPHS, PATTERN_GEOMETRY, PATTERN_UNDRAWN } from './quizTheme.js'

const QUIZ = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

describe('the card backdrop', () => {
  it('follows the game unless told otherwise, and null has to survive as null', () => {
    // The one place in the card where null is a real value rather than a missing one: "same as the game" is the default,
    // so a pattern with nothing set must not be handed a name it did not ask for.
    expect(sanitizeCard({}).pattern).toBeNull()
    expect(sanitizeCard({ pattern: 'stars' }).pattern).toBe('stars')
    for (const bad of ['', 'nope', '__proto__', 'constructor', 5, [], {}]) {
      expect(sanitizeCard({ pattern: bad }).pattern, String(bad)).toBeNull()
    }
  })
  it('only offers a pattern the renderer knows how to draw', () => {
    // A card naming a pattern no renderer draws would be a blank card rather than a wrong one, and nothing else would
    // say so: the image still renders, just without a backdrop.
    for (const key of Object.keys(THEME_PATTERNS)) {
      expect(sanitizeCard({ pattern: key }).pattern, key).toBe(key)
      // 'image' and 'none' have nothing to draw by design — one paints a photograph, the other nothing.
      if (PATTERN_UNDRAWN.includes(key)) continue
      expect(PATTERN_GLYPHS[key] ?? PATTERN_GEOMETRY[key], `${key} has nothing to draw`).toBeTruthy()
    }
  })
  it('takes a background colour by the same rule as the accent', () => {
    expect(DEFAULT_CARD.backgroundColor).toBeNull()
    expect(sanitizeCard({ backgroundColor: '#3B0764' }).backgroundColor).toBe('#3b0764')
    for (const bad of ['red', '#fff', 'rgb(0,0,0)', '#000000;}', 12, null]) {
      expect(sanitizeCard({ backgroundColor: bad }).backgroundColor, String(bad)).toBeNull()
    }
  })
  it('carries the backdrop theme fragment on the preview url, and only eight fields of it', () => {
    // Eight fields because the preview endpoint renders a card, not a screen: sponsors, sound and picture paths would make
    // the url unusable, and the cap is shared with the card draft beside it. deepA and deepB are here because the card
    // paints the banner; the glow pair is not, because the card draws no glow.
    expect(PREVIEW_THEME_KEYS).toEqual(['look', 'accent', 'page', 'deepA', 'deepB', 'pattern', 'backdropOpacity', 'backdropScale'])
    const back = decodeThemePreview(encodeThemePreview({ look: 'ocean', accent: '#123456', deepA: '#3b0764', pattern: 'rings', headline: 'x'.repeat(60), sponsor: 'nope' }))
    expect(back).toMatchObject({ look: 'ocean', accent: '#123456', deepA: '#3b0764', pattern: 'rings', headline: '' })
  })

  it('leaves the glow off the url, because the card draws no glow', () => {
    expect(decodeThemePreview(encodeThemePreview({ look: 'ocean', glowA: '#ff0000', glowB: '#00ff00' }))).toMatchObject({ glowA: null, glowB: null })
  })
  it('refuses a theme fragment that is junk, hostile or oversized rather than throwing on it', () => {
    for (const bad of [null, undefined, 5, '', 'not base64 $$', 'x'.repeat(800)]) {
      expect(decodeThemePreview(bad), String(bad)).toBeNull()
    }
    expect(decodeThemePreview(encodeThemePreview({ accent: 'red;background:url(x)', pattern: 'nope' }))).toMatchObject({ accent: null, pattern: 'math' })
  })
  it('keeps the whole preview url inside its cap with both payloads on it', () => {
    const theme = encodeThemePreview({ look: 'ocean', accent: '#123456', page: '#3b0764', deepA: '#0b2417', deepB: '#17492f', pattern: 'rings', backdropOpacity: 80, backdropScale: 150 })
    const card = encodeCardPreview({ ...DEFAULT_CARD, accent: '#abcdef', pattern: 'hexagons', backgroundColor: '#3b0764' }, { quizId: QUIZ })
    expect(theme.length + card.length).toBeLessThanOrEqual(700)
  })
})

describe('sanitizeCard', () => {
  it('fills in every default from an empty object', () => {
    expect(sanitizeCard({})).toEqual(DEFAULT_CARD)
  })

  it('fills in every default from junk', () => {
    expect(sanitizeCard('nope')).toEqual(DEFAULT_CARD)
    expect(sanitizeCard([1, 2, 3])).toEqual(DEFAULT_CARD)
    expect(sanitizeCard(null)).toEqual(DEFAULT_CARD)
  })

  it('keeps a lowercased hex accent and drops anything else', () => {
    expect(sanitizeCard({ accent: '#FF5A1F' }).accent).toBe('#ff5a1f')
    expect(sanitizeCard({ accent: 'red' }).accent).toBeNull()
    expect(sanitizeCard({ accent: '#ff5a' }).accent).toBeNull()
  })

  it('treats any flag that is not literal false as on', () => {
    expect(sanitizeCard({ showStreak: false }).showStreak).toBe(false)
    expect(sanitizeCard({ showStreak: 0 }).showStreak).toBe(true)
    expect(sanitizeCard({ showStreak: 'no' }).showStreak).toBe(true)
  })

  it('keeps a background path in this quiz folder only', () => {
    const path = `${QUIZ}/33333333-3333-4333-8333-333333333333-1700000000000.jpg`
    expect(sanitizeCard({ background: path }, { quizId: QUIZ }).background).toBe(path)
    expect(sanitizeCard({ background: `${OTHER}/x.jpg` }, { quizId: QUIZ }).background).toBeNull()
    expect(sanitizeCard({ background: 'https://evil.example/x.jpg' }, { quizId: QUIZ }).background).toBeNull()
  })

  it('is idempotent', () => {
    const once = sanitizeCard({ accent: '#ABCDEF', showTeam: false }, { quizId: QUIZ })
    expect(sanitizeCard(once, { quizId: QUIZ })).toEqual(once)
  })

  it('never returns a key that is not in DEFAULT_CARD', () => {
    expect(Object.keys(sanitizeCard({ nonsense: true })).sort()).toEqual(Object.keys(DEFAULT_CARD).sort())
  })
})

// The studio previews an unsaved card by putting it on the url, so a draft accent or an unticked box has to survive
// the round trip. Anything that does not decode is the server falling back to the saved card, never a crash.
describe('encodeCardPreview', () => {
  it('survives the round trip for a draft that differs from the saved card', () => {
    const draft = { ...DEFAULT_CARD, accent: '#00ff00', showStreak: false, showTeam: false }
    expect(decodeCardPreview(encodeCardPreview(draft, { quizId: QUIZ }), { quizId: QUIZ })).toEqual(sanitizeCard(draft, { quizId: QUIZ }))
  })

  it('round trips a null accent as null, not as the string "null"', () => {
    expect(decodeCardPreview(encodeCardPreview(DEFAULT_CARD, { quizId: QUIZ }), { quizId: QUIZ }).accent).toBeNull()
  })

  it('emits only url-safe characters, so it never has to be escaped', () => {
    expect(encodeCardPreview({ ...DEFAULT_CARD, accent: '#ABCDEF' }, { quizId: QUIZ })).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('is stable for the same design, so the url does not churn', () => {
    expect(encodeCardPreview(DEFAULT_CARD, { quizId: QUIZ })).toBe(encodeCardPreview(DEFAULT_CARD, { quizId: QUIZ }))
  })

  it('drops a background from another quiz rather than carrying it through', () => {
    const hostile = { ...DEFAULT_CARD, background: `${OTHER}/33333333-3333-4333-8333-333333333333-1700000000000.jpg` }
    expect(decodeCardPreview(encodeCardPreview(hostile, { quizId: QUIZ }), { quizId: QUIZ }).background).toBeNull()
  })
})

describe('decodeCardPreview', () => {
  it('returns null rather than throwing when the payload is missing or junk', () => {
    expect(decodeCardPreview(undefined, { quizId: QUIZ })).toBeNull()
    expect(decodeCardPreview('', { quizId: QUIZ })).toBeNull()
    expect(decodeCardPreview('not-base64!!', { quizId: QUIZ })).toBeNull()
  })

  it('returns null for a payload that decodes to something that is not an object', () => {
    expect(decodeCardPreview(btoa('"a string"').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), { quizId: QUIZ })).toBeNull()
  })

  it('refuses a payload far longer than any real card, so a url cannot become a memory cost', () => {
    expect(decodeCardPreview('A'.repeat(5000), { quizId: QUIZ })).toBeNull()
  })
})