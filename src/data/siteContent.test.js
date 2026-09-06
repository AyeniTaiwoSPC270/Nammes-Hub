import { describe, it, expect } from 'vitest'
import { splitParagraphs } from './siteContent'

describe('splitParagraphs', () => {
  it('splits text on blank lines into paragraphs', () => {
    expect(splitParagraphs('First para.\n\nSecond para.')).toEqual(['First para.', 'Second para.'])
  })
  it('returns a single paragraph when there are no blank lines', () => {
    expect(splitParagraphs('Just one paragraph.')).toEqual(['Just one paragraph.'])
  })
  it('returns an empty array for empty or missing text', () => {
    expect(splitParagraphs('')).toEqual([])
    expect(splitParagraphs(undefined)).toEqual([])
  })
  it('trims surrounding whitespace and drops blank paragraphs', () => {
    expect(splitParagraphs('\n\nFirst.\n\n\n\nSecond.\n\n')).toEqual(['First.', 'Second.'])
  })
})
