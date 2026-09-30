import { describe, it, expect } from 'vitest'
import {
  normalizeTheme,
  normalizeImage,
  normalizeQuestionStyle,
  applyPreset,
  FORM_PRESETS,
  safeImageUrl,
  readableOn,
  contrastRatio,
  themeVars,
  pageBackground,
  questionLabelStyle,
  imageFilter,
  hasTheme,
  themeToSave,
  normalizeCardLayout,
  cardLayoutStyle,
  computeResize,
  aspectRatioOf,
} from './formTheme'

describe('normalizeTheme', () => {
  it('fills defaults for empty input', () => {
    const t = normalizeTheme(null)
    expect(t.accent).toBe('#0b2417')
    expect(t.card.radius).toBe(12)
    expect(t.fonts.body).toBe('Public Sans')
    expect(t.title.bold).toBe(true)
  })

  it('clamps numbers and rejects bad colours, fonts and enums', () => {
    const t = normalizeTheme({
      accent: 'red',
      card: { opacity: 999, radius: -5, shadow: 'huge' },
      fonts: { body: 'Comic Sans MS' },
      title: { size: 500, align: 'justify' },
      width: 'gigantic',
    })
    expect(t.accent).toBe('#0b2417')
    expect(t.card.opacity).toBe(100)
    expect(t.card.radius).toBe(0)
    expect(t.card.shadow).toBe('sm')
    expect(t.fonts.body).toBe('Public Sans')
    expect(t.title.size).toBe(72)
    expect(t.title.align).toBe('left')
    expect(t.width).toBe('medium')
  })

  it('keeps valid values', () => {
    const t = normalizeTheme({ accent: '#FF5A1F', fonts: { heading: 'Lora' }, title: { italic: true, color: '#112233' } })
    expect(t.accent).toBe('#ff5a1f')
    expect(t.fonts.heading).toBe('Lora')
    expect(t.title.italic).toBe(true)
    expect(t.title.color).toBe('#112233')
  })
})

describe('images', () => {
  it('rejects unsafe urls', () => {
    expect(safeImageUrl('javascript:alert(1)')).toBe('')
    expect(safeImageUrl('http://x.com/a.png')).toBe('')
    expect(safeImageUrl('https://x.com/a").png')).toBe('')
    expect(safeImageUrl('https://x.supabase.co/a.png')).toBe('https://x.supabase.co/a.png')
  })

  it('returns null without a usable url and clamps adjustments', () => {
    expect(normalizeImage({ url: '' })).toBeNull()
    const img = normalizeImage({ url: 'https://a.co/i.png', zoom: 99, rotate: 45, brightness: 1, aspect: 'nope' })
    expect(img.zoom).toBe(4)
    expect(img.rotate).toBe(0)
    expect(img.brightness).toBe(30)
    expect(img.aspect).toBe('free')
  })

  it('builds a css filter only for changed values', () => {
    const base = normalizeImage({ url: 'https://a.co/i.png' })
    expect(imageFilter(base)).toBe('none')
    expect(imageFilter({ ...base, grayscale: 50, blur: 3 })).toBe('grayscale(50%) blur(3px)')
  })
})

describe('colour helpers', () => {
  it('picks readable text for fills', () => {
    expect(readableOn('#ffffff')).toBe('#111111')
    expect(readableOn('#0b2417')).toBe('#ffffff')
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('falls back to text colour when the accent vanishes into the card', () => {
    const vars = themeVars({ accent: '#111111', card: { color: '#141414' }, text: { color: '#eeeeee' } })
    expect(vars['--color-brand']).toBe('#eeeeee')
    expect(vars['--color-green-900']).toBe('#111111')
  })
})

describe('page background', () => {
  it('is null for the default type', () => {
    expect(pageBackground({ page: { type: 'default' } })).toBeNull()
  })
  it('builds a gradient', () => {
    const bg = pageBackground({ page: { type: 'gradient', color: '#000000', color2: '#ffffff', angle: 90 } })
    expect(bg.gradient).toBe('linear-gradient(90deg, #000000, #ffffff)')
  })
})

describe('question style', () => {
  it('overrides the form-wide style per question', () => {
    const style = questionLabelStyle({ question: { bold: true, size: 14 } }, { bold: false, italic: true, size: 20 })
    expect(style.fontWeight).toBe(400)
    expect(style.fontStyle).toBe('italic')
    expect(style.fontSize).toBe('20px')
  })
  it('drops empty per-question styles', () => {
    expect(normalizeQuestionStyle({})).toBeNull()
    expect(normalizeQuestionStyle({ bold: true, color: 'nope' })).toEqual({ bold: true })
  })
})

describe('card size', () => {
  it('clamps padding, gap and width', () => {
    const c = normalizeTheme({ card: { padding: 500, gap: -4, widthPct: 10 } }).card
    expect(c.padding).toBe(64)
    expect(c.gap).toBe(0)
    expect(c.widthPct).toBe(50)
  })
  it('includes the NAMMES presets', () => {
    expect(FORM_PRESETS.slice(0, 2).map((p) => p.id)).toEqual(['nammes', 'nammes-dark'])
    expect(applyPreset('nammes').accent).toBe('#0b2417')
    expect(applyPreset('nammes-dark').page.color).toBe('#0d1310')
  })
})

describe('presets', () => {
  it('every preset normalises cleanly and keeps the header and width', () => {
    for (const p of FORM_PRESETS) {
      const t = applyPreset(p.id, { header: null, width: 'wide', page: { image: null } })
      expect(t.preset).toBe(p.id)
      expect(t.width).toBe('wide')
    }
  })
  it('hasTheme / themeToSave treat null and {} as no theme', () => {
    expect(hasTheme(null)).toBe(false)
    expect(themeToSave({})).toBeNull()
    expect(themeToSave({ accent: '#ff0000' }).accent).toBe('#ff0000')
  })
})

describe('per-card layout', () => {
  it('keeps only the keys that were set and clamps them', () => {
    expect(normalizeCardLayout(null)).toBeNull()
    expect(normalizeCardLayout({})).toBeNull()
    expect(normalizeCardLayout({ widthPct: 5, minHeight: 99999, align: 'nope' })).toEqual({ widthPct: 30, minHeight: 1200, align: 'center' })
    expect(normalizeCardLayout({ widthPct: 60.4 })).toEqual({ widthPct: 60 })
  })

  it('turns a layout into css', () => {
    expect(cardLayoutStyle(null)).toEqual({})
    const s = cardLayoutStyle({ widthPct: 60, align: 'left', minHeight: 200, vAlign: 'center' })
    expect(s.width).toBe('60%')
    expect(s.marginRight).toBe('auto')
    expect(s.marginLeft).toBe(0)
    expect(s.minHeight).toBe('200px')
    expect(s.justifyContent).toBe('center')
  })

  it('is stored on questions and on the theme', () => {
    expect(normalizeQuestionStyle({ card: { widthPct: 70 } })).toEqual({ card: { widthPct: 70 } })
    expect(normalizeTheme({ headerCard: { minHeight: 300 } }).headerCard).toEqual({ minHeight: 300 })
    expect(normalizeTheme({}).headerCard).toEqual({})
  })
})

describe('computeResize', () => {
  const base = { startWidthPct: 60, startHeight: 200, containerWidth: 600, align: 'center' }

  it('widens a centered card twice as fast as the pointer moves', () => {
    expect(computeResize({ ...base, handle: 'e', dx: 30, dy: 0 })).toEqual({ widthPct: 70 })
  })
  it('the west handle widens when dragged left', () => {
    expect(computeResize({ ...base, handle: 'w', dx: -30, dy: 0 })).toEqual({ widthPct: 70 })
  })
  it('a left-aligned card grows one edge only', () => {
    expect(computeResize({ ...base, align: 'left', handle: 'e', dx: 60, dy: 0 })).toEqual({ widthPct: 70 })
  })
  it('clamps between the minimum and full width, snapping near full', () => {
    expect(computeResize({ ...base, handle: 'e', dx: -9999, dy: 0 }).widthPct).toBe(30)
    expect(computeResize({ ...base, handle: 'e', dx: 9999, dy: 0 }).widthPct).toBe(100)
    expect(computeResize({ ...base, startWidthPct: 90, handle: 'e', dx: 22, dy: 0 }).widthPct).toBe(100)
  })
  it('the bottom handle changes height only', () => {
    expect(computeResize({ ...base, handle: 's', dx: 50, dy: 40 })).toEqual({ height: 240 })
  })
  it('corners change both', () => {
    expect(computeResize({ ...base, handle: 'se', dx: 30, dy: -50 })).toEqual({ widthPct: 70, height: 150 })
  })
  it('never goes below zero height', () => {
    expect(computeResize({ ...base, handle: 's', dx: 0, dy: -999 }).height).toBe(0)
  })
})

describe('custom image ratio', () => {
  it('uses image.ratio when the aspect is custom', () => {
    const img = normalizeImage({ url: 'https://a.co/i.png', aspect: 'custom', ratio: 2.5 })
    expect(aspectRatioOf(img)).toBe(2.5)
  })
  it('clamps the ratio', () => {
    expect(normalizeImage({ url: 'https://a.co/i.png', aspect: 'custom', ratio: 99 }).ratio).toBe(5)
  })
})
