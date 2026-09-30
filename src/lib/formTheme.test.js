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
