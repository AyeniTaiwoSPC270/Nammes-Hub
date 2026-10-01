import { describe, it, expect, beforeEach } from 'vitest'
import {
  clockOffset, msLeft, formatClock, clockTone, formatDuration, answeredCount, questionState, loadActive, saveActive, clearActive,
  loadHistory, saveHistory, historyFor, progressFor, progressSummary, shareText,
} from './cbt'
import { questionsFromCsv, questionsToCsv, CBT_COLUMNS } from './quizCsv'
import { bankFromText } from './cbtAdmin'

beforeEach(() => {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
})

describe('the clock', () => {
  it('corrects for a phone whose clock is wrong', () => {
    const offset = clockOffset(10_000, 4_000) // the server is 6 s ahead of this phone
    expect(offset).toBe(6000)
    expect(msLeft(new Date(70_000).toISOString(), offset, 4_000)).toBe(60_000)
    expect(msLeft(null, 0)).toBeNull()
    expect(clockOffset(undefined)).toBe(0)
  })
  it('formats and colours the countdown', () => {
    expect(formatClock(3_725_000)).toBe('1:02:05')
    expect(formatClock(65_000)).toBe('1:05')
    expect(formatClock(-5)).toBe('0:00')
    expect(clockTone(11 * 60_000)).toBe('calm')
    expect(clockTone(9 * 60_000)).toBe('warn')
    expect(clockTone(30_000)).toBe('danger')
    expect(formatDuration(125)).toBe('2 min 5 s')
    expect(formatDuration(3700)).toBe('1 h 1 min')
  })
})

describe('counting answers', () => {
  const qs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  it('counts only real answers', () => {
    const answers = { a: { choice: 0 }, b: { text: '  ' }, c: { text: '42' } }
    expect(answeredCount(answers, qs)).toBe(2)
    expect(questionState(qs[0], answers, ['a'])).toEqual({ answered: true, flagged: true })
    expect(questionState(qs[1], answers, [])).toEqual({ answered: false, flagged: false })
  })
})

describe('what this device remembers', () => {
  it('keeps the attempt in progress per exam code', () => {
    expect(loadActive('ABC123')).toBeNull()
    saveActive('ABC123', { token: 'secret-token-value', mode: 'exam' })
    saveActive('ZZZ999', { token: 'other-token-value', mode: 'study' })
    expect(loadActive('ABC123')).toMatchObject({ token: 'secret-token-value' })
    clearActive('ABC123')
    expect(loadActive('ABC123')).toBeNull()
    expect(loadActive('ZZZ999')).not.toBeNull()
  })

  it('saves each finished attempt once and works out progress', () => {
    const base = { code: 'ABC123', title: 'Maths', courseCode: 'MTH 101', total: 40, secondsUsed: 600, passed: true }
    saveHistory({ ...base, id: 'one', mode: 'exam', score: 20, percent: 50, at: 1 })
    saveHistory({ ...base, id: 'one', mode: 'exam', score: 20, percent: 50, at: 1 }) // a refresh does not add it twice
    saveHistory({ ...base, id: 'two', mode: 'exam', score: 32, percent: 80, at: 2 })
    saveHistory({ ...base, id: 'three', mode: 'study', score: 40, percent: 100, at: 3 })
    expect(loadHistory()).toHaveLength(3)
    expect(historyFor('ABC123')).toHaveLength(3)
    expect(progressFor('ABC123')).toEqual({ attempts: 2, best: 80, latest: 80 })
    expect(progressFor('NOPE')).toBeNull()
    expect(progressSummary()).toEqual([expect.objectContaining({ code: 'ABC123', attempts: 2, best: 80 })])
  })

  it('ignores damaged storage', () => {
    localStorage.setItem('nammes-cbt-history', '{not json')
    expect(loadHistory()).toEqual([])
    localStorage.setItem('nammes-cbt-active', '[1,2]')
    expect(loadActive('ABC123')).toBeNull()
  })

  it('writes a share line with no name in it', () => {
    expect(shareText({ title: 'Test', courseCode: 'MTH 101', score: 31, total: 40, percent: 77.5, url: 'https://x/cbt/ABC123' })).toBe(
      'I scored 31/40 (77.5%) on MTH 101 Test CBT practice. Try it yourself: https://x/cbt/ABC123',
    )
  })
})

describe('spreadsheets for CBT banks', () => {
  const header = CBT_COLUMNS.join(',')
  it('reads explanation, topic and no_shuffle columns', () => {
    const { questions, problems } = questionsFromCsv(`${header}\nmultiple,Capital of Ghana?,Lagos,Accra,Kumasi,All of the above,B,20,1000,Accra is the capital.,Geography,yes`)
    expect(problems).toEqual([])
    expect(questions[0]).toMatchObject({ explanation: 'Accra is the capital.', topic: 'Geography', no_shuffle: true })
  })

  it('a sheet without the extra columns still imports', () => {
    const { questions } = questionsFromCsv('Capital of Ghana?,Lagos,Accra,Kumasi,Abuja,B')
    expect(questions[0]).toMatchObject({ explanation: '', no_shuffle: false })
  })

  it('imports more than the editor limit when a bigger max is given', () => {
    const rows = Array.from({ length: 300 }, (_, i) => `Question ${i}?,a,b,c,d,A`).join('\n')
    expect(questionsFromCsv(rows).questions).toHaveLength(200)
    expect(questionsFromCsv(rows, { max: 500 }).questions).toHaveLength(300)
  })

  it('round-trips through export and import with the extras kept', () => {
    const text = `${header}\nmultiple,Q one?,A1,B1,C1,D1,C,20,1000,Because C.,Algebra,yes\ntext,Capital of France?,,,,,Paris|paris,20,1000,,,`
    const { questions } = questionsFromCsv(text)
    const out = questionsToCsv(questions, { cbt: true })
    expect(out.split('\r\n')[0]).toBe(header)
    const again = questionsFromCsv(out).questions
    expect(again[0]).toMatchObject({ text: 'Q one?', correct_index: 2, explanation: 'Because C.', topic: 'Algebra', no_shuffle: true })
    expect(again[1].accepted_text).toBe('Paris')
  })

  it('checks admin banks with the trusted rules (no word filter) and names problems by row', () => {
    const ok = bankFromText(`${header}\ntruefalse,Is the sun a star (shit happens)?,,,,,True,10,500,Yes.,Astro,`)
    expect(ok.problems).toEqual([])
    expect(ok.rows[0]).toMatchObject({ explanation: 'Yes.', topic: 'Astro' })
    const bad = bankFromText(`${header}\nmultiple,No right answer?,a,b,,,Z,20,1000,,,`)
    expect(bad.problems[0].line).toBe(2)
  })
})
