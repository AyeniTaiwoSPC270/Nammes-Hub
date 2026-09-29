import { describe, it, expect } from 'vitest'
import { createExportDataHandler } from './handlers/export-data.js'

const ME = '11111111-1111-4111-8111-111111111111'

function fakeRes() {
  const res = { statusCode: null, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (body) => { res.body = body; return res }
  res.setHeader = () => {}
  return res
}

function fakeDb({ failTable = null, authFails = false } = {}) {
  const reads = []
  const rows = {
    profiles: [{ user_id: ME, full_name: 'Ada', student_id: '240406012' }],
    cgpa_semesters: [{ user_id: ME, level: 100 }],
    form_responses: [],
    award_nominations: [],
    outline_submissions: [],
  }
  return {
    reads,
    client: {
      auth: {
        getUser: async () =>
          authFails
            ? { data: null, error: { message: 'bad' } }
            : { data: { user: { id: ME, email: 'ada@example.invalid', created_at: '2026-01-01' } }, error: null },
      },
      from: (table) => ({
        select: () => ({
          eq: (column, value) => {
            const result = { maybeSingle: async () => ({ data: null }) }
            const done = failTable === table ? { data: null, error: { message: 'boom' } } : { data: rows[table] ?? [], error: null }
            reads.push([table, column, value])
            return Object.assign(Promise.resolve(done), result)
          },
        }),
      }),
    },
  }
}

const req = (body, { method = 'POST', token = 'tok' } = {}) => ({
  method,
  headers: { authorization: token ? `Bearer ${token}` : '' },
  body,
})

describe('export-data handler', () => {
  it('rejects non-POST, bad delivery and missing sign-in', async () => {
    let res = fakeRes()
    await createExportDataHandler({ getClient: () => fakeDb().client })(req({}, { method: 'GET' }), res)
    expect(res.statusCode).toBe(405)
    res = fakeRes()
    await createExportDataHandler({ getClient: () => fakeDb().client })(req({ delivery: 'fax' }), res)
    expect(res.statusCode).toBe(400)
    res = fakeRes()
    await createExportDataHandler({ getClient: () => fakeDb().client })(req({}, { token: '' }), res)
    expect(res.statusCode).toBe(401)
    res = fakeRes()
    await createExportDataHandler({ getClient: () => fakeDb({ authFails: true }).client })(req({}), res)
    expect(res.statusCode).toBe(401)
  })

  it('returns only the caller\'s own data and never reads votes', async () => {
    const db = fakeDb()
    const res = fakeRes()
    await createExportDataHandler({ getClient: () => db.client })(req({ delivery: 'download' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.data.profile.full_name).toBe('Ada')
    expect(res.body.data.cgpa_semesters).toHaveLength(1)
    expect(res.body.data.account.email).toBe('ada@example.invalid')
    const dataReads = db.reads.filter(([table]) => table !== 'admins')
    expect(dataReads.every(([, , value]) => value === ME)).toBe(true)
    expect(db.reads.some(([table]) => table === 'award_votes')).toBe(false)
    expect(res.body.data).not.toHaveProperty('award_votes')
  })

  it('emails the file to the account address', async () => {
    const sent = []
    const getResend = () => ({ emails: { send: async (m) => { sent.push(m); return { error: null } } } })
    const res = fakeRes()
    await createExportDataHandler({ getClient: () => fakeDb().client, getResend })(req({ delivery: 'email' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ sent: true })
    expect(sent[0].to).toBe('ada@example.invalid')
    expect(sent[0].attachments[0].filename).toBe('nammes-hub-data.json')
    expect(JSON.parse(Buffer.from(sent[0].attachments[0].content, 'base64').toString()).profile.full_name).toBe('Ada')
  })

  it('reports a failed email without leaking the provider error', async () => {
    const getResend = () => ({ emails: { send: async () => ({ error: { message: 'secret provider detail' } }) } })
    const res = fakeRes()
    await createExportDataHandler({ getClient: () => fakeDb().client, getResend })(req({ delivery: 'email' }), res)
    expect(res.statusCode).toBe(502)
    expect(JSON.stringify(res.body)).not.toContain('secret provider detail')
  })

  it('returns a generic error when a read fails', async () => {
    const res = fakeRes()
    await createExportDataHandler({ getClient: () => fakeDb({ failTable: 'cgpa_semesters' }).client })(req({}), res)
    expect(res.statusCode).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('boom')
  })
})
