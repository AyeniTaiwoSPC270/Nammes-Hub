import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// The whole claim of /play/low is that it is smaller than /play, and "we were careful" is not a thing that survives a
// refactor. A source scan is crude next to a real bundle measurement, but it fails loudly the first time somebody
// imports the backdrop to make it nicer, which is exactly when it matters.

const low = readFileSync('src/pages/PlayLow.jsx', 'utf8')

describe('the light client stays light', () => {
  it('draws no character, backdrop, confetti or look system', () => {
    for (const forbidden of ['QuizBackdrop', 'Character', 'Confetti', 'QuizTopBar', 'quizSound', 'useCastQuery']) {
      expect(low, `${forbidden} pulled the look system into the low client`).not.toContain(forbidden)
    }
  })

  it('draws no quiz-theme object or design-time draft', () => {
    // Matched on the property, not the word: the comment above this test uses "theme" to describe what is absent.
    expect(low).not.toContain('.theme')
    expect(low).not.toContain('backdropMotion')
  })

  it('imports only React, the API client and the pure geometry', () => {
    // Two project imports, and neither is a component. The components it needs are defined here, which is the point:
    // every one it borrowed would drag its own imports in with it.
    const imports = [...low.matchAll(/^import .*$/gm)].map((m) => m[0])
    const project = imports.filter((line) => !line.includes("from 'react'"))
    expect(imports.length - project.length, 'React itself is expected').toBe(1)
    expect(project).toHaveLength(2)
    expect(project.join(' ')).toContain('../data/quiz')
    expect(project.join(' ')).toContain('quizGrading')
  })

  it('speaks the same server contract as the full client, including the low flag', () => {
    expect(low).toContain("callQuiz('state'")
    expect(low).toContain('low: 1')
    expect(low).toContain("callQuiz('answer'")
  })

  it('answers every type the full client answers, so nothing is a dead end', () => {
    for (const type of ['order', 'diagram', 'numeric']) {
      expect(low, `no branch for ${type}`).toContain(`'${type}'`)
    }
  })

  it('is registered at /play/low and not as a mode of /play', () => {
    const app = readFileSync('src/App.jsx', 'utf8')
    expect(app).toContain('path="play/low"')
    expect(app).toContain("./pages/PlayLow'")
  })
})