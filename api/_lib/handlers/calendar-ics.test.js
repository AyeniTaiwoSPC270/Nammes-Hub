import { describe, expect, it } from 'vitest'
import { createCalendarIcsHandler } from './calendar-ics.js'

// A stand-in for the parts of the Supabase client this handler touches. Query builders are thenable, like the real
// ones, because the handler awaits them through Promise.all.
function fakeDb({
  flag = { key: 'calendar', enabled: true },
  settings = { id: 1, active_session: '2026/2027' },
  academic = [{ id: 'sen-1', session: '2026/2027', title: 'Examinations', kind: 'exams', starts_at: '2026-10-05' }],
  events = [],
  errors = {},
} = {}) {
  const from = (name) => {
    const filters = []
    const list = () => {
      const error = errors[name] ?? null
      if (error) return { data: null, error }
      const source =
        name === 'feature_flags'
          ? flag ? [flag] : []
          : name === 'calendar_settings'
            ? settings ? [settings] : []
            : name === 'academic_calendar'
              ? academic
              : events
      return { data: source.filter((row) => filters.every(([column, value]) => row[column] === value)), error: null }
    }
    const api = {
      select: () => api,
      eq: (column, value) => {
        filters.push([column, value])
        return api
      },
      order: () => api,
      then: (resolve) => resolve(list()),
      maybeSingle: async () => {
        const { data, error } = list()
        return { data: data?.[0] ?? null, error }
      },
    }
    return api
  }
  return { from }
}

function fakeRes() {
  const res = { statusCode: null, headers: {}, body: undefined, ended: false }
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.setHeader = (key, value) => {
    res.headers[key.toLowerCase()] = value
  }
  res.send = (body) => {
    res.body = body
    return res
  }
  res.end = () => {
    res.ended = true
    return res
  }
  return res
}

const handlerFor = (db, now = () => new Date('2026-10-19T12:00:00Z')) =>
  createCalendarIcsHandler({ getClient: () => db, now })

describe('the calendar ICS handler', () => {
  it('serves a calendar with the content type and the edge cache', async () => {
    const res = fakeRes()
    await handlerFor(fakeDb())({ method: 'GET' }, res)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('text/calendar; charset=utf-8')
    expect(res.headers['cache-control']).toBe('public, max-age=300, stale-while-revalidate=86400')
    expect(res.body).toContain('BEGIN:VCALENDAR')
    expect(res.body).toContain('SUMMARY:Examinations')
  })

  it('answers 404 with no-store when the calendar flag is off', async () => {
    // A valid-but-empty feed would wipe every subscriber's dates. A 404 stops publishing and keeps their last copy.
    const res = fakeRes()
    await handlerFor(fakeDb({ flag: { key: 'calendar', enabled: false } }))({ method: 'GET' }, res)
    expect(res.statusCode).toBe(404)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.body).toBeUndefined()
  })

  it('rejects a write and answers HEAD with headers only', async () => {
    const posted = fakeRes()
    await handlerFor(fakeDb())({ method: 'POST' }, posted)
    expect(posted.statusCode).toBe(405)

    const head = fakeRes()
    await handlerFor(fakeDb())({ method: 'HEAD' }, head)
    expect(head.statusCode).toBe(200)
    expect(head.headers['content-type']).toBe('text/calendar; charset=utf-8')
    expect(head.body).toBeUndefined()
    expect(head.ended).toBe(true)
  })

  it('never returns a partial calendar when a read fails', async () => {
    const res = fakeRes()
    await handlerFor(fakeDb({ errors: { academic_calendar: { message: 'nope' } } }))({ method: 'GET' }, res)
    expect(res.statusCode).toBe(500)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.body).toBeUndefined()
  })

  it('is a valid empty calendar when there is no active session', async () => {
    const res = fakeRes()
    await handlerFor(fakeDb({ settings: { id: 1, active_session: '' } }))({ method: 'GET' }, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('BEGIN:VCALENDAR')
    expect(res.body).not.toContain('BEGIN:VEVENT')
  })
})
