import { describe, it, expect } from 'vitest'
import { formatTimeLabel, sortTimetableRows, buildTimetablePdfRows, sessionForLevel, academicSession } from './timetablePdf'

describe('formatTimeLabel', () => {
  it('formats a morning 24h time as 12h with AM', () => {
    expect(formatTimeLabel('09:00:00')).toBe('9:00 AM')
  })

  it('formats an afternoon 24h time as 12h with PM', () => {
    expect(formatTimeLabel('14:30:00')).toBe('2:30 PM')
  })

  it('formats midnight as 12 AM', () => {
    expect(formatTimeLabel('00:00:00')).toBe('12:00 AM')
  })

  it('formats noon as 12 PM', () => {
    expect(formatTimeLabel('12:00:00')).toBe('12:00 PM')
  })

  it('returns an empty string for a missing time', () => {
    expect(formatTimeLabel('')).toBe('')
  })
})

describe('sortTimetableRows', () => {
  it('orders class entries by weekday then start time', () => {
    const rows = [
      { day: 'Wednesday', start_time: '09:00:00', code: 'MME 301' },
      { day: 'Monday', start_time: '11:00:00', code: 'MME 101' },
      { day: 'Monday', start_time: '09:00:00', code: 'MME 102' },
    ]
    expect(sortTimetableRows(rows, 'class').map((r) => r.code)).toEqual(['MME 102', 'MME 101', 'MME 301'])
  })

  it('orders exam entries by date then start time', () => {
    const rows = [
      { date: '2026-05-10', start_time: '13:00:00', code: 'MME 301' },
      { date: '2026-05-08', start_time: '09:00:00', code: 'MME 101' },
      { date: '2026-05-08', start_time: '08:00:00', code: 'MME 102' },
    ]
    expect(sortTimetableRows(rows, 'exam').map((r) => r.code)).toEqual(['MME 102', 'MME 101', 'MME 301'])
  })

  it('does not mutate the input array', () => {
    const rows = [{ day: 'Tuesday', start_time: '10:00:00', code: 'A' }]
    const before = [...rows]
    sortTimetableRows(rows, 'class')
    expect(rows).toEqual(before)
  })
})

describe('sessionForLevel', () => {
  it('derives the session for a level from the 100L entry year', () => {
    expect(sessionForLevel(2024, '100')).toBe('2024/2025')
    expect(sessionForLevel(2024, '200')).toBe('2025/2026')
    expect(sessionForLevel(2024, 300)).toBe('2026/2027')
  })

  it('falls back to the current-date session when no entry year is set', () => {
    const date = new Date('2026-09-28')
    expect(sessionForLevel(null, '300', date)).toBe(academicSession(date))
  })
})

describe('buildTimetablePdfRows', () => {
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
    expect(buildTimetablePdfRows(rows, 'class')).toEqual([
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
    expect(buildTimetablePdfRows(rows, 'exam')).toEqual([
      ['2026-05-08', '9:00 AM - 11:00 AM', 'MME 101', 'Intro to Materials', 'Main Hall', '', ''],
    ])
  })
})
