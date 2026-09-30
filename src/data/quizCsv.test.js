import { describe, it, expect } from 'vitest'
import { parseCsv, questionsFromCsv, questionsToCsv, CSV_COLUMNS } from './quizCsv'
import { blankQuestion, cleanQuestion } from './quizQuestions'

const BOM = String.fromCharCode(0xfeff)
const HEADER = CSV_COLUMNS.join(',')

describe('parseCsv', () => {
  it('reads plain rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })
  it('handles quotes, commas, doubled quotes and line breaks inside cells', () => {
    expect(parseCsv('"Hello, world","She said ""hi""","line1\nline2"')).toEqual([['Hello, world', 'She said "hi"', 'line1\nline2']])
  })
  it('handles Windows line endings, a byte-order mark and blank lines', () => {
    expect(parseCsv(`${BOM}a,b\r\n\r\n1,2\r\n`)).toEqual([['a', 'b'], ['1', '2']])
  })
  it('reads tab-separated text pasted from a spreadsheet', () => {
    expect(parseCsv('q\ta\tb\nWhat?\tyes\tno')).toEqual([['q', 'a', 'b'], ['What?', 'yes', 'no']])
  })
  it('keeps empty cells and handles a last row with no line break', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']])
    expect(parseCsv('')).toEqual([])
  })
})

describe('questionsFromCsv', () => {
  it('imports multiple choice with a header row', () => {
    const { questions, problems } = questionsFromCsv(`${HEADER}\nmultiple,Capital of Nigeria?,Lagos,Abuja,Kano,,B,30,2000`)
    expect(problems).toEqual([])
    expect(questions).toHaveLength(1)
    expect(questions[0]).toMatchObject({ type: 'multiple', text: 'Capital of Nigeria?', correct_index: 1, time_limit_seconds: 30, points: 2000 })
    expect(questions[0].options).toEqual(['Lagos', 'Abuja', 'Kano', ''])
  })
  it('imports a simple sheet with no header as multiple choice', () => {
    const { questions, problems } = questionsFromCsv('2 + 2?,3,4,5,6,b\n3 x 3?,6,9,12,15,B')
    expect(problems).toEqual([])
    expect(questions.map((q) => q.correct_index)).toEqual([1, 1])
    expect(questions[0].time_limit_seconds).toBe(20)
    expect(questions[0].points).toBe(1000)
  })
  it('imports every type', () => {
    const csv = [
      HEADER,
      'truefalse,The earth is round,,,,,True,,',
      'numeric,What is pi to 2 places?,,,,,3.14|0.01,,',
      'text,Who wrote the first program?,,,,,Ada Lovelace|Lovelace,,',
      'poll,Favourite course?,MTH,STA,CSC,,,,',
    ].join('\n')
    const { questions, problems } = questionsFromCsv(csv)
    expect(problems).toEqual([])
    expect(questions.map((q) => q.type)).toEqual(['truefalse', 'numeric', 'text', 'poll'])
    expect(cleanQuestion(questions[1])).toMatchObject({ numeric_answer: 3.14, numeric_tolerance: 0.01 })
    expect(cleanQuestion(questions[2]).accepted_answers).toEqual(['Ada Lovelace', 'Lovelace'])
    expect(cleanQuestion(questions[3]).options).toEqual(['MTH', 'STA', 'CSC'])
  })
  it('snaps odd times and points to the editor choices', () => {
    const { questions } = questionsFromCsv(`${HEADER}\nmultiple,Q,a,b,,,A,25,900`)
    expect(questions[0].time_limit_seconds).toBe(20)
    expect(questions[0].points).toBe(1000)
  })
  it('reports problems by line and keeps the good rows', () => {
    const csv = [HEADER, 'multiple,Fine?,a,b,,,A,,', 'multiple,No answer letter?,a,b,,,,,', 'banana,Bad type,a,b,,,A,,', 'multiple,,a,b,,,A,,', 'numeric,Num?,,,,,abc,,', 'multiple,One option,a,,,,A,,'].join('\n')
    const { questions, problems } = questionsFromCsv(csv)
    expect(questions).toHaveLength(1)
    expect(problems.map((p) => p.line)).toEqual([3, 4, 5, 6, 7])
    expect(problems[0].message).toMatch(/letter/)
    expect(problems[1].message).toMatch(/type/)
  })
  it('says so for an empty file', () => {
    expect(questionsFromCsv('').problems[0].message).toMatch(/empty/i)
  })
  it('limits a huge file', () => {
    const rows = Array.from({ length: 205 }, (_, i) => `Q${i}?,a,b,,,A`).join('\n')
    const { questions, problems } = questionsFromCsv(rows)
    expect(questions).toHaveLength(200)
    expect(problems[0].message).toMatch(/at most 200/)
  })
})

describe('export and import round trip', () => {
  const make = (over) => ({ ...blankQuestion(), text: 'Q', options: ['a', 'b', '', ''], ...over })
  it('gives back the same questions', () => {
    const originals = [
      make({ text: 'Commas, "quotes" and\nnew lines', options: ['x,y', 'he said "no"', 'c', ''], correct_index: 2, time_limit_seconds: 60, points: 500 }),
      make({ type: 'truefalse', text: 'Round?', correct_index: 1 }),
      make({ type: 'numeric', text: 'Pi?', numeric_answer: '3.14', numeric_tolerance: '0.01' }),
      make({ type: 'numeric', text: 'Minus two?', numeric_answer: '-2', numeric_tolerance: '0' }),
      make({ type: 'text', text: 'Who?', accepted_text: 'Ada\nLovelace' }),
      make({ type: 'poll', text: 'Fav?', options: ['a', 'b', 'c', 'd'] }),
    ]
    const csv = questionsToCsv(originals)
    const { questions, problems } = questionsFromCsv(csv)
    expect(problems).toEqual([])
    expect(questions).toHaveLength(originals.length)
    originals.forEach((o, i) => {
      const a = cleanQuestion(o)
      const b = cleanQuestion(questions[i])
      for (const key of ['type', 'text', 'options', 'correct_index', 'numeric_answer', 'numeric_tolerance', 'accepted_answers', 'time_limit_seconds', 'points']) {
        expect(b[key], `${i} ${key}`).toEqual(a[key])
      }
    })
  })
  it('keeps formula-looking cells as text in the file, and restores them on import', () => {
    const csv = questionsToCsv([make({ text: '=SUM(A1:A9)', options: ['+1', '-2', '@x', '=3'], correct_index: 0 })])
    const dataLine = csv.split('\r\n')[1]
    expect(dataLine.startsWith("multiple,'=SUM(A1:A9),'+1,'-2,'@x,'=3")).toBe(true)
    const { questions } = questionsFromCsv(csv)
    expect(questions[0].text).toBe('=SUM(A1:A9)')
    expect(questions[0].options).toEqual(['+1', '-2', '@x', '=3'])
  })
})
