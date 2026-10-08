import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
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

// The characters' stylesheet is imported by the screens, not by Character.jsx, because the card renders Character
// on the server. Nothing enforces that here, so check the source: a file that renders a Character and forgets the
// stylesheet loses every move, which is exactly what this project's own backdrop test exists to prevent.
describe('the characters stylesheet', () => {
  function files(dir) {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return files(path)
      return /\.jsx?$/.test(name) ? [path] : []
    })
  }

  function source(file) {
    return readFileSync(file, 'utf8')
  }

  const importsStylesheet = (text) => /import\s+['"][^'"]*characters\.css['"]/.test(text)

  // Follows relative imports to see whether the stylesheet ever arrives. Most screens reach it through QuizParts,
  // so checking only the importing file would be wrong, and checking only one hop would be fragile.
  function reaches(file, seen = new Set()) {
    if (seen.has(file) || !existsSync(file)) return false
    seen.add(file)
    const text = source(file)
    if (importsStylesheet(text)) return true
    return [...text.matchAll(/from '(\.[^']*)'/g)].some(([, spec]) => {
      const target = join(dirname(file), spec)
      return reaches(target.endsWith('.js') || target.endsWith('.jsx') ? target : `${target}.jsx`, seen)
        || reaches(join(target, 'index.jsx'), seen)
    })
  }

  it('is not imported by Character.jsx, which has to load on a server', () => {
    expect(importsStylesheet(source('src/components/quiz/Character.jsx'))).toBe(false)
  })

  it('is imported by every file that renders a Character', () => {
    const missing = files('src').filter((file) => /import Character from/.test(source(file)) && !reaches(file))
    expect(missing).toEqual([])
  })
})