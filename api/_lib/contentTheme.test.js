import { describe, it, expect } from 'vitest'
import {
  DEFAULT_THEME,
  FEATURED,
  IMAGE_ASPECTS,
  PAGES,
  RADII,
  SHADOWS,
  SWATCHES,
  cleanLookName,
  defaultTheme,
  sanitizeTheme,
  themeVars,
} from './contentTheme.js'

const SWATCH_IDS = SWATCHES.map((s) => s.id)

// Values that are not a legal choice for ANY field in the theme, so wherever they land the default must come
// back. Values that are legal somewhere but not here are checked by validity instead, in the meta-test below.
const TYPE_JUNK = [undefined, null, {}, [], () => {}, new Date(0), '', '   ', Number.NaN, Infinity, [1, 2], Symbol.iterator]

// The other half: a real value of some type, held to this field's own rule. `columns` clamps rather than
// falling back, `stagger` legitimately turns off, and inherited property names are ordinary words, so these
// must not all equal the default.
const OUT_OF_RANGE = [0, 99, -3, 1.5, true, '12', 'green', 'constructor', '__proto__', 'toString', 'red;']

// Every leaf path in DEFAULT_THEME, so the test below walks the real shape instead of a hand-typed copy that
// would drift the moment a field is added.
function leafPaths(node, prefix = []) {
  if (Array.isArray(node) || node === null || typeof node !== 'object') return [prefix]
  return Object.entries(node).flatMap(([key, value]) => leafPaths(value, [...prefix, key]))
}

function setAt(raw, path, value) {
  let node = raw
  for (const key of path.slice(0, -1)) {
    node = node[key]
  }
  node[path[path.length - 1]] = value
  return raw
}

describe('sanitizeTheme: nothing and junk', () => {
  it('turns nothing, junk or the wrong type into the default theme', () => {
    for (const bad of [undefined, null, 'a string', 42, true, [], {}, new Map()]) {
      expect(sanitizeTheme(bad, 'news'), String(bad)).toEqual(DEFAULT_THEME)
    }
  })

  it('never throws, whatever it is handed', () => {
    const weird = [
      { accent: 'nope', card: 5, type: [], layout: 'x' },
      { accent: null, card: null, type: null, layout: null },
      { accent: [1, 2, 3], card: { radius: {}, shadow: [] }, type: { titleSize: {}, clamp: [] } },
      { layout: { columns: {}, featured: {}, imageAspect: {}, stagger: {}, page: {} } },
    ]
    for (const input of weird) {
      expect(() => sanitizeTheme(input, 'news')).not.toThrow()
      expect(sanitizeTheme(input, 'news')).toEqual(DEFAULT_THEME)
    }
  })

  it('leaves the input untouched, frozen input included', () => {
    const deepFreeze = (value) => {
      if (value && typeof value === 'object') {
        Object.values(value).forEach(deepFreeze)
        Object.freeze(value)
      }
      return value
    }
    const raw = deepFreeze({
      accent: { color: 'danger', hex: '#AABBCC' },
      card: { radius: 'lg', shadow: 'none', image: 'plain', density: 'spacious' },
      type: { titleSize: 'xl', clamp: 5 },
      layout: { columns: 2, featured: 'image-top', imageAspect: 'short', stagger: false },
    })
    const snapshot = JSON.stringify(raw)
    expect(() => sanitizeTheme(raw, 'news')).not.toThrow()
    expect(JSON.stringify(raw)).toBe(snapshot)

    const mutable = { ...JSON.parse(snapshot) }
    const before = JSON.stringify(mutable)
    sanitizeTheme(mutable, 'news')
    expect(JSON.stringify(mutable)).toBe(before)
  })

  it('is idempotent and ignores unknown fields', () => {
    const once = sanitizeTheme({ card: { radius: 'lg', extra: 'x' }, looks: ['a'], ghost: { color: 'danger' } }, 'news')
    expect(once).not.toHaveProperty('card.extra')
    expect(once).not.toHaveProperty('looks')
    expect(once).not.toHaveProperty('ghost')
    expect(sanitizeTheme(once, 'news')).toEqual(once)
  })
})

describe('sanitizeTheme: the page it is judging for', () => {
  it('echoes the page from the row, never from the payload', () => {
    // A look's page is decided by which admin screen saved it. A design copied out of the other page's row
    // must not be able to move itself across.
    expect(sanitizeTheme({ layout: { page: 'events' } }, 'news').layout.page).toBe('news')
    expect(sanitizeTheme({ layout: { page: 'news' } }, 'events').layout.page).toBe('events')
  })

  it('falls back to news for a page that is not one of the two', () => {
    for (const page of [undefined, null, '', 'calendar', 'Events', 5, {}, []]) {
      expect(sanitizeTheme(undefined, page).layout.page).toBe('news')
    }
    expect(PAGES).toEqual(['events', 'news'])
  })

  it('gives the events page no lead story, whatever the row says', () => {
    for (const featured of FEATURED) {
      expect(sanitizeTheme({ layout: { featured } }, 'events').layout.featured).toBe('none')
    }
  })

  it('lets the news page choose its lead story', () => {
    for (const featured of FEATURED) {
      expect(sanitizeTheme({ layout: { featured } }, 'news').layout.featured).toBe(featured)
    }
    for (const featured of ['sideways', '', 1, {}, null]) {
      expect(sanitizeTheme({ layout: { featured } }, 'news').layout.featured).toBe(DEFAULT_THEME.layout.featured)
    }
  })

  it('starts each page on the picture shape its cards have always used', () => {
    // Events have been aspect-[3/4] and news a shorter band. A single default would restyle one of the two
    // pages the moment this shipped, so the starting value is per-page -- while staying editable on both.
    expect(sanitizeTheme(undefined, 'events').layout.imageAspect).toBe('tall')
    expect(sanitizeTheme(undefined, 'news').layout.imageAspect).toBe('wide')
    expect(sanitizeTheme({ layout: { imageAspect: 'short' } }, 'events').layout.imageAspect).toBe('short')
  })

  it('defaultTheme is sanitizeTheme of nothing, for that page', () => {
    for (const page of PAGES) expect(defaultTheme(page)).toEqual(sanitizeTheme(undefined, page))
  })
})

describe('sanitizeTheme: partial themes', () => {
  it('keeps what was given and fills in the rest', () => {
    const t = sanitizeTheme(
      {
        accent: { color: 'flame', hex: '#123456' },
        card: { radius: 'full', density: 'compact', image: 'plain', shadow: 'none' },
        type: { titleSize: 'xl', clamp: 5 },
        layout: { columns: 2, featured: 'image-top', imageAspect: 'short', stagger: false },
      },
      'news',
    )
    expect(t.accent).toEqual({ color: 'flame', hex: '#123456' })
    expect(t.card).toEqual({ radius: 'full', shadow: 'none', image: 'plain', density: 'compact' })
    expect(t.type).toEqual({ titleSize: 'xl', clamp: 5 })
    expect(t.layout).toEqual({ page: 'news', columns: 2, featured: 'image-top', imageAspect: 'short', stagger: false })
  })

  it('takes a valid swatch id for the accent', () => {
    for (const id of SWATCH_IDS) expect(sanitizeTheme({ accent: { color: id } }, 'news').accent.color).toBe(id)
  })
})

describe('sanitizeTheme: colours', () => {
  it('keeps an advanced hex alongside its swatch, rather than letting the two overwrite each other', () => {
    // Reading `color` alone made cleaning non-idempotent in the calendar studio: the studio holds a draft and
    // cleans it again on every render, so a colour typed into the Advanced field disappeared the moment any
    // unrelated control was touched.
    const t = sanitizeTheme({ accent: { color: 'flame', hex: '#123456' } }, 'news')
    expect(t.accent).toEqual({ color: 'flame', hex: '#123456' })
    // The studio is what decides a swatch choice clears the hex; the sanitiser only refuses to invent data.
    expect(sanitizeTheme({ accent: { color: 'flame', hex: '' } }, 'news').accent.hex).toBe('')
  })

  it('is idempotent for a swatch, a hex, and both together', () => {
    for (const accent of [
      { color: 'flame' },
      { color: 'flame', hex: '#123456' },
      { hex: '#A1B2C3' },
      { color: '#a1b2c3' },
    ]) {
      const once = sanitizeTheme({ accent }, 'news')
      expect(sanitizeTheme(once, 'news')).toEqual(once)
    }
  })

  it('accepts a hex as an advanced colour but still resolves a swatch for the picker', () => {
    const t = sanitizeTheme({ accent: { color: '#A1B2C3' } }, 'news')
    expect(t.accent.hex).toBe('#a1b2c3')
    expect(t.accent.color).toBe(DEFAULT_THEME.accent.color)
    expect(SWATCH_IDS).toContain(t.accent.color)
  })

  it('drops anything that is neither a swatch id nor a hex', () => {
    const bad = ['red', 'rgb(0,0,0)', '#fff', '#12345', '#1234567', '#000000;}', 'var(--color-ink)', 'white', ' ']
    for (const color of bad) {
      const t = sanitizeTheme({ accent: { color } }, 'news')
      expect(t.accent.color, color).toBe(DEFAULT_THEME.accent.color)
      expect(t.accent.hex, color).toBe('')
    }
  })

  it('falls back on an empty or non-string colour', () => {
    for (const color of ['', '   ', null, undefined, 12, {}, []]) {
      expect(sanitizeTheme({ accent: { color } }, 'news').accent).toEqual(DEFAULT_THEME.accent)
    }
  })

  it('falls back on an advanced hex that is not a hex, whatever the swatch', () => {
    for (const id of SWATCH_IDS) {
      const t = sanitizeTheme({ accent: { color: id, hex: 'red;' } }, 'news')
      expect(t.accent.color, id).toBe(id)
      expect(t.accent.hex, id).toBe('')
    }
  })
})

describe('sanitizeTheme: numbers and switches', () => {
  it('clamps the column count to 1..4', () => {
    expect(sanitizeTheme({ layout: { columns: 1 } }, 'news').layout.columns).toBe(1)
    expect(sanitizeTheme({ layout: { columns: 4 } }, 'news').layout.columns).toBe(4)
    expect(sanitizeTheme({ layout: { columns: 0 } }, 'news').layout.columns).toBe(1)
    expect(sanitizeTheme({ layout: { columns: 999 } }, 'news').layout.columns).toBe(4)
    expect(sanitizeTheme({ layout: { columns: -4 } }, 'news').layout.columns).toBe(1)
    expect(sanitizeTheme({ layout: { columns: 2.6 } }, 'news').layout.columns).toBe(3)
    for (const columns of [null, '2', {}, []]) {
      expect(sanitizeTheme({ layout: { columns } }, 'news').layout.columns).toBe(3)
    }
  })

  it('clamps the line clamp to 2..6', () => {
    expect(sanitizeTheme({ type: { clamp: 2 } }, 'news').type.clamp).toBe(2)
    expect(sanitizeTheme({ type: { clamp: 6 } }, 'news').type.clamp).toBe(6)
    expect(sanitizeTheme({ type: { clamp: 0 } }, 'news').type.clamp).toBe(2)
    expect(sanitizeTheme({ type: { clamp: 99 } }, 'news').type.clamp).toBe(6)
    expect(sanitizeTheme({ type: { clamp: 3.4 } }, 'news').type.clamp).toBe(3)
    for (const clamp of [null, '3', {}, []]) {
      expect(sanitizeTheme({ type: { clamp } }, 'news').type.clamp).toBe(DEFAULT_THEME.type.clamp)
    }
  })

  it('takes only a real boolean for the cascade', () => {
    // Boolean('false') is true, and a switch that cannot be switched off is worse than a default.
    expect(sanitizeTheme({ layout: { stagger: false } }, 'news').layout.stagger).toBe(false)
    expect(sanitizeTheme({ layout: { stagger: true } }, 'news').layout.stagger).toBe(true)
    for (const stagger of [undefined, null, 'false', 'true', 0, 1, {}, []]) {
      expect(sanitizeTheme({ layout: { stagger } }, 'news').layout.stagger).toBe(true)
    }
  })

  it('falls back on an unknown radius, shadow, image mode, density or title size', () => {
    expect(sanitizeTheme({ card: { radius: 'full' } }, 'news').card.radius).toBe('full')
    for (const radius of ['XL', '', 4, {}, null]) expect(sanitizeTheme({ card: { radius } }, 'news').card.radius).toBe(DEFAULT_THEME.card.radius)
    for (const shadow of ['huge', '', true, {}]) expect(sanitizeTheme({ card: { shadow } }, 'news').card.shadow).toBe('md')
    for (const image of ['cropped', '', true, {}]) expect(sanitizeTheme({ card: { image } }, 'news').card.image).toBe('cover')
    for (const density of ['cosy', '', true, {}]) expect(sanitizeTheme({ card: { density } }, 'news').card.density).toBe('comfortable')
    for (const size of ['huge', '', true, {}]) expect(sanitizeTheme({ type: { titleSize: size } }, 'news').type.titleSize).toBe('md')
  })

  it('honours card.image "none" on either page, since that is an admin saying stop', () => {
    for (const page of PAGES) expect(sanitizeTheme({ card: { image: 'none' } }, page).card.image).toBe('none')
  })

  it('lists the allow-lists it enforces', () => {
    // A test that names the allowed values, so widening one is a deliberate act in this file too.
    expect(RADII).toEqual(['sm', 'md', 'lg', 'full'])
    expect(SHADOWS).toEqual(['none', 'sm', 'md', 'lg'])
    expect(IMAGE_ASPECTS).toEqual(['short', 'md', 'tall', 'wide'])
    expect(FEATURED).toEqual(['none', 'image-left', 'image-top'])
    for (const list of [RADII, SHADOWS, IMAGE_ASPECTS, FEATURED]) {
      expect(new Set(list).size, list.join(',')).toBe(list.length)
    }
  })
})

describe('cleanLookName', () => {
  it('trims, and caps at the length the column allows', () => {
    expect(cleanLookName('  Term-time green  ')).toBe('Term-time green')
    expect(cleanLookName('x'.repeat(80))).toHaveLength(40)
  })

  it('falls back rather than writing an empty name the check constraint would refuse', () => {
    for (const name of ['', '   ', null, undefined, 7, {}, []]) {
      expect(cleanLookName(name)).toBe('Untitled design')
    }
  })
})

// The AGENTS.md rule, made mechanical: every leaf in DEFAULT_THEME must have a fallback in sanitizeTheme, so
// a hand-edited row cannot put junk on /events or /news. If a field is added without one, this fails.
describe('every DEFAULT_THEME field is covered', () => {
  const paths = leafPaths(DEFAULT_THEME)

  // A value a card can actually render, so the meta-test checks validity rather than equality.
  function isRenderable(t) {
    try {
      expect(SWATCH_IDS).toContain(t.accent.color)
      expect(t.accent.hex).toMatch(/^(#([0-9a-f]{2}){3})?$/)
      expect(RADII).toContain(t.card.radius)
      expect(SHADOWS).toContain(t.card.shadow)
      expect(['cover', 'plain', 'none']).toContain(t.card.image)
      expect(['compact', 'comfortable', 'spacious']).toContain(t.card.density)
      expect(['sm', 'md', 'lg', 'xl']).toContain(t.type.titleSize)
      expect(Number.isInteger(t.type.clamp)).toBe(true)
      expect(t.type.clamp).toBeGreaterThanOrEqual(2)
      expect(t.type.clamp).toBeLessThanOrEqual(6)
      expect(PAGES).toContain(t.layout.page)
      expect(Number.isInteger(t.layout.columns)).toBe(true)
      expect(t.layout.columns).toBeGreaterThanOrEqual(1)
      expect(t.layout.columns).toBeLessThanOrEqual(4)
      expect(FEATURED).toContain(t.layout.featured)
      expect(IMAGE_ASPECTS).toContain(t.layout.imageAspect)
      expect(typeof t.layout.stagger).toBe('boolean')
    } catch (error) {
      return error
    }
    return null
  }

  it('has paths to check', () => {
    expect(paths.length).toBeGreaterThan(10)
    expect(paths).toContainEqual(['accent', 'color'])
    expect(paths).toContainEqual(['layout', 'columns'])
  })

  for (const page of PAGES) {
    for (const path of paths) {
      const name = `${page}.${path.join('.')}`
      it(`a value of the wrong type at ${name} falls back to the default`, () => {
        for (const junk of TYPE_JUNK) {
          // layout.page is not a settable field -- it is echoed from the row -- so it is skipped here and
          // covered by its own test above rather than by pretending the sanitiser reads it.
          if (path[0] === 'layout' && path[1] === 'page') continue
          // Seeded from the PAGE default, not from DEFAULT_THEME. DEFAULT_THEME spells out the news values,
          // so seeding from it would leave an events theme carrying `imageAspect: 'wide'` and every
          // comparison below would fail on a field the test is not even about.
          const input = setAt(JSON.parse(JSON.stringify(defaultTheme(page))), path, junk)
          expect(() => sanitizeTheme(input, page), name).not.toThrow()
          expect(sanitizeTheme(input, page), `${name} <- ${String(junk)}`).toEqual(defaultTheme(page))
        }
      })
      it(`an out-of-range value at ${name} still yields a renderable theme`, () => {
        for (const junk of OUT_OF_RANGE) {
          if (path[0] === 'layout' && path[1] === 'page') continue
          const input = setAt(JSON.parse(JSON.stringify(defaultTheme(page))), path, junk)
          expect(() => sanitizeTheme(input, page), name).not.toThrow()
          expect(isRenderable(sanitizeTheme(input, page)), `${name} <- ${String(junk)}`).toBeNull()
          // Sanity: the field under test actually did something, so the test cannot pass by ignoring it.
          expect(sanitizeTheme(input, page), name).not.toBe(input)
        }
      })
    }
  }
})

describe('themeVars', () => {
  const KEYS = [
    '--content-accent',
    '--content-radius',
    '--content-shadow',
    '--content-pad',
    '--content-title',
    '--content-clamp',
    '--content-aspect',
    '--content-cols',
  ]

  it('emits only custom properties, never undefined or empty', () => {
    for (const page of PAGES) {
      const vars = themeVars(defaultTheme(page))
      for (const key of Object.keys(vars)) expect(key.startsWith('--'), key).toBe(true)
      for (const [key, value] of Object.entries(vars)) {
        expect(value, key).toBeTypeOf('string')
        expect(value.trim(), key).not.toBe('')
        expect(value.includes('undefined'), key).toBe(false)
        expect(value.includes('NaN'), key).toBe(false)
      }
      expect(Object.keys(vars)).toEqual(expect.arrayContaining(KEYS))
    }
  })

  it('never points a token at itself, which CSS would drop as a cycle', () => {
    for (const swatch of SWATCHES) {
      const vars = themeVars({ accent: { color: swatch.id } })
      for (const token of ['--color-brand', '--color-brand-orange', '--color-green-900']) {
        if (token in vars) expect(vars[token], swatch.id).not.toBe(`var(${swatch.token})`)
      }
    }
  })

  it('repoints the three page-surface accent tokens, not just the two the calendar studio needs', () => {
    // This is the test that says the Accent control is not inert. `--color-brand-orange` is the token
    // src/index.css:27-32 was created for -- text, borders and icons on a page surface -- which is exactly
    // what a card's category label and its Read more link are, so leaving it out made the headline control
    // of the studio change nothing a visitor could see on /events.
    const vars = themeVars({ accent: { color: 'flame' } })
    expect(vars['--content-accent']).toBe('var(--color-orange-500)')
    expect(vars['--color-brand']).toBe('var(--content-accent)')
    expect(vars['--color-brand-orange']).toBe('var(--content-accent)')
    expect(vars['--color-green-900']).toBe('var(--content-accent)')
  })

  it('references tokens rather than hexes, so the site keeps its dark mode', () => {
    const vars = themeVars({ accent: { color: 'brand' } })
    expect(vars['--content-accent']).toBe('var(--color-brand)')
    // `brand` IS --color-brand, so remapping it would be the cycle above.
    expect(vars['--color-brand']).toBeUndefined()
    expect(vars['--color-brand-orange']).toBe('var(--content-accent)')
    expect(vars['--color-green-900']).toBe('var(--content-accent)')
  })

  it('uses the advanced hex when there is one, and maps every accent token onto it', () => {
    const vars = themeVars({ accent: { hex: '#123456' } })
    expect(vars['--content-accent']).toBe('#123456')
    expect(vars['--color-brand']).toBe('var(--content-accent)')
    expect(vars['--color-brand-orange']).toBe('var(--content-accent)')
    expect(vars['--color-green-900']).toBe('var(--content-accent)')
  })

  it('reads the page off the theme, so the two cannot be mismatched at a call site', () => {
    expect(themeVars(defaultTheme('events'))['--content-aspect']).toBe('3 / 4')
    expect(themeVars(defaultTheme('news'))['--content-aspect']).toBe('16 / 9')
  })

  it('maps the scale onto real CSS values', () => {
    expect(themeVars({ card: { radius: 'full' } })['--content-radius']).toBe('9999px')
    expect(themeVars({ card: { shadow: 'none' } })['--content-shadow']).toBe('none')
    expect(themeVars({ card: { density: 'compact' } })['--content-pad']).toBe('16px')
    expect(themeVars({ type: { titleSize: 'xl' } })['--content-title']).toBe('28px')
    expect(themeVars({ type: { clamp: 2 } })['--content-clamp']).toBe('2')
    expect(themeVars({ layout: { columns: 4 } })['--content-cols']).toBe('4')
  })

  it('starts on the radius and the padding the cards had before this studio existed', () => {
    // `rounded-lg` was 12px (--radius-lg, src/index.css:41) and `p-6` was 24px. A default of 'md' here
    // would have silently sharpened every card on the site the day this shipped.
    const vars = themeVars(defaultTheme('news'))
    expect(vars['--content-radius']).toBe('12px')
    expect(vars['--content-pad']).toBe('24px')
    expect(vars['--content-title']).toBe('20px')
    expect(vars['--content-clamp']).toBe('2')
    expect(vars['--content-cols']).toBe('3')
  })

  it('survives a junk theme without producing junk css', () => {
    const vars = themeVars({ accent: 5, card: 'x', type: [], layout: null })
    expect(vars['--content-accent']).toBe('var(--color-brand)')
    expect(vars['--content-radius']).toBe('12px')
    expect(vars['--content-cols']).toBe('3')
  })
})