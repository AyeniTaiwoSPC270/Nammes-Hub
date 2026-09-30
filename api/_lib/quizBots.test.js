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
