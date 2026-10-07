import { describe, expect, it } from 'vitest'
import { DEFAULT_CARD, sanitizeCard } from './quizCard.js'

const QUIZ = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

describe('sanitizeCard', () => {
  it('fills in every default from an empty object', () => {
    expect(sanitizeCard({})).toEqual(DEFAULT_CARD)
  })

  it('fills in every default from junk', () => {
    expect(sanitizeCard('nope')).toEqual(DEFAULT_CARD)
    expect(sanitizeCard([1, 2, 3])).toEqual(DEFAULT_CARD)
    expect(sanitizeCard(null)).toEqual(DEFAULT_CARD)
  })

  it('keeps a lowercased hex accent and drops anything else', () => {
    expect(sanitizeCard({ accent: '#FF5A1F' }).accent).toBe('#ff5a1f')
    expect(sanitizeCard({ accent: 'red' }).accent).toBeNull()
    expect(sanitizeCard({ accent: '#ff5a' }).accent).toBeNull()
  })

  it('treats any flag that is not literal false as on', () => {
    expect(sanitizeCard({ showStreak: false }).showStreak).toBe(false)
    expect(sanitizeCard({ showStreak: 0 }).showStreak).toBe(true)
    expect(sanitizeCard({ showStreak: 'no' }).showStreak).toBe(true)
  })

  it('keeps a background path in this quiz folder only', () => {
    const path = `${QUIZ}/33333333-3333-4333-8333-333333333333-1700000000000.jpg`
    expect(sanitizeCard({ background: path }, { quizId: QUIZ }).background).toBe(path)
    expect(sanitizeCard({ background: `${OTHER}/x.jpg` }, { quizId: QUIZ }).background).toBeNull()
    expect(sanitizeCard({ background: 'https://evil.example/x.jpg' }, { quizId: QUIZ }).background).toBeNull()
  })

  it('is idempotent', () => {
    const once = sanitizeCard({ accent: '#ABCDEF', showTeam: false }, { quizId: QUIZ })
    expect(sanitizeCard(once, { quizId: QUIZ })).toEqual(once)
  })

  it('never returns a key that is not in DEFAULT_CARD', () => {
    expect(Object.keys(sanitizeCard({ nonsense: true })).sort()).toEqual(Object.keys(DEFAULT_CARD).sort())
  })
})