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

export const WIDTH = 1080
export const HEIGHT = 1350

const WHITE = '#ffffff'
const CREAM = '#f6f1e4'
const INK = '#0c4a24'

const COLS = 5
const ROWS = 2
const MARGIN_X = 56
const COL_GAP = 18
const COL_W = (WIDTH - MARGIN_X * 2 - COL_GAP * (COLS - 1)) / COLS
const PANEL_H = 208
const TEXT_BLOCK_H = 66
const ROW_GAP = 26
const GRID_TOP = 392

const ICON_CYCLE = ['grid', 'calculator', 'book', 'calendar', 'events', 'briefcase', 'megaphone', 'grid', 'calculator', 'book']

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function roundRect(ctx, x, y, w, h, r) {
  const tl = typeof r === 'number' ? { tl: r, tr: r, br: r, bl: r } : r
  ctx.beginPath()
  ctx.moveTo(x + tl.tl, y)
  ctx.lineTo(x + w - tl.tr, y)
  ctx.arcTo(x + w, y, x + w, y + tl.tr, tl.tr)
  ctx.lineTo(x + w, y + h - tl.br)
  ctx.arcTo(x + w, y + h, x + w - tl.br, y + h, tl.br)
  ctx.lineTo(x + tl.bl, y + h)
  ctx.arcTo(x, y + h, x, y + h - tl.bl, tl.bl)
  ctx.lineTo(x, y + tl.tl)
  ctx.arcTo(x, y, x + tl.tl, y, tl.tl)
  ctx.closePath()
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

function drawShadowedHeadline(ctx, lines, cx, startY, fontSize, lineHeight, colors, shadow) {
  ctx.font = `${fontSize}px "Anton"`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  lines.forEach((line, i) => {
    const y = startY + i * lineHeight
    ctx.fillStyle = shadow
    ctx.fillText(line, cx + fontSize * 0.045, y + fontSize * 0.045)
    ctx.fillStyle = colors[i] ?? colors[colors.length - 1]
    ctx.fillText(line, cx, y)
  })
}

// Cover-fit crop, favoring the top of the source image (matches the app's object-top avatars).
function coverFitRect(imgW, imgH, targetW, targetH) {
  const scale = Math.max(targetW / imgW, targetH / imgH)
  const dw = imgW * scale
  const dh = imgH * scale
  const dx = (targetW - dw) / 2
  const dy = 0
  return { dw, dh, dx, dy }
}

// Fetches + decodes each exec's photo once and reduces it to a luminance map at a fixed
// target size, so every variant can re-tint it into a different duotone without re-fetching.
export async function preloadExecPhotos(execs, targetW, targetH) {
  const w = Math.round(targetW)
  const h = Math.round(targetH)
  const results = []
  for (const exec of execs) {
    const res = await fetch(exec.photoUrl)
    const buf = Buffer.from(await res.arrayBuffer())
    const img = await loadImage(buf)
    const canvas = createCanvas(w, h)
    const ctx = canvas.getContext('2d')
    const { dw, dh, dx, dy } = coverFitRect(img.width, img.height, w, h)
    ctx.drawImage(img, dx, dy, dw, dh)
    const { data } = ctx.getImageData(0, 0, w, h)
    const luminance = new Uint8ClampedArray(w * h)
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      luminance[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    }
    results.push({ width: w, height: h, luminance })
  }
  return results
}

function duotoneCanvas(photo, darkHex, lightHex) {
  const [dr, dg, db] = hexToRgb(darkHex)
  const [lr, lg, lb] = hexToRgb(lightHex)
  const canvas = createCanvas(photo.width, photo.height)
  const ctx = canvas.getContext('2d')
  const imageData = ctx.createImageData(photo.width, photo.height)
  const out = imageData.data
  for (let p = 0, i = 0; p < photo.luminance.length; p++, i += 4) {
    const t = photo.luminance[p] / 255
    out[i] = dr + t * (lr - dr)
    out[i + 1] = dg + t * (lg - dg)
    out[i + 2] = db + t * (lb - db)
    out[i + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
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
    ctx.fillStyle = INK
    ctx.font = `700 ${size * 0.55}px "Poppins Bold"`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('in', cx, cy + size * 0.04)
  }
  ctx.restore()
}

/**
 * @param {object} variant - see executives.config.mjs for the shape
 * @param {Array} execs - [{ name, role, photoUrl }]
 * @param {Array} preloadedPhotos - output of preloadExecPhotos(execs, ...), same order as execs
 */
export async function renderExecutivesFlyer(variant, execs, preloadedPhotos) {
  ensureFonts()
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  // Background
  if (variant.bg === 'split') {
    const splitY = variant.splitY
    const bg = ctx.createLinearGradient(0, 0, 0, splitY)
    bg.addColorStop(0, variant.colors.bgTop[0])
    bg.addColorStop(1, variant.colors.bgTop[1])
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, WIDTH, splitY)
    ctx.fillStyle = variant.colors.bgBottom
    ctx.fillRect(0, splitY, WIDTH, HEIGHT - splitY)
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT)
    bg.addColorStop(0, variant.colors.bgTop[0])
    bg.addColorStop(1, variant.colors.bgTop[1])
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  drawGearWatermark(ctx, -60, 130, 260, 14, variant.colors.watermark, 1)
  drawGearWatermark(ctx, WIDTH + 60, HEIGHT - 220, 300, 16, variant.colors.watermark, 1)

  // Masthead: crest + wordmark (left), social handles (right)
  const logo = await loadImage(path.join(__dirname, '..', '..', 'public', 'logo.png'))
  const logoH = 72
  const logoW = (logo.width / logo.height) * logoH
  ctx.drawImage(logo, MARGIN_X, 46, logoW, logoH)

  ctx.textAlign = 'left'
  ctx.fillStyle = variant.colors.headerText
  ctx.font = '800 27px "Poppins ExtraBold"'
  ctx.fillText('NAMMES', MARGIN_X + logoW + 16, 78)
  ctx.font = '700 20px "Poppins SemiBold"'
  ctx.fillText('ENGINEERING SOCIETY', MARGIN_X + logoW + 16, 102)

  const socialRows = [
    ['instagram', '@unilag_nammes'],
    ['x', '@unilag_nammes'],
    ['linkedin', 'UNILAG NAMMES'],
  ]
  ctx.font = '600 17px "Poppins SemiBold"'
  socialRows.forEach(([kind, label], i) => {
    const y = 56 + i * 26
    const w = ctx.measureText(label).width
    const iconSize = 18
    const rightX = WIDTH - MARGIN_X
    drawSocialIcon(ctx, kind, rightX - w - iconSize - 8, y, iconSize, variant.colors.headerText)
    ctx.fillStyle = variant.colors.headerText
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, rightX, y + 1)
  })

  // Headline
  ctx.textBaseline = 'alphabetic'
  drawShadowedHeadline(
    ctx,
    ['MEET YOUR', 'EXECUTIVES'],
    WIDTH / 2,
    220,
    86,
    88,
    [variant.colors.headline1, variant.colors.headline2],
    'rgba(0,0,0,0.28)'
  )

  // Exec grid
  for (let i = 0; i < execs.length; i++) {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const panelX = MARGIN_X + col * (COL_W + COL_GAP)
    const rowTop = GRID_TOP + row * (PANEL_H + TEXT_BLOCK_H + ROW_GAP)
    const panelY = rowTop

    const cardRadius = variant.cardRadius ?? 18

    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = 16
    ctx.shadowOffsetY = 6
    ctx.fillStyle = variant.panelColor(col, row)
    roundRect(ctx, panelX, panelY, COL_W, PANEL_H, cardRadius)
    ctx.fill()
    ctx.restore()

    // Faint icon watermark behind the photo
    const iconFn = ICONS[ICON_CYCLE[i]]
    if (iconFn) {
      ctx.save()
      ctx.globalAlpha = variant.iconWatermarkAlpha
      roundRect(ctx, panelX, panelY, COL_W, PANEL_H, cardRadius)
      ctx.clip()
      iconFn(ctx, panelX + COL_W / 2, panelY + PANEL_H * 0.32, COL_W * 0.95, WHITE)
      ctx.restore()
    }

    // Duotone photo, framed with a visible mat on top/sides, flush at the bottom
    const inset = 9
    const photoX = panelX + inset
    const photoY = panelY + inset
    const photoW = COL_W - inset * 2
    const photoH = PANEL_H - inset
    const [dark, light] = variant.duotone(col, row)
    const tinted = duotoneCanvas(preloadedPhotos[i], dark, light)
    ctx.save()
    roundRect(ctx, photoX, photoY, photoW, photoH, {
      tl: cardRadius * 0.67,
      tr: cardRadius * 0.67,
      br: cardRadius * 0.22,
      bl: cardRadius * 0.22,
    })
    ctx.clip()
    ctx.drawImage(tinted, photoX, photoY, photoW, photoH)
    ctx.restore()

    // Name + role
    const textColor = variant.nameColor(row)
    const roleColor = variant.roleColor(row)
    const textCx = panelX + COL_W / 2
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = textColor
    ctx.font = '700 15px "Poppins Bold"'
    wrapCenteredText(ctx, exec_name(execs[i]), textCx, rowTop + PANEL_H + 24, COL_W + 10, 17)
    ctx.fillStyle = roleColor
    ctx.font = '600 12px "Poppins SemiBold"'
    wrapCenteredText(ctx, execs[i].role, textCx, rowTop + PANEL_H + 48, COL_W + 14, 14)
  }

  // Footer
  const footerY = GRID_TOP + ROWS * PANEL_H + (ROWS - 1) * (TEXT_BLOCK_H + ROW_GAP) + TEXT_BLOCK_H + 46
  ctx.strokeStyle = variant.colors.divider
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(WIDTH / 2 - 340, footerY)
  ctx.lineTo(WIDTH / 2 + 340, footerY)
  ctx.stroke()

  const medallionCY = footerY + 78
  const medallionR = 46
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 20
  ctx.shadowOffsetY = 8
  const grad = ctx.createLinearGradient(WIDTH / 2 - medallionR, medallionCY - medallionR, WIDTH / 2 + medallionR, medallionCY + medallionR)
  grad.addColorStop(0, variant.colors.medallion[0])
  grad.addColorStop(1, variant.colors.medallion[1])
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(WIDTH / 2, medallionCY, medallionR, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  const footerIconFn = ICONS[variant.footerIcon]
  if (footerIconFn) footerIconFn(ctx, WIDTH / 2, medallionCY, medallionR * 1.05, WHITE)

  ctx.fillStyle = variant.colors.footerText
  ctx.font = '800 34px "Anton"'
  ctx.textAlign = 'center'
  drawSpacedText(ctx, "THE AEGIS '26/27", WIDTH / 2, medallionCY + medallionR + 52, 3)

  ctx.fillStyle = variant.colors.footerSubtext
  ctx.font = '600 18px "Poppins SemiBold"'
  drawSpacedText(ctx, 'EXECUTIVE COUNCIL', WIDTH / 2, medallionCY + medallionR + 82, 3)

  return canvas.toBuffer('image/png')
}

function exec_name(exec) {
  return exec.name.toUpperCase()
}

function wrapCenteredText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.toUpperCase().split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  const startY = y - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, i) => ctx.fillText(line, cx, startY + i * lineHeight))
}

export { CREAM, INK, WHITE }
