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

  it('imports only React, the API client, the pure geometry and the shared seat store', () => {
    // A fixed, short list, and nothing else. Every one it borrowed would drag its own imports in with it, which is the
    // entire reason this client exists. quizPlayerStorage is the one non-geometry import allowed: without the durable
    // token a student on a weak connection who loses the tab has to retype a code, and this is the client they are on.
    const imports = [...low.matchAll(/^import .*$/gm)].map((m) => m[0])
    const project = imports.filter((line) => !line.includes("from 'react'"))
    expect(imports.length - project.length, 'React itself is expected').toBe(1)
    expect(project).toHaveLength(3)
    expect(project.join(' ')).toContain('../data/quiz')
    expect(project.join(' ')).toContain('quizGrading')
    expect(project.join(' ')).toContain('quizPlayerStorage')
  })

  it('keeps the seat across a closed tab, which is the case this client exists for', () => {
    // The token is only in the URL, so a refresh works but a closed tab does not -- and the student most likely to
    // lose the tab is the one on the worst connection.
    expect(low).toContain('readStore(storeKey(code))')
    expect(low).toContain('writeStore(storeKey(code)')
    // And a finished game drops its dead seat instead of offering it again.
    expect(low).toContain('forgetSeat(code)')
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