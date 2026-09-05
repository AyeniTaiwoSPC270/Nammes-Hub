import { describe, it, expect } from 'vitest'
import { computeFieldDiff } from './changeRequests'

describe('computeFieldDiff', () => {
  it('returns only fields that changed', () => {
    const before = { title: 'Old', body: 'Same', date: '2026-01-01' }
    const after = { title: 'New', body: 'Same', date: '2026-01-01' }
    expect(computeFieldDiff(before, after)).toEqual([{ field: 'title', before: 'Old', after: 'New' }])
  })
  it('treats a missing before as every field changed', () => {
    const after = { title: 'New', body: 'Text' }
    const diff = computeFieldDiff(null, after)
    expect(diff).toEqual(
      expect.arrayContaining([
        { field: 'title', before: null, after: 'New' },
        { field: 'body', before: null, after: 'Text' },
      ]),
    )
    expect(diff).toHaveLength(2)
  })
  it('returns an empty list when nothing changed', () => {
    const row = { title: 'Same' }
    expect(computeFieldDiff(row, row)).toEqual([])
  })
})
