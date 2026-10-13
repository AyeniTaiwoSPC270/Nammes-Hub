import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  sanitizeTheme, DEFAULT_THEME, THEME_LOOKS, THEME_PATTERNS, THEME_CONFETTI, THEME_HEADLINE_MAX, THEME_TAGLINE_MAX,
  THEME_EFFECTS, THEME_MUSIC, BACKDROP_RANGES, THEME_BACKDROP_FITS, isClipId,
  themeCssVars, themeAccent, contrastWithWhite, contrastRatio, isHexColor, withLook, withAccent, withPage,
  withSchemeColors, SCHEME_COLOR_KEYS,
  PATTERN_GLYPHS, PATTERN_GEOMETRY, PATTERN_UNDRAWN, PAGE_LIGHT, PAGE_DARK, ACCENT_DERIVED_TOKENS,
  THEME_BACKDROP_MOTION, MOTION_PICTURE_ONLY, MOTION_PER_MARK, MOTION_MARKLESS_STANDIN, MOTION_DURATIONS,
  MOTION_SPEED_LABELS, MOTION_DISTANCE, resolveMotion, motionDuration, hasMarks,
} from './quizTheme.js'

describe('sanitizeTheme', () => {
  it('turns nothing, junk or the wrong type into the default look', () => {
    for (const bad of [undefined, null, 5, 'x', [], {}]) expect(sanitizeTheme(bad)).toEqual(DEFAULT_THEME)
  })
  it('keeps valid choices', () => {
    const chosen = { music: 'hype', effects: false, off: ['join'], custom: { music: null, effects: { tick: 'abc12345' } } }
    const t = { look: 'midnight', accent: '#AbCdEf', page: '#101010', glowA: null, glowB: null, deepA: null, deepB: null, pattern: 'waves', image: null, backdropOpacity: 30, backdropScale: 150, backdropBlur: 6, backdropDim: 20, backdropFit: 'contain', backdropMotion: 'drift', backdropMotionSpeed: 5, backdropMotionOnPhones: false, confetti: 'petals', headline: 'Quiz Night', tagline: 'Phones out', sound: chosen, logo: null, sponsors: [], showSponsors: { lobby: false, finish: true } }
    expect(sanitizeTheme(t)).toEqual({ ...t, accent: '#abcdef', page: '#101010' })
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
    // its limit, including every colour field, a backdrop picture, six sponsors and a full set of custom clips — measures
    // under 2,500 characters, so there is room to spare rather than a knife edge.
    //
    // accent, page and the four scheme colours are set explicitly rather than left to default. A fixture that leaves them
    // null measures a theme the app cannot produce, and the size check would stop noticing a field that started costing
    // real space.
    const custom = { music: 'm'.repeat(40), effects: Object.fromEntries(Object.keys(THEME_EFFECTS).map((name) => [name, 'e'.repeat(40)])) }
    const full = sanitizeTheme({ accent: '#010203', page: '#040506', glowA: '#070809', glowB: '#0a0b0c', deepA: '#0d0e0f', deepB: '#101112', headline: 'h'.repeat(60), tagline: 't'.repeat(80), pattern: 'image', image: good, logo: good, sponsors: Array.from({ length: 6 }, () => ({ name: 'n'.repeat(40), path: good })), sound: { music: 'custom', off: Object.keys(THEME_EFFECTS), custom } }, { quizId: QUIZ_A })
    expect(full.accent).toBe('#010203')
    expect(full.page).toBe('#040506')
    expect(full.deepA).toBe('#0d0e0f')
    expect(Object.keys(full.sound.custom.effects)).toHaveLength(Object.keys(THEME_EFFECTS).length)
    expect(full.sound.music).toBe('custom')
    expect(JSON.stringify(full).length).toBeLessThan(3000)
  })
})

describe('the pattern vocabulary', () => {
  // These tables are the contract between the two renderers: the screens draw with CSS and SVG, the result card with a
  // canvas, and neither can read the other's drawing code. A pattern missing from both tables renders on one and not the
  // other, which is the defect these tables exist to prevent.
  it('says what every pattern is made of, so no renderer can silently skip one', () => {
    for (const key of Object.keys(THEME_PATTERNS)) {
      const places = [PATTERN_GLYPHS, PATTERN_GEOMETRY].filter((table) => Object.hasOwn(table, key)).length + (PATTERN_UNDRAWN.includes(key) ? 1 : 0)
      expect(places, key).toBe(1)
    }
  })
  it('never names a pattern that does not exist, or lists one twice', () => {
    for (const key of [...Object.keys(PATTERN_GLYPHS), ...Object.keys(PATTERN_GEOMETRY), ...PATTERN_UNDRAWN]) {
      expect(Object.hasOwn(THEME_PATTERNS, key), key).toBe(true)
    }
    for (const key of Object.keys(PATTERN_GLYPHS)) expect(Object.hasOwn(PATTERN_GEOMETRY, key), key).toBe(false)
    for (const key of PATTERN_UNDRAWN) expect(Object.hasOwn(PATTERN_GLYPHS, key) || Object.hasOwn(PATTERN_GEOMETRY, key), key).toBe(false)
  })
  it('gives every glyph set real single characters to draw', () => {
    for (const [key, glyphs] of Object.entries(PATTERN_GLYPHS)) {
      expect(glyphs.length, key).toBeGreaterThan(1)
      for (const glyph of glyphs) expect(typeof glyph === 'string' && [...glyph].length === 1, `${key} ${glyph}`).toBe(true)
    }
  })
  it('gives every drawn pattern positive measurements, so the card can scale them', () => {
    for (const [key, shape] of Object.entries(PATTERN_GEOMETRY)) {
      expect(Object.keys(shape).length, key).toBeGreaterThan(0)
      for (const [name, value] of Object.entries(shape)) {
        if (typeof value === 'number') expect(value, `${key}.${name}`).toBeGreaterThan(0)
        else if (Array.isArray(value)) expect(value.every((n) => typeof n === 'number'), `${key}.${name}`).toBe(true)
        else if (typeof value === 'object') expect(Object.keys(value).length, `${key}.${name}`).toBeGreaterThan(0)
        else expect(typeof value, `${key}.${name}`).toBe('string')
      }
    }
  })
  it('is what both renderers actually read, rather than a table each keeps its own copy of', () => {
    // The duplication this replaced was two hand-maintained arrays that agreed by luck. Neither renderer is cheaply
    // rendered here — one is a component tree and the other needs a canvas — so what is checked is that neither has gone
    // back to holding a backdrop vocabulary of its own.
    //
    // The forbidden set is read off the table rather than written out here, so a character added to PATTERN_GLYPHS in
    // six months is covered without touching this test. A name check would be worse twice over: narrower (it would miss
    // a list called something new) and it would have to be updated by hand to stay useful.
    //
    // Source is cut into top-level declarations first and each is scanned on its own. Cutting out the one declaration
    // that is allowed to repeat the characters with a regex was the obvious way to write this and it is wrong: a lazy
    // match runs to the next closing brace, so reflowing that declaration onto one line silently exempts the eleven
    // per cent of the file after it, and a planted duplicate goes unseen with the suite still green. Boundaries are the
    // start of each top-level `const`/`function`/`export`, which is where a reformat cannot reach.
    //
    // The scan is quadratic in the worst case — it walks each block looking for a character rather than bailing early.
    // On files this size that is tens of microseconds; noted because the cost is invisible from the pattern.
    const repertoire = new RegExp(`[${Object.values(PATTERN_GLYPHS).flat().join('').replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}]`)

    const topLevel = /^(?:const|let|function|export)\b/gm
    for (const file of ['src/components/quiz/QuizParts.jsx', 'api/_lib/quizCardRender.js']) {
      const source = readFileSync(file, 'utf8')
      expect(source, `${file} should read the shared table`).toMatch(/import\s*\{[^}]*PATTERN_GLYPHS/)
      const starts = [...source.matchAll(topLevel)].map((m) => m.index)
      expect(starts.length, `${file} should have top-level declarations to scan`).toBeGreaterThan(0)
      for (const [i, start] of starts.entries()) {
        const block = source.slice(start, starts[i + 1] ?? source.length)
        const name = block.match(/^(?:const|let|function|export)\s+([\w$]+)/)?.[1] ?? '?'
        // Confetti repeats these characters on purpose — a sparkles celebration and a sparkles backdrop both use ★ —
        // and never reaches the card. It is exempt by name, so that stays true however it is written.
        if (name.startsWith('CONFETTI_')) continue
        expect(block, `${file} declares "${name}" with the table's own characters`).not.toMatch(repertoire)
      }
      expect(source, `${file} should not declare its own shape path`).not.toMatch(/=\s*'M0 /)
    }
    // The declarations the exemption must not swallow: an answer shape and the confetti colours, neither a backdrop.
    const parts = readFileSync('src/components/quiz/QuizParts.jsx', 'utf8')
    expect(parts).toContain('const SHAPES = [')
    expect(parts).toContain('const CONFETTI_COLORS = [')
  })
})

describe('the page colour', () => {
  it('is off by default, so a quiz with no page colour looks exactly as it did before', () => {
    expect(DEFAULT_THEME.page).toBeNull()
    expect(sanitizeTheme({})).toEqual(DEFAULT_THEME)
    expect(sanitizeTheme({})).toHaveProperty('page')
  })

  it('takes only a #rrggbb colour, the same rule the accent has', () => {
    for (const bad of ['#fff', '#12345', '#1234567', 'red', 'rgb(0,0,0)', '#000000;}', 'var(--color-paper)', 12, [], {}]) {
      expect(sanitizeTheme({ page: bad }).page, String(bad)).toBeNull()
    }
    expect(sanitizeTheme({ page: '#0A1B2c' }).page).toBe('#0a1b2c')
  })

  it('changes the tokens the screens already read, and nothing else', () => {
    // The point of going through the tokens rather than a new mechanism: no screen file changes, because every one of
    // them already says bg-paper or text-ink-900 and those compile to these variables.
    const vars = themeCssVars({ page: '#0d1310' })
    expect(vars['--color-paper']).toBe('#0d1310')
    expect(Object.keys(vars).filter((k) => !k.startsWith('--color-') && !k.startsWith('--qz-') && k !== 'colorScheme')).toEqual([])
    expect(themeCssVars({})['--color-paper']).toBeUndefined()
    expect(themeCssVars({})['colorScheme']).toBeUndefined()
  })

  it('paints the colour that was chosen, not one of the two palette pages', () => {
    // Both palette papers are used as test colours elsewhere, so a palette page passes whether or not the choice is
    // honoured at all. These are colours the admin could pick that belong to neither, which is the only case that
    // separates a working control from one that quietly paints everything the same two colours.
    for (const page of ['#3b0764', '#123456', '#ffd7e0', '#7f1d1d', '#00b4d8']) {
      expect(themeCssVars({ page })['--color-paper'], page).toBe(page)
    }
    // And the ink still flips around whatever was chosen.
    expect(themeCssVars({ page: '#3b0764' })['--color-ink-900']).toBe(PAGE_DARK['ink-900'])
    expect(themeCssVars({ page: '#ffd7e0' })['--color-ink-900']).toBe(PAGE_LIGHT['ink-900'])
  })

  it('tells the browser which colour scheme it is on, since native controls do not read our tokens', () => {
    // `colorScheme`, not `color-scheme`: React logs an error for a hyphenated key that is not a custom property, and it
    // would do so on every render of every quiz screen.
    expect(themeCssVars({ page: '#3b0764' }).colorScheme).toBe('dark')
    expect(themeCssVars({ page: '#ffd7e0' }).colorScheme).toBe('light')
  })

  it('flips the text to whichever ink reads better, measured rather than guessed', () => {
    // A threshold on lightness gets mid-tones wrong, which is exactly where a dark page is most tempting and most
    // likely to end up unreadable.
    const inkOn = (page) => themeCssVars({ page })['--color-ink-900']
    expect(inkOn('#fcf9f8')).toBe(PAGE_LIGHT['ink-900'])
    expect(inkOn('#0d1310')).toBe(PAGE_DARK['ink-900'])
    expect(inkOn('#808080')).toBe(PAGE_LIGHT['ink-900'])
    // Whatever the page, the ink it picks has to be legible on it.
    for (const page of ['#fcf9f8', '#0d1310', '#808080', '#ffc400', '#4b0082', '#00ff00']) {
      expect(contrastRatio(inkOn(page), page), `${page} should be readable`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps the dark palette in step with the .dark block in index.css', () => {
    // Two sources for one palette is only safe while something compares them, and the comparison cannot be an import:
    // index.css is CSS and this is JavaScript.
    //
    // Matched to the closing brace, and exactly one block expected. Slicing to end-of-file works today and then quietly
    // stops working the first time anything below `.dark` declares a `--color-*` hex, because the last match wins and the
    // assertion would start comparing against the wrong rule.
    const css = readFileSync('src/index.css', 'utf8')
    const blockOf = (pattern) => {
      const found = [...css.matchAll(pattern)]
      expect(found.length, `${pattern} should match exactly one block in index.css`).toBe(1)
      return found[0][1]
    }
    const tokensIn = (block) => Object.fromEntries([...block.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map(([, token, value]) => [token, value.toLowerCase()]))

    const declared = tokensIn(blockOf(/\.dark\s*\{([^}]*)\}/g))
    const lightDeclared = tokensIn(blockOf(/@theme\s*\{([^}]*)\}/g))
    for (const [token, value] of Object.entries(PAGE_DARK)) expect(declared[token], `${token} should match index.css`).toBe(value)
    for (const [token, value] of Object.entries(PAGE_LIGHT)) expect(lightDeclared[token], `${token} should match index.css`).toBe(value)
  })

  it('holds nothing the accent owns, which would overwrite it on every screen', () => {
    // themeCssVars derives the orange steps and brand-orange from the accent and spreads the page palette *after* them,
    // so a token here would silently repaint the accent. This is the only thing standing between a routine dark-mode
    // tweak to `.dark` and that bug, which is why it is checked rather than left to a comment.
    for (const [name, palette] of [['PAGE_LIGHT', PAGE_LIGHT], ['PAGE_DARK', PAGE_DARK]]) {
      for (const token of ACCENT_DERIVED_TOKENS) {
        expect(Object.keys(palette), `${name} must not carry ${token}`).not.toContain(token)
      }
    }
  })

  it('covers every token a quiz screen paints its page with', () => {
    // A token missing here is one the admin's page colour silently does not reach, which looks like the colour not working.
    for (const token of ['paper', 'surface', 'surface-low', 'ink-900', 'ink', 'ink-muted', 'hairline', 'brand']) {
      expect(Object.keys(PAGE_LIGHT), token).toContain(token)
      expect(PAGE_DARK[token], token).toMatch(/^#[0-9a-f]{6}$/)
      expect(themeCssVars({ page: '#101010' })[`--color-${token}`], token).toBeDefined()
    }
  })
})

describe('picking a colour', () => {
  it('changes the scheme without disturbing a custom accent, including the scheme already chosen', () => {
    // The studio wrote `accent: null` into every scheme button, so re-clicking your own scheme threw the custom colour
    // away with no warning. That is what "custom colours do not work" meant.
    const custom = sanitizeTheme({ look: 'ocean', accent: '#123456' })
    for (const look of Object.keys(THEME_LOOKS)) expect(withLook(custom, look).accent, look).toBe('#123456')
    expect(withLook(custom, 'ocean')).toMatchObject({ look: 'ocean', accent: '#123456' })
    expect(withLook(custom, 'royal').look).toBe('royal')
  })
  it('goes back to the scheme colour only when asked, and never leaves an unusable one behind', () => {
    expect(withAccent(sanitizeTheme({ look: 'ocean', accent: '#123456' }), null).accent).toBeNull()
    expect(withAccent(sanitizeTheme({ look: 'ocean' }), '#AbCdEf').accent).toBe('#abcdef')
    // A value the picker cannot produce still has to mean something, and sanitizeTheme already answers this one: none.
    for (const bad of ['red', '#fff', 'rgb(0,0,0)', '#000000;}', 12]) {
      expect(withAccent(sanitizeTheme({ look: 'ocean', accent: '#123456' }), bad).accent, String(bad)).toBeNull()
    }
  })
  it('refuses a scheme it does not know, so a stale control cannot put junk on the projector', () => {
    for (const bad of ['__proto__', 'constructor', 'toString', '', 5, null]) {
      expect(withLook(sanitizeTheme({ look: 'royal' }), bad).look, String(bad)).toBe(DEFAULT_THEME.look)
    }
  })
  it('sets a page colour the same way, and clears it on the same terms', () => {
    const set = withPage(sanitizeTheme({ look: 'royal' }), '#0A1B2c')
    expect(set.page).toBe('#0a1b2c')
    expect(set.look, 'changing the page must not disturb the scheme').toBe('royal')
    expect(withPage(set, null).page).toBeNull()
    for (const bad of ['var(--color-paper)', '#fff', 12]) expect(withPage(set, bad).page, String(bad)).toBeNull()
  })
})

describe('the scheme’s own four colours', () => {
  const none = sanitizeTheme({ look: 'ocean' })
  const set = withSchemeColors(none, { deepA: '#0a1b2c' })

  it('starts on the scheme’s colours, so every quiz saved before this is untouched', () => {
    for (const key of SCHEME_COLOR_KEYS) expect(DEFAULT_THEME[key], key).toBeNull()
    expect(none).toMatchObject({ glowA: null, glowB: null, deepA: null, deepB: null })
  })

  it('takes #rrggbb and nothing else, exactly as the accent does', () => {
    const four = sanitizeTheme({ glowA: '#AbCdEf', glowB: '#123456', deepA: '#0B2417', deepB: '#17492f' })
    expect(four).toMatchObject({ glowA: '#abcdef', glowB: '#123456', deepA: '#0b2417', deepB: '#17492f' })
    for (const bad of ['red', '#fff', 'rgb(0,0,0)', '#000000;}', 12, null]) {
      expect(sanitizeTheme({ glowA: bad }).glowA, String(bad)).toBeNull()
      expect(sanitizeTheme({ deepB: bad }).deepB, String(bad)).toBeNull()
    }
  })

  it('sets one end of a gradient without disturbing the other three colours', () => {
    const vars = themeCssVars({ look: 'ocean', deepA: '#ff0000' })
    expect(vars['--qz-deep-a']).toBe('#ff0000')
    expect(vars['--qz-deep-b'], 'the other end is a separate decision').toBe(THEME_LOOKS.ocean.deep[1])
    expect(vars['--qz-glow-a']).toBe(THEME_LOOKS.ocean.glow[0])
    expect(vars['--qz-glow-b']).toBe(THEME_LOOKS.ocean.glow[1])
  })

  it('falls back to the scheme’s tint, not to its button colour', () => {
    // ocean’s accent and its glow[0] are different colours, so conflating them is invisible on a look where the two happen
    // to match and wrong on the ones where they do not. The neighbouring variable is named `accent`, which makes the slip
    // an easy one to make.
    expect(THEME_LOOKS.ocean.accent).not.toBe(THEME_LOOKS.ocean.glow[0])
    expect(themeCssVars({ look: 'ocean' })['--qz-glow-a']).toBe(THEME_LOOKS.ocean.glow[0])
  })

  it('keeps the accent’s place in the glow, below an explicit colour and above the scheme', () => {
    expect(themeCssVars({ look: 'ocean', accent: '#00ff00' })['--qz-glow-a'], 'a custom accent tints the glow, as it always has').toBe('#00ff00')
    expect(themeCssVars({ look: 'ocean', accent: '#00ff00', glowA: '#ff0000' })['--qz-glow-a'], 'an explicit colour wins').toBe('#ff0000')
    expect(themeCssVars({ look: 'ocean', accent: '#00ff00', glowA: null })['--qz-glow-a'], 'handing the glow back gives it to the accent again').toBe('#00ff00')
  })

  it('changes a colour and nothing else', () => {
    expect(set.deepA).toBe('#0a1b2c')
    expect(set.look, 'a colour must not change the scheme').toBe('ocean')
    expect(set.accent, 'and must not disturb the accent').toBeNull()
    expect(set.glowA).toBeNull()
    expect(withSchemeColors(set, { deepA: null, deepB: null }).deepA, 'clearing a pair').toBeNull()
    expect(withSchemeColors(set, {}).deepA, 'an absent key leaves what is already set alone').toBe('#0a1b2c')
  })

  it('refuses a key it does not own, so a patch cannot reach through and change something else', () => {
    // The patch is looser than withAccent’s single value, so the key check is the part that has to hold.
    for (const patch of [{ accent: '#123456' }, { look: 'royal' }, { page: '#000000' }, JSON.parse('{"__proto__":"#123456"}')]) {
      const out = withSchemeColors(none, patch)
      expect(out.accent, JSON.stringify(patch)).toBeNull()
      expect(out.look, JSON.stringify(patch)).toBe('ocean')
      expect(Object.keys(out).sort(), JSON.stringify(patch)).toEqual(Object.keys(none).sort())
    }
  })

  it('refuses a value it cannot use, and a patch that is not a patch', () => {
    for (const bad of ['red', '#fff', 'var(--x)', 12, null]) expect(withSchemeColors(set, { deepA: bad }).deepA, String(bad)).toBeNull()
    // A patch that is not an object changes nothing at all, rather than throwing or wiping a colour that was set.
    for (const bad of [null, 5, 'red', [], '#0a1b2c']) expect(withSchemeColors(set, bad).deepA, String(bad)).toBe('#0a1b2c')
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
  it('gives every celebration something to rain down, so none of them can silently fall blank', () => {
    // The pattern side has this guard and the celebration side did not: a style added to the studio with no piece set
    // renders nothing and the studio still says it is there.
    //
    // Checked in the source rather than by import, because CONFETTI_GLYPHS holds emoji and lives in QuizParts.jsx with
    // the renderer that uses it — a pure module here has no business owning it. Same reasoning as the backdrop guard
    // above, which reads the two renderer files for the same reason.
    const source = readFileSync('src/components/quiz/QuizParts.jsx', 'utf8')
    const glyphBlock = source.match(/CONFETTI_GLYPHS\s*=\s*\{([\s\S]*?)\n\}/)
    const glyphKeys = glyphBlock ? [...glyphBlock[1].matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]) : []
    const shaped = source.match(/CONFETTI_SHAPED\s*=\s*new Set\(\[([^\]]*)\]\)/)
    const shapedKeys = shaped ? [...shaped[1].matchAll(/'(\w+)'/g)].map((m) => m[1]) : []
    for (const key of Object.keys(THEME_CONFETTI)) {
      // 'paper' is the one style with no character in it, so it is listed in the shaped set rather than the glyph map.
      if (key === 'off') continue
      const has = glyphKeys.includes(key) || shapedKeys.includes(key)
      expect(has, `${key} has nothing to draw`).toBe(true)
    }
    expect(Object.keys(THEME_CONFETTI)).toEqual(['math', 'stars', 'petals', 'emoji', 'paper', 'letters', 'money', 'notes', 'hearts', 'off'])
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
    expect(Object.keys(BACKDROP_RANGES)).toEqual(['opacity', 'scale', 'blur', 'dim', 'motionSpeed'])
    const field = (name) => `backdrop${name[0].toUpperCase()}${name.slice(1)}`
    for (const [name, { min, max, step }] of Object.entries(BACKDROP_RANGES)) {
      expect(min, name).toBeLessThan(max)
      expect(step, name).toBeGreaterThan(0)
      expect(sanitizeTheme({ [field(name)]: min })[field(name)], `${name} min`).toBe(min)
      expect(sanitizeTheme({ [field(name)]: max })[field(name)], `${name} max`).toBe(max)
    }
  })
})

describe('backdrop motion', () => {
  const pic = `${QUIZ_A}/${FILE}-1767261600000.webp`
  it('is still by default, so no quiz starts moving on its own', () => {
    // A projector may already be on air, and every next game copies this default when it starts.
    expect(DEFAULT_THEME.backdropMotion).toBe('off')
    expect(sanitizeTheme({})).toMatchObject({ backdropMotion: 'off', backdropMotionSpeed: 3, backdropMotionOnPhones: true })
  })
  it('only accepts a style that is on the list, so nothing reaches CSS', () => {
    for (const style of Object.keys(THEME_BACKDROP_MOTION)) {
      // Pan needs a photograph to pan, so it is asked for in the one configuration where it is valid. That it settles
      // everywhere else is the next test's job, not this one's.
      expect(sanitizeTheme({ pattern: 'image', image: pic, backdropMotion: style }, { quizId: QUIZ_A }).backdropMotion, style).toBe(style)
    }
    for (const bad of ['__proto__', 'constructor', 'spin', '', 5, null, undefined, ['drift'], { drift: true }]) {
      expect(sanitizeTheme({ backdropMotion: bad }).backdropMotion, String(bad)).toBe('off')
    }
  })
  it("settles Pan to Still on anything but 'My image', and keeps the picture for next time", () => {
    // The same double defence cleanPattern gives 'image' with no upload: the studio greys the button out for a real
    // admin, and this is what catches a hand-edited row. A kept picture with a changed pattern also stops panning, or
    // the projector would animate a photograph no screen is drawing.
    for (const pattern of Object.keys(THEME_PATTERNS)) {
      const withPic = pattern === 'image' ? { pattern, image: pic } : { pattern }
      expect(sanitizeTheme({ ...withPic, backdropMotion: 'pan' }, { quizId: QUIZ_A }).backdropMotion, pattern).toBe(
        pattern === 'image' ? 'pan' : 'off',
      )
    }
    // 'My image' with no upload is Plain, and Plain has nothing to pan — the same fall cleanPattern makes.
    expect(sanitizeTheme({ pattern: 'image', backdropMotion: 'pan' }).backdropMotion).toBe('off')
    const chosen = sanitizeTheme({ pattern: 'waves', image: pic, backdropMotion: 'pan' }, { quizId: QUIZ_A })
    expect(chosen.image, 'the picture is kept so switching back does not need a second upload').toBe(pic)
    expect(chosen.backdropMotion).toBe('off')
    expect(sanitizeTheme({ pattern: 'image', image: pic, backdropMotion: 'pan' }, { quizId: QUIZ_A }).backdropMotion).toBe('pan')
  })
  it('moves phones unless told not to, and reads anything that is not false as yes', () => {
    // The showSponsors shape, so a row that lost the field gets the common case rather than the quiet one.
    expect(sanitizeTheme({ backdropMotionOnPhones: false }).backdropMotionOnPhones).toBe(false)
    for (const missing of [null, undefined, 0, '', 'no']) {
      expect(sanitizeTheme({ backdropMotionOnPhones: missing }).backdropMotionOnPhones, String(missing)).toBe(true)
    }
  })
  it('holds the speed inside 1 to 5, so no duration can be worked out from nonsense', () => {
    const { min, max } = BACKDROP_RANGES.motionSpeed
    expect(sanitizeTheme({ backdropMotionSpeed: 99 }).backdropMotionSpeed).toBe(max)
    expect(sanitizeTheme({ backdropMotionSpeed: -3 }).backdropMotionSpeed).toBe(min)
    for (const bad of ['3', null, undefined, {}, NaN, Infinity, true]) {
      expect(sanitizeTheme({ backdropMotionSpeed: bad }).backdropMotionSpeed, String(bad)).toBe(DEFAULT_THEME.backdropMotionSpeed)
    }
    expect(MOTION_SPEED_LABELS).toHaveLength(max - min + 1)
  })

  describe('the vocabulary the screens and the studio share', () => {
    it('gives every style a duration and a keyframe, so a typo cannot leave a still projector', () => {
      // Without this, a style added to the list and a class misspelled in the renderer is a backdrop that simply does
      // not move, with nothing failing. The same idea as the pattern tables being checked against both renderers.
      const css = readFileSync('src/index.css', 'utf8')
      for (const style of Object.keys(THEME_BACKDROP_MOTION)) {
        if (style === 'off') continue
        expect(MOTION_DURATIONS[style], `${style} has no duration`).toBeGreaterThan(0)
        expect(css, `${style} has no @keyframes`).toMatch(new RegExp(`@keyframes qz-bd-${style}\\s*\\{`))
        // Read the style's own rule rather than searching the file: this shipped once with every keyframe present and
        // every class present, and nothing running, because the rules were grouped and no rule ever set
        // `animation-name`. A keyframe nobody names and a class nobody binds are both perfectly valid CSS, so the
        // vocabulary checks all passed over a completely still projector.
        const rule = new RegExp(`\\.qz-bd-${style}\\s*\\{([^}]*)\\}`)
        const found = css.match(rule)
        expect(found, `${style} has no class`).not.toBeNull()
        const body = found[1]
        expect(body, `${style} names no keyframes, so its animation is the initial none`).toContain(`animation-name: qz-bd-${style}`)
        expect(body, `${style} does not loop`).toContain('infinite')
      }
      expect(Object.keys(MOTION_DURATIONS).sort()).toEqual(Object.keys(THEME_BACKDROP_MOTION).filter((s) => s !== 'off').sort())
      for (const label of MOTION_SPEED_LABELS) expect(typeof label).toBe('string')
    })
    it('splits the styles into the ones that move one layer and the ones that move each mark', () => {
      for (const style of MOTION_PER_MARK) {
        expect(Object.hasOwn(THEME_BACKDROP_MOTION, style), style).toBe(true)
        expect(Object.hasOwn(MOTION_MARKLESS_STANDIN, style), `${style} has no stand-in for a pattern with no marks`).toBe(true)
      }
      // A stand-in must be a whole-layer loop, or Dots would resolve a per-mark style to another per-mark style and
      // still have nothing to move.
      for (const [style, standIn] of Object.entries(MOTION_MARKLESS_STANDIN)) {
        expect(MOTION_PER_MARK, `${style} stands in for itself`).not.toContain(standIn)
        expect(MOTION_PICTURE_ONLY, `${style} stands in for a picture-only loop`).not.toContain(standIn)
        expect(Object.hasOwn(MOTION_DURATIONS, standIn), `${style} stands in for ${standIn}, which has no duration`).toBe(true)
      }
      for (const style of MOTION_PICTURE_ONLY) expect(MOTION_PER_MARK).not.toContain(style)
      for (const [style, distance] of Object.entries(MOTION_DISTANCE)) {
        expect(Object.hasOwn(MOTION_DURATIONS, style), `${style} has no duration`).toBe(true)
        expect(distance, `${style} grows by nothing`).toBeGreaterThan(0)
      }
    })
    it('resolves every style to something that can be drawn on every pattern', () => {
      // A style that silently resolved to Still would be a dead button in the studio with no warning anywhere.
      for (const pattern of Object.keys(THEME_PATTERNS)) {
        for (const style of Object.keys(THEME_BACKDROP_MOTION)) {
          const drawn = resolveMotion(style, pattern)
          if (style === 'off' || pattern === 'none' || (MOTION_PICTURE_ONLY.includes(style) && pattern !== 'image')) {
            expect(drawn, `${style} on ${pattern}`).toBe('off')
          } else {
            expect(drawn, `${style} on ${pattern} draws nothing`).not.toBe('off')
            expect(Object.hasOwn(MOTION_DURATIONS, drawn), `${style} on ${pattern} resolves to ${drawn}, which has no duration`).toBe(true)
          }
        }
      }
    })
    it('keeps the style the admin chose when the pattern changes, so switching back restores it', () => {
      // The stand-in is applied when drawing, never when saving. Rewriting the row instead would mean an admin who
      // picked Float, looked at Dots, and went back to Maths had silently lost their choice.
      const saved = sanitizeTheme({ pattern: 'dots', backdropMotion: 'float' })
      expect(saved.backdropMotion).toBe('float')
      expect(resolveMotion(saved.backdropMotion, saved.pattern)).toBe('breathe')
      expect(sanitizeTheme({ pattern: 'math', backdropMotion: 'float' }).backdropMotion).toBe('float')
    })
    it('reads which patterns have marks to move off the two shared tables, not a list of its own', () => {
      // A third list would be one more thing to remember when a pattern is added, and the tables already say it: a
      // pattern has marks if it is typed from glyphs or its geometry counts how many to draw.
      const marked = Object.keys(THEME_PATTERNS).filter(hasMarks)
      expect(marked.sort()).toEqual(['hexagons', 'math', 'notes', 'party', 'rings', 'stars'])
      for (const pattern of marked) {
        expect(PATTERN_GLYPHS[pattern] ?? PATTERN_GEOMETRY[pattern].count, pattern).toBeTruthy()
      }
      expect(hasMarks('nope')).toBe(false)
      expect(hasMarks('none')).toBe(false)
      // A per-mark style is only swapped for its stand-in exactly where there is nothing to move it on. Anywhere else,
      // the studio would be promising one thing and the projector drawing another without ever saying so.
      for (const pattern of Object.keys(THEME_PATTERNS)) {
        for (const style of MOTION_PER_MARK) {
          const swap = resolveMotion(style, pattern) !== style
          expect(swap, `${style} on ${pattern}`).toBe(!hasMarks(pattern))
        }
      }
    })
  })

  describe('motionDuration', () => {
    it('runs the table as written at the reference speed, and divides either side of it', () => {
      for (const [style, base] of Object.entries(MOTION_DURATIONS)) {
        expect(motionDuration(style, 3), style).toBeCloseTo(base, 1)
        expect(motionDuration(style, 5), style).toBeLessThan(motionDuration(style, 3))
        expect(motionDuration(style, 1), style).toBeGreaterThan(motionDuration(style, 3))
      }
    })
    it('has nothing to say about Still, or about a speed outside the slider', () => {
      expect(motionDuration('off', 3)).toBe(0)
      expect(motionDuration('spin', 3)).toBe(0)
      expect(motionDuration('drift', 99)).toBe(motionDuration('drift', BACKDROP_RANGES.motionSpeed.max))
      expect(motionDuration('drift', -3)).toBe(motionDuration('drift', BACKDROP_RANGES.motionSpeed.min))
    })
  })
})

describe('themeCssVars', () => {
  it("uses the look's accent, or the custom accent when one is set", () => {
    expect(themeCssVars({ look: 'ocean' })['--color-orange-500']).toBe(THEME_LOOKS.ocean.accent)
    expect(themeCssVars({ look: 'ocean', accent: '#112233' })['--color-orange-500']).toBe('#112233')
    expect(themeAccent({ look: 'forest' })).toBe(THEME_LOOKS.forest.accent)
  })
  it('only ever produces safe values', () => {
    const safe = /^(#[0-9a-f]{6}|color-mix\(in srgb, #[0-9a-f]{6} \d+%, (black|white)\))$/
    for (const value of Object.values(themeCssVars({ look: 'royal', accent: '#abcdef' }))) expect(value).toMatch(safe)
    // The page case too, since it adds a property that is not a colour: colorScheme is a fixed word or it is nothing,
    // and it is the one value here that is not caught by the hex rule.
    const vars = themeCssVars({ look: 'royal', accent: '#abcdef', page: '#3b0764' })
    for (const [key, value] of Object.entries(vars)) {
      if (key === 'colorScheme') expect(value).toMatch(/^(light|dark)$/)
      else expect(value, key).toMatch(safe)
    }
  })
  it('measures contrast sensibly', () => {
    expect(contrastWithWhite('#000000')).toBeGreaterThan(20)
    expect(contrastWithWhite('#ffffff')).toBeLessThan(1.1)
    expect(contrastWithWhite('nope')).toBe(1)
  })
})
