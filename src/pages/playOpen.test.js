import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// The open-quizzes list has its own route on purpose: /play answers "what is the code on the projector", and a room
// list is a different question. These are source scans because there is no behaviour here that a unit test can reach —
// the page is a poll and a map — and because the regression to catch is somebody folding the list back into the keypad.
const read = (path) => readFileSync(path, 'utf8')

const app = read('src/App.jsx')
const page = read('src/pages/PlayOpen.jsx')
const play = read('src/pages/PlayQuiz.jsx')

describe('/play/open is its own route', () => {
  it('is registered and lazily imported beside the other play routes', () => {
    expect(app).toContain("const PlayOpen = lazyRetry(() => import('./pages/PlayOpen'))")
    expect(app).toContain('path="play/open"')
  })

  it('is reached from the join screen rather than rendered inside it', () => {
    expect(play).toContain('to="/play/open"')
    expect(play).not.toContain('fetchOpenQuizzes')
  })

  it('reads the public list and sends a pick to the normal join flow', () => {
    expect(page).toContain('fetchOpenQuizzes')
    expect(page).toContain('/play?code=')
  })

  it('keeps the light client out, as every other play page does', () => {
    expect(page).not.toContain('PlayLow')
    expect(page).not.toContain('QuizBackdrop')
  })
})
