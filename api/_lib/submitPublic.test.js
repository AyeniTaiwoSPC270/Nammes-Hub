import { describe, it, expect } from 'vitest'
import { createSubmitPublicHandler } from '../submit-public.js'

const FORM_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '99999999-9999-4999-8999-999999999999'

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

function setup({ flagEnabled = true, flags, form, questions = [{ id: 'q1' }], insertError = null, verified = true, env } = {}) {
  const inserts = []
  const defaultForm = { id: FORM_ID, is_accepting_responses: true, closes_at: null, require_signin: false }
  const theForm = form === undefined ? defaultForm : form
  const client = {
    from: (table) => {
      if (table === 'feature_flags') return { select: () => ({ eq: (_column, key) => ({ maybeSingle: async () => ({ data: { enabled: flags ? flags[key] : flagEnabled } }) }) }) }
      if (table === 'forms') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: theForm }) }) }) }
      if (table === 'form_questions') return { select: () => ({ eq: async () => ({ data: questions }) }) }
      return { insert: async (row) => { inserts.push([table, row]); return { error: insertError } } }
    },
    auth: {
      getUser: async (token) =>
        token === 'valid-jwt'
          ? { data: { user: { id: USER_ID } }, error: null }
          : { data: { user: null }, error: { message: 'invalid token' } },
    },
  }
  const verifyImpl = async () => verified
  const fullEnv = env ?? { VITE_TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET: 'secret' }
  const handler = createSubmitPublicHandler({ getClient: () => client, verify: verifyImpl, env: fullEnv })
  return { handler, inserts }
}

const req = (body, method = 'POST') => ({ method, headers: { 'x-forwarded-for': '9.9.9.9' }, body })
const contact = { type: 'contact', token: 'tok', name: 'Ada', email: 'ada@example.com', message: 'Hi' }
const response = { type: 'form_response', token: 'tok', formId: FORM_ID, answers: { q1: 'yes' } }

describe('submit-public: contact', () => {
  it('saves a verified message', async () => {
    const { handler, inserts } = setup()
    const res = fakeRes(); await handler(req(contact), res)
    expect(res.statusCode).toBe(200)
    expect(inserts).toEqual([['contact_messages', { name: 'Ada', email: 'ada@example.com', message: 'Hi' }]])
  })
  it('rejects a failed verification and saves nothing', async () => {
    const { handler, inserts } = setup({ verified: false })
    const res = fakeRes(); await handler(req(contact), res)
    expect(res.statusCode).toBe(403)
    expect(inserts).toHaveLength(0)
  })
  it('rejects a missing token when the check is configured', async () => {
    const { handler, inserts } = setup()
    const res = fakeRes(); await handler(req({ ...contact, token: '' }), res)
    expect(res.statusCode).toBe(400)
    expect(inserts).toHaveLength(0)
  })
  it('rejects invalid content', async () => {
    const { handler } = setup()
    const res = fakeRes(); await handler(req({ ...contact, email: 'nope' }), res)
    expect(res.statusCode).toBe(400)
  })
  it('honours the public_forms pause switch', async () => {
    const { handler, inserts } = setup({ flagEnabled: false })
    const res = fakeRes(); await handler(req(contact), res)
    expect(res.statusCode).toBe(503)
    expect(inserts).toHaveLength(0)
  })
})

describe('submit-public: rollout safety', () => {
  it('skips the check only when Turnstile is not configured at all', async () => {
    const { handler, inserts } = setup({ env: {}, verified: false })
    const res = fakeRes(); await handler(req({ ...contact, token: '' }), res)
    expect(res.statusCode).toBe(200)
    expect(inserts).toHaveLength(1)
  })
  it('refuses (fails closed) when the site key is set but the secret is missing', async () => {
    const { handler, inserts } = setup({ env: { VITE_TURNSTILE_SITE_KEY: 'site' } })
    const res = fakeRes(); await handler(req(contact), res)
    expect(res.statusCode).toBe(503)
    expect(inserts).toHaveLength(0)
  })
})

describe('submit-public: form responses', () => {
  it('saves an anonymous response with no respondent identity', async () => {
    const { handler, inserts } = setup()
    const res = fakeRes(); await handler(req(response), res)
    expect(res.statusCode).toBe(200)
    expect(inserts).toEqual([['form_responses', { form_id: FORM_ID, respondent_id: null, respondent_email: null, answers: { q1: 'yes' } }]])
  })
  it('refuses closed forms, sign-in forms, missing forms and bad ids', async () => {
    const closed = setup({ form: { id: FORM_ID, is_accepting_responses: false, closes_at: null, require_signin: false } })
    const expired = setup({ form: { id: FORM_ID, is_accepting_responses: true, closes_at: '2000-01-01T00:00:00Z', require_signin: false } })
    const signin = setup({ form: { id: FORM_ID, is_accepting_responses: true, closes_at: null, require_signin: true } })
    const missing = setup({ form: null })
    const bad = setup()
    const codes = []
    for (const [s, body] of [[closed, response], [expired, response], [signin, response], [missing, response], [bad, { ...response, formId: 'nope' }]]) {
      const res = fakeRes(); await s.handler(req(body), res); codes.push(res.statusCode)
      expect(s.inserts).toHaveLength(0)
    }
    expect(codes).toEqual([403, 403, 403, 404, 400])
  })
  it('rejects answers for questions the form does not have', async () => {
    const { handler, inserts } = setup()
    const res = fakeRes(); await handler(req({ ...response, answers: { evil: 'x' } }), res)
    expect(res.statusCode).toBe(400)
    expect(inserts).toHaveLength(0)
  })
  it('gives a generic error if saving fails', async () => {
    const { handler } = setup({ insertError: { message: 'secret db detail' } })
    const res = fakeRes(); await handler(req(response), res)
    expect(res.statusCode).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('secret db detail')
  })
})

describe('submit-public: reports', () => {
  const report = { type: 'report', token: 'tok', category: 'wrong_info', page_url: '/outlines/csc101', page_title: 'CSC 101', message: 'Wrong unit count' }

  it('saves a report with a server-chosen kind and no reply address', async () => {
    const { handler, inserts } = setup()
    const res = fakeRes(); await handler(req(report), res)
    expect(res.statusCode).toBe(200)
    expect(inserts).toEqual([['contact_messages', {
      kind: 'report',
      category: 'wrong_info',
      page_url: '/outlines/csc101',
      page_title: 'CSC 101',
      message: 'Wrong unit count',
    }]])
  })

  it('never takes kind from the payload', async () => {
    const { handler, inserts } = setup()
    const res = fakeRes(); await handler(req({ ...report, kind: 'message', name: 'Mallory', email: 'm@x.com' }), res)
    expect(res.statusCode).toBe(200)
    expect(inserts[0][1].kind).toBe('report')
    expect(inserts[0][1].name).toBeUndefined()
  })

  it('rejects an unknown category and an absolute page address', async () => {
    const bad1 = setup()
    const a = fakeRes(); await bad1.handler(req({ ...report, category: 'nonsense' }), a)
    const bad2 = setup()
    const b = fakeRes(); await bad2.handler(req({ ...report, page_url: 'https://evil.example' }), b)
    expect([a.statusCode, b.statusCode]).toEqual([400, 400])
    expect(bad1.inserts).toHaveLength(0)
    expect(bad2.inserts).toHaveLength(0)
  })

  it('is switched off by its own flag, independently of public_forms', async () => {
    const off = setup({ flags: { public_forms: true, reports: false } })
    const a = fakeRes(); await off.handler(req(report), a)
    expect(a.statusCode).toBe(503)
    expect(off.inserts).toHaveLength(0)

    const formsDown = setup({ flags: { public_forms: false, reports: true } })
    const b = fakeRes(); await formsDown.handler(req(report), b)
    const c = fakeRes(); await formsDown.handler(req(contact), c)
    expect(b.statusCode).toBe(200)
    expect(c.statusCode).toBe(503)
  })
})

describe('submit-public: feedback', () => {
  const feedback = { type: 'feedback', token: 'tok', rating: 5, category: 'design', message: 'Nice', page_path: '/' }

  it('saves a rating with the caller resolved from their token', async () => {
    const { handler, inserts } = setup()
    const res = fakeRes(); await handler(req({ ...feedback, accessToken: 'valid-jwt' }), res)
    expect(res.statusCode).toBe(200)
    expect(inserts).toEqual([['hub_feedback', {
      rating: 5,
      category: 'design',
      message: 'Nice',
      page_path: '/',
      user_id: USER_ID,
    }]])
  })

  it('stores an anonymous rating when there is no token or it does not verify', async () => {
    const noToken = setup()
    const a = fakeRes(); await noToken.handler(req(feedback), a)
    const badToken = setup()
    const b = fakeRes(); await badToken.handler(req({ ...feedback, accessToken: 'expired' }), b)
    expect([a.statusCode, b.statusCode]).toEqual([200, 200])
    expect(noToken.inserts[0][1].user_id).toBeNull()
    expect(badToken.inserts[0][1].user_id).toBeNull()
  })

  it('never takes user_id from the payload', async () => {
    const { handler, inserts } = setup()
    const res = fakeRes(); await handler(req({ ...feedback, user_id: 'someone-else' }), res)
    expect(inserts[0][1].user_id).toBeNull()
  })

  it('rejects a rating outside 1-5 and an unknown reason', async () => {
    const low = setup()
    const a = fakeRes(); await low.handler(req({ ...feedback, rating: 0 }), a)
    const reason = setup()
    const b = fakeRes(); await reason.handler(req({ ...feedback, category: 'pricing' }), b)
    expect([a.statusCode, b.statusCode]).toEqual([400, 400])
    expect(low.inserts).toHaveLength(0)
    expect(reason.inserts).toHaveLength(0)
  })

  it('is switched off by its own flag, independently of the other two', async () => {
    const { handler, inserts } = setup({ flags: { public_forms: true, reports: true, feedback: false } })
    const res = fakeRes(); await handler(req(feedback), res)
    expect(res.statusCode).toBe(503)
    expect(inserts).toHaveLength(0)
  })
})

describe('submit-public: basics', () => {
  it('only accepts POST and known types', async () => {
    const { handler } = setup()
    const a = fakeRes(); await handler(req(contact, 'GET'), a)
    const b = fakeRes(); await handler(req({ ...contact, type: 'other' }), b)
    expect([a.statusCode, b.statusCode]).toEqual([405, 400])
  })
})
