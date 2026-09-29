import { describe, it, expect } from 'vitest'
import { createSubmitPublicHandler } from '../submit-public.js'

const FORM_ID = '11111111-1111-4111-8111-111111111111'

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

function setup({ flagEnabled = true, form, questions = [{ id: 'q1' }], insertError = null, verified = true, env } = {}) {
  const inserts = []
  const defaultForm = { id: FORM_ID, is_accepting_responses: true, closes_at: null, require_signin: false }
  const theForm = form === undefined ? defaultForm : form
  const client = {
    from: (table) => {
      if (table === 'feature_flags') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { enabled: flagEnabled } }) }) }) }
      if (table === 'forms') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: theForm }) }) }) }
      if (table === 'form_questions') return { select: () => ({ eq: async () => ({ data: questions }) }) }
      return { insert: async (row) => { inserts.push([table, row]); return { error: insertError } } }
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

describe('submit-public: basics', () => {
  it('only accepts POST and known types', async () => {
    const { handler } = setup()
    const a = fakeRes(); await handler(req(contact, 'GET'), a)
    const b = fakeRes(); await handler(req({ ...contact, type: 'other' }), b)
    expect([a.statusCode, b.statusCode]).toEqual([405, 400])
  })
})
