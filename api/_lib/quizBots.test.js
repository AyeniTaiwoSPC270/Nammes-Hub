import { describe, it, expect } from 'vitest'
import { botDecision, botNicknames, questionDifficulty, skillForBot, seeded, BOT_SKILLS } from './quizBots.js'

const choice = { id: 'q1', type: 'multiple', options: ['a', 'b', 'c', 'd'], correct_index: 2, points: 1000 }

describe('questionDifficulty', () => {
  it('uses the difficulty that was set, else the points', () => {
    expect(questionDifficulty({ difficulty: 'hard', points: 500 })).toBe('hard')
    expect(questionDifficulty({ points: 500 })).toBe('easy')
    expect(questionDifficulty({ points: 1000 })).toBe('medium')
    expect(questionDifficulty({ points: 2000 })).toBe('hard')
  })
})

describe('botDecision', () => {
  it('is the same every time for the same bot and question', () => {
    const a = botDecision({ botId: 'bot-1', skill: 'average', question: choice, limitMs: 20000 })
    expect(botDecision({ botId: 'bot-1', skill: 'average', question: choice, limitMs: 20000 })).toEqual(a)
  })
  it('thinks inside the time limit', () => {
    for (let i = 0; i < 200; i++) {
      const d = botDecision({ botId: `b${i}`, skill: 'beginner', question: choice, limitMs: 20000 })
      expect(d.thinkMs).toBeGreaterThan(0)
      expect(d.thinkMs).toBeLessThan(20000)
    }
  })
  it('gets more right the better its skill, and fewer on hard questions', () => {
    const rate = (skill, difficulty) => {
      let right = 0
      for (let i = 0; i < 2000; i++) if (botDecision({ botId: `bot-${i}`, skill, question: { ...choice, difficulty }, limitMs: 20000 }).correct) right++
      return right / 2000
    }
    expect(rate('expert', 'medium')).toBeGreaterThan(rate('average', 'medium'))
    expect(rate('average', 'medium')).toBeGreaterThan(rate('beginner', 'medium'))
    expect(rate('average', 'easy')).toBeGreaterThan(0.8)
    expect(rate('average', 'hard')).toBeLessThan(0.45)
  })
  it('submits the right option when it is right and another option when it is not', () => {
    for (let i = 0; i < 100; i++) {
      const d = botDecision({ botId: `x${i}`, skill: 'average', question: choice, limitMs: 10000 })
      expect(d.submission.chosenIndex === 2).toBe(d.correct)
    }
  })
  it('answers typed and number questions in a way that grades the same', () => {
    const num = { id: 'n', type: 'numeric', numeric_answer: 366, numeric_tolerance: 0, points: 500 }
    const text = { id: 't', type: 'text', accepted_answers: ['Tokyo'], points: 500 }
    for (let i = 0; i < 50; i++) {
      const n = botDecision({ botId: `n${i}`, skill: 'average', question: num, limitMs: 20000 })
      expect(Number(n.submission.answerText) === 366).toBe(n.correct)
      const t = botDecision({ botId: `t${i}`, skill: 'average', question: text, limitMs: 20000 })
      expect(t.submission.answerText === 'Tokyo').toBe(t.correct)
    }
  })
  it('picks any option on a poll and is never right or wrong', () => {
    const d = botDecision({ botId: 'p', skill: 'average', question: { id: 'p', type: 'poll', options: ['a', 'b'] }, limitMs: 10000 })
    expect(d.correct).toBeNull()
    expect([0, 1]).toContain(d.submission.chosenIndex)
  })
  // An ordering and a diagram question used to fall through to the typed branch and submit answerText: 'not sure',
  // which the answer handler refused, so every bot sat the question out and the host watched "0 of 11 answered" on a
  // question their own phones could answer. A test bot that cannot answer is not a test bot.
  it('answers an ordering question with a permutation of the steps it was shown', () => {
    const order = { id: 'o', type: 'order', options: ['Start', 'Isolate', 'Test', 'Issue'], correct_index: null, points: 500 }
    for (let i = 0; i < 50; i++) {
      const d = botDecision({ botId: `o${i}`, skill: 'average', question: order, limitMs: 20000 })
      const sent = d.submission.order
      expect(Array.isArray(sent), `bot ${i} sent no ordering answer`).toBe(true)
      // A permutation of every step exactly once: a repeated or missing step is refused by the handler, not graded.
      expect([...sent].sort((a, b) => a - b)).toEqual([0, 1, 2, 3])
      expect(sent.join() === '0,1,2,3').toBe(d.correct)
    }
  })
  it('answers a diagram question with a point inside the picture', () => {
    const diagram = {
      id: 'd', type: 'diagram', options: [], correct_index: null, points: 500,
      diagram_targets: [{ x: 0.5, y: 0.25, r: 0.08, ar: 1.5 }],
    }
    for (let i = 0; i < 50; i++) {
      const d = botDecision({ botId: `d${i}`, skill: 'average', question: diagram, limitMs: 20000 })
      const tap = d.submission.tap
      expect(tap, `bot ${i} sent no tap`).toBeTruthy()
      expect(Number.isFinite(tap.x) && tap.x >= 0 && tap.x <= 1).toBe(true)
      expect(Number.isFinite(tap.y) && tap.y >= 0 && tap.y <= 1).toBe(true)
      // Right when it landed on a marked region. Only one direction is asserted: a bot that was wrong taps a random point,
// and on a small region that point can still land inside by chance, which is a legitimately lucky miss rather than a bug.
const inRegion = Math.hypot(tap.x - 0.5, tap.y - 0.25) <= 0.08
      if (d.correct) expect(inRegion, `bot ${i} was right but missed the region`).toBe(true)
    }
  })
})

describe('skillForBot', () => {
  it('uses the chosen skill, and spreads "mixed" across all three', () => {
    expect(skillForBot('expert', 3)).toBe('expert')
    const mixed = new Set(Array.from({ length: 10 }, (_, i) => skillForBot('mixed', i)))
    expect([...mixed].sort()).toEqual([...BOT_SKILLS].sort())
  })
})

describe('botNicknames', () => {
  it('makes distinct names that fit a nickname and skip taken ones', () => {
    const names = botNicknames(120, ['Tobi_Pi'])
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(120)
    expect(names.every((n) => n.length <= 20)).toBe(true)
    expect(names.map((n) => n.toLowerCase())).not.toContain('tobi_pi')
  })
  it('seeded stays in range', () => {
    for (let i = 0; i < 100; i++) {
      const v = seeded(`k${i}`, i)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
