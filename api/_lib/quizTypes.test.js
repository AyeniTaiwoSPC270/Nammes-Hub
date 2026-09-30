import { describe, it, expect } from 'vitest'
import {
  parseNumber, normaliseText, gradeAnswer, correctText, streakBonus, isComeback, computeAward, fiftyFiftyHidden, sanitizeGameOptions, hashToken,
} from './quiz.js'
import { createQuizAnswerHandler } from './handlers/quiz-answer.js'
import { createQuizPowerupHandler } from './handlers/quiz-powerup.js'
import { createQuizStateHandler } from './handlers/quiz-state.js'
import { QUIZ, SESSION, fakeRes, fakeDb, anon } from './quizTestKit.js'

describe('parseNumber', () => {
  it('accepts plain numbers, fractions and exponents', () => {
    expect(parseNumber('3.14')).toBe(3.14)
    expect(parseNumber(' -2 ')).toBe(-2)
    expect(parseNumber('1/2')).toBe(0.5)
    expect(parseNumber('1e3')).toBe(1000)
    expect(parseNumber('-3/4')).toBe(-0.75)
  })
  it('rejects units, words, empties and divide-by-zero', () => {
    for (const bad of ['5 m', 'five', '', '  ', '1/0', '1,5', '.5', '5.', '--2', '1/2/3', 'Infinity', 'NaN', '9'.repeat(30), null, 4]) {
      expect(parseNumber(bad), String(bad)).toBeNull()
    }
  })
})

describe('normaliseText', () => {
  it('ignores case, accents, punctuation and spacing', () => {
    expect(normaliseText('  Ada   LOVELACE! ')).toBe('ada lovelace')
    expect(normaliseText('Émile Borel.')).toBe('emile borel')
    expect(normaliseText("O'Brien")).toBe('obrien')
    expect(normaliseText(5)).toBe('')
  })
})

describe('gradeAnswer', () => {
  const multiple = { type: 'multiple', options: ['a', 'b', 'c'], correct_index: 1 }
  it('grades multiple choice and true/false by index', () => {
    expect(gradeAnswer(multiple, { chosenIndex: 1 })).toMatchObject({ ok: true, correct: true, chosenIndex: 1 })
    expect(gradeAnswer(multiple, { chosenIndex: 0 })).toMatchObject({ ok: true, correct: false })
    expect(gradeAnswer({ type: 'truefalse', options: ['True', 'False'], correct_index: 1 }, { chosenIndex: 1 }).correct).toBe(true)
    for (const bad of [-1, 3, 1.5, '1', undefined]) expect(gradeAnswer(multiple, { chosenIndex: bad }).ok).toBe(false)
    expect(gradeAnswer(multiple, { answerText: 'b' }).ok).toBe(false)
  })
  it('does not grade a poll', () => {
    expect(gradeAnswer({ type: 'poll', options: ['x', 'y'], correct_index: null }, { chosenIndex: 0 })).toMatchObject({ ok: true, correct: null })
  })
  it('grades typed numbers within the tolerance', () => {
    const q = { type: 'numeric', options: [], numeric_answer: 3.14, numeric_tolerance: 0.01 }
    expect(gradeAnswer(q, { answerText: '3.14' }).correct).toBe(true)
    expect(gradeAnswer(q, { answerText: '3.145' }).correct).toBe(true)
    expect(gradeAnswer(q, { answerText: '3.2' }).correct).toBe(false)
    expect(gradeAnswer({ ...q, numeric_answer: 0.5, numeric_tolerance: 0 }, { answerText: '1/2' }).correct).toBe(true)
    expect(gradeAnswer(q, { answerText: 'pi' })).toMatchObject({ ok: false })
    expect(gradeAnswer(q, { chosenIndex: 0 }).ok).toBe(false)
  })
  it('grades typed text against the accepted list', () => {
    const q = { type: 'text', options: [], accepted_answers: ['Ada Lovelace', 'Lovelace'] }
    expect(gradeAnswer(q, { answerText: ' ada   lovelace. ' }).correct).toBe(true)
    expect(gradeAnswer(q, { answerText: 'LOVELACE' }).correct).toBe(true)
    expect(gradeAnswer(q, { answerText: 'Babbage' }).correct).toBe(false)
    expect(gradeAnswer(q, { answerText: 'x'.repeat(41) }).ok).toBe(false)
    expect(gradeAnswer(q, { answerText: '   ' }).ok).toBe(false)
  })
  it('shows a typed answer at the reveal', () => {
    expect(correctText({ type: 'numeric', numeric_answer: '3.14' })).toBe('3.14')
    expect(correctText({ type: 'text', accepted_answers: ['Ada', 'Bo'] })).toBe('Ada')
    expect(correctText({ type: 'multiple' })).toBeNull()
  })
})

describe('streaks, multipliers, power-ups and comeback', () => {
  it('has the streak ladder from the spec', () => {
    expect([1, 2, 3, 4, 5, 9].map(streakBonus)).toEqual([0, 50, 100, 150, 200, 200])
  })
  const on = { streaks: true, comeback: true, powerups: true }
  it('awards base only with every option off', () => {
    expect(computeAward({ correct: true, base: 800, streakBefore: 4 })).toMatchObject({ points: 800, bonus: 0, streakAfter: 5 })
  })
  it('adds the streak bonus and counts the streak', () => {
    expect(computeAward({ correct: true, base: 800, streakBefore: 2, options: on })).toMatchObject({ points: 900, bonus: 100, streakAfter: 3 })
  })
  it('resets the streak on a wrong answer and pays nothing', () => {
    expect(computeAward({ correct: false, base: 0, streakBefore: 4, options: on })).toMatchObject({ points: 0, streakAfter: 0 })
  })
  it('leaves polls alone', () => {
    expect(computeAward({ correct: null, base: 0, streakBefore: 4, options: on })).toMatchObject({ points: 0, streakAfter: 4 })
  })
  it('doubles for a double-points question and for double down, and both together', () => {
    expect(computeAward({ correct: true, base: 800, multiplier: 2 }).points).toBe(1600)
    expect(computeAward({ correct: true, base: 800, powerup: 'double' }).points).toBe(1600)
    expect(computeAward({ correct: true, base: 800, multiplier: 2, powerup: 'double' }).points).toBe(3200)
  })
  it('doubles the streak bonus too', () => {
    expect(computeAward({ correct: true, base: 800, streakBefore: 1, multiplier: 2, options: on }).points).toBe((800 + 50) * 2)
  })
  it('adds 15% for a comeback on the base points, rounded', () => {
    expect(computeAward({ correct: true, base: 777, comeback: true, options: on })).toMatchObject({ points: 777 + 117, bonus: 117 })
    expect(computeAward({ correct: true, base: 777, comeback: true, options: { comeback: false } }).points).toBe(777)
  })
  it('a double down on a wrong answer still earns nothing', () => {
    expect(computeAward({ correct: false, base: 0, powerup: 'double', options: on }).points).toBe(0)
  })
})

describe('isComeback', () => {
  const scores = (list) => new Map(list.map((s, i) => [`p${i}`, s]))
  it('is for the bottom quarter only, and only with at least four players', () => {
    const s = scores([900, 800, 700, 600, 500, 400, 300, 200])
    expect(['p0', 'p5'].map((p) => isComeback(s, p))).toEqual([false, false])
    expect(isComeback(s, 'p6')).toBe(true)
    expect(isComeback(s, 'p7')).toBe(true)
    expect(isComeback(scores([900, 500, 100]), 'p2')).toBe(false)
  })
  it('never boosts anyone when everyone is level (the first question)', () => {
    const s = scores([0, 0, 0, 0, 0, 0, 0, 0])
    for (const p of s.keys()) expect(isComeback(s, p)).toBe(false)
  })
  it('does not boost someone tied with the players above the cut-off', () => {
    const s = scores([500, 500, 500, 500])
    expect(isComeback(s, 'p3')).toBe(false)
  })
})

describe('fiftyFiftyHidden', () => {
  const args = { playerId: 'pl', questionId: 'qu', optionCount: 4, correctIndex: 2 }
  it('hides two wrong options, never the right one, and is stable', () => {
    const hidden = fiftyFiftyHidden(args)
    expect(hidden).toHaveLength(2)
    expect(hidden).not.toContain(2)
    expect(fiftyFiftyHidden(args)).toEqual(hidden)
  })
  it('works out for every correct index and player', () => {
    for (let correct = 0; correct < 4; correct++) for (const pl of ['a', 'b', 'c', 'd']) {
      const hidden = fiftyFiftyHidden({ playerId: pl, questionId: 'q', optionCount: 4, correctIndex: correct })
      expect(hidden).toHaveLength(2)
      expect(hidden).not.toContain(correct)
    }
  })
  it('does nothing unless there are four options', () => {
    expect(fiftyFiftyHidden({ ...args, optionCount: 3 })).toEqual([])
    expect(fiftyFiftyHidden({ ...args, optionCount: 2 })).toEqual([])
  })
})

describe('sanitizeGameOptions', () => {
  it('is off unless explicitly true', () => {
    expect(sanitizeGameOptions({})).toEqual({ streaks: false, powerups: false, comeback: false })
    expect(sanitizeGameOptions({ streaks: 'yes', powerups: 1, comeback: true, junk: 1 })).toEqual({ streaks: false, powerups: false, comeback: true })
    expect(sanitizeGameOptions(null)).toEqual({ streaks: false, powerups: false, comeback: false })
  })
})

// ---- handlers ----
const START = Date.parse('2026-10-01T10:00:00.000Z')
const iso = (ms) => new Date(ms).toISOString()
const P = ['a', 'b', 'c', 'd', 'e'].map((x, i) => `44444444-4444-4444-8444-44444444444${i}`)

function gameWith(questions, { options = {}, players = 2, session = {} } = {}) {
  const db = fakeDb({
    quiz_questions: questions.map((q, i) => ({ id: `q${i + 1}`, quiz_id: QUIZ, position: i, text: `Question ${i + 1}?`, options: [], correct_index: null, time_limit_seconds: 20, points: 1000, type: 'multiple', points_multiplier: 1, accepted_answers: [], ...q })),
    quiz_sessions: [{ id: SESSION, quiz_id: QUIZ, join_code: '123456', state: 'question', current_question_index: 0, question_started_at: iso(START), max_players: 40, game_options: options, ...session }],
    quiz_players: P.slice(0, players).map((id, i) => ({ id, session_id: SESSION, nickname: `Player${i}`, total_score: 0, streak: 0, powerups_used: [], avatar_id: 0, joined_at: iso(START - 1000 * (9 - i)) })),
    quiz_player_tokens: P.slice(0, players).map((id, i) => ({ player_id: id, token_hash: hashToken(`t${i}`) })),
  })
  const ask = async (token, body, at = START + 2000) => {
    const res = fakeRes()
    await createQuizAnswerHandler(() => db, { now: () => at, allow: () => true })(anon({ token, ...body }), res)
    return res
  }
  const power = async (token, kind) => {
    const res = fakeRes()
    await createQuizPowerupHandler(() => db, { allow: () => true })(anon({ token, kind }), res)
    return res
  }
  const state = async (token) => {
    const res = fakeRes()
    await createQuizStateHandler(() => db, { allow: () => true, now: () => START + 2000, baseUrl: 'https://x.supabase.co' })(anon({ token }), res)
    return res
  }
  const next = (index = 1) => Object.assign(db.tables.quiz_sessions[0], { state: 'question', current_question_index: index, question_started_at: iso(START + 60_000) })
  const player = (i) => db.tables.quiz_players[i]
  return { db, ask, power, state, next, player }
}

const choice = { options: ['a', 'b', 'c', 'd'], correct_index: 1 }

describe('answering typed questions', () => {
  it('accepts a numeric answer, stores the text and grades it on the server', async () => {
    const g = gameWith([{ type: 'numeric', numeric_answer: 3.14, numeric_tolerance: 0.01 }])
    expect((await g.ask('t0', { answerText: '3.14' })).body).toEqual({ accepted: true })
    expect((await g.ask('t1', { answerText: '7' })).body).toEqual({ accepted: true })
    expect(g.db.tables.quiz_answers.map((a) => [a.answer_text, a.correct, a.points_awarded])).toEqual([['3.14', true, 950], ['7', false, 0]])
  })
  it('rejects the wrong shape for the question type', async () => {
    const g = gameWith([{ type: 'numeric', numeric_answer: 1 }])
    expect((await g.ask('t0', { chosenIndex: 0 })).statusCode).toBe(400)
    expect((await g.ask('t0', { answerText: 'one' })).statusCode).toBe(400)
    const c = gameWith([{ type: 'multiple', ...choice }])
    expect((await c.ask('t0', { answerText: 'b' })).statusCode).toBe(400)
  })
  it('grades typed text, ignoring case and punctuation', async () => {
    const g = gameWith([{ type: 'text', accepted_answers: ['Ada Lovelace'] }])
    await g.ask('t0', { answerText: 'ADA lovelace!' })
    expect(g.db.tables.quiz_answers[0].correct).toBe(true)
  })
  it('a poll scores nothing and leaves streaks alone', async () => {
    const g = gameWith([{ type: 'poll', options: ['x', 'y'] }], { options: { streaks: true } })
    g.player(0).streak = 3
    await g.ask('t0', { chosenIndex: 1 })
    expect(g.player(0)).toMatchObject({ total_score: 0, streak: 3 })
    expect(g.db.tables.quiz_answers[0].correct).toBeNull()
  })
  it('never tells a phone the answer to a typed question while it is open', async () => {
    const g = gameWith([{ type: 'text', accepted_answers: ['Secret Word'] }, { type: 'numeric', numeric_answer: 424242 }])
    let body = (await g.state('t0')).body
    expect(body.question).toMatchObject({ type: 'text', options: [] })
    expect(JSON.stringify(body)).not.toMatch(/secret word/i)
    g.next()
    body = (await g.state('t0')).body
    expect(JSON.stringify(body)).not.toContain('424242')
  })
  it('shows the typed answer and the result once revealed', async () => {
    const g = gameWith([{ type: 'numeric', numeric_answer: 12 }])
    await g.ask('t0', { answerText: '12' })
    g.db.tables.quiz_sessions[0].state = 'reveal'
    const { reveal } = (await g.state('t0')).body
    expect(reveal).toMatchObject({ correctText: '12', correct: true, answerText: '12', correctIndex: null })
  })
})

describe('streaks through the answer handler', () => {
  it('builds a streak, pays the bonus, and resets on a miss', async () => {
    const g = gameWith([{ ...choice }, { ...choice }, { ...choice }, { ...choice }], { options: { streaks: true } })
    const points = []
    for (let i = 0; i < 3; i++) {
      if (i) g.next(i)
      await g.ask('t0', { chosenIndex: 1 }, i ? START + 60_000 : START)
      points.push(g.player(0).total_score)
    }
    // full points each time (answered instantly): 1000, then +50, then +100
    expect(points).toEqual([1000, 2050, 3150])
    expect(g.player(0).streak).toBe(3)
    g.next(3)
    await g.ask('t0', { chosenIndex: 0 }, START + 60_000)
    expect(g.player(0).streak).toBe(0)
  })
  it('does nothing extra when streaks are off', async () => {
    const g = gameWith([{ ...choice }, { ...choice }])
    await g.ask('t0', { chosenIndex: 1 }, START)
    g.next(1)
    await g.ask('t0', { chosenIndex: 1 }, START + 60_000)
    expect(g.player(0).total_score).toBe(2000)
  })
  it('doubles a double-points question', async () => {
    const g = gameWith([{ ...choice, points_multiplier: 2 }])
    await g.ask('t0', { chosenIndex: 1 }, START)
    expect(g.player(0).total_score).toBe(2000)
    expect(g.db.tables.quiz_answers[0].bonus_points).toBe(1000)
  })
})

describe('power-ups', () => {
  const on = { powerups: true }
  it('are off unless the game has them on', async () => {
    const g = gameWith([{ ...choice }])
    expect((await g.power('t0', 'double')).statusCode).toBe(403)
  })
  it('double down doubles a right answer, once per game', async () => {
    const g = gameWith([{ ...choice }, { ...choice }], { options: on })
    expect((await g.power('t0', 'double')).statusCode).toBe(200)
    expect((await g.power('t0', 'double')).statusCode).toBe(200) // repeat tap on the same question: same result, no second spend
    await g.ask('t0', { chosenIndex: 1 }, START)
    expect(g.player(0).total_score).toBe(2000)
    g.next(1)
    expect((await g.power('t0', 'double')).statusCode).toBe(409) // already used this game
    expect(g.db.tables.quiz_powerup_uses).toHaveLength(1)
  })
  it('only one power-up per question', async () => {
    const g = gameWith([{ ...choice }], { options: on })
    await g.power('t0', 'double')
    expect((await g.power('t0', 'fifty')).statusCode).toBe(409)
  })
  it('double down is refused on double-points questions and polls', async () => {
    const d = gameWith([{ ...choice, points_multiplier: 2 }], { options: on })
    expect((await d.power('t0', 'double')).statusCode).toBe(409)
    const p = gameWith([{ type: 'poll', options: ['x', 'y'] }], { options: on })
    expect((await p.power('t0', 'double')).statusCode).toBe(409)
  })
  it('50/50 hides two wrong options, the same two every time, and they cannot be picked', async () => {
    const g = gameWith([{ ...choice }], { options: on })
    const first = (await g.power('t0', 'fifty')).body
    expect(first.hidden).toHaveLength(2)
    expect(first.hidden).not.toContain(1)
    expect((await g.power('t0', 'fifty')).body).toEqual(first)
    const question = (await g.state('t0')).body.question
    expect(question).toMatchObject({ powerup: 'fifty', hidden: first.hidden })
    expect((await g.ask('t0', { chosenIndex: first.hidden[0] })).statusCode).toBe(400)
    expect((await g.ask('t0', { chosenIndex: 1 })).statusCode).toBe(200)
  })
  it('50/50 needs four answers', async () => {
    const g = gameWith([{ options: ['a', 'b', 'c'], correct_index: 0 }], { options: on })
    expect((await g.power('t0', 'fifty')).statusCode).toBe(409)
  })
  it('cannot be used after answering or when the question is closed', async () => {
    const g = gameWith([{ ...choice }], { options: on })
    await g.ask('t0', { chosenIndex: 1 })
    expect((await g.power('t0', 'double')).statusCode).toBe(409)
    g.db.tables.quiz_sessions[0].state = 'reveal'
    expect((await g.power('t1', 'double')).statusCode).toBe(409)
  })
  it('rejects unknown kinds and unknown players', async () => {
    const g = gameWith([{ ...choice }], { options: on })
    expect((await g.power('t0', 'hack')).statusCode).toBe(400)
    expect((await g.power('nobody', 'double')).statusCode).toBe(401)
  })
})

describe('comeback boost', () => {
  it('boosts a correct answer from the bottom quarter, measured as the question opened', async () => {
    const g = gameWith([{ ...choice }], { options: { comeback: true }, players: 5 })
    ;[900, 800, 700, 600, 100].forEach((s, i) => { g.player(i).total_score = s })
    // someone answering first raises their total, but the standing is taken before this question
    await g.ask('t0', { chosenIndex: 1 }, START)
    await g.ask('t4', { chosenIndex: 1 }, START)
    const last = g.db.tables.quiz_answers.find((a) => a.player_id === P[4])
    const first = g.db.tables.quiz_answers.find((a) => a.player_id === P[0])
    expect(first.points_awarded).toBe(1000)
    expect(last.points_awarded).toBe(1150)
  })
  it('is shown to the phone as a chip before answering', async () => {
    const g = gameWith([{ ...choice }], { options: { comeback: true }, players: 5 })
    ;[900, 800, 700, 600, 100].forEach((s, i) => { g.player(i).total_score = s })
    g.db.tables.quiz_player_tokens.push({ player_id: P[4], token_hash: hashToken('t4') })
    expect((await g.state('t4')).body.question.comeback).toBe(true)
    expect((await g.state('t0')).body.question.comeback).toBe(false)
  })
  it('gives nothing on the first question when everyone is level', async () => {
    const g = gameWith([{ ...choice }], { options: { comeback: true }, players: 5 })
    await g.ask('t4', { chosenIndex: 1 }, START)
    expect(g.db.tables.quiz_answers[0].points_awarded).toBe(1000)
  })
})
