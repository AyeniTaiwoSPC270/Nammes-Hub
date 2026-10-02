import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ICONS } from './icons.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let fontsRegistered = false
function ensureFonts() {
  if (fontsRegistered) return
  const dir = path.join(__dirname, 'fonts')
  GlobalFonts.registerFromPath(path.join(dir, 'Anton-Regular.ttf'), 'Anton')
  GlobalFonts.registerFromPath(path.join(dir, 'Poppins-Regular.ttf'), 'Poppins')
  GlobalFonts.registerFromPath(path.join(dir, 'Poppins-Medium.ttf'), 'Poppins Medium')
  GlobalFonts.registerFromPath(path.join(dir, 'Poppins-SemiBold.ttf'), 'Poppins SemiBold')
  GlobalFonts.registerFromPath(path.join(dir, 'Poppins-Bold.ttf'), 'Poppins Bold')
  GlobalFonts.registerFromPath(path.join(dir, 'Poppins-ExtraBold.ttf'), 'Poppins ExtraBold')
  fontsRegistered = true
}

const WIDTH = 1080
const HEIGHT = 1350

const GREEN = '#0c4a24'
const GREEN_DEEP = '#062a14'
const GREEN_LINE = 'rgba(255,255,255,0.05)'
const ORANGE = '#f5821f'
const ORANGE_DARK = '#c2590a'
const GOLD = '#f4c430'
const GOLD_DEEP = '#caa000'
const WHITE = '#ffffff'
const INK = '#0c4a24'

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// mulberry32 — deterministic PRNG so the torn-paper edge is stable across renders
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function drawGearWatermark(ctx, cx, cy, radius, teeth, color, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = radius * 0.05
  ctx.beginPath()
  ctx.arc(cx, cy, radius * 0.78, 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < teeth; i++) {
    const angle = (Math.PI * 2 * i) / teeth
    const x1 = cx + Math.cos(angle) * radius * 0.78
    const y1 = cy + Math.sin(angle) * radius * 0.78
    const x2 = cx + Math.cos(angle) * radius
    const y2 = cy + Math.sin(angle) * radius
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.restore()
}

function drawSpacedText(ctx, text, cx, y, spacing) {
  const chars = text.split('')
  const widths = chars.map((c) => ctx.measureText(c).width)
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
  let x = cx - total / 2
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x + widths[i] / 2, y)
    x += widths[i] + spacing
  }
}

function drawShadowedHeadline(ctx, lines, cx, startY, fontSize, lineHeight, fill, shadow) {
  ctx.font = `${fontSize}px "Anton"`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  lines.forEach((line, i) => {
    const y = startY + i * lineHeight
    ctx.fillStyle = shadow
    ctx.fillText(line, cx + fontSize * 0.045, y + fontSize * 0.045)
    ctx.fillStyle = fill
    ctx.fillText(line, cx, y)
  })
}

function drawTornEdge(ctx, baseY, width, height, seed) {
  const rand = mulberry32(seed)
  const step = 22
  const points = []
  for (let x = 0; x <= width; x += step) {
    const jitter = (rand() - 0.5) * 26
    points.push([x, baseY + jitter])
  }
  points.push([width, height])
  points.push([0, height])

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 22
  ctx.shadowOffsetY = -6
  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  points.slice(1, -2).forEach(([x, y]) => ctx.lineTo(x, y))
  ctx.lineTo(width, height)
  ctx.lineTo(0, height)
  ctx.closePath()
  ctx.fillStyle = WHITE
  ctx.fill()
  ctx.restore()
}

function drawCheckRow(ctx, text, x, y, fontSize) {
  const r = fontSize * 0.62
  ctx.fillStyle = GREEN
  ctx.beginPath()
  ctx.arc(x + r, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = WHITE
  ctx.lineWidth = fontSize * 0.14
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x + r * 0.55, y)
  ctx.lineTo(x + r * 0.9, y + r * 0.35)
  ctx.lineTo(x + r * 1.5, y - r * 0.4)
  ctx.stroke()

  ctx.fillStyle = INK
  ctx.font = `600 ${fontSize}px "Poppins SemiBold"`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + r * 2.4, y + fontSize * 0.05)
}

function drawSocialIcon(ctx, kind, cx, cy, size, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = size * 0.09
  if (kind === 'instagram') {
    roundRect(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.28)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, size * 0.24, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx + size * 0.3, cy - size * 0.3, size * 0.05, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 'x') {
    ctx.lineWidth = size * 0.11
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(cx - size * 0.32, cy - size * 0.32)
    ctx.lineTo(cx + size * 0.32, cy + size * 0.32)
    ctx.moveTo(cx + size * 0.32, cy - size * 0.32)
    ctx.lineTo(cx - size * 0.32, cy + size * 0.32)
    ctx.stroke()
  } else if (kind === 'linkedin') {
    roundRect(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.18)
    ctx.fill()
    ctx.fillStyle = GREEN
    ctx.font = `700 ${size * 0.55}px "Poppins Bold"`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('in', cx, cy + size * 0.04)
  }
  ctx.restore()
}

export async function renderFlyer(config) {
  ensureFonts()
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  bg.addColorStop(0, GREEN)
  bg.addColorStop(1, GREEN_DEEP)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Faint gear watermarks (echoes the department's engineering motif, kept subtle)
  drawGearWatermark(ctx, -60, 120, 260, 14, GREEN_LINE, 1)
  drawGearWatermark(ctx, WIDTH + 60, HEIGHT - 260, 300, 16, GREEN_LINE, 1)

  // Masthead: real crest + org name
  const logo = await loadImage(path.join(__dirname, '..', '..', 'public', 'logo.png'))
  const logoH = 138
  const logoW = (logo.width / logo.height) * logoH
  ctx.drawImage(logo, WIDTH / 2 - logoW / 2, 46, logoW, logoH)

  ctx.fillStyle = WHITE
  ctx.font = '800 34px "Poppins ExtraBold"'
  ctx.textAlign = 'center'
  drawSpacedText(ctx, 'NAMMES HUB', WIDTH / 2, 216, 2)

  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = '600 19px "Poppins SemiBold"'
  drawSpacedText(ctx, 'UNILAG CHAPTER', WIDTH / 2, 246, 3)

  // Headline
  const headlineFontSize = config.headlineFontSize ?? 92
  const headlineLineHeight = headlineFontSize * 1.02
  drawShadowedHeadline(
    ctx,
    config.headline,
    WIDTH / 2,
    330,
    headlineFontSize,
    headlineLineHeight,
    WHITE,
    'rgba(0,0,0,0.28)'
  )
  const headlineBottom = 330 + (config.headline.length - 1) * headlineLineHeight

  // Subheadline
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.font = '500 30px "Poppins Medium"'
  ctx.textAlign = 'center'
  const subY = headlineBottom + 56
  config.subheadline.forEach((line, i) => {
    ctx.fillText(line, WIDTH / 2, subY + i * 38)
  })
  const subBottom = subY + (config.subheadline.length - 1) * 38

  // Icon medallion
  const medallionCY = subBottom + 190
  const medallionR = 170
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 18
  const grad = ctx.createLinearGradient(
    WIDTH / 2 - medallionR,
    medallionCY - medallionR,
    WIDTH / 2 + medallionR,
    medallionCY + medallionR
  )
  grad.addColorStop(0, GOLD)
  grad.addColorStop(1, ORANGE)
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(WIDTH / 2, medallionCY, medallionR, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(WIDTH / 2, medallionCY, medallionR - 10, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  const iconFn = ICONS[config.icon]
  if (iconFn) iconFn(ctx, WIDTH / 2, medallionCY, medallionR * 1.05, WHITE)

  // Feature bullet card
  const cardW = 700
  const cardX = WIDTH / 2 - cardW / 2
  const rowH = 54
  const cardPadY = 38
  const cardH = cardPadY * 2 + rowH * config.bullets.length
  const cardY = medallionCY + medallionR + 56

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = 20
  ctx.shadowOffsetY = 8
  ctx.fillStyle = 'rgba(255,255,255,0.96)'
  roundRect(ctx, cardX, cardY, cardW, cardH, 24)
  ctx.fill()
  ctx.restore()

  config.bullets.forEach((text, i) => {
    drawCheckRow(ctx, text, cardX + 34, cardY + cardPadY + rowH * i + rowH / 2, 24)
  })

  // Torn paper transition
  const tornBaseY = cardY + cardH + 70
  drawTornEdge(ctx, tornBaseY, WIDTH, HEIGHT, config.seed ?? 7)

  // CTA pill
  const ctaW = 620
  const ctaH = 84
  const ctaX = WIDTH / 2 - ctaW / 2
  const ctaY = tornBaseY + 60
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 8
  const ctaGrad = ctx.createLinearGradient(ctaX, ctaY, ctaX + ctaW, ctaY)
  ctaGrad.addColorStop(0, ORANGE)
  ctaGrad.addColorStop(1, ORANGE_DARK)
  ctx.fillStyle = ctaGrad
  roundRect(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = WHITE
  ctx.font = '700 30px "Poppins Bold"'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(config.cta, WIDTH / 2, ctaY + ctaH / 2 + 2)

  // Social row
  const socialY = ctaY + ctaH + 70
  const items = [
    ['instagram', '@unilag_nammes'],
    ['x', '@unilag_nammes'],
    ['linkedin', 'UNILAG NAMMES'],
  ]
  ctx.font = '600 22px "Poppins SemiBold"'
  const widths = items.map(([, label]) => ctx.measureText(label).width)
  const iconSize = 26
  const gapAfterIcon = 10
  const gapBetween = 34
  const segWidths = widths.map((w) => iconSize + gapAfterIcon + w)
  const totalW = segWidths.reduce((a, b) => a + b, 0) + gapBetween * (items.length - 1)
  let x = WIDTH / 2 - totalW / 2
  items.forEach(([kind, label], i) => {
    drawSocialIcon(ctx, kind, x + iconSize / 2, socialY, iconSize, INK)
    ctx.fillStyle = INK
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x + iconSize + gapAfterIcon, socialY + 1)
    x += segWidths[i] + gapBetween
  })

  return canvas.toBuffer('image/png')
}

export { WIDTH, HEIGHT }
