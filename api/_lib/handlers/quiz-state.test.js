import { describe, expect, it } from 'vitest'
import { createQuizStateHandler } from './quiz-state.js'
import { hashToken } from '../quiz.js'
import { QUIZ, SESSION, fakeDb, fakeRes } from '../quizTestKit.js'

const TOKEN = 'player-token'
const QUESTION = '55555555-5555-4555-8555-555555555555'
const EXPLANATION = "Newton's third law acts in pairs."
const allow = () => true

// The explanation is the one field on the reveal that is prose rather than the answer itself, so the property worth
// pinning is where it may not appear: while the question is still open, the correct answer is not public, and an
// explanation is a more direct route to it than an index. quiz-state.js:151 is the gate that keeps both behind the
// reveal step, and this is that gate under test.
function game({ state = 'reveal', showExplanations, explanation = EXPLANATION } = {}) {
  return fakeDb({
    quizzes: [{ id: QUIZ, max_players: 40 }],
    quiz_questions: [
      {
        id: QUESTION,
        quiz_id: QUIZ,
        position: 0,
        text: 'Which statement is true?',
        options: ['a', 'b', 'c'],
        correct_index: 1,
        time_limit_seconds: 20,
        points: 1000,
        explanation,
      },
    ],
    quiz_sessions: [
      {
        id: SESSION,
        quiz_id: QUIZ,
        state,
        current_question_index: 0,
        team_mode: false,
        theme: {},
        card: {},
        question_ids: [QUESTION],
        show_explanations: showExplanations,
      },
    ],
    quiz_players: [{ id: 'p1', session_id: SESSION, nickname: 'Ada', total_score: 0, streak: 0, avatar_id: 0 }],
    quiz_player_tokens: [{ player_id: 'p1', token_hash: hashToken(TOKEN) }],
  })
}

async function state(db, body = {}) {
  const res = fakeRes()
  await createQuizStateHandler(() => db, { allow, baseUrl: 'https://example.supabase.co' })(
    { method: 'POST', headers: {}, body: { token: TOKEN, ...body } },
    res,
  )
  return res
}

// Low-data mode is the phone saying it cannot use some of this. The invariant that matters: it may only ever subtract.
// A flag that changed what a player knows about the game would be a correctness hole in a bandwidth optimisation.
describe('low-data phones', () => {
  it('does not send the explanation', async () => {
    const res = await state(game({ state: 'reveal' }), { low: 1 })
    expect(res.statusCode).toBe(200)
    expect(res.body.reveal).toBeDefined()
    expect('explanation' in res.body.reveal).toBe(false)
    expect(JSON.stringify(res.body)).not.toContain('Newton')
  })

  it('still sends the answer and the score, because those are the game', async () => {
    const res = await state(game({ state: 'reveal' }), { low: 1 })
    expect(res.body.reveal.correct).not.toBeUndefined()
    expect(res.body.reveal.pointsAwarded).toBe(0)
    expect(res.body.me.nickname).toBe('Ada')
  })

  it('accepts the flag as a number or a string, because JSON has no single way to say yes', async () => {
    for (const low of [1, '1', true]) {
      const res = await state(game({ state: 'reveal' }), { low })
      expect('explanation' in res.body.reveal, String(low)).toBe(false)
    }
  })

  it('is ignored when the flag is absent, zero or junk', async () => {
    for (const low of [undefined, 0, false, 'yes', null]) {
      const res = await state(game({ state: 'reveal' }), low === undefined ? {} : { low })
      expect(res.body.reveal.explanation, String(low)).toContain('Newton')
    }
  })

  it('does not pre-load the next question picture', async () => {
    const res = await state(game({ state: 'leaderboard' }), { low: 1 })
    expect(res.statusCode).toBe(200)
    expect(res.body.nextImageUrl).toBeUndefined()
  })

  it('pre-loads the next picture when the phone has not asked not to', async () => {
    const res = await state(game({ state: 'leaderboard' }))
    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('nextImageUrl')
  })
})

describe('explanations on the live reveal', () => {
  it('withholds the explanation while the question is still open', async () => {
    const res = await state(game({ state: 'question' }))
    expect(res.statusCode).toBe(200)
    // The reveal block does not exist yet, so the explanation cannot be on the wire by another route either.
    expect(res.body.reveal).toBeUndefined()
    expect(JSON.stringify(res.body)).not.toContain('Newton')
  })

  it('withholds the explanation from a game whose host turned it off', async () => {
    const res = await state(game({ state: 'reveal', showExplanations: false }))
    expect(res.statusCode).toBe(200)
    expect(res.body.reveal).toBeDefined()
    expect(res.body.reveal.explanation).toBeNull()
    expect(JSON.stringify(res.body)).not.toContain('Newton')
  })

  it('shows it on the reveal, and keeps it up on the leaderboard step', async () => {
    for (const step of ['reveal', 'leaderboard']) {
      const res = await state(game({ state: step, showExplanations: true }))
      expect(res.body.reveal?.explanation, step).toBe(EXPLANATION)
    }
  })

  it('sends no reveal at all once the game is finished', async () => {
    // quiz-state.js:101 only builds the question/reveal block for question, reveal and leaderboard. A finished game
    // shows the result card instead, so there is nothing left to explain and no reason to carry the prose.
    const res = await state(game({ state: 'finished', showExplanations: true }))
    expect(res.statusCode).toBe(200)
    expect(res.body.reveal).toBeUndefined()
    expect(res.body.question).toBeUndefined()
  })

  it('defaults to showing it, because the column is not null and CBT already defaults on', async () => {
    const res = await state(game({ state: 'reveal' }))
    expect(res.body.reveal.explanation).toBe(EXPLANATION)
  })

  it('renders nothing for a question that has no explanation', async () => {
    const res = await state(game({ state: 'reveal', showExplanations: true, explanation: null }))
    expect(res.body.reveal.explanation).toBeNull()
  })

  it('still sends the correct answer on the reveal even with explanations off', async () => {
    // Turning prose off must not turn the reveal off. cbt.js:30 is the same shape of switch.
    const res = await state(game({ state: 'reveal', showExplanations: false }))
    expect(res.body.reveal.correctIndex).toBe(1)
    expect(res.body.reveal.correct).toBeNull()
  })
})

// A diagram question is graded on the server against regions stored with the question, so those regions are the mark.
// A phone that receives them before it has tapped has been handed the answer: it can read them out of the payload
// without tapping anything at all. This was exactly what happened - quiz-state.js put them on the open question, with a
// comment claiming that was the safe time to send them.
describe('diagram regions never leave before the reveal', () => {
  const diagram = (state = 'reveal') => fakeDb({
    quizzes: [{ id: QUIZ, max_players: 40 }],
    quiz_questions: [{
      id: QUESTION,
      quiz_id: QUIZ,
      position: 0,
      type: 'diagram',
      text: 'Tap the switch that is closed.',
      image_path: 'q/diagram.webp',
      diagram_targets: [{ x: 0.25, y: 0.75, r: 0.08, ar: 1.5 }],
      time_limit_seconds: 20,
      points: 1000,
    }],
    quiz_sessions: [{
      id: SESSION,
      quiz_id: QUIZ,
      state,
      current_question_index: 0,
      team_mode: false,
      theme: {},
      card: {},
      question_ids: [QUESTION],
    }],
    quiz_players: [{ id: 'p1', session_id: SESSION, nickname: 'Ada', total_score: 0, streak: 0, avatar_id: 0 }],
    quiz_player_tokens: [{ player_id: 'p1', token_hash: hashToken(TOKEN) }],
  })

  it('sends no regions while the question is open', async () => {
    const res = await state(diagram('question'))
    expect(res.statusCode).toBe(200)
    expect(res.body.question).toBeDefined()
    expect(res.body.question.diagramTargets).toBeUndefined()
    expect(JSON.stringify(res.body)).not.toContain('0.75')
  })

  it('sends them with the reveal, so the student is shown what was graded', async () => {
    const res = await state(diagram('reveal'))
    expect(res.body.reveal.diagramTargets).toEqual([{ x: 0.25, y: 0.75, r: 0.08, ar: 1.5 }])
  })

  it('sends no regions on any other question type, which has no correct_index to leak either', async () => {
    const res = await state(game({ state: 'reveal' }))
    expect(res.body.reveal.diagramTargets).toBeUndefined()
  })
})