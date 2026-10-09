import { describe, it, expect } from 'vitest'
import { KIND_ORDER, SWATCHES, DEFAULT_THEME, sanitizeTheme, themeVars } from './calendarTheme.js'

const SWATCH_IDS = SWATCHES.map((s) => s.id)

// Values that are not a legal choice for ANY field in the theme, so wherever they land the default must come
// back. Values that are legal somewhere but not here — 0 for maxPerDay, false for a highlight, the word
// "constructor" as a label — are checked by validity instead, in the meta-test below.
const TYPE_JUNK = [undefined, null, {}, [], () => {}, new Date(0), '', '   ', Number.NaN, Infinity, [1, 2], Symbol.iterator]

// The other half: a real value of some type, held to this field's own rule. maxPerDay clamps rather than
// falling back, a highlight switch legitimately turns off, and inherited property names are ordinary words in
// a label, so these must not all equal the default.
const OUT_OF_RANGE = [0, 12, -3, 1.5, 99, true, false, '12', 'green', 'constructor', '__proto__', 'toString', 'red;']

// Every leaf path in DEFAULT_THEME, so the test below can walk the real shape instead of a hand-typed copy
// that would drift the moment a field is added.
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
      expect(sanitizeTheme(bad), String(bad)).toEqual(DEFAULT_THEME)
    }
  })

  it('never throws, whatever it is handed', () => {
    const weird = [
      { accents: 'nope', page: 5, grid: [], defaults: 'x', highlight: 7 },
      { accents: { lectures: null }, page: null, grid: null, defaults: null, highlight: null },
      { accents: [1, 2, 3], defaults: { kinds: {}, sources: 'academic' } },
      { page: { radius: {}, density: [] }, grid: { weekStart: {}, maxPerDay: {} } },
      { defaults: { view: {}, kinds: [null, undefined], sources: [1, 2] } },
    ]
    for (const input of weird) expect(() => sanitizeTheme(input)).not.toThrow()
    for (const input of weird) expect(sanitizeTheme(input)).toEqual(DEFAULT_THEME)
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
      accents: { lectures: { color: 'danger', label: '  Final  ', icon: 'star', hex: '#AABBCC' }, exams: 'junk' },
      page: { radius: 'lg', density: 'compact', accent: 'warning' },
      grid: { weekStart: 0, maxPerDay: 99 },
      defaults: { kinds: ['exams', 'nope'], sources: ['event'], view: 'agenda' },
      highlight: { today: false },
    })
    const snapshot = JSON.stringify(raw)
    expect(() => sanitizeTheme(raw)).not.toThrow()
    expect(JSON.stringify(raw)).toBe(snapshot)

    const mutable = { ...JSON.parse(snapshot) }
    const before = JSON.stringify(mutable)
    sanitizeTheme(mutable)
    expect(JSON.stringify(mutable)).toBe(before)
  })

  it('is idempotent and ignores unknown fields', () => {
    const once = sanitizeTheme({ page: { radius: 'lg', extra: 'x' }, looks: ['a'], accents: { ghost: { color: 'danger' } } })
    expect(once).not.toHaveProperty('page.extra')
    expect(once).not.toHaveProperty('looks')
    expect(once.accents).not.toHaveProperty('ghost')
    expect(sanitizeTheme(once)).toEqual(once)
  })
})

describe('sanitizeTheme: partial themes', () => {
  it('keeps what was given and fills in the rest', () => {
    const t = sanitizeTheme({
      accents: { lectures: { label: '  Lectures &  Seminars ', icon: 'co_present' } },
      page: { radius: 'full', density: 'compact' },
      grid: { weekStart: 0, showWeekends: false, maxPerDay: 5 },
      defaults: { view: 'agenda', kinds: ['exams', 'break'], sources: ['academic'] },
      highlight: { today: false, nextUp: false },
    })
    expect(t.accents.lectures).toEqual({ color: 'brand', icon: 'co_present', label: 'Lectures & Seminars', hex: '' })
    expect(t.accents.exams).toEqual(DEFAULT_THEME.accents.exams)
    expect(t.page).toEqual({ accent: 'brand', hex: '', radius: 'full', density: 'compact' })
    expect(t.grid).toEqual({ weekStart: 0, showWeekends: false, maxPerDay: 5 })
    expect(t.defaults).toEqual({ view: 'agenda', kinds: ['exams', 'break'], sources: ['academic'] })
    expect(t.highlight).toEqual({ today: false, nextUp: false })
  })

  it('takes a valid swatch id for the page accent', () => {
    for (const id of SWATCH_IDS) expect(sanitizeTheme({ page: { accent: id } }).page.accent).toBe(id)
  })
})

describe('sanitizeTheme: colours', () => {
  it('keeps an advanced hex alongside its swatch, rather than letting the two overwrite each other', () => {
    // This used to clear the hex whenever `color` held a valid swatch id, which made cleaning
    // non-idempotent: the studio holds a draft and cleans it again on every render, so a colour typed
    // into the Advanced field disappeared the moment any unrelated control was touched.
    const t = sanitizeTheme({ accents: { break: { color: 'flame', hex: '#123456' } } })
    expect(t.accents.break).toEqual({ color: 'flame', icon: 'beach_access', label: 'Break', hex: '#123456' })
    // The studio is what decides a swatch choice clears the hex; the sanitiser only refuses to invent data.
    expect(sanitizeTheme({ accents: { break: { color: 'flame', hex: '' } } }).accents.break.hex).toBe('')
  })

  it('is idempotent for a swatch, a hex, and both together', () => {
    for (const accents of [
      { break: { color: 'flame' } },
      { break: { color: 'flame', hex: '#123456' } },
      { lectures: { hex: '#A1B2C3' } },
      { lectures: { color: '#a1b2c3' } },
    ]) {
      const once = sanitizeTheme({ accents })
      expect(sanitizeTheme(once)).toEqual(once)
    }
    const pageOnce = sanitizeTheme({ page: { accent: 'flame', hex: '#ff5a1f' } })
    expect(sanitizeTheme(pageOnce)).toEqual(pageOnce)
  })

  it('accepts a hex as an advanced colour but still resolves a swatch for the picker', () => {
    const t = sanitizeTheme({ accents: { lectures: { color: '#A1B2C3' } }, page: { accent: '#ff5a1f' } })
    expect(t.accents.lectures.hex).toBe('#a1b2c3')
    expect(t.accents.lectures.color).toBe(DEFAULT_THEME.accents.lectures.color)
    expect(t.page.hex).toBe('#ff5a1f')
    expect(t.page.accent).toBe(DEFAULT_THEME.page.accent)
    expect(SWATCH_IDS).toContain(t.page.accent)
  })

  it('drops anything that is neither a swatch id nor a hex', () => {
    const bad = ['red', 'rgb(0,0,0)', '#fff', '#12345', '#1234567', '#000000;}', 'var(--color-ink)', 'white', ' ']
    for (const color of bad) {
      const t = sanitizeTheme({ accents: { exams: { color } }, page: { accent: color } })
      expect(t.accents.exams.color, color).toBe(DEFAULT_THEME.accents.exams.color)
      expect(t.accents.exams.hex, color).toBe('')
      expect(t.page.accent, color).toBe(DEFAULT_THEME.page.accent)
      expect(t.page.hex, color).toBe('')
    }
  })

  it('falls back on an empty or non-string colour', () => {
    for (const color of ['', '   ', null, undefined, 12, {}, []]) {
      expect(sanitizeTheme({ accents: { other: { color } } }).accents.other).toEqual(DEFAULT_THEME.accents.other)
    }
  })

  it('falls back on an advanced hex that is not a hex, whatever the swatch', () => {
    for (const kind of KIND_ORDER) {
      const t = sanitizeTheme({ accents: { [kind]: { color: 'warning', hex: 'red;' } } })
      expect(t.accents[kind].color, kind).toBe('warning')
      expect(t.accents[kind].hex, kind).toBe('')
    }
  })
})

describe('sanitizeTheme: text fields', () => {
  it('trims a label, collapses its whitespace and caps it at 60 characters', () => {
    const t = sanitizeTheme({ accents: { lectures: { label: `  a\n\tb ${'x'.repeat(200)}` } } })
    expect(t.accents.lectures.label).toBe(`a b ${'x'.repeat(56)}`)
    expect(t.accents.lectures.label).toHaveLength(60)
  })

  it('falls back on an empty or non-string label', () => {
    for (const label of ['', '    ', '\n\t', null, undefined, 7, {}, []]) {
      expect(sanitizeTheme({ accents: { exams: { label } } }).accents.exams.label).toBe('Exams')
    }
  })

  it('falls back on an icon that is not a lowercase word', () => {
    for (const icon of ['two words', 'icon-2', 'Icon', '', '   ', 'star;', '9', null, undefined, 3, {}, '<span>']) {
      expect(sanitizeTheme({ accents: { exams: { icon } } }).accents.exams.icon).toBe('assignment')
    }
    expect(sanitizeTheme({ accents: { exams: { icon: 'event_note' } } }).accents.exams.icon).toBe('event_note')
  })
})

describe('sanitizeTheme: grid, page and defaults', () => {
  it('clamps the week start to Sunday or Monday', () => {
    expect(sanitizeTheme({ grid: { weekStart: 0 } }).grid.weekStart).toBe(0)
    expect(sanitizeTheme({ grid: { weekStart: 1 } }).grid.weekStart).toBe(1)
    for (const weekStart of [2, 5, 7, -1, 1.5, '1', null, true, {}]) {
      expect(sanitizeTheme({ grid: { weekStart } }).grid.weekStart).toBe(DEFAULT_THEME.grid.weekStart)
    }
  })

  it('clamps items per day to 1..12', () => {
    expect(sanitizeTheme({ grid: { maxPerDay: 12 } }).grid.maxPerDay).toBe(12)
    expect(sanitizeTheme({ grid: { maxPerDay: 1 } }).grid.maxPerDay).toBe(1)
    expect(sanitizeTheme({ grid: { maxPerDay: 999 } }).grid.maxPerDay).toBe(12)
    expect(sanitizeTheme({ grid: { maxPerDay: 0 } }).grid.maxPerDay).toBe(1)
    expect(sanitizeTheme({ grid: { maxPerDay: -4 } }).grid.maxPerDay).toBe(1)
    expect(sanitizeTheme({ grid: { maxPerDay: 4.6 } }).grid.maxPerDay).toBe(5)
    for (const maxPerDay of [null, '5', {}, []]) {
      expect(sanitizeTheme({ grid: { maxPerDay } }).grid.maxPerDay).toBe(3)
    }
  })

  it('takes only a real boolean for the two highlights', () => {
    expect(sanitizeTheme({ highlight: {} }).highlight).toEqual({ today: true, nextUp: true })
    expect(sanitizeTheme({ highlight: { today: false } }).highlight).toEqual({ today: false, nextUp: true })
    expect(sanitizeTheme({ highlight: { nextUp: false } }).highlight).toEqual({ today: true, nextUp: false })
    expect(sanitizeTheme({ highlight: 'x' }).highlight).toEqual({ today: true, nextUp: true })
  })

  it('falls back on an unknown view, radius or density', () => {
    expect(sanitizeTheme({ defaults: { view: 'week' } }).defaults.view).toBe('month')
    expect(sanitizeTheme({ defaults: { view: 'agenda' } }).defaults.view).toBe('agenda')
    for (const view of ['Week', '', null, 1, {}, 'month ']) {
      expect(sanitizeTheme({ defaults: { view } }).defaults.view).toBe('month')
    }
    expect(sanitizeTheme({ page: { radius: 'lg' } }).page.radius).toBe('lg')
    for (const radius of ['XL', '', 4, {}, null]) expect(sanitizeTheme({ page: { radius } }).page.radius).toBe('md')
    expect(sanitizeTheme({ page: { density: 'compact' } }).page.density).toBe('compact')
    for (const density of ['cosy', '', true, {}]) expect(sanitizeTheme({ page: { density } }).page.density).toBe('comfortable')
  })

  it('filters kinds and sources, and never leaves an empty list', () => {
    expect(sanitizeTheme({ defaults: { kinds: ['exams', 'lectures'] } }).defaults.kinds).toEqual(['lectures', 'exams'])
    expect(sanitizeTheme({ defaults: { sources: ['event', 'event'] } }).defaults.sources).toEqual(['event'])
    for (const kinds of [[], 'lectures', null, {}, [null, 1, 'nope']]) {
      expect(sanitizeTheme({ defaults: { kinds } }).defaults.kinds).toEqual([...KIND_ORDER])
    }
    for (const sources of [[], 'academic', null, {}, [null, 'events']]) {
      expect(sanitizeTheme({ defaults: { sources } }).defaults.sources).toEqual(['academic', 'event'])
    }
  })

  it('has all seven kinds, always, and drops any other key', () => {
    const t = sanitizeTheme({ accents: { ghost: { color: 'danger', label: 'Ghost', icon: 'star' }, exams: {} } })
    expect(Object.keys(t.accents)).toEqual([...KIND_ORDER])
    expect(t.accents).not.toHaveProperty('ghost')
  })
})

// The AGENTS.md rule, made mechanical: every leaf in DEFAULT_THEME must have a fallback in sanitizeTheme, so
// a hand-edited row cannot put junk on the calendar. If a field is added without one, this fails.
describe('every DEFAULT_THEME field is covered', () => {
  const paths = leafPaths(DEFAULT_THEME)

  it('has paths to check', () => {
    expect(paths.length).toBeGreaterThan(20)
    expect(paths).toContainEqual(['accents', 'lectures', 'color'])
    expect(paths).toContainEqual(['grid', 'maxPerDay'])
  })

  // A value the calendar can actually render, so the meta-test checks validity rather than equality.
  function isRenderable(t) {
    try {
      expect(Object.keys(t.accents)).toEqual([...KIND_ORDER])
      for (const kind of KIND_ORDER) {
        const a = t.accents[kind]
        expect(SWATCH_IDS, kind).toContain(a.color)
        expect(a.hex, kind).toMatch(/^(#([0-9a-f]{2}){3})?$/)
        expect(a.icon, kind).toMatch(/^[a-z_]+$/)
        expect(a.label.length, kind).toBeGreaterThan(0)
        expect(a.label.length, kind).toBeLessThanOrEqual(60)
      }
      expect(SWATCH_IDS).toContain(t.page.accent)
      expect(t.page.hex).toMatch(/^(#([0-9a-f]{2}){3})?$/)
      expect(['sm', 'md', 'lg', 'full']).toContain(t.page.radius)
      expect(['comfortable', 'compact']).toContain(t.page.density)
      expect([0, 1]).toContain(t.grid.weekStart)
      expect(typeof t.grid.showWeekends).toBe('boolean')
      expect(Number.isInteger(t.grid.maxPerDay)).toBe(true)
      expect(t.grid.maxPerDay).toBeGreaterThanOrEqual(1)
      expect(t.grid.maxPerDay).toBeLessThanOrEqual(12)
      expect(['month', 'agenda']).toContain(t.defaults.view)
      expect(t.defaults.kinds.length).toBeGreaterThan(0)
      for (const kind of t.defaults.kinds) expect(KIND_ORDER).toContain(kind)
      expect(t.defaults.sources.length).toBeGreaterThan(0)
      for (const source of t.defaults.sources) expect(['academic', 'event']).toContain(source)
      expect(typeof t.highlight.today).toBe('boolean')
      expect(typeof t.highlight.nextUp).toBe('boolean')
    } catch (error) {
      return error
    }
    return null
  }

  for (const path of paths) {
    const name = path.join('.')
    it(`a value of the wrong type at ${name} falls back to the default`, () => {
      for (const junk of TYPE_JUNK) {
        const input = setAt(JSON.parse(JSON.stringify(DEFAULT_THEME)), path, junk)
        expect(() => sanitizeTheme(input), name).not.toThrow()
        expect(sanitizeTheme(input), `${name} <- ${String(junk)}`).toEqual(DEFAULT_THEME)
      }
    })
    it(`an out-of-range value at ${name} still yields a renderable theme`, () => {
      for (const junk of OUT_OF_RANGE) {
        const input = setAt(JSON.parse(JSON.stringify(DEFAULT_THEME)), path, junk)
        expect(() => sanitizeTheme(input), name).not.toThrow()
        expect(isRenderable(sanitizeTheme(input)), `${name} <- ${String(junk)}`).toBeNull()
        // Sanity: the field under test actually did something, so the test cannot pass by ignoring it.
        expect(sanitizeTheme(input), name).not.toBe(input)
      }
    })
  }
})

describe('themeVars', () => {
  const KEYS = ['--cal-accent', '--cal-radius', '--cal-cell-min', '--cal-row-pad', ...KIND_ORDER.map((k) => `--cal-${k}`)]

  it('emits only custom properties, never undefined or empty', () => {
    const vars = themeVars(DEFAULT_THEME)
    for (const key of Object.keys(vars)) expect(key.startsWith('--'), key).toBe(true)
    for (const [key, value] of Object.entries(vars)) {
      expect(value, key).toBeTypeOf('string')
      expect(value.trim(), key).not.toBe('')
      expect(value.includes('undefined'), key).toBe(false)
      expect(value.includes('NaN'), key).toBe(false)
    }
    expect(Object.keys(vars)).toEqual(expect.arrayContaining(KEYS))
  })

  it('never points a token at itself, which CSS would drop as a cycle', () => {
    for (const swatch of SWATCHES) {
      const vars = themeVars({ page: { accent: swatch.id } })
      for (const token of ['--color-brand', '--color-green-900']) {
        if (token in vars) expect(vars[token], swatch.id).not.toBe(`var(${swatch.token})`)
      }
    }
  })

  it('references tokens rather than hexes, so the site keeps its dark mode', () => {
    const vars = themeVars({ accents: { exams: { color: 'ember' } }, page: { accent: 'brand' } })
    expect(vars['--cal-accent']).toBe('var(--color-brand)')
    expect(vars['--cal-exams']).toBe('var(--color-orange-600)')
    expect(vars['--color-brand']).toBeUndefined()
    expect(vars['--color-green-900']).toBe('var(--cal-accent)')
  })

  it('uses the advanced hex when there is one, and maps both brand tokens onto it', () => {
    const vars = themeVars({ page: { accent: '#123456' } })
    expect(vars['--cal-accent']).toBe('#123456')
    expect(vars['--color-brand']).toBe('var(--cal-accent)')
    expect(vars['--color-green-900']).toBe('var(--cal-accent)')
  })

  it('maps the radius and density onto the site scale', () => {
    for (const [radius, px] of Object.entries({ sm: '4px', md: '8px', lg: '12px', full: '9999px' })) {
      expect(themeVars({ page: { radius } })['--cal-radius']).toBe(px)
    }
    expect(themeVars({ page: { density: 'compact' } })['--cal-cell-min']).toBe('84px')
    expect(themeVars({ page: { density: 'comfortable' } })['--cal-cell-min']).toBe('112px')
  })

  it('survives a junk theme without producing junk css', () => {
    const vars = themeVars({ accents: 5, page: 'x', grid: [], defaults: null, highlight: 1 })
    expect(vars['--cal-accent']).toBe('var(--color-brand)')
    expect(vars['--cal-exams']).toBe('var(--color-danger)')
    expect(vars['--cal-radius']).toBe('8px')
  })
})