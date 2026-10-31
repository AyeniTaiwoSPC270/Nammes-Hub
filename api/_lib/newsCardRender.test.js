import { describe, it, expect } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { renderNewsCard, wrapTitle, OG_WIDTH, OG_HEIGHT } from './newsCardRender.js'
import { ensureFonts } from './fonts.js'

ensureFonts()
const ctx = createCanvas(OG_WIDTH, OG_HEIGHT).getContext('2d')
// The renderer draws at 60px bold; measuring at the canvas default 10px would make every title
// look like it fits on one line.
ctx.font = `bold 60px "Public Sans"`

function photoBuffer() {
  const canvas = createCanvas(800, 600)
  const context = canvas.getContext('2d')
  context.fillStyle = '#ff0000'
  context.fillRect(0, 0, 800, 600)
  return canvas.toBuffer('image/png')
}

// PNG layout: 8-byte signature, 4-byte IHDR length, "IHDR", then width and height as uint32.
const pngSize = (buffer) => ({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) })

describe('wrapTitle', () => {
  it('keeps a short title on one line', () => {
    expect(wrapTitle(ctx, 'Matriculation dates', 1100)).toEqual(['Matriculation dates'])
  })

  it('breaks a long title across at most three lines and marks the cut', () => {
    const lines = wrapTitle(ctx, 'word '.repeat(60).trim(), 1100, 3)
    expect(lines).toHaveLength(3)
    expect(lines[2].endsWith('…')).toBe(true)
    for (const line of lines) expect(ctx.measureText(line).width).toBeLessThanOrEqual(1100)
  })

  it('hard-breaks a single word wider than the column', () => {
    const lines = wrapTitle(ctx, `${'a'.repeat(400)}`, 1100, 3)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(ctx.measureText(line).width).toBeLessThanOrEqual(1100)
  })

  it('copes with an empty or missing title', () => {
    expect(wrapTitle(ctx, '', 1100)).toEqual([])
    expect(wrapTitle(ctx, undefined, 1100)).toEqual([])
  })
})

describe('renderNewsCard', () => {
  it('draws a 1200x630 PNG with no photo and no logo', async () => {
    const buffer = await renderNewsCard({ title: 'Hello' })
    expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(pngSize(buffer)).toEqual({ width: OG_WIDTH, height: OG_HEIGHT })
  })

  it('draws the article photo behind the scrim', async () => {
    const buffer = await renderNewsCard({ title: 'Hello', imageBuffer: photoBuffer() })
    expect(pngSize(buffer)).toEqual({ width: OG_WIDTH, height: OG_HEIGHT })
  })

  it('survives an unreadable upload and an empty title', async () => {
    const buffer = await renderNewsCard({ title: '', imageBuffer: Buffer.from('not an image') })
    expect(pngSize(buffer)).toEqual({ width: OG_WIDTH, height: OG_HEIGHT })
  })
})
