import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let fontsRegistered = false
function ensureFonts() {
  if (fontsRegistered) return
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/PlayfairDisplay-Bold.ttf'), 'Playfair Display')
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/PublicSans-Regular.ttf'), 'Public Sans')
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/PublicSans-Bold.ttf'), 'Public Sans Bold')
  fontsRegistered = true
}

const WIDTH = 1080
const HEIGHT = 1350
const GREEN = '#0b2417'
const GREEN_DEEP = '#071a10'
const ORANGE = '#ff5a1f'
const ORANGE_DARK = '#ae3200'
const GOLD = '#e9b64f'
const GOLD_LIGHT = '#f7dfa0'

function drawHexLattice(ctx, x, y, w, h, flipX, flipY) {
  ctx.save()
  ctx.translate(x + (flipX ? w : 0), y + (flipY ? h : 0))
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
  ctx.strokeStyle = GOLD
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 1.2
  const hexW = 34
  const hexH = 30
  for (let row = 0; row * hexH < h; row++) {
    for (let col = 0; col * hexW < w; col++) {
      const cx = col * hexW + (row % 2 ? hexW / 2 : 0)
      const cy = row * hexH
      const dist = Math.sqrt(cx * cx + cy * cy) / Math.sqrt(w * w + h * h)
      ctx.globalAlpha = Math.max(0, 0.35 * (1 - dist * 1.8))
      if (ctx.globalAlpha <= 0) continue
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i
        const px = cx + 16 * Math.cos(angle)
        const py = cy + 16 * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
    }
  }
  ctx.restore()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawPhotoFrame(ctx, cx, topY, isWinner, photoImage) {
  const frameW = 560
  const frameH = 675
  const x = cx - frameW / 2
  const outerPad = isWinner ? 20 : 15
  const radius = 26

  ctx.save()
  if (isWinner) {
    const glow = ctx.createRadialGradient(cx, topY + frameH / 2, frameH * 0.2, cx, topY + frameH / 2, frameH * 0.9)
    glow.addColorStop(0, 'rgba(233,182,79,0.35)')
    glow.addColorStop(1, 'rgba(233,182,79,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  const grad = ctx.createLinearGradient(x, topY, x + frameW, topY + frameH)
  if (isWinner) {
    grad.addColorStop(0, GOLD_LIGHT)
    grad.addColorStop(0.45, GOLD)
    grad.addColorStop(1, '#a9781f')
  } else {
    grad.addColorStop(0, ORANGE)
    grad.addColorStop(0.45, '#ffb066')
    grad.addColorStop(1, ORANGE_DARK)
  }
  ctx.fillStyle = grad
  roundRect(ctx, x, topY, frameW, frameH, radius)
  ctx.fill()

  const innerX = x + outerPad
  const innerY = topY + outerPad
  const innerW = frameW - outerPad * 2
  const innerH = frameH - outerPad * 2
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  roundRect(ctx, innerX, innerY, innerW, innerH, radius - 8)
  ctx.fill()

  const photoPad = 8
  const photoX = innerX + photoPad
  const photoY = innerY + photoPad
  const photoW = innerW - photoPad * 2
  const photoH = innerH - photoPad * 2
  ctx.save()
  roundRect(ctx, photoX, photoY, photoW, photoH, radius - 14)
  ctx.clip()
  if (photoImage) {
    const scale = Math.max(photoW / photoImage.width, photoH / photoImage.height)
    const drawW = photoImage.width * scale
    const drawH = photoImage.height * scale
    ctx.drawImage(photoImage, photoX - (drawW - photoW) / 2, photoY - (drawH - photoH) / 2, drawW, drawH)
  } else {
    ctx.fillStyle = '#8b98a1'
    ctx.fillRect(photoX, photoY, photoW, photoH)
  }
  ctx.restore()
  ctx.restore()

  return { x, y: topY, w: frameW, h: frameH }
}

function drawRibbon(ctx, cx, y, isWinner) {
  const text = isWinner ? 'WINNER' : 'VOTE'
  ctx.save()
  ctx.translate(cx - 220, y - 20)
  ctx.rotate((-8 * Math.PI) / 180)
  ctx.font = 'bold 30px "Public Sans Bold"'
  const paddingX = 24
  const textWidth = ctx.measureText(text).width
  const boxW = textWidth + paddingX * 2
  const boxH = 56
  if (isWinner) {
    const grad = ctx.createLinearGradient(0, 0, boxW, boxH)
    grad.addColorStop(0, GOLD_LIGHT)
    grad.addColorStop(0.6, GOLD)
    grad.addColorStop(1, '#c98f2c')
    ctx.fillStyle = grad
  } else {
    ctx.fillStyle = ORANGE
  }
  roundRect(ctx, 0, 0, boxW, boxH, 6)
  ctx.fill()
  ctx.fillStyle = isWinner ? '#3a2a06' : '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, paddingX, boxH / 2 + 2)
  ctx.restore()
}

function drawLaurel(ctx, cx, y, side) {
  const dir = side === 'left' ? -1 : 1
  const baseX = cx + dir * (280 + 30)
  ctx.save()
  ctx.strokeStyle = GOLD
  ctx.fillStyle = GOLD
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(baseX, y - 100)
  ctx.quadraticCurveTo(baseX + dir * 60, y, baseX, y + 100)
  ctx.stroke()
  for (const t of [-70, -40, -10, 20, 55, 85]) {
    const lx = baseX + dir * (t < 0 ? -t * 0.15 : t * 0.1) + dir * 20
    const ly = y + t
    ctx.beginPath()
    ctx.ellipse(lx, ly, 16, 8, dir * 0.6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export async function renderAwardCard({ variant, name, categoryTitle, seasonTitle, photoBuffer }) {
  ensureFonts()
  const isWinner = variant === 'winner'
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  const bg = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 1.1, HEIGHT * 0.2, WIDTH / 2, HEIGHT * 1.1, HEIGHT * 1.1)
  bg.addColorStop(0, GREEN_DEEP)
  bg.addColorStop(1, GREEN)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const latticeSize = 380
  drawHexLattice(ctx, 0, 0, latticeSize, latticeSize, false, false)
  drawHexLattice(ctx, WIDTH - latticeSize, 0, latticeSize, latticeSize, true, false)
  drawHexLattice(ctx, 0, HEIGHT - latticeSize, latticeSize, latticeSize, false, true)
  drawHexLattice(ctx, WIDTH - latticeSize, HEIGHT - latticeSize, latticeSize, latticeSize, true, true)

  ctx.textAlign = 'center'
  ctx.fillStyle = ORANGE
  ctx.font = 'bold 22px "Public Sans Bold"'
  ctx.fillText('NAMMES HUB', WIDTH / 2, 90)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '18px "Public Sans"'
  ctx.fillText(seasonTitle, WIDTH / 2, 118)

  const photoImage = photoBuffer ? await loadImage(photoBuffer) : null
  const frameTopY = 165
  const frame = drawPhotoFrame(ctx, WIDTH / 2, frameTopY, isWinner, photoImage)

  drawRibbon(ctx, WIDTH / 2, frame.y - 10, isWinner)
  if (isWinner) {
    drawLaurel(ctx, WIDTH / 2, frame.y + frame.h / 2, 'left')
    drawLaurel(ctx, WIDTH / 2, frame.y + frame.h / 2, 'right')
  }

  const nameY = frame.y + frame.h + 70
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 56px "Playfair Display"'
  if (isWinner) {
    ctx.shadowColor = 'rgba(233,182,79,0.55)'
    ctx.shadowBlur = 24
  }
  ctx.fillText(name, WIDTH / 2, nameY)
  ctx.shadowBlur = 0

  ctx.fillStyle = isWinner ? GOLD : ORANGE
  ctx.font = 'bold 24px "Public Sans Bold"'
  ctx.fillText(categoryTitle.toUpperCase(), WIDTH / 2, nameY + 46)

  const footerY = HEIGHT - 60
  ctx.strokeStyle = isWinner ? GOLD : ORANGE
  ctx.globalAlpha = 0.6
  ctx.beginPath()
  ctx.moveTo(WIDTH / 2 - 150, footerY - 20)
  ctx.lineTo(WIDTH / 2 + 150, footerY - 20)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '16px "Public Sans"'
  ctx.fillText('nammeshub.com/awards', WIDTH / 2, footerY)

  return canvas.toBuffer('image/png')
}
