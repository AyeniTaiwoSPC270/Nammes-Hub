import { describe, it, expect } from 'vitest'
import { questionsFromCsv } from './quizCsv'
import { cleanQuestion } from './quizQuestions'
import { sanitizeCustomQuestions } from '../../api/_lib/quizCustom.js'

// What the "Make a quiz" page does with a pasted spreadsheet: read it, clean it, then run the same checks the server runs.
const pipeline = (text) => {
  const { questions, problems } = questionsFromCsv(text)
  const checked = sanitizeCustomQuestions(questions.map((q) => cleanQuestion(q)))
  return { good: checked.questions, problems: [...problems, ...checked.problems] }
}

describe('make-a-quiz import pipeline', () => {
  it('accepts the template rows, in every question type', () => {
    const { good, problems } = pipeline([
      'type,question,option_a,option_b,option_c,option_d,correct,seconds,points',
      'multiple,What is the capital of Ghana?,Lagos,Accra,Kumasi,Abuja,B,20,1000',
      'truefalse,The sun is a star.,,,,,True,10,500',
      'numeric,How many days are in a leap year?,,,,,366,20,1000',
      'text,What is the capital of France?,,,,,Paris|paris,30,1000',
    ].join('\r\n'))
    expect(problems).toEqual([])
    expect(good.map((q) => q.type)).toEqual(['multiple', 'truefalse', 'numeric', 'text'])
    expect(good[0]).toMatchObject({ correct_index: 1, options: ['Lagos', 'Accra', 'Kumasi', 'Abuja'] })
    expect(good[2].numeric_answer).toBe(366)
    expect(good[3].accepted_answers).toEqual(['Paris'])
  })

  it('accepts a plain list pasted from Excel (tab separated, no header)', () => {
    const { good, problems } = pipeline('2 + 2?\t3\t4\t5\t6\tB\n5 x 5?\t10\t20\t25\t30\tC')
    expect(problems).toEqual([])
    expect(good).toHaveLength(2)
    expect(good[1].correct_index).toBe(2)
  })

  it('reports polls and blocked words with their row', () => {
    const { problems } = pipeline('type,question,option_a,option_b,option_c,option_d,correct\npoll,Fav colour?,red,blue,,,\nmultiple,Who is a shit?,a,b,c,d,A')
    expect(problems.some((p) => /multiple choice/i.test(p.message) || /poll/i.test(p.message))).toBe(true)
    expect(problems.some((p) => /not allowed/i.test(p.message))).toBe(true)
  })
})
