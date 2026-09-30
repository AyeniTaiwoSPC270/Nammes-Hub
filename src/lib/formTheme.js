// Form appearance: the theme JSON stored on forms.theme, the per-question image/style JSON
// stored on form_questions.image / .style, and the pure helpers that turn them into CSS.
// Everything user-controlled is clamped or allow-listed here, so the renderers can trust it.

const HEX = /^#[0-9a-f]{6}$/i

export const FORM_FONTS = [
  { name: 'Public Sans', stack: '"Public Sans", -apple-system, sans-serif', group: 'Sans' },
  { name: 'Inter', stack: '"Inter", sans-serif', group: 'Sans' },
  { name: 'Roboto', stack: '"Roboto", sans-serif', group: 'Sans' },
  { name: 'Open Sans', stack: '"Open Sans", sans-serif', group: 'Sans' },
  { name: 'Lato', stack: '"Lato", sans-serif', group: 'Sans' },
  { name: 'Montserrat', stack: '"Montserrat", sans-serif', group: 'Sans' },
  { name: 'Poppins', stack: '"Poppins", sans-serif', group: 'Sans' },
  { name: 'Nunito', stack: '"Nunito", sans-serif', group: 'Sans' },
  { name: 'Raleway', stack: '"Raleway", sans-serif', group: 'Sans' },
  { name: 'Work Sans', stack: '"Work Sans", sans-serif', group: 'Sans' },
  { name: 'DM Sans', stack: '"DM Sans", sans-serif', group: 'Sans' },
  { name: 'Playfair Display', stack: '"Playfair Display", Georgia, serif', group: 'Serif' },
  { name: 'Merriweather', stack: '"Merriweather", Georgia, serif', group: 'Serif' },
  { name: 'Lora', stack: '"Lora", Georgia, serif', group: 'Serif' },
  { name: 'Libre Baskerville', stack: '"Libre Baskerville", Georgia, serif', group: 'Serif' },
  { name: 'Crimson Text', stack: '"Crimson Text", Georgia, serif', group: 'Serif' },
  { name: 'Oswald', stack: '"Oswald", sans-serif', group: 'Display' },
  { name: 'Bebas Neue', stack: '"Bebas Neue", sans-serif', group: 'Display', singleWeight: true },
  { name: 'Anton', stack: '"Anton", sans-serif', group: 'Display', singleWeight: true },
  { name: 'Pacifico', stack: '"Pacifico", cursive', group: 'Script', singleWeight: true },
  { name: 'Lobster', stack: '"Lobster", cursive', group: 'Script', singleWeight: true },
  { name: 'Dancing Script', stack: '"Dancing Script", cursive', group: 'Script' },
  { name: 'Caveat', stack: '"Caveat", cursive', group: 'Script' },
  { name: 'Permanent Marker', stack: '"Permanent Marker", cursive', group: 'Script', singleWeight: true },
  { name: 'Roboto Mono', stack: '"Roboto Mono", monospace', group: 'Mono' },
  { name: 'Space Mono', stack: '"Space Mono", monospace', group: 'Mono' },
]

const FONT_BY_NAME = new Map(FORM_FONTS.map((f) => [f.name, f]))
const DEFAULT_FONT = 'Public Sans'

export function fontStack(name) {
  return (FONT_BY_NAME.get(name) ?? FONT_BY_NAME.get(DEFAULT_FONT)).stack
}

const loadedFonts = new Set()

/** Adds the Google Fonts stylesheet for a font once. Public Sans is already loaded by index.html. */
export function loadFormFont(name) {
  const font = FONT_BY_NAME.get(name)
  if (!font || name === DEFAULT_FONT || loadedFonts.has(name) || typeof document === 'undefined') return
  loadedFonts.add(name)
  const family = name.replace(/ /g, '+')
  const spec = font.singleWeight ? family : `${family}:wght@400;700`
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`
  document.head.appendChild(link)
}

export const FORM_WIDTHS = [
  { value: 'narrow', label: 'Narrow', px: 560 },
  { value: 'medium', label: 'Medium', px: 700 },
  { value: 'wide', label: 'Wide', px: 900 },
]

export const CARD_SHADOWS = [
  { value: 'none', label: 'None', css: 'none' },
  { value: 'sm', label: 'Soft', css: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)' },
  { value: 'md', label: 'Raised', css: '0 8px 28px rgba(0,0,0,0.14)' },
]

export const PAGE_TYPES = [
  { value: 'default', label: 'Default' },
  { value: 'color', label: 'Color' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'image', label: 'Image' },
]

const BASE = {
  preset: 'classic',
  accent: '#0b2417',
  page: {
    type: 'color',
    color: '#fcf9f8',
    color2: '#e6f0ea',
    angle: 160,
    image: null,
    imageBlur: 0,
    imageOpacity: 100,
    imageDim: 0,
  },
  card: { color: '#ffffff', opacity: 100, blur: 0, radius: 12, shadow: 'sm', border: true, padding: 20, gap: 16, widthPct: 100 },
  text: { color: '#1c1b1b', muted: '#5f665f' },
  fonts: { heading: DEFAULT_FONT, body: DEFAULT_FONT },
  title: { size: 32, bold: true, italic: false, underline: false, align: 'left', color: '' },
  description: { size: 16, bold: false, italic: false, underline: false, align: 'left', color: '' },
  question: { size: 14, bold: true, italic: false, underline: false, align: 'left', color: '' },
  answerSize: 16,
  width: 'medium',
  header: null,
  showProgress: true,
}

function preset(id, label, patch) {
  return { id, label, patch }
}

// Presets only set the look; every field stays editable afterwards.
export const FORM_PRESETS = [
  // The site's own look: paper page, white cards, forest-green accent, Public Sans.
  preset('nammes', 'NAMMES', {
    accent: '#0b2417',
    page: { type: 'color', color: '#fcf9f8' },
    card: { color: '#ffffff', opacity: 100, radius: 8, border: true, shadow: 'sm' },
    text: { color: '#1c1b1b', muted: '#424843' },
    title: { color: '#0b2417', bold: true },
    question: { color: '#0b2417' },
  }),
  // Same identity as the site's dark mode: deep green ground, mint accent.
  preset('nammes-dark', 'NAMMES Dark', {
    accent: '#5cb88a',
    page: { type: 'color', color: '#0d1310' },
    card: { color: '#16211b', opacity: 100, radius: 8, border: true, shadow: 'none' },
    text: { color: '#e6e8e5', muted: '#9aa79e' },
    title: { color: '#f7f9f7', bold: true },
    question: { color: '#f7f9f7' },
  }),
  preset('classic', 'Classic', {}),
  preset('midnight', 'Midnight', {
    accent: '#8ab4ff',
    page: { type: 'gradient', color: '#0b1020', color2: '#1b2446', angle: 160 },
    card: { color: '#141b33', opacity: 92, border: true, shadow: 'md' },
    text: { color: '#eef1fb', muted: '#a3adcb' },
  }),
  preset('ocean', 'Ocean', {
    accent: '#0a6ea8',
    page: { type: 'gradient', color: '#d9f0ff', color2: '#8fd0f5', angle: 160 },
    card: { color: '#ffffff', opacity: 94, shadow: 'md' },
    text: { color: '#0f2a3d', muted: '#476579' },
  }),
  preset('forest', 'Forest', {
    accent: '#1f6b3f',
    page: { type: 'gradient', color: '#e3f1e6', color2: '#b7dcc1', angle: 150 },
    card: { color: '#fbfffb', opacity: 96, shadow: 'sm' },
    text: { color: '#10301c', muted: '#4b6b57' },
    fonts: { heading: 'Merriweather', body: 'Lato' },
  }),
  preset('sunset', 'Sunset', {
    accent: '#d9480f',
    page: { type: 'gradient', color: '#ffe3c9', color2: '#ffb3a1', angle: 150 },
    card: { color: '#fffaf5', opacity: 94, shadow: 'md' },
    text: { color: '#3b1d10', muted: '#7a5646' },
    fonts: { heading: 'Poppins', body: 'Poppins' },
  }),
  preset('lavender', 'Lavender', {
    accent: '#6d4bd8',
    page: { type: 'gradient', color: '#efe8ff', color2: '#d3c4ff', angle: 155 },
    card: { color: '#ffffff', opacity: 94, radius: 18, shadow: 'md' },
    text: { color: '#241a45', muted: '#675c8a' },
    fonts: { heading: 'Nunito', body: 'Nunito' },
  }),
  preset('rose', 'Rose', {
    accent: '#c2185b',
    page: { type: 'color', color: '#fde7ef' },
    card: { color: '#ffffff', opacity: 100, radius: 16, shadow: 'sm' },
    text: { color: '#3a1424', muted: '#7d5566' },
    fonts: { heading: 'Playfair Display', body: 'Lora' },
  }),
  preset('paper', 'Paper', {
    accent: '#8a5a2b',
    page: { type: 'color', color: '#f3ead8' },
    card: { color: '#fffaf0', opacity: 100, radius: 4, border: true, shadow: 'none' },
    text: { color: '#33281b', muted: '#7a6a55' },
    fonts: { heading: 'Crimson Text', body: 'Crimson Text' },
  }),
  preset('slate', 'Slate', {
    accent: '#334155',
    page: { type: 'color', color: '#e2e8f0' },
    card: { color: '#ffffff', opacity: 100, radius: 8, shadow: 'sm' },
    text: { color: '#0f172a', muted: '#586579' },
    fonts: { heading: 'Inter', body: 'Inter' },
  }),
  preset('mint', 'Mint', {
    accent: '#0f9d8a',
    page: { type: 'gradient', color: '#dcfbf3', color2: '#b5efe0', angle: 170 },
    card: { color: '#ffffff', opacity: 90, blur: 8, radius: 20, shadow: 'sm' },
    text: { color: '#0b3a33', muted: '#4a7a72' },
    fonts: { heading: 'DM Sans', body: 'DM Sans' },
  }),
  preset('noir', 'Noir', {
    accent: '#f5c518',
    page: { type: 'color', color: '#0a0a0a' },
    card: { color: '#171717', opacity: 100, radius: 6, border: true, shadow: 'none' },
    text: { color: '#f4f4f4', muted: '#a1a1a1' },
    fonts: { heading: 'Oswald', body: 'Work Sans' },
  }),
  preset('glass', 'Glass', {
    accent: '#ffffff',
    page: { type: 'gradient', color: '#4338ca', color2: '#db2777', angle: 135 },
    card: { color: '#ffffff', opacity: 16, blur: 14, radius: 20, border: true, shadow: 'md' },
    text: { color: '#ffffff', muted: '#e4defa' },
    fonts: { heading: 'Montserrat', body: 'Montserrat' },
  }),
]

function clamp(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function hex(value, fallback) {
  return typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : fallback
}

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

function font(value, fallback) {
  return FONT_BY_NAME.has(value) ? value : fallback
}

// Uploaded images always live on https storage; anything else (javascript:, quotes, parens) is dropped.
export function safeImageUrl(url) {
  if (typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!/^https:\/\/[^\s"'()<>\\]+$/.test(trimmed)) return ''
  return trimmed
}

export const IMAGE_ASPECTS = [
  { value: 'free', label: 'Original', ratio: null },
  { value: '1:1', label: '1:1', ratio: 1 },
  { value: '4:3', label: '4:3', ratio: 4 / 3 },
  { value: '3:2', label: '3:2', ratio: 3 / 2 },
  { value: '16:9', label: '16:9', ratio: 16 / 9 },
  { value: '21:9', label: '21:9', ratio: 21 / 9 },
  { value: '3:1', label: '3:1', ratio: 3 },
  { value: '3:4', label: '3:4', ratio: 3 / 4 },
]

export const DEFAULT_IMAGE = {
  url: '',
  aspect: 'free',
  zoom: 1,
  x: 50,
  y: 50,
  rotate: 0,
  flipH: false,
  flipV: false,
  brightness: 100,
  contrast: 100,
  saturate: 100,
  grayscale: 0,
  blur: 0,
  radius: 8,
  widthPct: 100,
  align: 'center',
  alt: '',
}

/** Clamps an image-adjustment object. Returns null when there is no usable image. */
export function normalizeImage(raw) {
  if (!raw || typeof raw !== 'object') return null
  const url = safeImageUrl(raw.url)
  if (!url) return null
  const d = DEFAULT_IMAGE
  return {
    url,
    aspect: pick(raw.aspect, IMAGE_ASPECTS.map((a) => a.value), d.aspect),
    zoom: clamp(raw.zoom, 1, 4, d.zoom),
    x: clamp(raw.x, 0, 100, d.x),
    y: clamp(raw.y, 0, 100, d.y),
    rotate: pick(Number(raw.rotate), [0, 90, 180, 270], 0),
    flipH: Boolean(raw.flipH),
    flipV: Boolean(raw.flipV),
    brightness: clamp(raw.brightness, 30, 180, d.brightness),
    contrast: clamp(raw.contrast, 30, 180, d.contrast),
    saturate: clamp(raw.saturate, 0, 200, d.saturate),
    grayscale: clamp(raw.grayscale, 0, 100, d.grayscale),
    blur: clamp(raw.blur, 0, 20, d.blur),
    radius: clamp(raw.radius, 0, 48, d.radius),
    widthPct: clamp(raw.widthPct, 10, 100, d.widthPct),
    align: pick(raw.align, ['left', 'center', 'right'], d.align),
    alt: typeof raw.alt === 'string' ? raw.alt.slice(0, 200) : '',
  }
}

export function imageFilter(image) {
  const parts = []
  if (image.brightness !== 100) parts.push(`brightness(${image.brightness}%)`)
  if (image.contrast !== 100) parts.push(`contrast(${image.contrast}%)`)
  if (image.saturate !== 100) parts.push(`saturate(${image.saturate}%)`)
  if (image.grayscale > 0) parts.push(`grayscale(${image.grayscale}%)`)
  if (image.blur > 0) parts.push(`blur(${image.blur}px)`)
  return parts.length ? parts.join(' ') : 'none'
}

export function aspectRatioOf(image) {
  return IMAGE_ASPECTS.find((a) => a.value === image.aspect)?.ratio ?? null
}

function normalizeTextStyle(raw, base) {
  const r = raw && typeof raw === 'object' ? raw : {}
  return {
    size: clamp(r.size, 10, 72, base.size),
    bold: r.bold === undefined ? base.bold : Boolean(r.bold),
    italic: r.italic === undefined ? base.italic : Boolean(r.italic),
    underline: r.underline === undefined ? base.underline : Boolean(r.underline),
    align: pick(r.align, ['left', 'center', 'right'], base.align),
    color: r.color === '' || r.color === undefined ? '' : hex(r.color, ''),
  }
}

/** Merges stored theme JSON over the defaults and clamps every value. */
export function normalizeTheme(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const page = r.page && typeof r.page === 'object' ? r.page : {}
  const card = r.card && typeof r.card === 'object' ? r.card : {}
  const text = r.text && typeof r.text === 'object' ? r.text : {}
  const fonts = r.fonts && typeof r.fonts === 'object' ? r.fonts : {}
  const b = BASE
  return {
    preset: typeof r.preset === 'string' ? r.preset.slice(0, 24) : b.preset,
    accent: hex(r.accent, b.accent),
    page: {
      type: pick(page.type, PAGE_TYPES.map((t) => t.value), b.page.type),
      color: hex(page.color, b.page.color),
      color2: hex(page.color2, b.page.color2),
      angle: clamp(page.angle, 0, 360, b.page.angle),
      image: normalizeImage(page.image),
      imageBlur: clamp(page.imageBlur, 0, 30, b.page.imageBlur),
      imageOpacity: clamp(page.imageOpacity, 0, 100, b.page.imageOpacity),
      imageDim: clamp(page.imageDim, 0, 80, b.page.imageDim),
    },
    card: {
      color: hex(card.color, b.card.color),
      opacity: clamp(card.opacity, 0, 100, b.card.opacity),
      blur: clamp(card.blur, 0, 30, b.card.blur),
      radius: clamp(card.radius, 0, 32, b.card.radius),
      shadow: pick(card.shadow, CARD_SHADOWS.map((s) => s.value), b.card.shadow),
      border: card.border === undefined ? b.card.border : Boolean(card.border),
      padding: clamp(card.padding, 8, 64, b.card.padding),
      gap: clamp(card.gap, 0, 64, b.card.gap),
      widthPct: clamp(card.widthPct, 50, 100, b.card.widthPct),
    },
    text: { color: hex(text.color, b.text.color), muted: hex(text.muted, b.text.muted) },
    fonts: { heading: font(fonts.heading, DEFAULT_FONT), body: font(fonts.body, DEFAULT_FONT) },
    title: normalizeTextStyle(r.title, b.title),
    description: normalizeTextStyle(r.description, b.description),
    question: normalizeTextStyle(r.question, b.question),
    answerSize: clamp(r.answerSize, 12, 26, b.answerSize),
    width: pick(r.width, FORM_WIDTHS.map((w) => w.value), b.width),
    header: normalizeImage(r.header),
    showProgress: r.showProgress === undefined ? b.showProgress : Boolean(r.showProgress),
  }
}

/** The default look with a preset applied. Keeps the page image, header image and width; resets text styles. */
export function applyPreset(presetId, current) {
  const found = FORM_PRESETS.find((p) => p.id === presetId) ?? FORM_PRESETS[0]
  const keep = current ? { header: current.header, width: current.width, page: { image: current.page.image } } : {}
  const patch = found.patch
  return normalizeTheme({
    ...patch,
    preset: found.id,
    page: { ...(patch.page ?? {}), image: keep.page?.image ?? null },
    header: keep.header ?? null,
    width: keep.width ?? 'medium',
  })
}

export const DEFAULT_THEME = normalizeTheme({})

/** True when the stored theme is meaningfully different from not having one. */
export function hasTheme(raw) {
  return Boolean(raw && typeof raw === 'object' && Object.keys(raw).length > 0)
}

export function themeToSave(theme) {
  return hasTheme(theme) ? normalizeTheme(theme) : null
}

// ---------- colour math ----------

function toRgb(color) {
  const n = parseInt(color.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(color) {
  const [r, g, b] = toRgb(color).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Black or white, whichever reads better on the given fill. */
export function readableOn(color) {
  return contrastRatio(color, '#ffffff') >= contrastRatio(color, '#111111') ? '#ffffff' : '#111111'
}

// ---------- CSS output ----------

/** CSS custom properties that re-skin every Tailwind utility inside the themed scope. */
export function themeVars(theme) {
  const t = normalizeTheme(theme)
  const brandOnCard = contrastRatio(t.accent, t.card.color) >= 3 ? t.accent : t.text.color
  return {
    '--color-paper': t.page.color,
    '--color-surface': t.card.color,
    '--color-surface-low': `color-mix(in srgb, ${t.card.color} 93%, ${t.text.color} 7%)`,
    '--color-ink': t.text.color,
    '--color-ink-900': t.text.color,
    '--color-ink-muted': t.text.muted,
    '--color-hairline': `color-mix(in srgb, ${t.text.color} 24%, transparent)`,
    '--color-brand': brandOnCard,
    '--color-green-900': t.accent,
    '--form-on-accent': readableOn(t.accent),
    '--font-body': fontStack(t.fonts.body),
    '--font-display': fontStack(t.fonts.heading),
    '--form-answer-size': `${t.answerSize}px`,
    fontFamily: fontStack(t.fonts.body),
    color: t.text.color,
  }
}

export function cardStyle(theme) {
  const t = normalizeTheme(theme)
  const shadow = CARD_SHADOWS.find((s) => s.value === t.card.shadow)?.css ?? 'none'
  return {
    background: `color-mix(in srgb, ${t.card.color} ${t.card.opacity}%, transparent)`,
    borderRadius: `${t.card.radius}px`,
    width: `${t.card.widthPct}%`,
    marginInline: 'auto',
    border: t.card.border ? '1px solid color-mix(in srgb, var(--color-ink) 18%, transparent)' : '1px solid transparent',
    boxShadow: shadow,
    backdropFilter: t.card.blur > 0 ? `blur(${t.card.blur}px)` : undefined,
    WebkitBackdropFilter: t.card.blur > 0 ? `blur(${t.card.blur}px)` : undefined,
  }
}

/** Inline style for a run of text (title / description / question). */
export function textStyle(style, fallbackColor) {
  return {
    fontSize: `${style.size}px`,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: style.underline ? 'underline' : 'none',
    textAlign: style.align,
    color: style.color || fallbackColor,
  }
}

/** Style for a single question label: the form-wide question style, overridden per question. */
export function questionLabelStyle(theme, questionStyle) {
  const base = normalizeTheme(theme).question
  const own = questionStyle && typeof questionStyle === 'object' ? questionStyle : {}
  const merged = {
    size: clamp(own.size, 10, 48, base.size),
    bold: own.bold === undefined ? base.bold : Boolean(own.bold),
    italic: own.italic === undefined ? base.italic : Boolean(own.italic),
    underline: own.underline === undefined ? base.underline : Boolean(own.underline),
    align: pick(own.align, ['left', 'center', 'right'], base.align),
    color: own.color === undefined ? base.color : hex(own.color, ''),
  }
  return textStyle(merged, 'var(--color-ink-900)')
}

export function normalizeQuestionStyle(raw) {
  if (!raw || typeof raw !== 'object') return null
  const out = {}
  if (raw.size !== undefined) out.size = clamp(raw.size, 10, 48, 14)
  for (const key of ['bold', 'italic', 'underline']) {
    if (raw[key] !== undefined) out[key] = Boolean(raw[key])
  }
  if (raw.align !== undefined) out.align = pick(raw.align, ['left', 'center', 'right'], 'left')
  if (raw.color) out.color = hex(raw.color, '')
  if (out.color === '') delete out.color
  return Object.keys(out).length ? out : null
}

export function widthPx(theme) {
  const t = normalizeTheme(theme)
  return FORM_WIDTHS.find((w) => w.value === t.width)?.px ?? 700
}

/** Everything the background layer needs to paint, or null when the page keeps the site default. */
export function pageBackground(theme) {
  const t = normalizeTheme(theme)
  const { page } = t
  if (page.type === 'default') return null
  if (page.type === 'color') return { base: page.color }
  if (page.type === 'gradient') {
    return { base: page.color, gradient: `linear-gradient(${page.angle}deg, ${page.color}, ${page.color2})` }
  }
  return {
    base: page.color,
    image: page.image,
    imageBlur: page.imageBlur,
    imageOpacity: page.imageOpacity,
    imageDim: page.imageDim,
  }
}

/** Card inner spacing, and the space between cards. */
export function cardPadding(theme) {
  return `${normalizeTheme(theme).card.padding}px`
}

export function cardGap(theme) {
  return `${normalizeTheme(theme).card.gap}px`
}
