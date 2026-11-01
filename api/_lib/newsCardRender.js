import { createCanvas, loadImage } from '@napi-rs/canvas'
import { ensureFonts } from './fonts.js'

// The 1200x630 Open Graph card for a news article. Server-only, like quizCardRender and
// awardCardRender: a Vercel function cannot draw through React, and the picture a WhatsApp
// thumbnail shows has to be the same picture on every fetch.
//
// Spec: docs/superpowers/specs/2026-10-31-news-slugs-share-preview-design.md
//
// The buffers are fetched by the caller rather than in here, so this module does no I/O beyond
// drawing: a test hands it an empty Buffer and gets a card back.

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

const MARGIN = 72
const TITLE_SIZE = 60
const MAX_TITLE_LINES = 3
const BRAND = '#ea580c'
const INK = '#ffffff'

// Solid enough that white text is legible over any photograph an admin has uploaded, including a
// bright one. Drawn as two stops rather than a flat fill so the card keeps some depth.
const SCRIM_TOP = 'rgba(9, 12, 22, 0.92)'
const SCRIM_BOTTOM = 'rgba(9, 12, 22, 0.55)'

const FALLBACK_TOP = '#111827'
const FALLBACK_BOTTOM = '#9a3412'

/** Break text into at most `maxLines` lines that fit `maxWidth`, with an ellipsis when it is cut. */
export function wrapTitle(ctx, text, maxWidth, maxLines = MAX_TITLE_LINES) {
  const words = String(text ?? '')
    .split(/\s+/)
    .filter(Boolean)
  const lines = []
  let line = ''
  let overflowed = false

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    line = word
    if (lines.length >= maxLines) {
      overflowed = true
      break
    }
    if (ctx.measureText(line).width > maxWidth) {
      // A single word longer than the whole column: hard-break it rather than overflow the card.
      let chunk = ''
      for (const char of word) {
        if (ctx.measureText(chunk + char).width > maxWidth) {
          lines.push(chunk)
          chunk = char
          if (lines.length >= maxLines) {
            overflowed = true
            break
          }
        } else {
          chunk += char
        }
      }
      line = chunk
    }
    if (overflowed) break
  }

  if (overflowed) {
    // Re-measure rather than assume the ellipsis is no wider than the character it replaces: in
    // Public Sans it is not, and a line one pixel over the column is a line that clips.
    let last = lines[maxLines - 1] ?? ''
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
    lines[maxLines - 1] = `${last}…`
    return lines.slice(0, maxLines)
  }
  if (line) lines.push(line)
  return lines.slice(0, maxLines)
}

/**
 * Draw the card and return a PNG buffer.
 *
 * `imageBuffer` is the article's own photo (already fetched by the caller) and `logoBuffer` the
 * Hub mark; either may be null, and the card must still be worth pasting into a chat -- a missing
 * photo becomes the Hub gradient, a missing logo becomes the wordmark in text.
 */
export async function renderNewsCard({ title, imageBuffer = null, logoBuffer = null } = {}) {
  ensureFonts()
  const canvas = createCanvas(OG_WIDTH, OG_HEIGHT)
  const ctx = canvas.getContext('2d')

  const gradient = ctx.createLinearGradient(0, 0, OG_WIDTH, OG_HEIGHT)
  gradient.addColorStop(0, FALLBACK_TOP)
  gradient.addColorStop(1, FALLBACK_BOTTOM)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT)

  if (imageBuffer) {
    try {
      const photo = await loadImage(imageBuffer)
      // Cover, not contain: a portrait photo letterboxed onto the card would leave bands of the
      // gradient showing on both sides, which reads as a rendering fault rather than a design.
      const scale = Math.max(OG_WIDTH / photo.width, OG_HEIGHT / photo.height)
      const width = photo.width * scale
      const height = photo.height * scale
      ctx.drawImage(photo, (OG_WIDTH - width) / 2, (OG_HEIGHT - height) / 2, width, height)
    } catch {
      // A truncated or unreadable upload falls back to the gradient already drawn beneath it.
    }
  }

  const scrim = ctx.createLinearGradient(0, 0, 0, OG_HEIGHT)
  scrim.addColorStop(0, SCRIM_TOP)
  scrim.addColorStop(1, SCRIM_BOTTOM)
  ctx.fillStyle = scrim
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT)

  // Brand mark, top left: the logo when it loads, the wordmark when it does not.
  let markHeight = 64
  if (logoBuffer) {
    try {
      const logo = await loadImage(logoBuffer)
      markHeight = 64
      const markWidth = (logo.width / logo.height) * markHeight
      ctx.drawImage(logo, MARGIN, MARGIN, markWidth, markHeight)
    } catch {
      drawWordmark(ctx)
    }
  } else {
    drawWordmark(ctx)
  }

  // Accent rule above the title: the one piece of colour that says "this is a Hub card" even when
  // the photograph behind it is monochrome.
  ctx.fillStyle = BRAND
  ctx.fillRect(MARGIN, OG_HEIGHT - MARGIN - 340, 96, 8)

  ctx.fillStyle = INK
  ctx.font = `bold ${TITLE_SIZE}px "Public Sans"`
  ctx.textBaseline = 'top'
  const lines = wrapTitle(ctx, title, OG_WIDTH - MARGIN * 2)
  lines.forEach((line, index) => {
    ctx.fillText(line, MARGIN, OG_HEIGHT - MARGIN - 300 + index * (TITLE_SIZE + 14))
  })

  return canvas.toBuffer('image/png')
}

function drawWordmark(ctx) {
  ctx.fillStyle = INK
  ctx.font = 'bold 34px "Public Sans"'
  ctx.textBaseline = 'top'
  ctx.fillText('NAMMES HUB', MARGIN, MARGIN + 14)
}
