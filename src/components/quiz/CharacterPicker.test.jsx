import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CharacterPicker from './CharacterPicker'
import { randomCastId } from './characterPickerUtils.js'

describe('character picker', () => {
  it('renders only the ids offered by a sparse custom cast', () => {
    const cast = { mode: 'custom', characters: [{ slot: 2, name: 'Kola', spec: { body: 'moon', color: '#ff5a1f' }, moves: {}, color: { main: '#ff5a1f', dark: '#8e1c00', light: '#ffe9e0' } }] }
    const html = renderToStaticMarkup(<CharacterPicker cast={cast} value={52} onChange={() => {}} />)
    expect(html).toContain('aria-label="Kola"')
    expect(html).toContain('d="M64 14a36 36 0 1 0 0 72 29 29 0 0 1 0-72z"')
    expect(html).not.toContain('aria-label="Pixel"')
  })

  it('chooses only an id that the current cast offers when shuffled', () => {
    const cast = { mode: 'custom', characters: [{ slot: 0 }, { slot: 2 }] }
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    try {
      expect(randomCastId(cast)).toBe(52)
      expect(randomCastId(undefined)).toBeGreaterThanOrEqual(0)
      expect(randomCastId(undefined)).toBeLessThan(50)
    } finally {
      vi.restoreAllMocks()
    }
  })
})
