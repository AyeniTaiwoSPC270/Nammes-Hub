import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// A phone that joined by TYPING the code -- which is what the host's own projector tells students to do -- used to hold
// a seat it could not get back to. The seat is stored under the code and the code lives in the URL, but nothing ever
// wrote it there, so refreshing dropped the player onto the join form with their token still saved. To a student that
// is a lost game; on a phone in a hall it is the moment the exercise stops working.
//
// /play/low got this right from the start (`history.replaceState` on join), which is why the bug was only ever on the
// full client. Both routes have to keep it.

const play = readFileSync('src/pages/PlayQuiz.jsx', 'utf8')
const low = readFileSync('src/pages/PlayLow.jsx', 'utf8')

describe('a joined phone can find its own seat again', () => {
  it('writes the code into the address bar on join, on both clients', () => {
    // replaceState, not pushState: the browser's back button must not walk out of the lobby into the join form.
    expect(play, '/play never records the code in the URL').toMatch(/replaceState\(\s*null,\s*'',\s*`\/play\?code=/)
    expect(low, '/play/low does not record the code either').toMatch(/replaceState\(\s*null,\s*'',\s*`\?token=/)
  })

  it('offers a way back from the join form without retyping the code', () => {
    // The token is the thing that resumes, so the shortcut only fills the code and lets the normal join path send it.
    expect(play).toContain('rememberedSeats')
    expect(play).toContain('Back into game')
  })

  it('stamps the seat so the most recent game sorts first', () => {
    expect(play).toContain('stampSeat')
  })
})

describe('a finished game stops being offered', () => {
  // quiz-join refuses `state = 'finished'`, so a finished seat is a button that cannot work. The phone is the only
  // thing that knows the game ended -- there is no cheap server call for "is this code still open" -- so it flags the
  // seat when the final state arrives.
  it('flags the seat as finished on both clients when the game ends', () => {
    expect(play).toMatch(/data\.session\.state === 'finished'[\s\S]{0,200}finishSeat\(/)
    expect(low).toContain('finishSeat(code)')
  })

  it('drops the seat when the player presses Play again, since the game cannot be re-entered', () => {
    expect(play).toMatch(/forgetSeat\(saved\?\.code \?\? code\)/)
  })
})

describe('the light client is reachable', () => {
  it('is linked from the join form, so a student on a weak connection can find it', () => {
    // It was a working route with no door leading to it. The students who most need it are the ones who just sat
    // through the full first load, and nothing told them a lighter one existed.
    expect(play, 'nothing on the join screen points at /play/low').toContain('/play/low')
  })

  it('is named on the projector, so a host can move one phone over without typing an address', () => {
    expect(readFileSync('src/pages/HostQuiz.jsx', 'utf8')).toContain('/play/low')
  })
})

describe('low data mode only ever subtracts', () => {
  it('never hides the answer, the score or the clock', () => {
    // The flag exists to save bytes. Anything a student needs in order to play has to survive it, which is why
    // quiz-state.test.js asserts the answer and score still arrive on `low: 1`.
    //
    // Exactly three things are subtracted, and all three are decoration: the backdrop on the lobby screen, the backdrop
    // on the question screen, and the cast character on the reveal. Counting them is the point -- a fourth is either a
    // bug (something a student needs) or a change that arrived without anyone deciding it should.
    const guarded = [...play.matchAll(/\{low \? null : /g)].length
    expect(guarded, 'a new low-data subtraction needs a reason and a test').toBe(3)
    // The backdrop is a large animated SVG and the character is the largest single SVG on a reveal; nothing else is.
    expect([...play.matchAll(/\{low \? null : <QuizBackdrop \/>\}/g)].length, 'both backdrops should still drop').toBe(2)
  })

  it('sends the flag so the server trims the payload rather than the client discarding bytes', () => {
    expect(play).toContain("...(low ? { low: 1 } : {})")
  })
})