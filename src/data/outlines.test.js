import { describe, it, expect } from 'vitest'
import { getCourses, getCourse } from './outlines'

const fixture = [
  {
    id: 'mme-101',
    level: 100,
    semester: 1,
    code: 'MME 101',
    title: 'Introduction to Materials and Metallurgical Engineering',
    units: 2,
    topics: ['History and scope', 'Overview of metals, ceramics, polymers and composites'],
    texts: null,
  },
  {
    id: 'phy-cm-101',
    level: 100,
    semester: 1,
    code: 'PHY-CM 101',
    title: 'General Physics I (Mechanics)',
    units: 2,
    topics: ['Units and Dimensions', 'Kinematics'],
    texts: ['Adewale’s Physics'],
  },
  {
    id: 'mme-102',
    level: 100,
    semester: 2,
    code: 'MME 102',
    title: 'Some Second Semester Course',
    units: 3,
    topics: ['Topic A'],
    texts: [],
  },
  {
    id: 'mme-201',
    level: 200,
    semester: 1,
    code: 'MME 201',
    title: 'Materials Science I',
    units: 3,
    topics: ['Atomic bonding and structure'],
    texts: null,
  },
]

describe('getCourses', () => {
  it('returns the matching subset when called with string level/semester against numeric fixture columns', () => {
    const result = getCourses(fixture, '100', '1')
    expect(result.map((c) => c.id)).toEqual(['mme-101', 'phy-cm-101'])
  })

  it('returns an empty array for a level/semester combination with no matches', () => {
    expect(getCourses(fixture, '500', '2')).toEqual([])
  })

  it('does not mutate the input array', () => {
    const before = fixture.map((c) => c.id)
    getCourses(fixture, '100', '1')
    expect(fixture.map((c) => c.id)).toEqual(before)
  })
})

describe('getCourse', () => {
  it('finds a course by code once spaces are stripped and case is normalized (mirrors the slug built in OutlineCourses)', () => {
    const course = getCourse(fixture, '100', '1', 'phy-cm101')
    expect(course.id).toBe('phy-cm-101')
  })

  it('matches a code with a space against a hyphen-free, lowercase route param', () => {
    const course = getCourse(fixture, '100', '1', 'mme101')
    expect(course.id).toBe('mme-101')
  })

  it('returns undefined when no course matches the level/semester/code combination', () => {
    expect(getCourse(fixture, '100', '1', 'mme999')).toBeUndefined()
  })

  it('does not match a course from a different level or semester', () => {
    expect(getCourse(fixture, '200', '1', 'mme101')).toBeUndefined()
  })
})
