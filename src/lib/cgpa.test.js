import { describe, it, expect } from 'vitest'
import { pointsForGrade, semesterGPA, classify, cumulativeStats, whatIfTarget, findPriorAttempts } from './cgpa'

describe('pointsForGrade', () => {
  it('maps each letter grade to its point value', () => {
    expect(pointsForGrade('A')).toBe(5)
    expect(pointsForGrade('B')).toBe(4)
    expect(pointsForGrade('C')).toBe(3)
    expect(pointsForGrade('D')).toBe(2)
    expect(pointsForGrade('E')).toBe(1)
    expect(pointsForGrade('F')).toBe(0)
  })

  it('throws on an unknown grade', () => {
    expect(() => pointsForGrade('Z')).toThrow('Unknown grade: Z')
  })
})

describe('semesterGPA', () => {
  it('computes weighted GPA across courses', () => {
    const result = semesterGPA([
      { units: 3, grade: 'A' },
      { units: 2, grade: 'C' },
    ])
    expect(result.totalUnits).toBe(5)
    expect(result.totalPoints).toBe(3 * 5 + 2 * 3)
    expect(result.gpa).toBeCloseTo((3 * 5 + 2 * 3) / 5)
  })

  it('returns a 0 GPA for an empty course list instead of dividing by zero', () => {
    const result = semesterGPA([])
    expect(result.totalUnits).toBe(0)
    expect(result.totalPoints).toBe(0)
    expect(result.gpa).toBe(0)
  })
})

describe('classify', () => {
  it('maps CGPA values to the correct classification band', () => {
    expect(classify(5.0)).toBe('First Class')
    expect(classify(4.5)).toBe('First Class')
    expect(classify(4.49)).toBe('Second Class Upper')
    expect(classify(3.5)).toBe('Second Class Upper')
    expect(classify(2.4)).toBe('Second Class Lower')
    expect(classify(1.5)).toBe('Third Class')
    expect(classify(1.0)).toBe('Pass')
    expect(classify(0.5)).toBe('Below Pass')
  })
})

describe('cumulativeStats', () => {
  it('sorts semesters chronologically and tracks a running CGPA', () => {
    const semesters = [
      { id: 's2', level: '100', semester: 2, courses: [{ units: 3, grade: 'B', counts_toward_cgpa: true }] },
      { id: 's1', level: '100', semester: 1, courses: [{ units: 2, grade: 'A', counts_toward_cgpa: true }] },
    ]

    const result = cumulativeStats(semesters)

    expect(result.rows.map((r) => r.semesterId)).toEqual(['s1', 's2'])
    expect(result.rows[0].gpa).toBeCloseTo(5)
    expect(result.rows[1].cumulativeUnits).toBe(5)
    expect(result.overallCGPA).toBeCloseTo((2 * 5 + 3 * 4) / 5)
    expect(result.classification).toBe('Second Class Upper')
  })

  it('excludes courses flagged as not counting toward CGPA from cumulative totals but keeps them in that semester GPA', () => {
    const semesters = [
      {
        id: 's1',
        level: '300',
        semester: 1,
        courses: [
          { units: 3, grade: 'F', counts_toward_cgpa: false },
          { units: 2, grade: 'B', counts_toward_cgpa: true },
        ],
      },
    ]

    const result = cumulativeStats(semesters)

    expect(result.rows[0].gpa).toBeCloseTo((3 * 0 + 2 * 4) / 5)
    expect(result.overallUnits).toBe(2)
    expect(result.overallCGPA).toBeCloseTo(4)
  })
})

describe('whatIfTarget', () => {
  it('computes the average grade point needed on remaining units to hit a target CGPA', () => {
    const result = whatIfTarget({ currentUnits: 60, currentPoints: 216, targetCgpa: 3.8, remainingUnits: 20 })
    expect(result.requiredAveragePoint).toBeCloseTo(4.4)
    expect(result.achievable).toBe(true)
    expect(result.alreadyMet).toBe(false)
  })

  it('flags an unreachable target', () => {
    const result = whatIfTarget({ currentUnits: 60, currentPoints: 60, targetCgpa: 4.8, remainingUnits: 4 })
    expect(result.achievable).toBe(false)
  })

  it('flags when the target is already met', () => {
    const result = whatIfTarget({ currentUnits: 60, currentPoints: 60 * 4.5, targetCgpa: 4.0, remainingUnits: 20 })
    expect(result.alreadyMet).toBe(true)
    expect(result.requiredAveragePoint).toBe(0)
  })

  it('returns an error instead of dividing by zero when remaining units is 0', () => {
    const result = whatIfTarget({ currentUnits: 60, currentPoints: 180, targetCgpa: 4.0, remainingUnits: 0 })
    expect(result.error).toBeTruthy()
    expect(result.requiredAveragePoint).toBeNull()
  })
})

describe('findPriorAttempts', () => {
  it('finds earlier attempts of the same course code in other semesters, case/whitespace-insensitive', () => {
    const semesters = [
      { id: 's1', level: '300', semester: 1, courses: [{ id: 'c1', code: 'mme 301', units: 3, grade: 'F' }] },
      { id: 's2', level: '300', semester: 2, courses: [{ id: 'c2', code: 'MME  301', units: 3, grade: 'B' }] },
    ]

    const matches = findPriorAttempts('MME 301', semesters, 's2')

    expect(matches).toHaveLength(1)
    expect(matches[0].semesterId).toBe('s1')
    expect(matches[0].label).toBe('300L S1')
  })

  it('returns an empty array when there is no prior attempt', () => {
    const semesters = [{ id: 's1', level: '300', semester: 1, courses: [{ id: 'c1', code: 'MME 301', units: 3, grade: 'A' }] }]
    expect(findPriorAttempts('MME 303', semesters, 's1')).toEqual([])
  })
})
