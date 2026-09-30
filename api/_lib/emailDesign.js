// Email design: the JSON "design" (colors, fonts, header, button, footer...) and the "blocks"
// (heading, text, image, button...) that make up one email, plus the renderer that turns both
// into email-safe HTML (tables + inline styles). Shared by the admin preview and the server, so what
// an admin sees is what gets sent. Everything is clamped / escaped / allow-listed here because the
// server renders whatever design a caller sends.

export const SITE_URL = 'https://www.nammeshub.com.ng'

const HEX = /^#[0-9a-f]{6}$/i

// Only fonts every major inbox can show. Web fonts are ignored by Gmail and Outlook.
export const EMAIL_FONTS = [
  { key: 'system', label: 'Modern sans (system)', stack: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" },
  { key: 'arial', label: 'Arial', stack: 'Arial,Helvetica,sans-serif' },
  { key: 'verdana', label: 'Verdana', stack: 'Verdana,Geneva,sans-serif' },
  { key: 'tahoma', label: 'Tahoma', stack: 'Tahoma,Geneva,sans-serif' },
  { key: 'trebuchet', label: 'Trebuchet MS', stack: "'Trebuchet MS',Helvetica,sans-serif" },
  { key: 'georgia', label: 'Georgia', stack: 'Georgia,Times,serif' },
  { key: 'times', label: 'Times New Roman', stack: "'Times New Roman',Times,serif" },
  { key: 'palatino', label: 'Palatino', stack: "Palatino,'Palatino Linotype',Georgia,serif" },
  { key: 'courier', label: 'Courier New', stack: "'Courier New',Courier,monospace" },
]

const FONT_KEYS = EMAIL_FONTS.map((f) => f.key)

export function emailFontStack(key) {
  return (EMAIL_FONTS.find((f) => f.key === key) ?? EMAIL_FONTS[0]).stack
}

export const HEADER_STYLES = [
  { value: 'bar', label: 'Color bar' },
  { value: 'plain', label: 'Plain' },
  { value: 'centered', label: 'Centered' },
]

export const STRIPE_STYLES = [
  { value: 'none', label: 'None' },
  { value: 'solid', label: 'Solid' },
  { value: 'split', label: 'Two-tone' },
]

const ALIGNS = ['left', 'center', 'right']

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

function text(value, max, fallback = '') {
  return typeof value === 'string' ? value.slice(0, max) : fallback
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Links may be https, mailto, or "site:/path" (resolved against the site URL so presets survive a domain change).
export function safeLink(url) {
  if (typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (/^site:\/[^\s"'<>]*$/.test(trimmed)) return trimmed
  if (/^https:\/\/[^\s"'<>()\\]+$/.test(trimmed)) return trimmed
  if (/^mailto:[^\s"'<>()\\]+$/.test(trimmed)) return trimmed
  return ''
}

export function resolveLink(url, siteUrl = SITE_URL) {
  const safe = safeLink(url)
  return safe.startsWith('site:') ? siteUrl + safe.slice(5) : safe
}

export function safeImageSrc(url, allowedHosts) {
  if (typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!/^https:\/\/[^\s"'<>()\\]+$/.test(trimmed)) return ''
  if (allowedHosts) {
    try {
      if (!allowedHosts.includes(new URL(trimmed).hostname)) return ''
    } catch {
      return ''
    }
  }
  return trimmed
}

// ---------- images (crop / adjust values are baked into the file by the editor) ----------

export const EMAIL_IMAGE_ASPECTS = [
  { value: 'free', label: 'Original' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:2', label: '3:2' },
  { value: '16:9', label: '16:9' },
  { value: '21:9', label: '21:9' },
  { value: '3:1', label: '3:1' },
]

export const DEFAULT_ADJUST = {
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
}

export function normalizeAdjust(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const d = DEFAULT_ADJUST
  return {
    aspect: pick(r.aspect, EMAIL_IMAGE_ASPECTS.map((a) => a.value), d.aspect),
    zoom: clamp(r.zoom, 1, 4, d.zoom),
    x: clamp(r.x, 0, 100, d.x),
    y: clamp(r.y, 0, 100, d.y),
    rotate: pick(Number(r.rotate), [0, 90, 180, 270], 0),
    flipH: Boolean(r.flipH),
    flipV: Boolean(r.flipV),
    brightness: clamp(r.brightness, 30, 180, d.brightness),
    contrast: clamp(r.contrast, 30, 180, d.contrast),
    saturate: clamp(r.saturate, 0, 200, d.saturate),
    grayscale: clamp(r.grayscale, 0, 100, d.grayscale),
  }
}

function normalizePicture(raw, allowedHosts) {
  if (!raw || typeof raw !== 'object') return null
  const url = safeImageSrc(raw.url, allowedHosts)
  if (!url) return null
  return {
    url,
    // The untouched upload, kept so the crop can be re-adjusted later.
    src: safeImageSrc(raw.src, allowedHosts) || url,
    adjust: normalizeAdjust(raw.adjust),
    alt: text(raw.alt, 200),
    link: safeLink(raw.link),
    bakeKey: text(raw.bakeKey, 200),
  }
}

// ---------- design ----------

const BASE_DESIGN = {
  layout: 'default',
  colors: {
    page: '#f6f3f2',
    card: '#ffffff',
    border: '#c2c8c1',
    text: '#191813',
    heading: '#0b2417',
    muted: '#6b6558',
    link: '#ae3200',
    headerBg: '#0b2417',
    headerText: '#ffffff',
    tagBg: '#27402f',
    tagText: '#9cd6b2',
    buttonBg: '#ae3200',
    buttonText: '#ffffff',
    footerBg: '#faf8f7',
    footerText: '#6b6558',
    calloutBg: '#f6f3f2',
    calloutBorder: '#ba1a1a',
    stripeA: '#ff5a1f',
    stripeB: '#0b2417',
  },
  fonts: { heading: 'system', body: 'system' },
  sizes: { title: 23, body: 15, lineHeight: 1.7 },
  title: { show: true, bold: true, italic: false, underline: false, align: 'left', color: '' },
  card: { width: 600, radius: 8, border: true, padding: 40 },
  header: {
    style: 'bar',
    rule: false,
    logo: 'site',
    logoUrl: '',
    wordmark: 'NAMMES Hub',
    tag: 'Official Notice',
    eyebrow: '',
    dateBadge: false,
    banner: null,
  },
  stripe: 'none',
  callout: false,
  divider: false,
  button: { show: false, text: 'Visit NAMMES Hub →', url: 'site:/', style: 'filled', radius: 999, align: 'left' },
  footer: {
    text: "You're receiving this because you're a NAMMES Hub member.\nNational Association of Metallurgical and Materials Engineering Students · Faculty of Engineering, University of Lagos",
    showPrefs: true,
  },
}

/** Merges a stored design over the defaults and clamps every value. */
export function normalizeDesign(raw, allowedHosts) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const c = r.colors && typeof r.colors === 'object' ? r.colors : {}
  const f = r.fonts && typeof r.fonts === 'object' ? r.fonts : {}
  const s = r.sizes && typeof r.sizes === 'object' ? r.sizes : {}
  const t = r.title && typeof r.title === 'object' ? r.title : {}
  const cd = r.card && typeof r.card === 'object' ? r.card : {}
  const h = r.header && typeof r.header === 'object' ? r.header : {}
  const b = r.button && typeof r.button === 'object' ? r.button : {}
  const ft = r.footer && typeof r.footer === 'object' ? r.footer : {}
  const B = BASE_DESIGN
  const colors = {}
  for (const key of Object.keys(B.colors)) colors[key] = hex(c[key], B.colors[key])
  return {
    layout: text(r.layout, 24, B.layout),
    colors,
    fonts: { heading: pick(f.heading, FONT_KEYS, 'system'), body: pick(f.body, FONT_KEYS, 'system') },
    sizes: {
      title: clamp(s.title, 16, 56, B.sizes.title),
      body: clamp(s.body, 12, 22, B.sizes.body),
      lineHeight: clamp(s.lineHeight, 1.2, 2.2, B.sizes.lineHeight),
    },
    title: {
      show: t.show === undefined ? B.title.show : Boolean(t.show),
      bold: t.bold === undefined ? B.title.bold : Boolean(t.bold),
      italic: t.italic === undefined ? B.title.italic : Boolean(t.italic),
      underline: t.underline === undefined ? B.title.underline : Boolean(t.underline),
      align: pick(t.align, ALIGNS, B.title.align),
      color: t.color === '' || t.color === undefined ? '' : hex(t.color, ''),
    },
    card: {
      width: clamp(cd.width, 420, 700, B.card.width),
      radius: clamp(cd.radius, 0, 32, B.card.radius),
      border: cd.border === undefined ? B.card.border : Boolean(cd.border),
      padding: clamp(cd.padding, 16, 64, B.card.padding),
    },
    header: {
      style: pick(h.style, HEADER_STYLES.map((x) => x.value), B.header.style),
      rule: h.rule === undefined ? B.header.rule : Boolean(h.rule),
      logo: pick(h.logo, ['site', 'custom', 'none'], B.header.logo),
      logoUrl: safeImageSrc(h.logoUrl, allowedHosts),
      wordmark: text(h.wordmark, 60, B.header.wordmark),
      tag: text(h.tag, 40, B.header.tag),
      eyebrow: text(h.eyebrow, 80, B.header.eyebrow),
      dateBadge: h.dateBadge === undefined ? B.header.dateBadge : Boolean(h.dateBadge),
      banner: normalizePicture(h.banner, allowedHosts),
    },
    stripe: pick(r.stripe, STRIPE_STYLES.map((x) => x.value), B.stripe),
    callout: r.callout === undefined ? B.callout : Boolean(r.callout),
    divider: r.divider === undefined ? B.divider : Boolean(r.divider),
    button: {
      show: b.show === undefined ? B.button.show : Boolean(b.show),
      text: text(b.text, 60, B.button.text),
      url: safeLink(b.url) || B.button.url,
      style: pick(b.style, ['filled', 'outline'], B.button.style),
      radius: clamp(b.radius, 0, 999, B.button.radius),
      align: pick(b.align, ALIGNS, B.button.align),
    },
    footer: {
      text: text(ft.text, 600, B.footer.text),
      showPrefs: ft.showPrefs === undefined ? B.footer.showPrefs : Boolean(ft.showPrefs),
    },
  }
}

function preset(id, label, description, patch) {
  return { id, label, description, patch }
}

// The seven original broadcast layouts, expressed as designs.
export const EMAIL_PRESETS = [
  preset('default', 'Default', 'Dark green header bar with an "Official Notice" tag.', {}),
  preset('bold', 'Bold', 'High-contrast orange header, large headline.', {
    colors: { headerBg: '#ff5a1f', headerText: '#ffffff', tagBg: '#ff7a47', tagText: '#ffffff' },
    sizes: { title: 28, body: 16, lineHeight: 1.75 },
    header: { style: 'bar', tag: 'Official Bulletin', eyebrow: 'Announcement · {{date}}' },
    button: { show: true },
  }),
  preset('minimal', 'Minimal', 'Text-first, no colored header.', {
    sizes: { title: 20 },
    header: { style: 'plain', rule: true, tag: 'Notice', eyebrow: '{{date}}' },
    colors: { tagText: '#6b6558', tagBg: '#ffffff' },
  }),
  preset('event', 'Event Invite', 'Date badge and a call to action.', {
    colors: { tagBg: '#fff0e6', tagText: '#ae3200' },
    header: { style: 'plain', tag: 'Official Invitation', dateBadge: true },
    button: { show: true, text: 'See events →', url: 'site:/events' },
  }),
  preset('alert', 'Urgent Alert', 'Red accent and a highlighted message box.', {
    colors: { headerBg: '#ba1a1a', headerText: '#ffffff', tagBg: '#d04a4a', tagText: '#ffffff', calloutBg: '#ffdad6', calloutBorder: '#ba1a1a' },
    stripe: 'solid',
    header: { style: 'bar', tag: 'Urgent Notice' },
    callout: true,
    title: { color: '#000904' },
    sizes: { title: 22 },
  }),
  preset('digest', 'Newsletter Digest', 'Centered editorial layout with a dated eyebrow.', {
    header: { style: 'centered', tag: '', eyebrow: 'Weekly Dispatch · {{date_full}}' },
    title: { align: 'center' },
    divider: true,
    sizes: { title: 26, lineHeight: 1.8 },
    button: { show: true, text: 'Read more on NAMMES Hub →', align: 'center' },
    colors: { headerText: '#0b2417' },
  }),
  preset('celebration', 'Celebration', 'Festive orange and green accents.', {
    colors: { tagBg: '#e6f0ea', tagText: '#1c6b3a' },
    stripe: 'split',
    header: { style: 'plain', tag: 'Congratulations' },
    title: { align: 'center' },
    sizes: { title: 25 },
    button: { show: true, text: 'View all results →', url: 'site:/awards', align: 'center' },
  }),
]

function deepMerge(base, patch) {
  const out = { ...base }
  for (const [k, v] of Object.entries(patch ?? {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? deepMerge(base[k], v) : v
  }
  return out
}

export function presetDesign(id) {
  const found = EMAIL_PRESETS.find((p) => p.id === id) ?? EMAIL_PRESETS[0]
  return normalizeDesign(deepMerge(BASE_DESIGN, { ...found.patch, layout: found.id }))
}

export const DEFAULT_DESIGN = presetDesign('default')

// Automatic emails (not broadcasts): their look is designable, their content is fixed by the app.
export const SYSTEM_EMAILS = [
  {
    id: 'welcome',
    label: 'Welcome email',
    description: 'Sent when someone creates an account.',
    design: {
      header: { tag: '', eyebrow: 'Membership Activation', style: 'plain', rule: true },
      colors: { headerText: '#0b2417' },
      footer: {
        text: 'National Association of Metallurgical and Materials Engineering Students (NAMMES)\nFaculty of Engineering, University of Lagos\nYou received this transactional email because you created an account on NAMMES Hub.',
      },
      button: { show: true, text: 'Visit NAMMES Hub →', url: 'site:/' },
      sizes: { title: 24 },
    },
  },
  {
    id: 'new_content',
    label: 'New content alert',
    description: 'Sent when news, an event or an opportunity is posted.',
    design: {
      header: { tag: '', eyebrow: '', style: 'plain', rule: true },
      colors: { headerText: '#0b2417' },
      footer: {
        text: 'This is an automated departmental content alert from NAMMES Hub.',
        showPrefs: true,
      },
      button: { show: true, text: 'Read more →', url: 'site:/' },
      sizes: { title: 22 },
    },
  },
]

export function systemDesign(id) {
  const found = SYSTEM_EMAILS.find((s) => s.id === id)
  return normalizeDesign(deepMerge(BASE_DESIGN, { ...(found?.design ?? {}), layout: id }))
}

// ---------- blocks ----------

export const BLOCK_TYPES = [
  { type: 'heading', label: 'Heading', icon: 'title' },
  { type: 'text', label: 'Text', icon: 'notes' },
  { type: 'image', label: 'Image', icon: 'image' },
  { type: 'button', label: 'Button', icon: 'smart_button' },
  { type: 'quote', label: 'Highlight box', icon: 'format_quote' },
  { type: 'list', label: 'List', icon: 'format_list_bulleted' },
  { type: 'divider', label: 'Divider', icon: 'horizontal_rule' },
  { type: 'spacer', label: 'Spacer', icon: 'height' },
  { type: 'columns', label: 'Two columns', icon: 'view_column' },
]

const MAX_BLOCKS = 60

export function newBlock(type) {
  const id = globalThis.crypto?.randomUUID?.() ?? `b${Math.random().toString(36).slice(2)}`
  switch (type) {
    case 'heading':
      return { id, type, text: '', level: 2, align: 'left', color: '' }
    case 'text':
      return { id, type, text: '', align: 'left' }
    case 'image':
      return { id, type, url: '', src: '', bakeKey: '', alt: '', link: '', widthPct: 100, align: 'center', radius: 8, adjust: { ...DEFAULT_ADJUST } }
    case 'button':
      return { id, type, text: 'Click here', url: '', style: 'filled', align: 'left' }
    case 'quote':
      return { id, type, text: '', color: '' }
    case 'list':
      return { id, type, items: [''], ordered: false }
    case 'divider':
      return { id, type, color: '' }
    case 'spacer':
      return { id, type, height: 24 }
    case 'columns':
      return { id, type, left: newBlock('text'), right: newBlock('text') }
    default:
      return null
  }
}

function normalizeBlock(raw, allowedHosts, depth) {
  if (!raw || typeof raw !== 'object') return null
  const id = text(raw.id, 64) || newBlock('text').id
  switch (raw.type) {
    case 'heading':
      return {
        id,
        type: 'heading',
        text: text(raw.text, 500),
        level: pick(Number(raw.level), [1, 2, 3], 2),
        align: pick(raw.align, ALIGNS, 'left'),
        color: raw.color ? hex(raw.color, '') : '',
      }
    case 'text':
      return { id, type: 'text', text: text(raw.text, 20000), align: pick(raw.align, ALIGNS, 'left') }
    case 'image': {
      const url = safeImageSrc(raw.url, allowedHosts)
      if (!url) return null
      return {
        id,
        type: 'image',
        url,
        src: safeImageSrc(raw.src, allowedHosts) || url,
        bakeKey: text(raw.bakeKey, 200),
        alt: text(raw.alt, 200),
        link: safeLink(raw.link),
        widthPct: clamp(raw.widthPct, 10, 100, 100),
        align: pick(raw.align, ALIGNS, 'center'),
        radius: clamp(raw.radius, 0, 48, 8),
        adjust: normalizeAdjust(raw.adjust),
      }
    }
    case 'button':
      return {
        id,
        type: 'button',
        text: text(raw.text, 60, 'Click here'),
        url: safeLink(raw.url),
        style: pick(raw.style, ['filled', 'outline'], 'filled'),
        align: pick(raw.align, ALIGNS, 'left'),
      }
    case 'quote':
      return { id, type: 'quote', text: text(raw.text, 5000), color: raw.color ? hex(raw.color, '') : '' }
    case 'list': {
      const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, 40).map((i) => text(i, 500))
      return { id, type: 'list', items: items.length ? items : [''], ordered: Boolean(raw.ordered) }
    }
    case 'divider':
      return { id, type: 'divider', color: raw.color ? hex(raw.color, '') : '' }
    case 'spacer':
      return { id, type: 'spacer', height: clamp(raw.height, 4, 96, 24) }
    case 'columns': {
      if (depth > 0) return null
      const side = (b) => {
        const n = normalizeBlock(b, allowedHosts, depth + 1)
        return n && ['text', 'image', 'button', 'heading'].includes(n.type) ? n : newBlock('text')
      }
      return { id, type: 'columns', left: side(raw.left), right: side(raw.right) }
    }
    default:
      return null
  }
}

export function normalizeBlocks(raw, allowedHosts) {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(0, MAX_BLOCKS)
    .map((b) => normalizeBlock(b, allowedHosts, 0))
    .filter(Boolean)
}

/** A plain-text version of the blocks, for history, duplicate detection and notification previews. */
export function blocksToPlainText(blocks) {
  const parts = []
  const visit = (b) => {
    if (!b) return
    if (b.type === 'columns') {
      visit(b.left)
      visit(b.right)
    } else if (b.type === 'list') {
      parts.push(b.items.filter((i) => i.trim()).map((i) => `- ${i}`).join('\n'))
    } else if (b.type === 'button') {
      parts.push(b.text)
    } else if (b.text) {
      parts.push(b.text)
    }
  }
  normalizeBlocks(blocks).forEach(visit)
  return parts.filter(Boolean).join('\n\n')
}

/** The plain-text body + optional image older broadcasts used, as blocks. */
export function legacyToBlocks({ body, imageUrl }) {
  const blocks = []
  if (body && body.trim()) blocks.push({ ...newBlock('text'), text: body.trim() })
  if (imageUrl) blocks.push({ ...newBlock('image'), url: imageUrl, src: imageUrl })
  return blocks
}

// ---------- rendering ----------

function formatDate(style, now) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: style, timeZone: 'Africa/Lagos' }).format(now)
}

function tokens(value, ctx) {
  return value
    .replaceAll('{{date_full}}', formatDate('full', ctx.now))
    .replaceAll('{{date}}', formatDate('medium', ctx.now))
    .replaceAll('{{site_url}}', ctx.siteUrl)
}

// Inline formatting on already-escaped text: **bold**, *italic*, [label](https://link), bare links.
function inline(raw, ctx, linkColor) {
  let out = escapeHtml(tokens(raw, ctx))
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  const style = `color:${linkColor};text-decoration:underline;`
  // Bare links first (skipping ones inside "(...)", which belong to a [label](url) pair), then labelled links.
  out = out.replace(/(^|[\s>(])(https:\/\/[^\s<]+)/g, (m, lead, url) => (lead === '(' ? m : `${lead}<a href="${url}" style="${style}">${url}</a>`))
  out = out.replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (_m, label, url) => `<a href="${url}" style="${style}">${label}</a>`)
  return out.replace(/\n/g, '<br>')
}

function paragraphs(raw, ctx, d, align) {
  const color = d.colors.text
  return raw
    .trim()
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map(
      (p) =>
        `<p style="margin:0 0 ${Math.round(d.sizes.body * 1.15)}px 0;font-size:${d.sizes.body}px;line-height:${d.sizes.lineHeight};color:${color};text-align:${align};">${inline(p, ctx, d.colors.link)}</p>`,
    )
    .join('\n')
}

function buttonHtml({ text: label, url, style, align, radius }, d, ctx) {
  const href = resolveLink(url, ctx.siteUrl)
  if (!href || !label) return ''
  const filled = style === 'filled'
  const bg = filled ? d.colors.buttonBg : 'transparent'
  const color = filled ? d.colors.buttonText : d.colors.buttonBg
  const border = `2px solid ${d.colors.buttonBg}`
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="${align}" style="margin:8px 0 16px 0;${align === 'center' ? 'margin-left:auto;margin-right:auto;' : ''}"><tr><td bgcolor="${filled ? d.colors.buttonBg : ''}" style="background-color:${bg};border:${border};border-radius:${radius}px;"><a href="${href}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:${color};text-decoration:none;font-family:${emailFontStack(d.fonts.body)};">${escapeHtml(tokens(label, ctx))}</a></td></tr></table>`
}

function imageHtml(b, d, ctx, innerWidth) {
  const width = Math.round((innerWidth * b.widthPct) / 100)
  const img = `<img src="${b.url}" alt="${escapeHtml(b.alt)}" width="${width}" style="display:block;width:${width}px;max-width:100%;height:auto;border:0;border-radius:${b.radius}px;" />`
  const href = resolveLink(b.link, ctx.siteUrl)
  const inner = href ? `<a href="${href}">${img}</a>` : img
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="${b.align}" style="margin:0 ${b.align === 'center' ? 'auto' : '0'} 16px ${b.align === 'right' ? 'auto' : '0'};max-width:100%;"><tr><td>${inner}</td></tr></table>`
}

function renderBlock(b, d, ctx, innerWidth) {
  switch (b.type) {
    case 'heading': {
      const size = { 1: Math.round(d.sizes.title * 0.95), 2: Math.round(d.sizes.body * 1.5), 3: Math.round(d.sizes.body * 1.2) }[b.level]
      return `<h${b.level + 1} style="margin:0 0 12px 0;font-family:${emailFontStack(d.fonts.heading)};font-size:${size}px;line-height:1.3;font-weight:700;color:${b.color || d.colors.heading};text-align:${b.align};">${inline(b.text, ctx, d.colors.link)}</h${b.level + 1}>`
    }
    case 'text':
      return paragraphs(b.text, ctx, d, b.align)
    case 'image':
      return imageHtml(b, d, ctx, innerWidth)
    case 'button':
      return buttonHtml({ ...b, radius: d.button.radius }, d, ctx)
    case 'quote': {
      const accent = b.color || d.colors.calloutBorder
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;"><tr><td style="background-color:${d.colors.calloutBg};border-left:4px solid ${accent};padding:14px 18px;border-radius:0 6px 6px 0;">${paragraphs(b.text, ctx, { ...d, sizes: { ...d.sizes } }, 'left').replace(/margin:0 0 \d+px 0/g, 'margin:0')}</td></tr></table>`
    }
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul'
      const items = b.items
        .filter((i) => i.trim())
        .map((i) => `<li style="margin:0 0 6px 0;">${inline(i, ctx, d.colors.link)}</li>`)
        .join('')
      return `<${tag} style="margin:0 0 16px 0;padding-left:22px;font-size:${d.sizes.body}px;line-height:${d.sizes.lineHeight};color:${d.colors.text};">${items}</${tag}>`
    }
    case 'divider':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px 0;"><tr><td style="border-top:1px solid ${b.color || d.colors.border};font-size:0;line-height:0;">&nbsp;</td></tr></table>`
    case 'spacer':
      return `<div style="height:${b.height}px;line-height:${b.height}px;font-size:0;">&nbsp;</div>`
    case 'columns': {
      const half = Math.floor((innerWidth - 16) / 2)
      const cell = (side, padding) =>
        `<td class="col" width="50%" valign="top" style="width:50%;padding:${padding};">${renderBlock(side, d, ctx, half)}</td>`
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;"><tr>${cell(b.left, '0 8px 0 0')}${cell(b.right, '0 0 0 8px')}</tr></table>`
    }
    default:
      return ''
  }
}

export function renderBlocksHtml(blocks, design, ctx = {}) {
  const d = normalizeDesign(design)
  const c = { siteUrl: SITE_URL, now: new Date(), ...ctx }
  const innerWidth = d.card.width - d.card.padding * 2
  return normalizeBlocks(blocks)
    .map((b) => renderBlock(b, d, c, innerWidth))
    .join('\n')
}

function wordmarkHtml(d, ctx, color) {
  const { header } = d
  let logo = ''
  if (header.logo === 'site') {
    logo = `<img src="${ctx.siteUrl}/logo.png" width="22" height="22" alt="" style="border-radius:4px;vertical-align:middle;margin-right:8px;border:0;" />`
  } else if (header.logo === 'custom' && header.logoUrl) {
    logo = `<img src="${header.logoUrl}" height="28" alt="" style="vertical-align:middle;margin-right:8px;border:0;max-height:28px;" />`
  }
  const name = header.wordmark
    ? `<span style="vertical-align:middle;">${escapeHtml(tokens(header.wordmark, ctx))}</span>`
    : ''
  return `<a href="${ctx.siteUrl}" style="font-size:19px;font-weight:700;letter-spacing:-0.02em;text-decoration:none;color:${color};font-family:${emailFontStack(d.fonts.heading)};">${logo}${name}</a>`
}

function headerHtml(d, ctx) {
  const { header, colors } = d
  const pad = d.card.padding
  const tag = header.tag
    ? `<span style="display:inline-block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${colors.tagText};background-color:${colors.tagBg};padding:4px 10px;border-radius:4px;">${escapeHtml(tokens(header.tag, ctx))}</span>`
    : ''
  const eyebrowText = header.eyebrow ? escapeHtml(tokens(header.eyebrow, ctx)) : ''
  const onBar = header.style === 'bar'
  const wordColor = onBar ? colors.headerText : colors.heading
  const ruleStyle = header.rule || header.style === 'centered' ? `border-bottom:1px solid ${colors.border};` : ''

  if (header.style === 'centered') {
    return `<tr><td align="center" style="padding:28px ${pad}px 18px ${pad}px;${ruleStyle}">${wordmarkHtml(d, ctx, wordColor)}${tag ? `<div style="margin-top:10px;">${tag}</div>` : ''}${eyebrowText ? `<div style="margin-top:6px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:${colors.muted};">${eyebrowText}</div>` : ''}</td></tr>`
  }
  const bg = onBar ? `background-color:${colors.headerBg};` : ''
  const padding = onBar ? `22px ${pad}px` : `28px ${pad}px 18px ${pad}px`
  const right = tag || (!onBar && eyebrowText ? `<span style="font-size:11px;color:${colors.muted};">${eyebrowText}</span>` : '')
  return `<tr><td style="${bg}${ruleStyle}padding:${padding};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td>${wordmarkHtml(d, ctx, wordColor)}</td><td align="right">${right}</td></tr></table></td></tr>`
}

function stripeHtml(d) {
  if (d.stripe === 'none') return ''
  const a = d.colors.stripeA
  const b = d.colors.stripeB
  if (d.stripe === 'solid') return `<tr><td style="height:6px;line-height:6px;font-size:0;background-color:${d.colors.calloutBorder};">&nbsp;</td></tr>`
  return `<tr><td style="height:6px;line-height:6px;font-size:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="50%" style="height:6px;line-height:6px;font-size:0;background-color:${a};">&nbsp;</td><td width="50%" style="height:6px;line-height:6px;font-size:0;background-color:${b};">&nbsp;</td></tr></table></td></tr>`
}

function bannerHtml(d, ctx) {
  const banner = d.header.banner
  if (!banner) return ''
  const img = `<img src="${banner.url}" alt="${escapeHtml(banner.alt)}" width="${d.card.width}" style="display:block;width:100%;max-width:${d.card.width}px;height:auto;border:0;" />`
  const href = resolveLink(banner.link, ctx.siteUrl)
  return `<tr><td style="font-size:0;line-height:0;">${href ? `<a href="${href}">${img}</a>` : img}</td></tr>`
}

function footerHtml(d, ctx) {
  const lines = d.footer.text
    .split('\n')
    .filter((l) => l.trim())
    .map((l, i) => `<div style="${i ? 'margin-top:6px;' : ''}">${inline(l, ctx, d.colors.footerText)}</div>`)
    .join('')
  const prefs = d.footer.showPrefs
    ? `<div style="margin-top:8px;"><a href="${ctx.siteUrl}/account" style="color:${d.colors.footerText};text-decoration:underline;">Manage notification preferences</a></div>`
    : ''
  if (!lines && !prefs) return ''
  const pad = d.card.padding
  return `<tr><td style="background-color:${d.colors.footerBg};border-top:1px solid ${d.colors.border};padding:22px ${pad}px 28px ${pad}px;font-size:12px;line-height:1.6;color:${d.colors.footerText};">${lines}${prefs}</td></tr>`
}

/**
 * Builds the full email. `content` is { subject, blocks, preheader? }. Returns an HTML document with
 * inline styles (the server runs it through juice for the few remaining <style> rules).
 */
export function renderEmail({ design, content, siteUrl = SITE_URL, now = new Date(), allowedHosts }) {
  const d = normalizeDesign(design, allowedHosts)
  const ctx = { siteUrl, now }
  const blocks = normalizeBlocks(content?.blocks, allowedHosts)
  const subject = text(content?.subject, 200)
  const pad = d.card.padding
  const innerWidth = d.card.width - pad * 2
  const bodyFont = emailFontStack(d.fonts.body)

  const badgeText = content?.eyebrow ? escapeHtml(text(content.eyebrow, 60)) : d.header.dateBadge && !d.header.eyebrow ? formatDate('medium', now) : ''
  const eyebrowBadge = badgeText
    ? `<div style="display:inline-block;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${d.colors.link};background-color:${d.colors.tagBg};padding:5px 10px;border-radius:4px;margin-bottom:16px;">${badgeText}</div>`
    : ''

  // A color-bar header has no room for the eyebrow, so it sits just above the title instead.
  const eyebrowRow =
    d.header.style === 'bar' && d.header.eyebrow
      ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${d.colors.link};margin-bottom:14px;text-align:${d.title.align};">${escapeHtml(tokens(d.header.eyebrow, ctx))}</div>`
      : ''

  const titleStyle = [
    `margin:0 0 ${d.divider ? 18 : 22}px 0`,
    `font-family:${emailFontStack(d.fonts.heading)}`,
    `font-size:${d.sizes.title}px`,
    'line-height:1.3',
    `font-weight:${d.title.bold ? 800 : 400}`,
    `font-style:${d.title.italic ? 'italic' : 'normal'}`,
    `text-decoration:${d.title.underline ? 'underline' : 'none'}`,
    `text-align:${d.title.align}`,
    `color:${d.title.color || d.colors.heading}`,
    'letter-spacing:-.015em',
  ].join(';')
  const title = d.title.show && subject ? `<h1 style="${titleStyle};">${escapeHtml(subject)}</h1>` : ''
  const divider = d.divider
    ? `<table role="presentation" align="${d.title.align}" cellpadding="0" cellspacing="0" style="margin:0 ${d.title.align === 'center' ? 'auto' : '0'} 24px ${d.title.align === 'right' ? 'auto' : '0'};"><tr><td style="width:48px;height:2px;line-height:2px;font-size:0;background-color:${d.colors.stripeA};">&nbsp;</td></tr></table>`
    : ''

  const body = blocks.map((b) => renderBlock(b, d, ctx, innerWidth)).join('\n')
  const wrapped = d.callout
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background-color:${d.colors.calloutBg};border-left:4px solid ${d.colors.calloutBorder};border-radius:0 8px 8px 0;padding:20px 24px;">${body}</td></tr></table>`
    : body
  const cta = d.button.show ? buttonHtml(d.button, d, ctx) : ''

  const preheader = content?.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader)}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject || d.header.wordmark)}</title>
<style>
@media (max-width:640px){.outer{padding:12px 6px !important;}.col{display:block !important;width:100% !important;padding:0 0 12px 0 !important;}}
a{color:${d.colors.link};}
</style>
</head>
<body style="margin:0;padding:0;background-color:${d.colors.page};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${d.colors.page};"><tr><td class="outer" align="center" style="padding:40px 16px;">
<table role="presentation" width="${d.card.width}" cellpadding="0" cellspacing="0" style="width:${d.card.width}px;max-width:100%;background-color:${d.colors.card};${d.card.border ? `border:1px solid ${d.colors.border};` : ''}border-radius:${d.card.radius}px;overflow:hidden;font-family:${bodyFont};color:${d.colors.text};">
${stripeHtml(d)}
${headerHtml(d, ctx)}
${bannerHtml(d, ctx)}
<tr><td style="padding:${Math.round(pad * 0.9)}px ${pad}px ${pad}px ${pad}px;font-family:${bodyFont};">
${eyebrowBadge}
${eyebrowRow}
${title}
${divider}
${wrapped}
${cta}
</td></tr>
${footerHtml(d, ctx)}
</table>
</td></tr></table>
</body>
</html>`
}

// ---------- automatic emails ----------

export function welcomeContent({ fullName }) {
  const name = (fullName || 'there').slice(0, 80)
  return {
    subject: `Welcome to the hub, ${name}.`,
    blocks: [
      {
        ...newBlock('text'),
        text: 'Welcome to **NAMMES Hub** — your official student departmental portal for the National Association of Metallurgical and Materials Engineering Students. Your account is now active, giving you access to lecture timetables, course outlines, past exam papers, and opportunity listings.',
      },
      { ...newBlock('text'), text: 'Sincerely,\n**The Aegis 2026/2027**' },
    ],
  }
}

export function newContentEmailContent({ eyebrow, title, url, imageUrl }) {
  const blocks = []
  if (imageUrl) blocks.push({ ...newBlock('image'), url: imageUrl, src: imageUrl })
  blocks.push({ ...newBlock('text'), text: 'A new update was just posted on NAMMES Hub.' })
  if (url) blocks.push({ ...newBlock('button'), text: 'Read more →', url })
  return { subject: title, preheader: eyebrow, blocks, eyebrow }
}
