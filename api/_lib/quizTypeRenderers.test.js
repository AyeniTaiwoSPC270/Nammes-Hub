import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { QUESTION_TYPES, TYPE_INFO, isChoiceTypeSource } from './quizTypes.js'

// The sibling of the index.css keyframe scan. A type that reaches the database, the editor and the projector but has no
// branch in a phone renderer is a question a student can be shown and not answer, and nothing else would report it:
// there is no failing test, just a class of silent dead ends in a live game.
//
// Reachability is not the same as a literal. A choice type is reached through isChoiceType, and numeric and text both
// fall through to the typed box. What must appear literally is a type whose GRADING differs, because that is the one
// that needs its own branch.

const RENDERERS = [
  'src/pages/PlayQuiz.jsx',
  'src/pages/HostQuiz.jsx',
  'src/pages/PlayPractice.jsx',
  'src/pages/PlayBattle.jsx',
]

const source = (file) => readFileSync(file, 'utf8')

// The types whose submission is not a single index and therefore need a branch of their own on every surface.
const NEEDS_OWN_BRANCH = QUESTION_TYPES.filter((type) => !isChoiceTypeSource(type) && type !== 'numeric' && type !== 'text')

describe('every question type reaches the screens that draw it', () => {
  for (const file of RENDERERS) {
    it(`${file} covers the choice types through the shared helper`, () => {
      expect(source(file), `${file} should branch on isChoiceType`).toContain('isChoiceType')
    })

    for (const type of NEEDS_OWN_BRANCH) {
      it(`${file} draws ${type} on its own`, () => {
        // order and diagram are not in the exam engine, and the exam view is checked separately below.
        if (type === 'diagram' && file === 'src/components/cbt/QuestionView.jsx') return
        const text = source(file)
        const named = text.includes(`'${type}'`) || text.includes(`"${type}"`) || text.includes(`${type}Pick`) || text.includes(`${type}Draft`)
        expect(named, `${file} has no branch for ${type}`).toBe(true)
      })
    }
  }

  it('the exam view draws ordering and units, and does not draw a diagram', () => {
    // Mirrors cbt.js:52 and quiz-cbt.js:57. If a diagram ever appears here, the image pipeline has to come with it.
    const text = source('src/components/cbt/QuestionView.jsx')
    expect(text).toContain("'order'")
    expect(text).toContain('question.unit')
    expect(text).not.toContain("'diagram'")
  })

  it('the exam allow-list excludes diagram for the same reason it excludes a poll', () => {
    expect(TYPE_INFO.diagram.cbt).toBe(false)
    expect(TYPE_INFO.order.cbt).toBe(true)
    expect(TYPE_INFO.numeric.cbt).toBe(true)
  })

  it('a community set can author a unit question but not an ordering or a diagram', () => {
    // An ordering answer needs a scored round the host decides, and a diagram needs a picture upload the community
    // importer has no place for.
    expect(TYPE_INFO.numeric.custom).toBe(true)
    expect(TYPE_INFO.order.custom).toBe(false)
    expect(TYPE_INFO.diagram.custom).toBe(false)
  })

  it('the live phone sends an ordering answer as a permutation and a diagram answer as a normalised point', () => {
    const text = source('src/pages/PlayQuiz.jsx')
    expect(text).toContain('order: orderDraft')
    expect(text).toContain('tap: diagramDraft')
  })
})