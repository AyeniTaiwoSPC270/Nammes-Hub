import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Two things a duel player could not see on their own screen, reported off a real game.
//
// The clock used to be computed only while you could still answer, and the ring fell back to the full time limit when it
// was not. So the instant you locked in, the countdown sprang back to 30 and stopped — it looked like the timer had
// reset, which is exactly the question players asked. The question was still live the whole time: the server holds it
// open until the opponent answers or the limit passes.
//
// And while you were still thinking, nothing said whether your opponent had already locked in. `view.opponentAnswered`
// arrives on every poll, but the only screen that read it was the one shown *after* you answered, so a player who was
// still choosing could not tell a close question from an open one.
//
// There is no DOM in this project's tests and this screen needs a live battle, so the guard reads the source and checks
// the two rules that were broken. It cannot prove the screen looks right; it stops these two regressions coming back.

const source = readFileSync(new URL('./PlayBattle.jsx', import.meta.url), 'utf8')

describe('the duel clock keeps running after a player locks in', () => {
  it('reads the clock from battleClock rather than computing it here', () => {
    // A second copy of the countdown is how the two halves drifted apart in the first place.
    expect(source).toMatch(/import \{[^}]*\bbattleClock\b[^}]*\} from '\.\.\/data\/quiz'/)
    expect(source).not.toMatch(/\bsecondsRemaining\b/)
  })

  it('never falls back to the full limit for the ring', () => {
    // `seconds={remaining ?? question.timeLimitSeconds}` is the exact line that read as a reset. A `??` here would put
    // a number on screen that no longer matches the server's deadline.
    expect(source).not.toMatch(/<CountdownRing[^>]*\?\?/)
    expect(source).toMatch(/<CountdownRing seconds=\{remaining\}/)
  })

  it('shows the ring only while there is a clock to show', () => {
    // The other end of the same fix: with no clock there is no honest number, so the ring goes rather than inventing one.
    expect(source).toMatch(/\{remaining !== null && <CountdownRing/)
  })

  it('locks the answer panel by canAnswer, not by the countdown reaching zero', () => {
    // Locking in is what closes the panel. The clock now runs past that point, so it can no longer be the thing that
    // decides whether an answer may be given.
    expect(source).toMatch(/<QuestionPanel[^>]*disabled=\{busy \|\| !canAnswer\}/)
    expect(source).not.toMatch(/disabled=\{busy \|\| remaining === 0\}/)
  })
})

describe('a duel player is told when their opponent has locked in', () => {
  it('reads the flag the server already sends, only in a duel', () => {
    expect(source).toMatch(/isDuel && view\.opponentAnswered &&/)
    // A challenge has no opponent playing at the same time, so it has nothing to report.
    expect(source).not.toMatch(/!isDuel && view\.opponentAnswered/)
  })

  it('says it only while the player is still choosing', () => {
    // After you lock in the waiting screen already reads "Revealing…", so a second line would only repeat it.
    expect(source).toMatch(/isDuel && view\.opponentAnswered && !waitingForThem &&/)
  })

  it('names the opponent, so a bot duel is not left guessing who is done', () => {
    expect(source).toMatch(/\{view\.opponent\.nickname\} has locked in/)
  })

  it('announces itself, so it is not colour alone', () => {
    expect(source).toMatch(/role="status"/)
  })
})