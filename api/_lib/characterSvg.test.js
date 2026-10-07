import { describe, expect, it } from 'vitest'
import { characterSvg } from './characterSvg.js'
import { AVATAR_COUNT } from '../../src/data/quizCharacters.js'

describe('characterSvg', () => {
  it('produces a complete svg for all 50 characters', () => {
    for (let id = 0; id < AVATAR_COUNT; id++) {
      const svg = characterSvg(id)
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg.endsWith('</svg>')).toBe(true)
      expect(svg).toContain('viewBox="0 0 100 100"')
      expect(svg).toContain('</g>')
    }
  })

  it('falls back to the first character for an id that does not exist', () => {
    expect(characterSvg(999)).toBe(characterSvg(0))
    expect(characterSvg(-1)).toBe(characterSvg(0))
  })

  it('carries the mood so a happy face differs from a sad one', () => {
    expect(characterSvg(3, { mood: 'sad' })).not.toBe(characterSvg(3, { mood: 'happy' }))
  })

  it('honours the requested size', () => {
    expect(characterSvg(0, { size: 420 })).toContain('width="420"')
  })

  it('is a standalone document, which is what the canvas parser needs', () => {
    expect(characterSvg(0)).toContain('xmlns="http://www.w3.org/2000/svg"')
  })
})