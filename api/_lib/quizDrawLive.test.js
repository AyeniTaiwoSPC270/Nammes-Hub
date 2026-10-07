import { describe, it, expect } from 'vitest'
import { fakeDb, fakeRes, QUIZ, SESSION, admin, anon } from './quizTestKit.js'
import { createQuizAdvanceHandler } from './handlers/quiz-advance.js'
import { createQuizStateHandler } from './handlers/quiz-state.js'
import { createQuizAnswerHandler } from './handlers/quiz-answer.js'
import { hashToken } from './quiz.js'

// The live game with question banks: the session has its own drawn list and answer orders, and everything the phones and
// the projector see has to come from those rather than from the quiz's positions.

const Q1 = '11111111-1111-4111-8111-111111111111'
const Q2 = '22222222-2222-4222-8222-222222222222'
const Q3 = '33333333-3333-4333-8333-333333333333'
const PLAYER = '44444444-4444-4444-8444-444444444444'
const TOKEN = 'tok'

// Options are in the order they were typed. The drawn order puts question 2 first, and its answers were swapped.
const rows = [
  { id: Q1, quiz_id: QUIZ, position: 0, type: 'multiple', text: 'Q1?', options: ['Lagos', 'Accra', 'Kumasi', 'Ibadan'], correct_index: 1, time_limit_seconds: 20, points: 1000 },
  { id: Q2, quiz_id: QUIZ, position: 1, type: 'multiple', text: 'Q2?', options: ['A', 'B', 'C', 'D'], correct_index: 0, time_limit_seconds: 20, points: 1000 },
  { id: Q3, quiz_id: QUIZ, position: 2, type: 'multiple', text: 'Q3?', options: ['X', 'Y', 'Z', 'W'], correct_index: 3, time_limit_seconds: 20, points: 1000 },
]

// The order Q2's answers were drawn in: the tile at position 0 is the answer stored third, position 1 the first, and so on.
// Q2's right answer is the first one stored, so on the projector it is the second tile, not the first.
const swap = [2, 0, 3, 1]

function world(session, extra = {}) {
  const db = fakeDb({
    quiz_questions: rows.map((r) => ({ ...r })),
    quizzes: [{ id: QUIZ, max_players: 40, draw_settings: { draw_count: 2, shuffle_questions: true, shuffle_options: true } }],
    quiz_sessions: [{ ...session, ...extra }],
    quiz_players: [{ id: PLAYER, session_id: SESSION, nickname: 'Ada', total_score: 0, avatar_id: 0, streak: 0, powerups_used: [] }],
    quiz_player_tokens: [{ player_id: PLAYER, token_hash: hashToken('tok') }],
    quiz_answers: [],
    quiz_powerup_uses: [],
  })
  return db
}

const running = (over = {}) => ({
  id: SESSION, quiz_id: QUIZ, state: 'question', current_question_index: 0, question_started_at: new Date(Date.now() - 1000).toISOString(),
  question_ids: [Q2, Q1], option_orders: { [Q2]: swap }, max_players: 40, paused_at: null, paused_total_ms: 0, time_bonus_ms: 0,
  ...over,
})

// Each handler asks for its client, so one is built per call against the database under test: the assertions need to read
// the very rows the handler wrote.
const stateOf = async (w) => {
  const res = fakeRes()
  await createQuizStateHandler(() => w, { now: () => Date.now(), allow: () => true })({ method: 'POST', headers: {}, body: { token: TOKEN } }, res)
  return res.body
}

const postAnswer = async (w, chosenIndex) => {
  const res = fakeRes()
  await createQuizAnswerHandler(() => w, { now: () => Date.now(), allow: () => true })({ method: 'POST', headers: {}, body: { token: TOKEN, chosenIndex } }, res)
  return res
}

describe('the drawn list decides the order, not the quiz positions', () => {
  it('shows the first drawn question, which is not the first in the quiz', async () => {
    const body = await stateOf(world(running()))
    expect(body.question.text).toBe('Q2?')
    expect(body.session.index).toBe(0)
    expect(body.session.questionCount).toBe(2) // the drawn count, not the quiz's three
  })

  it('steps to the second drawn question', async () => {
    const body = await stateOf(world(running({ current_question_index: 1 })))
    expect(body.question.text).toBe('Q1?')
  })

  it('sends the answers in the order they were drawn', async () => {
    const body = await stateOf(world(running()))
    expect(body.question.options).toEqual(['C', 'A', 'D', 'B'])
  })

  it('leaves a question that was not shuffled with its answers as typed', async () => {
    const body = await stateOf(world(running({ current_question_index: 1 })))
    expect(body.question.options).toEqual(['Lagos', 'Accra', 'Kumasi', 'Ibadan'])
  })
})

describe('the reveal points at the answer as it was shown', () => {
  it('shows the right answer where it is on screen, not where it is stored', async () => {
    const w = world(running({ state: 'reveal' }))
    const body = await stateOf(w)
    // Q2's right answer is A, stored first. The swap puts it in the second slot on screen.
    expect(body.reveal.correctIndex).toBe(1)
    expect(body.question.options[body.reveal.correctIndex]).toBe('A')
  })

  it('reports a stored pick where the player saw it', async () => {
    const w = world(running({ state: 'reveal' }))
    w.tables.quiz_answers.push({ session_id: SESSION, player_id: PLAYER, question_id: Q2, chosen_index: 2, correct: false, points_awarded: 0 })
    const body = await stateOf(w)
    // Stored 2 is Kumasi, shown first.
    expect(body.question.options[body.reveal.chosenIndex]).toBe('C')
    expect(body.reveal.chosenIndex).toBe(0)
  })
})

describe('an answer is graded against what was tapped', () => {
  it('marks the second answer shown as correct, though it is stored first', async () => {
    const w = world(running())
    const res = await postAnswer(w, 1) // 'A' on screen, stored at 0, which is the right answer
    expect(res.statusCode).toBe(200)
    expect(w.tables.quiz_answers[0].chosen_index).toBe(0) // stored in its own position
    expect(w.tables.quiz_answers[0].correct).toBe(true)
  })

  it('marks the first answer shown as wrong, though it is stored third', async () => {
    const w = world(running())
    const res = await postAnswer(w, 0) // 'C' on screen, stored at 2
    expect(res.statusCode).toBe(200)
    expect(w.tables.quiz_answers[0].chosen_index).toBe(2)
    expect(w.tables.quiz_answers[0].correct).toBe(false)
  })

  it('refuses an answer that is not one of the ones shown', async () => {
    const res = await postAnswer(world(running()), 9)
    expect(res.statusCode).toBe(400)
  })

  it('still scores an unshuffled question normally', async () => {
    const w = world(running({ current_question_index: 1 }))
    const res = await postAnswer(w, 1) // Accra, stored at 1
    expect(res.statusCode).toBe(200)
    expect(w.tables.quiz_answers[0].correct).toBe(true)
  })
})

describe('the game ends after the questions it drew', () => {
  const step = async (w, expectedState, expectedIndex) => {
    const res = fakeRes()
    await createQuizAdvanceHandler(() => w)({ method: 'POST', headers: { authorization: 'Bearer good' }, body: { sessionId: SESSION, expectedState, expectedIndex } }, res)
    return res
  }

  it('finishes after the second drawn question, not the third in the quiz', async () => {
    const w = world(running({ state: 'leaderboard', current_question_index: 1 }))
    const res = await step(w, 'leaderboard', 1)
    expect(res.statusCode).toBe(200)
    expect(res.body.session.state).toBe('finished')
  })

  it('still has one question to go after the first drawn one', async () => {
    const w = world(running({ state: 'leaderboard', current_question_index: 0 }))
    const res = await step(w, 'leaderboard', 0)
    expect(res.body.session.state).toBe('question')
    expect(res.body.session.current_question_index).toBe(1)
  })

  it('refuses a step that is not the admin move it was told about', async () => {
    const w = world(running({ state: 'leaderboard', current_question_index: 0 }))
    const res = await step(w, 'leaderboard', 1)
    expect(res.statusCode).toBe(409)
  })
})

describe('a game from before question banks', () => {
  const legacy = (over = {}) => ({
    id: SESSION, quiz_id: QUIZ, state: 'question', current_question_index: 1, question_started_at: new Date(Date.now() - 1000).toISOString(),
    max_players: 40, paused_at: null, paused_total_ms: 0, time_bonus_ms: 0, ...over,
  })

  it('plays the quiz questions in position order, with answers as typed', async () => {
    const body = await stateOf(world(legacy()))
    expect(body.question.text).toBe('Q2?')
    expect(body.question.options).toEqual(['A', 'B', 'C', 'D'])
    expect(body.session.questionCount).toBe(3)
  })

  it('reveals the right answer where it is stored', async () => {
    const w = world(legacy({ state: 'reveal' }))
    w.tables.quiz_answers.push({ session_id: SESSION, player_id: PLAYER, question_id: Q2, chosen_index: 1, correct: false, points_awarded: 0 })
    const body = await stateOf(w)
    expect(body.reveal.correctIndex).toBe(0)
    expect(body.reveal.chosenIndex).toBe(1)
  })

  it('grades an answer by its stored position, unchanged', async () => {
    const w = world(legacy())
    const res = await postAnswer(w, 0) // A, stored at 0 and the right answer
    expect(res.statusCode).toBe(200)
    expect(w.tables.quiz_answers[0].chosen_index).toBe(0)
    expect(w.tables.quiz_answers[0].correct).toBe(true)
  })
})