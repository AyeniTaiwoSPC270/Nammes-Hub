import QRCode from 'qrcode'

// The three assets an admin needs to put the follow page in front of students: a vector code for print, a
// large PNG for a slide, and a square card for a WhatsApp group. All three encode the same URL, so a
// reprint is never needed when a social handle changes -- only the page behind the code changes.
//
// Drawing lives here rather than in the admin page for the same reason the quiz card renderers are separate
// modules: the file is unchanged by a restyle of the screen that triggers it.

const CARD_SIZE = 1080

// Read off the design tokens in src/index.css. A canvas cannot use a CSS variable, and these are the two
// colours the poster is made of.
const GREEN_900 = '#0b2417'
const ORANGE_500 = '#ff5a1f'
const WHITE = '#ffffff'

export function qrPngDataUrl(text, width = 1024) {
  // Error correction M is the usual poster trade-off: a code that still reads after a thumbprint or a
  // slightly matte print, without the density H adds to a long URL.
  return QRCode.toDataURL(text, { width, margin: 2, errorCorrectionLevel: 'M' })
}

export function qrSvgText(text) {
  return QRCode.toString(text, { type: 'svg', margin: 4, errorCorrectionLevel: 'M' })
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null)
      return
    }
    const image = new Image()
    image.onload = () => resolve(image)
    // A missing logo must not cost the admin the whole card.
    image.onerror = () => resolve(null)
    image.src = src
  })
}

function roundRect(ctx, x, y, width, height, radius) {
  // roundRect is recent enough that a fallback is worth the eight lines: an older browser would throw
  // mid-draw and download a blank square.
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, radius)
    return
  }
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let value = text
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1)
  }
  return `${value}…`
}

// A square card: the code, the brand and the address written out, so somebody who cannot scan it can still
// type it. Rendered at 1080px, which is what WhatsApp stops downscaling.
export async function renderFollowCard(url) {
  if (typeof document === 'undefined') throw new Error('A card can only be drawn in the browser.')

  const canvas = document.createElement('canvas')
  canvas.width = CARD_SIZE
  canvas.height = CARD_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser could not draw the card.')

  const [qr, logo] = await Promise.all([qrPngDataUrl(url, 1000), loadImage('/logo-small.png')])
  const qrImage = await loadImage(qr)

  ctx.fillStyle = GREEN_900
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE)

  ctx.fillStyle = ORANGE_500
  ctx.fillRect(0, 0, CARD_SIZE, 12)

  const fontStack = 'system-ui, -apple-system, "Segoe UI", sans-serif'

  if (logo) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(136, 140, 48, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(logo, 88, 92, 96, 96)
    ctx.restore()
  }

  ctx.fillStyle = WHITE
  ctx.textAlign = 'center'
  ctx.font = `800 82px ${fontStack}`
  ctx.fillText('Follow NAMMES', CARD_SIZE / 2, 292)

  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = `400 34px ${fontStack}`
  ctx.fillText('Socials, newsletter and the Hub', CARD_SIZE / 2, 348)

  ctx.fillStyle = WHITE
  roundRect(ctx, 250, 390, 580, 580, 36)
  ctx.fill()

  if (qrImage) {
    ctx.drawImage(qrImage, 290, 430, 500, 500)
  }

  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  ctx.font = `600 30px ${fontStack}`
  const address = url.replace(/^https?:\/\//i, '').replace(/\?.*$/, '')
  ctx.fillText(fitText(ctx, address, 900), CARD_SIZE / 2, 1032)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The card could not be exported.'))
    }, 'image/png')
  })
}
