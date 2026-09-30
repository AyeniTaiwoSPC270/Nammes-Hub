import { describe, it, expect } from 'vitest'
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
})
