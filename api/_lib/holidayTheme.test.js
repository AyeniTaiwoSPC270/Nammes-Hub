import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  HOLIDAY_PARTICLES, HOLIDAY_TOKENS, BANNER_MAX,
  isHolidayImagePath, isThemeId,
  sanitizePalette, sanitizeDecor, sanitizeImagery, sanitizeBackground, sanitizeQuizTheme, sanitizeHolidayTheme,
  resolveActiveHoliday, holidayThemeVars, todayLagos,
} from './holidayTheme.js'

const UUID = '0f9db1e2-3c4a-4b5e-8c7d-1a2b3c4d5e6f'
const PATH = `christmas-2026/${UUID}.webp`

describe('sanitizePalette', () => {
  it('keeps allowlisted hexes, lowercased, and drops everything else', () => {
    const out = sanitizePalette({ light: { brand: '#8A1C1C', paper: 'red', 'font-display': '#000000' }, dark: {} })
    expect(out.light).toEqual({ brand: '#8a1c1c' })
    expect(out.dark).toEqual({})
  })

  it('settles junk to two empty maps', () => {
    expect(sanitizePalette(null)).toEqual({ light: {}, dark: {} })
    expect(sanitizePalette('x')).toEqual({ light: {}, dark: {} })
    expect(sanitizePalette([1])).toEqual({ light: {}, dark: {} })
  })

  it('covers exactly the eleven tokens the spec allows', () => {
    expect(HOLIDAY_TOKENS).toHaveLength(11)
  })
})

describe('sanitizeDecor', () => {
  it('defaults particles to off and accepts a known effect only', () => {
    expect(sanitizeDecor({}).particles).toBe('off')
    expect(sanitizeDecor({ particles: 'snow' }).particles).toBe('snow')
    expect(sanitizeDecor({ particles: 'lava' }).particles).toBe('off')
  })

  it('banner is plain text, capped, with control characters stripped', () => {
    const banner = sanitizeDecor({ banner: `  Happy\u0007  Christmas\x1f ${'x'.repeat(200)}` }).banner
    expect(banner.startsWith('Happy Christmas ')).toBe(true)
    expect(banner).toHaveLength(BANNER_MAX)
  })

  it('an empty banner is null, not a empty string', () => {
    expect(sanitizeDecor({ banner: '   ' }).banner).toBeNull()
  })
})

describe('image paths', () => {
  it('accepts a path in the theme folder and rejects one from another', () => {
    expect(isHolidayImagePath(PATH, 'christmas-2026')).toBe(true)
    expect(isHolidayImagePath(PATH, 'easter-2027')).toBe(false)
    expect(isHolidayImagePath('../etc/passwd')).toBe(false)
    expect(isHolidayImagePath('https://example.com/x.png')).toBe(false)
  })

  it('sanitizeImagery drops a picture from the wrong folder when the theme is named', () => {
    const out = sanitizeImagery({ band: PATH, logo: PATH.replace('christmas-2026', 'easter-2027') }, { themeId: 'christmas-2026' })
    expect(out.band).toBe(PATH)
    expect(out.logo).toBeNull()
  })

  it('sanitizeBackground keeps a picture in the theme folder and drops a foreign one', () => {
    // The option and the picture are judged separately: a theme can carry a picture with the toggle
    // off (band today, background later) and can go festive with no picture at all (the gradient).
    expect(sanitizeBackground({ enabled: true, image: PATH }, { themeId: 'christmas-2026' })).toEqual({ enabled: true, image: PATH })
    expect(sanitizeBackground({ enabled: true, image: PATH.replace('christmas-2026', 'easter-2027') }, { themeId: 'christmas-2026' }).image).toBeNull()
  })

  it('sanitizeBackground settles junk to the feature off with no picture', () => {
    for (const bad of [undefined, null, 'yes', 12, [], { enabled: 'yes', image: '../etc/passwd' }]) {
      expect(sanitizeBackground(bad), JSON.stringify(bad)).toEqual({ enabled: false, image: null })
    }
    // Truthy-but-not-true must not switch the feature on — the box is checked by a real boolean.
    expect(sanitizeBackground({ enabled: 'true' }).enabled).toBe(false)
  })
})

describe('sanitizeQuizTheme', () => {
  it('judges the design with quizTheme sanitizeTheme, not its own rules', () => {
    // An 'image' design with no picture settles to 'none' — the holiday picture lives in `image`,
    // because a holiday path is not a quiz path and sanitizeTheme would drop it from the design.
    const out = sanitizeQuizTheme({ design: { look: 'forest', pattern: 'image', image: PATH, sound: { music: 'cinematic' } }, image: PATH }, { themeId: 'christmas-2026' })
    expect(out.design.pattern).toBe('none')
    expect(out.design.sound.music).toBe('cinematic')
    expect(out.image).toBe(PATH)
  })

  it('a junk music style and a junk image settle to defaults', () => {
    const out = sanitizeQuizTheme({ design: { sound: { music: 'polka' } }, image: 'not/a/path' })
    expect(out.design.sound.music).toBe('off')
    expect(out.image).toBeNull()
  })

  it('look_id must be a slug', () => {
    expect(sanitizeQuizTheme({ look_id: 'holiday-christmas-2026' }).look_id).toBe('holiday-christmas-2026')
    expect(sanitizeQuizTheme({ look_id: 'DROP TABLE' }).look_id).toBeNull()
  })
})

describe('resolveActiveHoliday', () => {
  const christmas = { id: 'christmas-2026', enabled: true, starts_on: '2026-12-15', ends_on: '2027-01-05' }
  const newYear = { id: 'new-year', enabled: true, starts_on: '2026-12-31', ends_on: '2027-01-02' }
  const always = { id: 'always-on', enabled: true, starts_on: null, ends_on: null }

  it('the kill flag refuses everything, even manual', () => {
    expect(resolveActiveHoliday({ themes: [christmas], settings: { mode: 'manual', active_theme_id: 'christmas-2026' }, enabled: false, today: '2026-12-25' })).toBeNull()
  })

  it('mode off refuses a live range; manual returns the forced theme; manual refuses a disabled one', () => {
    expect(resolveActiveHoliday({ themes: [christmas], settings: { mode: 'off' }, today: '2026-12-25' })).toBeNull()
    expect(resolveActiveHoliday({ themes: [christmas], settings: { mode: 'manual', active_theme_id: 'christmas-2026' }, today: '2026-06-01' })?.id).toBe('christmas-2026')
    expect(resolveActiveHoliday({ themes: [{ ...christmas, enabled: false }], settings: { mode: 'manual', active_theme_id: 'christmas-2026' }, today: '2026-12-25' })).toBeNull()
  })

  it('auto is inclusive on both ends', () => {
    expect(resolveActiveHoliday({ themes: [christmas], settings: { mode: 'auto' }, today: '2026-12-15' })?.id).toBe('christmas-2026')
    expect(resolveActiveHoliday({ themes: [christmas], settings: { mode: 'auto' }, today: '2027-01-05' })?.id).toBe('christmas-2026')
    expect(resolveActiveHoliday({ themes: [christmas], settings: { mode: 'auto' }, today: '2026-12-14' })).toBeNull()
  })

  it('the later range wins an overlap, unbounded comes last, ties break by id', () => {
    expect(resolveActiveHoliday({ themes: [christmas, newYear], settings: { mode: 'auto' }, today: '2027-01-01' })?.id).toBe('new-year')
    expect(resolveActiveHoliday({ themes: [christmas, always], settings: { mode: 'auto' }, today: '2026-12-20' })?.id).toBe('christmas-2026')
    expect(resolveActiveHoliday({ themes: [always], settings: { mode: 'auto' }, today: '2026-06-01' })?.id).toBe('always-on')
    const a = { id: 'a-day', starts_on: null, ends_on: null, enabled: true }
    const b = { ...a, id: 'b-day' }
    expect(resolveActiveHoliday({ themes: [b, a], settings: { mode: 'auto' }, today: '2026-06-01' })?.id).toBe('a-day')
  })

  it('auto without a today, or with a mode it does not know, is null', () => {
    expect(resolveActiveHoliday({ themes: [christmas], settings: { mode: 'auto' } })).toBeNull()
    expect(resolveActiveHoliday({ themes: [christmas], settings: { mode: 'sideways' }, today: '2026-12-25' })).toBeNull()
  })
})

describe('holidayThemeVars', () => {
  const theme = { id: 'x', palette: { light: { brand: '#8a1c1c' }, dark: { brand: '#e08a8a' } } }

  it('emits only the tokens the palette provides, as --color-* names', () => {
    expect(holidayThemeVars(theme, 'light')).toEqual({ '--color-brand': '#8a1c1c' })
    expect(holidayThemeVars(theme, 'dark')).toEqual({ '--color-brand': '#e08a8a' })
  })

  it('an unknown mode falls back to the light map; junk emits nothing', () => {
    expect(holidayThemeVars(theme, 'sepia')).toEqual({ '--color-brand': '#8a1c1c' })
    expect(holidayThemeVars({ palette: { light: { brand: 'red' } } }, 'light')).toEqual({})
  })
})

describe('todayLagos', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(todayLagos(new Date('2026-12-25T00:30:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // 00:30 UTC on the 25th is 01:30 on the 25th in Lagos (UTC+1): the pinning is what makes this true.
    expect(todayLagos(new Date('2026-12-25T00:30:00Z'))).toBe('2026-12-25')
    // 23:30 UTC on the 24th is 00:30 on the 25th in Lagos — a UTC clock would say the 24th.
    expect(todayLagos(new Date('2026-12-24T23:30:00Z'))).toBe('2026-12-25')
  })
})

describe('id shape', () => {
  it('slugs only', () => {
    expect(isThemeId('christmas-2026')).toBe(true)
    expect(isThemeId('Christmas 2026')).toBe(false)
    expect(isThemeId('')).toBe(false)
  })

  it('a junk row sanitises to a safe theme: bad id empties, the name survives as plain text', () => {
    const out = sanitizeHolidayTheme({ id: 'NOT A SLUG', name: '<b>x</b>', enabled: 'yes' })
    expect(out.id).toBe('')
    // Not markup anywhere it can be read as such: React renders it as text, and nothing concatenates it into HTML.
    expect(out.name).toBe('<b>x</b>')
    expect(out.enabled).toBe(true)
  })
})

describe('index.css keyframes (source scan)', () => {
  const css = readFileSync('src/index.css', 'utf8')

  it('every particle effect has its holiday-p-<id> keyframes, the backdrop-motion guard', () => {
    for (const id of Object.keys(HOLIDAY_PARTICLES)) {
      if (id === 'off') continue
      expect(css, `src/index.css has no @keyframes holiday-p-${id}`).toContain(`@keyframes holiday-p-${id}`)
    }
  })
})
