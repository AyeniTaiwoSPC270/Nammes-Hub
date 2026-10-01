import { describe, it, expect } from 'vitest'
import { sanitizeCustomQuestions, cleanTitle, cleanLine, CUSTOM_MAX_QUESTIONS, CUSTOM_DAYS } from './quizCustom.js'
import { createQuizSetsHandler } from './handlers/quiz-sets.js'
import { createQuizPracticeHandler } from './handlers/quiz-practice.js'
import { createQuizBattleHandler } from './handlers/quiz-battle.js'
import quizRouter from '../quiz.js'
import { fakeRes, fakeDb, anon } from './quizTestKit.js'

const START = Date.parse('2026-10-01T10:00:00.000Z')
const good = [
  { type: 'multiple', text: 'Capital of Ghana?', options: ['Lagos', 'Accra', '', 'Kumasi'], correct_index: 1, time_limit_seconds: 20, points: 1000 },
  { type: 'truefalse', text: 'The sun is a star.', correct_index: 0 },
  { type: 'numeric', text: 'Days in a leap year?', numeric_answer: '366', numeric_tolerance: '0' },
  { type: 'text', text: 'Capital of France?', accepted_answers: ['Paris', 'paris', ' Paris '] },
]

describe('sanitizeCustomQuestions', () => {
  it('accepts the four question types and keeps the right answer when empty boxes are dropped', () => {
    const { questions, problems } = sanitizeCustomQuestions(good)
    expect(problems).toEqual([])
    expect(questions).toHaveLength(4)
    expect(questions[0]).toMatchObject({ options: ['Lagos', 'Accra', 'Kumasi'], correct_index: 1 })
    expect(questions[1]).toMatchObject({ options: ['True', 'False'], correct_index: 0 })
    expect(questions[2]).toMatchObject({ numeric_answer: 366, numeric_tolerance: 0 })
    expect(questions[3].accepted_answers).toEqual(['Paris'])
  })

  it('refuses what cannot be played, with a line number for each', () => {
    const cases = [
      [[{ type: 'poll', text: 'Fav?', options: ['a', 'b'] }], /multiple choice/i],
      [[{ type: 'multiple', text: '', options: ['a', 'b'], correct_index: 0 }], /text/i],
      [[{ type: 'multiple', text: 'Q', options: ['a'], correct_index: 0 }], /two answers/i],
      [[{ type: 'multiple', text: 'Q', options: ['a', 'b', 'c', 'd', 'e'], correct_index: 0 }], /four/i],
      [[{ type: 'multiple', text: 'Q', options: ['a', '', 'c'], correct_index: 1 }], /correct answer/i],
      [[{ type: 'multiple', text: 'x'.repeat(301), options: ['a', 'b'], correct_index: 0 }], /too long/i],
      [[{ type: 'multiple', text: 'Q', options: ['a', 'b'.repeat(101)], correct_index: 0 }], /answer is too long/i],
      [[{ type: 'numeric', text: 'Q', numeric_answer: 'abc' }], /number/i],
      [[{ type: 'numeric', text: 'Q', numeric_answer: 1, numeric_tolerance: -1 }], /margin/i],
      [[{ type: 'text', text: 'Q', accepted_answers: [] }], /accepted answer/i],
      [[{ type: 'text', text: 'Q', accepted_answers: ['x'.repeat(41)] }], /characters/i],
      [[{ type: 'multiple', text: 'what the shit', options: ['a', 'b'], correct_index: 0 }], /not allowed/i],
      [[{ type: 'multiple', text: 'Q', options: ['a', 'shit'], correct_index: 0 }], /not allowed/i],
      [[], /at least one/i],
      ['nope', /at least one/i],
    ]
    for (const [input, pattern] of cases) {
      const { problems } = sanitizeCustomQuestions(input)
      expect(problems[0]?.message, JSON.stringify(input)).toMatch(pattern)
      expect(problems[0].line).toBeGreaterThanOrEqual(1)
    }
    const many = sanitizeCustomQuestions(Array.from({ length: CUSTOM_MAX_QUESTIONS + 1 }, () => good[0]))
    expect(many.problems[0].message).toMatch(/at most/)
  })

  it('only keeps known fields and clamps the timing and points', () => {
    const { questions } = sanitizeCustomQuestions([{ ...good[0], time_limit_seconds: 7, points: 99999, evil: '<script>', image_path: 'x/y.png', id: 'steal' }])
    expect(questions[0]).toMatchObject({ time_limit_seconds: 10, points: 2000, points_multiplier: 1 })
    expect(Object.keys(questions[0])).not.toEqual(expect.arrayContaining(['evil', 'image_path', 'id']))
  })

  it('cleans invisible characters and titles', () => {
    expect(cleanLine('  a\u0000\u0007b \n c ')).toBe('a b c')
    expect(cleanTitle('  Maths quiz ').title).toBe('Maths quiz')
    expect(cleanTitle('ab').error).toBeTruthy()
    expect(cleanTitle('x'.repeat(61)).error).toBeTruthy()
    expect(cleanTitle('shit quiz').error).toBeTruthy()
  })
})

function world(extra = {}) {
  const db = fakeDb({ quizzes: [], quiz_questions: [], ...extra })
  let clock = START
  let seed = 0.2
  const at = (ms) => { clock = ms }
  const opts = () => ({ now: () => clock, random: () => (seed = (seed * 7.31 + 0.137) % 1), cleanupChance: 0, allow: () => true, allowCreate: () => true })
  const call = async (body, over = {}) => {
    const res = fakeRes()
    await createQuizSetsHandler(() => db, { ...opts(), ...over })(anon(body), res)
    return res
  }
  const practice = async (body) => {
    const res = fakeRes()
    await createQuizPracticeHandler(() => db, { now: () => clock, allowStart: () => true, allow: () => true, cleanupChance: 0 })(anon(body), res)
    return res
  }
  const battle = async (body) => {
    const res = fakeRes()
    await createQuizBattleHandler(() => db, { ...opts(), allowJoin: () => true, baseUrl: 'https://x.supabase.co' })(anon(body), res)
    return res
  }
  const make = async (over = {}) => (await call({ op: 'create', title: 'My maths quiz', questions: good, ...over })).body
  return { db, call, practice, battle, make, at }
}

describe('community sets: making one', () => {
  it('stores the set privately and hands back a code and a secret', async () => {
    const w = world()
    const made = await w.make()
    expect(made).toMatchObject({ title: 'My maths quiz', questionCount: 4 })
    expect(made.code).toMatch(/^[A-Z2-9]{6}$/)
    expect(made.manageToken).toBeTruthy()
    const row = w.db.tables.quizzes[0]
    expect(row).toMatchObject({ is_custom: true, practice_enabled: true, battle_enabled: true, custom_code: made.code })
    expect(row.expires_at).toBe(new Date(START + CUSTOM_DAYS * 86_400_000).toISOString())
    expect(row.owner_hash).not.toBe(made.manageToken)
    expect(w.db.tables.quiz_questions).toHaveLength(4)
    expect(w.db.tables.quiz_questions.every((q) => q.quiz_id === made.quizId)).toBe(true)
    expect(JSON.stringify(made)).not.toContain(row.owner_hash)
  })

  it('refuses a bad title or bad questions, and stores nothing', async () => {
    const w = world()
    expect((await w.call({ op: 'create', title: 'x', questions: good })).statusCode).toBe(400)
    const res = await w.call({ op: 'create', title: 'Fine title', questions: [good[0], { type: 'multiple', text: 'Q', options: ['a'], correct_index: 0 }] })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/^Question 2/)
    expect(w.db.tables.quizzes).toHaveLength(0)
    expect((await w.call({ op: 'wat' })).statusCode).toBe(400)
  })

  it('limits how many sets one address can make, and how many exist in all', async () => {
    const w = world()
    expect((await w.call({ op: 'create', title: 'My maths quiz', questions: good }, { allowCreate: () => false })).statusCode).toBe(429)
    const full = world({ quizzes: Array.from({ length: 1000 }, (_, i) => ({ id: `c${i}`, is_custom: true })) })
    expect((await full.call({ op: 'create', title: 'My maths quiz', questions: good })).statusCode).toBe(503)
  })

  it('is reachable through the quiz router', async () => {
    const res = fakeRes()
    await quizRouter({ method: 'GET', query: { action: 'sets' }, headers: {} }, res)
    expect(res.statusCode).toBe(405)
  })
})

describe('community sets: finding and deleting one', () => {
  it('finds a set by its code until it expires', async () => {
    const w = world()
    const made = await w.make()
    const info = (await w.call({ op: 'info', code: made.code.toLowerCase() })).body
    expect(info).toMatchObject({ quizId: made.quizId, title: 'My maths quiz', questionCount: 4 })
    expect(JSON.stringify(info)).not.toMatch(/owner|hash|correct/)
    expect((await w.call({ op: 'info', code: 'ZZZZZZ' })).statusCode).toBe(404)
    expect((await w.call({ op: 'info', code: 'abc' })).statusCode).toBe(404)
    w.at(START + 31 * 86_400_000)
    expect((await w.call({ op: 'info', code: made.code })).statusCode).toBe(404)
  })

  it('only the maker (with the secret) can delete it, and everything goes with it', async () => {
    const w = world({ quizzes: [{ id: 'admin-quiz', title: 'Official', is_custom: false }], quiz_questions: [] })
    const made = await w.make()
    expect((await w.call({ op: 'remove', code: made.code, manageToken: 'wrong' })).statusCode).toBe(404)
    expect((await w.call({ op: 'remove', code: made.code })).statusCode).toBe(404)
    expect(w.db.tables.quizzes).toHaveLength(2)
    expect((await w.call({ op: 'remove', code: made.code, manageToken: made.manageToken })).body).toEqual({ removed: true })
    expect(w.db.tables.quizzes.map((q) => q.id)).toEqual(['admin-quiz'])
    expect(w.db.tables.quiz_questions).toHaveLength(0)
  })

  it('an official quiz can never be found or deleted through a code', async () => {
    const w = world({ quizzes: [{ id: 'official', title: 'Official', is_custom: false, custom_code: 'ABCDEF' }] })
    expect((await w.call({ op: 'info', code: 'ABCDEF' })).statusCode).toBe(404)
  })
})

describe('community sets in practice and battles', () => {
  it('can be practised, and stops working when it expires', async () => {
    const w = world()
    const made = await w.make()
    const info = await w.practice({ op: 'info', quizId: made.quizId })
    expect(info.statusCode).toBe(200)
    expect(info.body).toMatchObject({ title: 'My maths quiz', questionCount: 4, battleEnabled: true })
    const run = await w.practice({ op: 'start', quizId: made.quizId, nickname: 'Ada', avatarId: 1 })
    expect(run.statusCode).toBe(200)
    w.at(START + 31 * 86_400_000)
    expect((await w.practice({ op: 'info', quizId: made.quizId })).statusCode).toBe(404)
    expect((await w.practice({ op: 'state', token: run.body.token })).statusCode).toBe(404)
  })

  it('never shows up in the public practice or battle lists, but a battle can be started on it', async () => {
    const w = world({ quizzes: [{ id: '11111111-1111-4111-8111-111111111111', title: 'Official', practice_enabled: true, battle_enabled: true }], quiz_questions: [{ id: 'q1', quiz_id: '11111111-1111-4111-8111-111111111111', position: 0, type: 'multiple', text: 'Q?', options: ['a', 'b'], correct_index: 0, time_limit_seconds: 20, points: 1000 }] })
    const made = await w.make()
    const practiceList = (await w.practice({ op: 'list' })).body.quizzes
    expect(practiceList.map((q) => q.title)).toEqual(['Official'])
    const battleList = (await w.battle({ op: 'list' })).body.quizzes
    expect(battleList.map((q) => q.title)).toEqual(['Official'])
    const asked = (await w.battle({ op: 'list', quizId: made.quizId })).body.quizzes
    expect(asked.map((q) => q.title).sort()).toEqual(['My maths quiz', 'Official'])
    const duel = await w.battle({ op: 'create', quizId: made.quizId, mode: 'duel', vsBot: true, nickname: 'Ada', avatarId: 1 })
    expect(duel.statusCode).toBe(200)
    expect(duel.body.total).toBe(4)
  })

  it('an expired set cannot start a battle, and its battles never change the ranking', async () => {
    const w = world()
    const made = await w.make()
    const a = (await w.battle({ op: 'create', quizId: made.quizId, mode: 'duel', nickname: 'Ada', avatarId: 1, tag: 'tag-aaaaaaaaaaaaaaaa' })).body
    w.at(START + 1000)
    const b = (await w.battle({ op: 'join', code: a.code, nickname: 'Bayo', avatarId: 2, tag: 'tag-bbbbbbbbbbbbbbbb' })).body
    expect(b.state).toBe('question')
    w.at(START + 1000 + 50_000)
    await w.battle({ op: 'state', token: a.token })
    expect((await w.battle({ op: 'state', token: a.token })).body.state).toBe('finished') // b went silent
    expect(w.db.tables.quiz_battle_ratings).toHaveLength(0)
    w.at(START + 31 * 86_400_000)
    expect((await w.battle({ op: 'create', quizId: made.quizId, mode: 'challenge', nickname: 'Ada', avatarId: 1 })).statusCode).toBe(404)
  })
})
