import { describe, expect, it } from 'vitest'
import { heroImages } from './heroImages'

describe('heroImages', () => {
  it('prefers the ordered slideshow array', () => {
    expect(heroImages({ hero_image_urls: ['a.webp', 'b.webp'], hero_image_url: 'old.webp' })).toEqual([
      'a.webp',
      'b.webp',
    ])
  })

  it('falls back to the legacy single image', () => {
    expect(heroImages({ hero_image_urls: null, hero_image_url: 'old.webp' })).toEqual(['old.webp'])
  })

  it('drops blanks in the array instead of rendering an empty slide', () => {
    expect(heroImages({ hero_image_urls: ['', 'a.webp'] })).toEqual(['a.webp'])
  })

  it('returns no slides for an empty row', () => {
    expect(heroImages(null)).toEqual([])
    expect(heroImages({})).toEqual([])
  })
})
