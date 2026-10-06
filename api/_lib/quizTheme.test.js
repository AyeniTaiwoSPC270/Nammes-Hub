import { describe, it, expect } from 'vitest'
import {
  sanitizeTheme, DEFAULT_THEME, THEME_LOOKS, THEME_PATTERNS, THEME_CONFETTI, THEME_HEADLINE_MAX, THEME_TAGLINE_MAX,
  THEME_EFFECTS, THEME_MUSIC, BACKDROP_RANGES, THEME_BACKDROP_FITS, isClipId,
  themeCssVars, themeAccent, contrastWithWhite, isHexColor,
} from './quizTheme.js'

describe('sanitizeTheme', () => {
  it('turns nothing, junk or the wrong type into the default look', () => {
    for (const bad of [undefined, null, 5, 'x', [], {}]) expect(sanitizeTheme(bad)).toEqual(DEFAULT_THEME)
  })
  it('keeps valid choices', () => {
    const chosen = { music: 'hype', effects: false, off: ['join'], custom: { music: null, effects: { tick: 'abc12345' } } }
    const t = { look: 'midnight', accent: '#AbCdEf', pattern: 'waves', image: null, backdropOpacity: 30, backdropScale: 150, backdropBlur: 6, backdropDim: 20, backdropFit: 'contain', confetti: 'petals', headline: 'Quiz Night', tagline: 'Phones out', sound: chosen, logo: null, sponsors: [], showSponsors: { lobby: false, finish: true } }
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
    const full = sanitizeTheme({ headline: 'h'.repeat(60), tagline: 't'.repeat(80), pattern: 'image', image: good, logo: good, sponsors: Array.from({ length: 6 }, () => ({ name: 'n'.repeat(40), path: good })) }, { quizId: QUIZ_A })
    expect(JSON.stringify(full).length).toBeLessThan(2000)
  })
})

describe('sound settings', () => {
  it('default to quiet music and effects on, with nothing switched off and no imported clips', () => {
    expect(sanitizeTheme({}).sound).toEqual({ music: 'off', effects: true, off: [], custom: { music: null, effects: {} } })
  })
  it('only accept known music styles, and effects are on unless switched off', () => {
    expect(sanitizeTheme({ sound: { music: 'chill' } }).sound.music).toBe('chill')
    expect(sanitizeTheme({ sound: { music: '__proto__', effects: 'no' } }).sound).toMatchObject({ music: 'off', effects: true })
    expect(sanitizeTheme({ sound: { effects: false } }).sound.effects).toBe(false)
    expect(sanitizeTheme({ sound: 'loud' }).sound).toEqual(DEFAULT_THEME.sound)
  })
  it('keeps a custom music choice, and falls back to silence when the clip is missing or malformed', () => {
    expect(sanitizeTheme({ sound: { music: 'custom', custom: { music: 'abc12345' } } }).sound).toEqual({ music: 'custom', effects: true, off: [], custom: { music: 'abc12345', effects: {} } })
    for (const bad of [{ music: 'custom' }, { music: 'custom', custom: {} }, { music: 'custom', custom: { music: null } }, { music: 'custom', custom: { music: 'no' } }, { music: 'custom', custom: { music: '../../x' } }, { music: 'custom', custom: 'loud' }]) {
      expect(sanitizeTheme({ sound: bad }).sound.music, JSON.stringify(bad)).toBe('off')
    }
  })
  it('only keep effects that are switched off, once each and in a fixed order', () => {
    expect(sanitizeTheme({ sound: { off: ['join', 'applause'] } }).sound.off).toEqual(['join', 'applause'])
    expect(sanitizeTheme({ sound: { off: ['applause', 'join', 'applause'] } }).sound.off).toEqual(['join', 'applause'])
    for (const bad of ['applause', { applause: true }, 5, null]) expect(sanitizeTheme({ sound: { off: bad } }).sound.off).toEqual([])
    for (const name of ['__proto__', 'constructor', 'toString', 'not-a-sound', '']) {
      expect(sanitizeTheme({ sound: { off: [name] } }).sound.off, name).toEqual([])
    }
    expect(Object.hasOwn(sanitizeTheme({ sound: { off: ['constructor'] } }).sound.off, 'constructor')).toBe(false)
  })
  it('only keep custom clips for known effects, and only ids of the right shape', () => {
    const good = { drumroll: 'abc12345', join: 'zzzz-9999' }
    expect(sanitizeTheme({ sound: { custom: { effects: good } } }).sound.custom.effects).toEqual(good)
    // Every one of these is dropped: an unknown effect, and four ways of writing something that is not a clip id.
    const bad = { ...good, notASound: 'abc12345', applause: 'short', join: '../evil', tick: 42, lock: ['a'] }
    expect(sanitizeTheme({ sound: { custom: { effects: bad } } }).sound.custom.effects).toEqual({ drumroll: 'abc12345' })
    expect(sanitizeTheme({ sound: { custom: { effects: 'loud' } } }).sound.custom.effects).toEqual({})
    expect(sanitizeTheme({ sound: { custom: 7 } }).sound.custom).toEqual({ music: null, effects: {} })
  })
  it('clean a saved theme to the same jsonb every time, so the studio does not see a draft as changed', () => {
    const once = sanitizeTheme({ sound: { off: ['join', 'tick'], custom: { effects: { tickFast: 'b1b1b1b1', correct: 'c2c2c2c2' } } } })
    expect(JSON.stringify(sanitizeTheme(once))).toBe(JSON.stringify(once))
    expect(Object.keys(once.sound.custom.effects)).toEqual(['tickFast', 'correct'])
  })
  it('holds a clip id to a fixed shape, so it can only ever be a key into the local library', () => {
    for (const good of ['abc12345', 'zzzz-9999', 'a'.repeat(40), '0-0-0-0-0-0-0-0']) expect(isClipId(good), good).toBe(true)
    for (const bad of ['abc1234', 'a'.repeat(41), 'ABC12345', 'abc_12345', 'abc.12345', 'abc/12345', '../x', 'a b', '', 42, null, undefined, ['abc12345']]) {
      expect(isClipId(bad), String(bad)).toBe(false)
    }
  })
  it('knows an effect for every style of music, and lists custom music as a style', () => {
    expect(Object.keys(THEME_MUSIC)).toEqual(['off', 'chill', 'hype', 'afro', 'disco', 'cinematic', 'custom'])
  })
})

describe('a theme at its largest', () => {
  const good = `${QUIZ_A}/${FILE}-1767261600000.webp`
  it('stays inside the column check even with every sponsor and every effect customised', () => {
    // The column is `pg_column_size(theme) < 4000` (20260930190000_quiz_theme.sql), which is a binary size and so runs
    // a little above this character count for the same document. The largest theme the app can produce — every field at
    // its limit, a backdrop picture, six sponsors and a full set of custom clips — measures 2,100 characters, so there is
    // room to spare rather than a knife edge.
    const custom = { music: 'm'.repeat(40), effects: Object.fromEntries(Object.keys(THEME_EFFECTS).map((name) => [name, 'e'.repeat(40)])) }
    const full = sanitizeTheme({ headline: 'h'.repeat(60), tagline: 't'.repeat(80), pattern: 'image', image: good, logo: good, sponsors: Array.from({ length: 6 }, () => ({ name: 'n'.repeat(40), path: good })), sound: { music: 'custom', off: Object.keys(THEME_EFFECTS), custom } }, { quizId: QUIZ_A })
    expect(Object.keys(full.sound.custom.effects)).toHaveLength(Object.keys(THEME_EFFECTS).length)
    expect(full.sound.music).toBe('custom')
    expect(JSON.stringify(full).length).toBeLessThan(3000)
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

describe('backdrop settings', () => {
  const pic = `${QUIZ_A}/${FILE}-1767261600000.webp`
  it('starts faintly, at the size it was designed at, with nothing blurred or faded', () => {
    expect(sanitizeTheme({})).toMatchObject({ pattern: 'math', image: null, backdropOpacity: 8, backdropScale: 100, backdropBlur: 0, backdropDim: 0 })
  })
  it('keeps an uploaded picture when the image backdrop is chosen', () => {
    const t = sanitizeTheme({ pattern: 'image', image: pic }, { quizId: QUIZ_A })
    expect(t.pattern).toBe('image')
    expect(t.image).toBe(pic)
  })
  it("falls back to Plain when 'my image' is chosen with no picture, but keeps the picture for next time", () => {
    // The same rule cleanSound uses for asking for custom music with no clip: settle to the neutral option rather than
    // leave the screens with a backdrop they cannot draw.
    for (const bad of [null, undefined, '', 5, 'https://evil.example/x.png', `${QUIZ_B}/${FILE}.webp`]) {
      expect(sanitizeTheme({ pattern: 'image', image: bad }, { quizId: QUIZ_A }).pattern, String(bad)).toBe('none')
    }
    expect(sanitizeTheme({ pattern: 'image', image: pic }, { quizId: QUIZ_A }).image).toBe(pic)
  })
  it('fills the screen by default, and only offers the three ways a picture can meet it', () => {
    // A background that defaulted to showing the whole picture would letterbox on most projectors, and one that always
    // filled would silently cut off parts of it. Both have to be askable for.
    expect(Object.keys(THEME_BACKDROP_FITS)).toEqual(['cover', 'contain', 'stretch'])
    expect(sanitizeTheme({}).backdropFit).toBe('cover')
    for (const fit of Object.keys(THEME_BACKDROP_FITS)) expect(sanitizeTheme({ backdropFit: fit }).backdropFit, fit).toBe(fit)
    for (const bad of ['__proto__', 'constructor', 'zoom', '', 5, null, undefined, ['cover']]) {
      expect(sanitizeTheme({ backdropFit: bad }).backdropFit, String(bad)).toBe('cover')
    }
  })
  it('holds every slider inside its range, so nothing unbounded reaches a CSS length or percentage', () => {
    const set = { backdropOpacity: 900, backdropScale: -4, backdropBlur: 1e9, backdropDim: 55.4 }
    expect(sanitizeTheme(set)).toMatchObject({ backdropOpacity: 100, backdropScale: 50, backdropBlur: 24, backdropDim: 55 })
    // Anything that is not a plain finite number is dropped rather than coerced.
    for (const bad of ['40', null, undefined, {}, [], NaN, Infinity, -Infinity, true]) {
      expect(sanitizeTheme({ backdropOpacity: bad, backdropScale: bad, backdropBlur: bad, backdropDim: bad })).toMatchObject({
        backdropOpacity: DEFAULT_THEME.backdropOpacity,
        backdropScale: DEFAULT_THEME.backdropScale,
        backdropBlur: DEFAULT_THEME.backdropBlur,
        backdropDim: DEFAULT_THEME.backdropDim,
      })
    }
  })
  it('offers every slider a range the sanitizer keeps, so the studio cannot hand out a value that gets thrown away', () => {
    expect(Object.keys(BACKDROP_RANGES)).toEqual(['opacity', 'scale', 'blur', 'dim'])
    const field = (name) => `backdrop${name[0].toUpperCase()}${name.slice(1)}`
    for (const [name, { min, max, step }] of Object.entries(BACKDROP_RANGES)) {
      expect(min, name).toBeLessThan(max)
      expect(step, name).toBeGreaterThan(0)
      expect(sanitizeTheme({ [field(name)]: min })[field(name)], `${name} min`).toBe(min)
      expect(sanitizeTheme({ [field(name)]: max })[field(name)], `${name} max`).toBe(max)
    }
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
