import { describe, it, expect } from 'vitest'
import { groupSubmissionsByType, validateSubmissionDraft } from './outlineSubmissions'

const fixture = [
  { id: 'a', type: 'Past Question', title: '2023 exam', session: '2023/2024' },
  { id: 'b', type: 'Past Question', title: '2022 exam', session: '2022/2023' },
  { id: 'c', type: 'Lecture Notes', title: 'Week 1 notes', session: null },
  { id: 'd', type: 'Other', title: 'Extra reading', session: null },
]

describe('groupSubmissionsByType', () => {
  it('groups rows under each known type, in SUBMISSION_TYPES order', () => {
    const groups = groupSubmissionsByType(fixture)
    expect(groups.map((g) => g.type)).toEqual(['Past Question', 'Lecture Notes', 'Other'])
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('omits a type entirely when it has no matching rows', () => {
    const groups = groupSubmissionsByType(fixture.filter((r) => r.type !== 'Other'))
    expect(groups.map((g) => g.type)).toEqual(['Past Question', 'Lecture Notes'])
  })

  it('returns an empty array for no rows', () => {
    expect(groupSubmissionsByType([])).toEqual([])
  })
})

describe('validateSubmissionDraft', () => {
  it('requires a title', () => {
    expect(validateSubmissionDraft({ title: '', mode: 'file', hasFile: true, externalUrl: '' })).toBe(
      'A title is required.'
    )
    expect(validateSubmissionDraft({ title: '   ', mode: 'file', hasFile: true, externalUrl: '' })).toBe(
      'A title is required.'
    )
  })

  it('requires a file when mode is file', () => {
    expect(validateSubmissionDraft({ title: 'x', mode: 'file', hasFile: false, externalUrl: '' })).toBe(
      'Choose a file to upload.'
    )
  })

  it('requires a link when mode is link', () => {
    expect(validateSubmissionDraft({ title: 'x', mode: 'link', hasFile: false, externalUrl: '  ' })).toBe(
      'Paste a link.'
    )
  })

  it('returns null when a file submission is complete', () => {
    expect(validateSubmissionDraft({ title: 'x', mode: 'file', hasFile: true, externalUrl: '' })).toBeNull()
  })

  it('returns null when a link submission is complete', () => {
    expect(
      validateSubmissionDraft({ title: 'x', mode: 'link', hasFile: false, externalUrl: 'https://x.com' })
    ).toBeNull()
  })
})
