import { describe, it, expect } from 'vitest'
import { wrapText, buildImageRows, layoutTableRows, columnWidthsFor } from './timetableImage'

const measureWidth = (text) => text.length * 6

describe('wrapText', () => {
  it('keeps short text on a single line', () => {
    expect(wrapText('MME 101', 200, measureWidth)).toEqual(['MME 101'])
  })

  it('breaks long text onto multiple lines at word boundaries', () => {
    const lines = wrapText('Introduction to Engineering Materials Science', 100, measureWidth)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(' ')).toBe('Introduction to Engineering Materials Science')
  })

  it('returns a single empty line for empty text', () => {
    expect(wrapText('', 100, measureWidth)).toEqual([''])
    expect(wrapText(null, 100, measureWidth)).toEqual([''])
  })
})

describe('buildImageRows', () => {
  it('builds a row per entry with formatted time and day for class timetables', () => {
    const rows = [
      {
        day: 'Monday',
        start_time: '09:00:00',
        end_time: '10:00:00',
        code: 'MME 101',
        title: 'Intro to Materials',
        venue: 'LT1',
        lecturer: 'Dr. Ade',
        notes: 'Practical Lab',
      },
    ]
    expect(buildImageRows(rows, 'class')).toEqual([
      ['Monday', '9:00 AM - 10:00 AM', 'MME 101', 'Intro to Materials', 'LT1', 'Dr. Ade', 'Practical Lab'],
    ])
  })

  it('uses the date column and blank lecturer fallback for exam timetables', () => {
    const rows = [
      {
        date: '2026-05-08',
        start_time: '09:00:00',
        end_time: '11:00:00',
        code: 'MME 101',
        title: 'Intro to Materials',
        venue: 'Main Hall',
        lecturer: null,
        notes: null,
      },
    ]
    expect(buildImageRows(rows, 'exam')).toEqual([
      ['2026-05-08', '9:00 AM - 11:00 AM', 'MME 101', 'Intro to Materials', 'Main Hall', '', ''],
    ])
  })
})

describe('layoutTableRows', () => {
  const columnWidths = columnWidthsFor(700)

  it('gives every row at least the minimum height', () => {
    const rows = [['Monday', '9:00 AM - 10:00 AM', 'MME 101', 'Intro', 'LT1', 'Dr. Ade', '']]
    const [laidOut] = layoutTableRows(rows, columnWidths, measureWidth)
    expect(laidOut.height).toBeGreaterThanOrEqual(34)
  })

  it('grows row height when a cell wraps onto multiple lines', () => {
    const shortRow = [['Monday', '9:00 AM - 10:00 AM', 'MME 101', 'Intro', 'LT1', 'Dr. Ade', '']]
    const longRow = [
      ['Monday', '9:00 AM - 10:00 AM', 'MME 101', 'A very long course title that will need to wrap across several lines of text', 'LT1', 'Dr. Ade', ''],
    ]
    const [shortLaidOut] = layoutTableRows(shortRow, columnWidths, measureWidth)
    const [longLaidOut] = layoutTableRows(longRow, columnWidths, measureWidth)
    expect(longLaidOut.height).toBeGreaterThan(shortLaidOut.height)
  })
})
