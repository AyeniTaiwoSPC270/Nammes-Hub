import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import QuestionCard from './QuestionCard'
import { blankQuestion, QUESTION_TYPE_INFO } from '../../../data/quiz'

const render = (q) => renderToStaticMarkup(<QuestionCard question={q} number={1} total={3} onChange={() => {}} onMove={() => {}} onRemove={() => {}} />)

describe('QuestionCard', () => {
  it('draws every question type with the fields that type needs', () => {
    for (const type of Object.keys(QUESTION_TYPE_INFO)) {
      const html = render({ ...blankQuestion(type), text: 'Hi' })
      expect(html, type).toContain('Question 1')
    }
    expect(render(blankQuestion('numeric'))).toContain('Allowed margin')
    expect(render(blankQuestion('text'))).toContain('Accepted answers')
    expect(render(blankQuestion('truefalse'))).toContain('True')
    expect(render(blankQuestion('multiple'))).toContain('Answer 4')
  })
  it('hides points and double-points for a poll', () => {
    expect(render(blankQuestion('poll'))).not.toContain('Double points round')
    expect(render(blankQuestion('multiple'))).toContain('Double points round')
  })
  it('asks for alt text once there is a picture, and previews maths', () => {
    const withPicture = render({ ...blankQuestion(), image_path: null, imageBlob: new Blob(['x']), imagePreview: 'blob:x', image_alt: '' })
    expect(withPicture).toContain('Describe the picture')
    expect(render({ ...blankQuestion(), text: 'Solve $x^2$' })).toContain('Preview')
  })

  it('offers an explanation on every question, picture or not, with a live counter', () => {
    // The reveal explanation is not part of the picture block: most of them explain a calculation, not a diagram.
    const plain = render({ ...blankQuestion(), text: 'Hi', explanation: 'Because of the second law.' })
    expect(plain).toContain('Explanation shown on the reveal')
    expect(plain).toContain('26/500')
    expect(plain).toContain('Because of the second law.')
    expect(render(blankQuestion('numeric'))).toContain('Explanation shown on the reveal')
  })

  it('keeps the explanation when the answer type changes', () => {
    // changeType() rebuilds the question and lists, field by field, what carries over. An explanation used to be
    // missing from that list, so switching a written question from multiple choice to a number threw away why the
    // answer was right. The list is only reachable through the <select> onChange, and vitest runs on defaults here
    // (node, no jsdom), so this is a source scan -- the same idiom index.css uses to keep a keyframe from going missing.
    const source = readFileSync(new URL('./QuestionCard.jsx', import.meta.url), 'utf8')
    const start = source.indexOf('function changeType')
    const carryOver = source.slice(start, source.indexOf('\n  }', start))
    expect(start, 'changeType() should still exist').toBeGreaterThan(-1)
    expect(carryOver).toMatch(/explanation: question\.explanation/)
  })
})
