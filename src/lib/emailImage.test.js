import { describe, it, expect } from 'vitest'
import { cropRect, adjustKey, isDefaultAdjust, aspectRatio, collectImages } from './emailImage'

describe('cropRect', () => {
  it('uses the whole picture when the aspect is free', () => {
    expect(cropRect(1000, 500, { aspect: 'free' })).toEqual({ W: 1000, H: 500, sx: 0, sy: 0, sw: 1000, sh: 500 })
  })

  it('fits the largest box of the chosen shape, centered by default', () => {
    const r = cropRect(1000, 500, { aspect: '1:1' })
    expect(r.sw).toBe(500)
    expect(r.sh).toBe(500)
    expect(r.sx).toBe(250)
    expect(r.sy).toBe(0)
  })

  it('moves the box with x and y', () => {
    expect(cropRect(1000, 500, { aspect: '1:1', x: 0 }).sx).toBe(0)
    expect(cropRect(1000, 500, { aspect: '1:1', x: 100 }).sx).toBe(500)
  })

  it('zooming shrinks the box', () => {
    const r = cropRect(1000, 500, { aspect: '1:1', zoom: 2 })
    expect(r.sw).toBe(250)
    expect(r.sh).toBe(250)
  })

  it('swaps width and height for a quarter turn', () => {
    const r = cropRect(1000, 500, { aspect: 'free', rotate: 90 })
    expect(r.W).toBe(500)
    expect(r.H).toBe(1000)
  })

  it('wide frames on tall pictures crop vertically', () => {
    const r = cropRect(500, 1000, { aspect: '3:1' })
    expect(r.sw).toBe(500)
    expect(Math.round(r.sh)).toBe(167)
  })
})

describe('adjust helpers', () => {
  it('knows when nothing was adjusted', () => {
    expect(isDefaultAdjust({})).toBe(true)
    expect(isDefaultAdjust({ brightness: 120 })).toBe(false)
  })
  it('gives the same key for the same picture and settings only', () => {
    expect(adjustKey('a', { zoom: 2 })).toBe(adjustKey('a', { zoom: 2 }))
    expect(adjustKey('a', { zoom: 2 })).not.toBe(adjustKey('a', { zoom: 3 }))
    expect(adjustKey('a', {})).not.toBe(adjustKey('b', {}))
  })
  it('parses aspect ratios', () => {
    expect(aspectRatio('16:9')).toBeCloseTo(16 / 9)
    expect(aspectRatio('free')).toBeNull()
    expect(aspectRatio('nope')).toBeNull()
  })
  it('collects images from blocks, columns and the banner', () => {
    const img = (n) => ({ type: 'image', src: `https://x/${n}` })
    const found = collectImages(
      [img(1), { type: 'columns', left: img(2), right: { type: 'text' } }],
      { header: { banner: { src: 'https://x/3' } } },
    )
    expect(found).toHaveLength(3)
  })
})
