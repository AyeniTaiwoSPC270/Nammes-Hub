import { describe, it, expect } from 'vitest'
import { createCalendarRemindersHandler, reminderDedupeKey } from './calendar-reminders.js'
import { formatCalendarDay } from '../emailDesign.js'

const SESSION = '2026/2027'
// 23:30 UTC is already the 10th in Lagos. A handler that read the host clock would call this the 9th and remind
// every student a day early.
const AT = new Date('2026-10-09T23:30:00Z')
const TODAY = '2026-10-10'
const TOMORROW = '2026-10-11'

const signed = { 'x-webhook-timestamp': '1700000000', 'x-webhook-signature': 'abcd' }

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

// A stand-in for the parts of the Supabase client this handler touches. It records the filters and the signed
// arguments it was given, so a test can assert what was asked for and not only what came back.
function fakeDb({
  signatureOk = true,
  flag = { key: 'calendar', enabled: true },
  settings = { id: 1, active_session: SESSION, reminder_enabled: true },
  rows = [],
  recipients = [{ email: 'ada@x.com' }, { email: 'bola@x.com' }],
  errors = {},
} = {}) {
  const asked = []
  const signedAs = []
  const logged = []

  function builder(name, seed, filters) {
    const add = (kind) => (col, val) => { filters.push([kind, col, val]); return api }
    const list = () => {
      const error = errors[name] ?? null
      if (error) return { data: null, error }
      const match = (r) =>
        filters.every(([kind, col, val]) =>
          kind === 'eq' ? r[col] === val
            : kind === 'gte' ? r[col] != null && r[col] >= val
            : kind === 'lte' ? r[col] != null && r[col] <= val
            : r[col] != null,
        )
      const source = name === 'feature_flags' ? flag : name === 'calendar_settings' ? settings : seed
      if (source == null) return { data: [], error: null }
      return { data: (Array.isArray(source) ? source : [source]).filter(match), error: null }
    }
    const api = {
      select: () => api,
      eq: add('eq'),
      gte: add('gte'),
      lte: add('lte'),
      not: add('not'),
      upsert: async (row) => { logged.push(row); return { error: null } },
      then: (resolve) => resolve(list()),
      maybeSingle: async () => {
        const { data, error } = list()
        return { data: data?.[0] ?? null, error }
      },
    }
    return api
  }

  const client = {
    rpc: async (name, args) => {
      if (name === 'verify_webhook_signature') {
        signedAs.push(args)
        return { data: signatureOk, error: null }
      }
      if (name === 'get_notification_recipients') {
        if (errors.recipients) return { data: null, error: errors.recipients }
        return { data: recipients, error: null }
      }
      return { data: null, error: { message: 'unknown' } }
    },
    from: (name) => {
      const entry = { table: name, filters: [] }
      asked.push(entry)
      return builder(name, rows, entry.filters)
    },
  }
  return { client, asked, signedAs, logged }
}

function setup(options = {}) {
  const db = fakeDb(options)
  const queued = []
  const enqueue = async (_client, rows) => {
    if (options.enqueueError) return { queued: 0, error: options.enqueueError }
    queued.push(...rows)
    return { queued: rows.length, error: null }
  }
  const handler = createCalendarRemindersHandler({ getClient: () => db.client, enqueue, now: () => options.at ?? AT })
  return { handler, queued, db }
}

const post = (headers = signed, method = 'POST') => ({ method, headers, body: {} })

// A row whose reminder is due today: seeded three days out with a three-day lead.
const dueRow = (overrides = {}) => ({
  id: '2026-2027-s1-01',
  session: SESSION,
  title: 'Payment of Fees & Online Registration',
  kind: 'registration',
  starts_at: '2026-10-13',
  ends_at: null,
  note: null,
  remind_days: 3,
  ...overrides,
})

describe('calendar-reminders handler', () => {
  it('refuses anything that is not a POST, and caches nothing on that path', async () => {
    const res = fakeRes()
    await setup().handler(post(signed, 'GET'), res)
    expect(res.statusCode).toBe(405)
    expect(res.headers['Cache-Control']).toBe('no-store')
  })

  it('refuses an unsigned call, and the old shared-secret header is not a credential either', async () => {
    let res = fakeRes()
    await setup({ signatureOk: false }).handler(post(), res)
    expect(res.statusCode).toBe(401)
    res = fakeRes()
    await setup().handler(post({ 'x-webhook-secret': 'legacy' }), res)
    expect(res.statusCode).toBe(401)
    res = fakeRes()
    await setup().handler({ method: 'POST', headers: {}, body: {} }, res)
    expect(res.statusCode).toBe(401)
    expect(res.headers['Cache-Control']).toBe('no-store')
  })

  it('signs for its own table and key, so no other route’s signature is a credential here', async () => {
    const { handler, db } = setup({ rows: [dueRow()] })
    await handler(post(), fakeRes())
    expect(db.signedAs).toEqual([{
      p_ts: 1700000000,
      // 'email_outbox'/'tick' is the email worker's pair. Sharing it would let a captured worker signature
      // verify here, because the HMAC covers these three parts and nothing else.
      p_table: 'academic_calendar',
      p_key: 'remind',
      p_sig: 'abcd',
    }])
  })

  it('queues one email per recipient per due entry, keyed so a repeat tick queues nothing new', async () => {
    const { handler, queued } = setup({ rows: [dueRow()] })
    const res = fakeRes()
    await handler(post(), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ queued: 2, due: 1 })
    expect(queued.map((r) => r.to)).toEqual(['ada@x.com', 'bola@x.com'])
    expect(queued.map((r) => r.dedupeKey)).toEqual([
      'academic-reminder:2026-2027-s1-01:2026-10-13:ada@x.com',
      'academic-reminder:2026-2027-s1-01:2026-10-13:bola@x.com',
    ])
    // A second run of the same day produces byte-identical keys, which is what makes the outbox upsert a no-op.
    const again = setup({ rows: [dueRow()] })
    await again.handler(post(), fakeRes())
    expect(again.queued.map((r) => r.dedupeKey)).toEqual(queued.map((r) => r.dedupeKey))
  })

  it('gives every recipient a distinct key, because email_outbox.dedupe_key is unique', async () => {
    const { handler, queued } = setup({ rows: [dueRow()] })
    await handler(post(), fakeRes())
    expect(new Set(queued.map((r) => r.dedupeKey)).size).toBe(queued.length)
  })

  it('names the entry, the date and the lead time in the email', async () => {
    const { handler, queued } = setup({ rows: [dueRow({ note: 'There is a penalty for missing it.' })] })
    await handler(post(), fakeRes())
    expect(queued[0].kind).toBe('academic-reminder')
    expect(queued[0].subject).toBe('Payment of Fees & Online Registration — in 3 days')
    expect(queued[0].html).toContain('Payment of Fees &amp; Online Registration')
    expect(queued[0].html).toContain('Tuesday, 13 October 2026')
    expect(queued[0].html).toContain('There is a penalty for missing it.')
  })

  it('gives the span of a multi-week block, which is the part a student needs', async () => {
    const { handler, queued } = setup({
      rows: [dueRow({ title: 'First Semester Break', starts_at: TODAY, ends_at: '2026-10-24', remind_days: 0 })],
    })
    await handler(post(), fakeRes())
    expect(queued[0].html).toContain('Saturday, 10 October 2026 to Saturday, 24 October 2026')
  })

  it('says today rather than "in 0 days" for a same-day reminder', async () => {
    const { handler, queued } = setup({ rows: [dueRow({ starts_at: TODAY, remind_days: 0 })] })
    await handler(post(), fakeRes())
    expect(queued).toHaveLength(2)
    expect(queued[0].subject).toContain('— today')
  })

  it('is keyed to the Lagos day, not the host clock', async () => {
    // 23:30 UTC on the 9th is 00:30 on the 10th in Lagos.
    const onTime = setup({ at: new Date('2026-10-09T23:30:00Z'), rows: [dueRow({ starts_at: TOMORROW, remind_days: 1 })] })
    await onTime.handler(post(), fakeRes())
    expect(onTime.queued).toHaveLength(2)
    // And 22:30 UTC on the 9th is still the 9th in Lagos, so the same row is not due yet.
    const tooEarly = setup({ at: new Date('2026-10-09T22:30:00Z'), rows: [dueRow({ starts_at: TOMORROW, remind_days: 1 })] })
    await tooEarly.handler(post(), fakeRes())
    expect(tooEarly.queued).toHaveLength(0)
  })

  it('only asks for the active session, and only rows that could still be due', async () => {
    const { handler, db } = setup({ rows: [dueRow()] })
    await handler(post(), fakeRes())
    const ask = db.asked.find((a) => a.table === 'academic_calendar')
    expect(ask.filters).toEqual([
      ['eq', 'session', SESSION],
      ['not', 'starts_at', 'is'],
      ['not', 'remind_days', 'is'],
      ['gte', 'starts_at', TODAY],
      // remind_days cannot exceed 30, so nothing later than today + 30 can be due.
      ['lte', 'starts_at', '2026-11-09'],
    ])
  })

  it('sends nothing for an undated row, a past row, a row with no lead time, or a row that is not due', async () => {
    const cases = {
      'to be determined': dueRow({ id: 'tba-1', starts_at: null, remind_days: 3 }),
      'already past': dueRow({ id: 'past-1', starts_at: '2026-01-25', remind_days: 7 }),
      'no lead time': dueRow({ id: 'no-lead', remind_days: null }),
      'due in three days': dueRow({ id: 'later', starts_at: '2026-10-16', remind_days: 3 }),
      'was due last week': dueRow({ id: 'earlier', starts_at: '2026-10-09', remind_days: 3 }),
      'a day the database never had': dueRow({ id: 'impossible', starts_at: '2026-02-30', remind_days: 3 }),
      'a lead time the schema forbids': dueRow({ id: 'absurd', remind_days: 365 }),
      'a row with no id to key on': dueRow({ id: '', remind_days: 3 }),
    }
    for (const [label, row] of Object.entries(cases)) {
      const { handler, queued } = setup({ rows: [row] })
      const res = fakeRes()
      await handler(post(), res)
      expect(queued, label).toHaveLength(0)
      expect(res.body, label).toEqual({ queued: 0, due: 0 })
    }
  })

  it('still sends the entries that are due when another one is not', async () => {
    const { handler, queued } = setup({
      rows: [dueRow({ id: 'tba', starts_at: null }), dueRow({ id: 'keep', starts_at: '2026-10-13' })],
    })
    await handler(post(), fakeRes())
    expect(queued.map((r) => r.dedupeKey)).toEqual([
      'academic-reminder:keep:2026-10-13:ada@x.com',
      'academic-reminder:keep:2026-10-13:bola@x.com',
    ])
  })

  it('crosses a month boundary when counting back the lead time', async () => {
    // 1 March minus three days is 26 February, so this row is due on the 26th, not somewhere in March.
    const onTime = setup({ at: new Date('2026-02-26T09:00:00Z'), rows: [dueRow({ starts_at: '2026-03-01', remind_days: 3 })] })
    await onTime.handler(post(), fakeRes())
    expect(onTime.queued).toHaveLength(2)
    const offByOne = setup({ at: new Date('2026-02-26T09:00:00Z'), rows: [dueRow({ starts_at: '2026-03-01', remind_days: 4 })] })
    await offByOne.handler(post(), fakeRes())
    expect(offByOne.queued).toHaveLength(0)
  })

  it('sends nothing when the calendar flag is switched off', async () => {
    const { handler, queued } = setup({ flag: { key: 'calendar', enabled: false }, rows: [dueRow()] })
    const res = fakeRes()
    await handler(post(), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ queued: 0, due: 0, skipped: 'calendar-flag-off' })
    expect(queued).toHaveLength(0)
  })

  it('sends nothing when the studio has reminders switched off', async () => {
    const { handler, queued } = setup({ settings: { id: 1, active_session: SESSION, reminder_enabled: false }, rows: [dueRow()] })
    const res = fakeRes()
    await handler(post(), res)
    expect(res.body).toEqual({ queued: 0, due: 0, skipped: 'reminders-off' })
    expect(queued).toHaveLength(0)
  })

  it('sends nothing when no session is active, rather than reminding on a stale calendar', async () => {
    const { handler, queued } = setup({ settings: { id: 1, active_session: '', reminder_enabled: true }, rows: [dueRow()] })
    const res = fakeRes()
    await handler(post(), res)
    expect(res.body).toEqual({ queued: 0, due: 0, skipped: 'no-active-session' })
    expect(queued).toHaveLength(0)
  })

  it('reports no rows as queued when nobody has notifications switched on', async () => {
    const { handler, queued } = setup({ recipients: [], rows: [dueRow()] })
    const res = fakeRes()
    await handler(post(), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ queued: 0, due: 1 })
    expect(queued).toHaveLength(0)
  })

  it('reads addresses only from get_notification_recipients, never from a row', async () => {
    const { handler, db } = setup({ rows: [dueRow()] })
    await handler(post(), fakeRes())
    expect(db.asked.map((a) => a.table)).toEqual(['feature_flags', 'calendar_settings', 'academic_calendar', 'email_templates'])
    expect(db.asked.some((a) => a.table === 'profiles' || a.table === 'auth')).toBe(false)
  })

  it('does not report a queue failure as a success', async () => {
    const { handler, db } = setup({ rows: [dueRow()], enqueueError: { message: 'db down' } })
    const res = fakeRes()
    await handler(post(), res)
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Could not queue the reminder emails' })
    expect(JSON.stringify(res.body)).not.toContain('db down')
    expect(db.logged).toHaveLength(1)
    expect(db.logged[0]).toMatchObject({ route: 'calendar-reminders', status: 500 })
  })

  it('reports a database failure as a failure rather than an empty run', async () => {
    const cases = [
      [{ errors: { feature_flags: { message: 'boom' } } }, 'Could not read the calendar flag'],
      [{ errors: { calendar_settings: { message: 'boom' } } }, 'Could not read the calendar settings'],
      [{ errors: { academic_calendar: { message: 'boom' } } }, 'Could not read the calendar'],
      [{ errors: { recipients: { message: 'boom' } } }, 'Could not load recipients'],
    ]
    for (const [options, message] of cases) {
      const { handler, queued } = setup({ rows: [dueRow()], ...options })
      const res = fakeRes()
      await handler(post(), res)
      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({ error: message })
      expect(queued).toHaveLength(0)
    }
  })
})

describe('reminderDedupeKey', () => {
  it('is built from the entry, its senate date and the recipient', () => {
    expect(reminderDedupeKey({ id: '2026-2027-s1-01', startsAt: '2026-10-13', email: 'ada@x.com' }))
      .toBe('academic-reminder:2026-2027-s1-01:2026-10-13:ada@x.com')
  })
})

describe('formatCalendarDay', () => {
  it('names the day the senate printed, with no shift for a reader who is not on that offset', () => {
    expect(formatCalendarDay('2026-10-13')).toBe('Tuesday, 13 October 2026')
    expect(formatCalendarDay('2026-03-01')).toBe('Sunday, 1 March 2026')
  })

  it('hands back the raw value rather than "Invalid Date" for something that is not a day', () => {
    expect(formatCalendarDay('not-a-date')).toBe('not-a-date')
  })
})