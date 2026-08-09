import { describe, it, expect } from 'vitest'
import { getResources } from './resources'

const fixture = [
  { id: 'mme-101', level: 100, semester: 1, category: 'Lecture Notes', title: 'MME 101' },
  { id: 'phy-101', level: 100, semester: 1, category: 'Slides & Handouts', title: 'PHY-CM 101' },
  { id: 'mme-102', level: 100, semester: 2, category: 'Lecture Notes', title: 'MME 102' },
  { id: '200l-notes', level: 200, semester: 1, category: 'Lecture Notes', title: '200L Notes' },
]

describe('getResources', () => {
  it('returns the matching subset when called with string level/semester against numeric fixture columns', () => {
    const result = getResources(fixture, '100', '1')
    expect(result.map((r) => r.id)).toEqual(['mme-101', 'phy-101'])
  })

  it('returns an empty array for a level/semester combination with no matches', () => {
    expect(getResources(fixture, '500', '2')).toEqual([])
  })

  it('does not mutate the input array', () => {
    const before = fixture.map((r) => r.id)
    getResources(fixture, '100', '1')
    expect(fixture.map((r) => r.id)).toEqual(before)
  })
})
