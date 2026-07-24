import { describe, it, expect } from 'vitest'
import { pointsForGrade, semesterGPA, classify } from './cgpa'

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
