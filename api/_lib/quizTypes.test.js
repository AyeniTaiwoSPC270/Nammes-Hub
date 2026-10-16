import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  TYPE_INFO,
  QUESTION_TYPES,
  CBT_QUESTION_TYPES,
  CUSTOM_QUESTION_TYPES,
  QUESTION_TYPE_INFO,
  cbtTypeLabel,
  resolveTypeAlias,
} from './quizTypes.js'

// Every list of question types used to be written out by hand, five times. The failure mode was not a crash: a type
// added to one list and missed in another worked on the projector and was silently dropped for a community set, or
// imported from a spreadsheet and then refused to save. These tests are the reason that can no longer happen quietly.

describe('quizTypes', () => {
  it('gives every type a label, a hint and at least one way to be spelled in a spreadsheet', () => {
    for (const type of QUESTION_TYPES) {
      const info = TYPE_INFO[type]
      expect(info.label, type).toBeTruthy()
      expect(info.hint, type).toBeTruthy()
      expect(info.cbtLabel, type).toBeTruthy()
      expect(Array.isArray(info.aliases), type).toBe(true)
      // The canonical name always resolves, so a round trip through the alias map is stable.
      expect(resolveTypeAlias(type), type).toBe(type)
      expect(resolveTypeAlias(type.toUpperCase()), type).toBe(type)
    }
  })

  it('never gives two types the same spreadsheet spelling', () => {
    const seen = new Map()
    for (const type of QUESTION_TYPES) {
      for (const alias of [type, ...TYPE_INFO[type].aliases]) {
        const key = alias.trim().toLowerCase()
        expect(seen.has(key), `"${key}" maps to both ${seen.get(key)} and ${type}`).toBe(false)
        seen.set(key, type)
      }
    }
  })

  it('keeps a poll out of the exam engine and out of community sets', () => {
    // cbt.js:49 — "A poll is not an exam question, so it never takes part."
    expect(CBT_QUESTION_TYPES).not.toContain('poll')
    expect(CUSTOM_QUESTION_TYPES).not.toContain('poll')
    expect(QUESTION_TYPES).toContain('poll')
  })

  it('resolves the spellings a real spreadsheet uses', () => {
    for (const [alias, type] of [
      ['', 'multiple'],
      ['mc', 'multiple'],
      ['Multiple Choice', 'multiple'],
      ['tf', 'truefalse'],
      ['True/False', 'truefalse'],
      ['number', 'numeric'],
      ['short answer', 'text'],
      ['survey', 'poll'],
    ]) {
      expect(resolveTypeAlias(alias), alias).toBe(type)
    }
    expect(resolveTypeAlias('essay')).toBeNull()
    // A sheet with no type column at all is a plain list of questions, and imports as multiple choice.
    expect(resolveTypeAlias(undefined)).toBe('multiple')
    expect(resolveTypeAlias('')).toBe('multiple')
  })

  it('labels a type the exam editor prints inline, falling back to the key for an unexpected row', () => {
    expect(cbtTypeLabel('truefalse')).toBe('True/false')
    expect(cbtTypeLabel('multiple')).toBe('Multiple choice')
    expect(cbtTypeLabel('somethingNew')).toBe('somethingNew')
  })
})

// The derived lists are only worth anything if the code that used to hand-write them actually reads them. These read
// the source rather than the module graph, because a consumer that quietly re-introduces its own literal array is
// exactly the regression being guarded against, and it would still import cleanly.
const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8')

describe('question type consumers read the shared list', () => {
  it('the quiz editor takes its labels and hints from the shared list', () => {
    const source = read('../../src/data/quizQuestions.js')
    expect(source).toMatch(/import \{ QUESTION_TYPE_INFO \} from '\.\.\/\.\.\/api\/_lib\/quizTypes\.js'/)
    // No hand-written type map may come back.
    expect(source).not.toMatch(/QUESTION_TYPE_INFO\s*=\s*\{/)
  })

  it('the exam editor takes its labels from the shared list', () => {
    const source = read('../../src/components/admin/cbt/ExamEditor.jsx')
    expect(source).toMatch(/import \{ cbtTypeLabel \} from '\.\.\/\.\.\/\.\.\/\.\.\/api\/_lib\/quizTypes\.js'/)
    expect(source).not.toMatch(/const TYPE_LABEL\s*=/)
  })

  it('the CSV importer resolves types through the shared list', () => {
    const source = read('../../src/data/quizCsv.js')
    expect(source).toMatch(/import \{ resolveTypeAlias \} from '\.\.\/\.\.\/api\/_lib\/quizTypes\.js'/)
    expect(source).not.toMatch(/const TYPE_ALIASES\s*=/)
  })

  it('community sets read their allowed types from the shared list', () => {
    const source = read('./quizCustom.js')
    expect(source).toMatch(/import \{ CUSTOM_QUESTION_TYPES \} from '\.\/quizTypes\.js'/)
    expect(source).toMatch(/const TYPES = CUSTOM_QUESTION_TYPES/)
  })

  it('grading no longer keeps its own copy of the list', () => {
    const source = read('./quizGrading.js')
    expect(source).not.toMatch(/QUESTION_TYPES\s*=\s*\[/)
  })
})

describe('the derived editor list', () => {
  it('is exactly the label and hint of every type, and nothing else', () => {
    expect(Object.keys(QUESTION_TYPE_INFO)).toEqual(QUESTION_TYPES)
    for (const type of QUESTION_TYPES) {
      expect(QUESTION_TYPE_INFO[type].label).toBe(TYPE_INFO[type].label)
      expect(QUESTION_TYPE_INFO[type].hint).toBe(TYPE_INFO[type].hint)
    }
  })
})