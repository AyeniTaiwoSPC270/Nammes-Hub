import { describe, expect, it } from 'vitest'
import { createQuizCastHandler } from './handlers/quiz-cast.js'
import { QUIZ, SESSION, fakeDb, fakeRes } from './quizTestKit.js'

const post = (body) => ({ method: 'POST', headers: {}, body })
const caller = (isAdmin) => async () => ({ isAdmin })
const character = (overrides = {}) => ({
  slot: 0,
  name: 'Kola',
  spec: { body: 'pot', color: '#ff5a1f' },
  moves: { idle: 'sway' },
  ...overrides,
})

describe('quiz character cast handler', () => {
  it('answers a roster by join code from the session snapshot', async () => {
    const db = fakeDb({ quiz_sessions: [{ id: SESSION, join_code: '123456', quiz_id: QUIZ, characters: { mode: 'all', characters: [character()] } }] })
    const res = fakeRes()
    await createQuizCastHandler(() => db, { getCaller: caller(false) })(post({ op: 'roster', code: '123456' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ mode: 'all', characters: [{ slot: 0, name: 'Kola', spec: { body: 'pot' } }] })
  })

  it('answers a roster by quiz id and sanitizes the saved rows', async () => {
    const db = fakeDb({
      quizzes: [{ id: QUIZ, cast_mode: 'custom' }],
      quiz_characters: [{ id: 'c1', quiz_id: QUIZ, ...character({ spec: { body: 'pot', color: 'red' }, moves: {} }) }],
    })
    const res = fakeRes()
    await createQuizCastHandler(() => db, { getCaller: caller(false) })(post({ op: 'roster', quizId: QUIZ }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.characters[0].spec).toMatchObject({ body: 'pot', color: null, topper: 'none' })
  })

  it('returns 404 when the join code does not name a session', async () => {
    const res = fakeRes()
    await createQuizCastHandler(() => fakeDb(), { getCaller: caller(false) })(post({ op: 'roster', code: '999999' }), res)
    expect(res.statusCode).toBe(404)
  })

  it('allows no caller to save a cast', async () => {
    const res = fakeRes()
    await createQuizCastHandler(() => fakeDb({ quiz_characters: [] }), { getCaller: caller(false) })(post({ op: 'cast', quizId: QUIZ, characters: [] }), res)
    expect(res.statusCode).toBe(403)
  })

  it('updates by row id, removes dropped entries, and keeps the remaining slot unchanged', async () => {
    const db = fakeDb({
      quizzes: [{ id: QUIZ, cast_mode: 'all' }],
      quiz_characters: [
        { id: 'c1', quiz_id: QUIZ, ...character() },
        { id: 'c2', quiz_id: QUIZ, ...character({ slot: 1, name: 'Gone' }) },
      ],
    })
    const res = fakeRes()
    await createQuizCastHandler(() => db, { getCaller: caller(true) })(
      post({ op: 'cast', quizId: QUIZ, mode: 'all', characters: [character({ id: 'c1', name: 'Kolar' })] }), res,
    )
    expect(res.statusCode).toBe(200)
    expect(db.tables.quiz_characters).toHaveLength(1)
    expect(db.tables.quiz_characters[0]).toMatchObject({ id: 'c1', slot: 0, name: 'Kolar' })
    expect(db.tables.quizzes[0].cast_mode).toBe('all')
  })

  it('rejects a move into a slot that is still occupied without changing the cast', async () => {
    const original = [
      { id: 'c1', quiz_id: QUIZ, ...character() },
      { id: 'c2', quiz_id: QUIZ, ...character({ slot: 1, name: 'B' }) },
    ]
    const db = fakeDb({ quizzes: [{ id: QUIZ }], quiz_characters: structuredClone(original) })
    const res = fakeRes()
    await createQuizCastHandler(() => db, { getCaller: caller(true) })(
      post({ op: 'cast', quizId: QUIZ, mode: 'all', characters: [character({ id: 'c1', slot: 1 })] }), res,
    )
    expect(res.statusCode).toBe(400)
    expect(db.tables.quiz_characters).toEqual(original)
  })

  it('requires a POST and a valid quiz id for a save', async () => {
    const handler = createQuizCastHandler(() => fakeDb(), { getCaller: caller(true) })
    const wrongMethod = fakeRes()
    await handler({ method: 'GET', body: { op: 'cast', quizId: QUIZ } }, wrongMethod)
    expect(wrongMethod.statusCode).toBe(405)
    const badId = fakeRes()
    await handler(post({ op: 'cast', quizId: 'bad', characters: [] }), badId)
    expect(badId.statusCode).toBe(400)
  })
})
