import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// The explanation is authored once and shown in two places, and only one of them was ever wired. The phone renders it
// from the reveal payload; the projector's RevealScreen takes no explanation prop at all, so a host looking at the wall
// sees the right answer and no prose while every phone behind them reads the reason. Nothing fails when that happens -
// the save succeeded, the payload carried the field, and the component simply never asked for it. So it is asserted
// here: the reveal screen has to name the explanation, and it has to pass the field down to it.

const host = readFileSync('src/pages/HostQuiz.jsx', 'utf8')
const phone = readFileSync('src/pages/PlayQuiz.jsx', 'utf8')
const state = readFileSync('api/_lib/handlers/quiz-state.js', 'utf8')

describe('the reveal shows the explanation on the projector as well as the phone', () => {
  it('the projector reveal screen accepts an explanation', () => {
    const signature = host.match(/function RevealScreen\(([^)]*)\)/)?.[1] ?? ''
    expect(signature).toContain('explanation')
  })

  it('the host passes the explanation into the reveal screen', () => {
    const call = host.match(/<RevealScreen[\s\S]*?\/>/)?.[0] ?? ''
    expect(call).toMatch(/explanation=\{[^}]*\}/)
  })

  it('the reveal screen actually renders it', () => {
    // The body is everything from the component to the next top-level function.
    const body = host.slice(host.indexOf('function RevealScreen('), host.indexOf('function LeaderboardScreen('))
    expect(body).toContain('reveal.explanation')
  })

  it('the phone still renders it, so the two cannot disagree about what is shown', () => {
    expect(phone).toContain('reveal.explanation')
  })

  it('the server sends it, gated only by the host setting', () => {
    expect(state).toContain('show_explanations')
    expect(state).toContain('explanation: session.show_explanations !== false')
  })
})