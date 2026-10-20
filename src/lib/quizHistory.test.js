import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { summariseSeat } from './quizHistory.js'

// A result row is built from two things the phone already has: the seat record, and the `quiz-state` payload the
// token answers. The pure half is tested here without a browser or a fetch.

const seat = (overrides = {}) => ({ code: '123456', nickname: 'Bisi', at: 1700000000000, ...overrides })

describe('summariseSeat', () => {
  it('turns a finished payload into a row, with the winner from top', () => {
    const summary = summariseSeat(seat(), {
      session: { state: 'finished' },
      me: { rank: 2, score: 1450 },
      playerCount: 24,
      top: [{ nickname: 'Ada', rank: 1 }, { nickname: 'Bisi', rank: 2 }],
    })
    expect(summary).toEqual({
      code: '123456',
      nickname: 'Bisi',
      playedAt: 1700000000000,
      status: 'finished',
      rank: 2,
      score: 1450,
      players: 24,
      winner: 'Ada',
    })
  })

  it('keeps a live game as live, still with rank and score', () => {
    const summary = summariseSeat(
      seat(),
      { session: { state: 'question' }, me: { rank: 5, score: 320 }, playerCount: 18 },
    )
    expect(summary.status).toBe('live')
    expect(summary.rank).toBe(5)
    expect(summary.score).toBe(320)
  })

  it('reports gone, and does not throw, for a payload with no session', () => {
    for (const payload of [null, undefined, {}, { me: null }]) {
      const summary = summariseSeat(seat(), payload)
      expect(summary.status).toBe('gone')
      expect(summary.rank).toBeNull()
    }
  })

  it('leaves the winner null rather than undefined when there is no top', () => {
    const summary = summariseSeat(seat(), { session: { state: 'finished' }, me: { rank: 1, score: 900 } })
    expect(summary.winner).toBeNull()
  })

  it('describes the game the seat came from, not the payload', () => {
    const summary = summariseSeat(seat({ code: '999999', nickname: 'Ada', at: 42 }), {
      session: { state: 'finished' },
      me: { rank: 1, score: 10 },
    })
    expect(summary.code).toBe('999999')
    expect(summary.nickname).toBe('Ada')
    expect(summary.playedAt).toBe(42)
  })
})

// Source scans, in the style of playSeatResume.test.js: the wiring is the part a pure test cannot prove.
const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
const app = read('src/App.jsx')
const page = read('src/pages/PlayHistory.jsx')
const play = read('src/pages/PlayQuiz.jsx')
const low = read('src/pages/PlayLow.jsx')

describe('/play/history is wired to the seats the device holds', () => {
  it('is a lazily loaded route', () => {
    expect(app).toContain("const PlayHistory = lazyRetry(() => import('./pages/PlayHistory'))")
    expect(app).toContain('path="play/history"')
  })

  it('asks for finished seats and reads each one with low: 1', () => {
    expect(page).toContain('rememberedSeats({ includeFinished: true')
    expect(page).toMatch(/callQuiz\('state',\s*\{[^}]*low: 1/)
  })

  it('leaves the join screen on the default, so finished games stay off it', () => {
    expect(play).toContain('rememberedSeats()')
    expect(play).not.toContain('includeFinished')
  })

  it('has the low client store the session id its card needs', () => {
    expect(low).toMatch(/stampSeat\(\{[^}]*sessionId: joined\.sessionId/)
  })

  it('offers an entry point on both the join and finished screens', () => {
    expect(play).toContain('See your past results')
    expect(play).toContain('My past results')
    expect(play.match(/to="\/play\/history"/g)?.length).toBeGreaterThanOrEqual(2)
  })
})
