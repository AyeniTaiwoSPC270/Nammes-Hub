import { describe, it, expect } from 'vitest'
import { createAdminIssuesHandler } from './handlers/admin-issues.js'

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

const env = { SENTRY_AUTH_TOKEN: 'tok', SENTRY_ORG: 'my-org', SENTRY_PROJECT: 'javascript-react' }

function setup({ isOwner = true, sentryOk = true, environment = env, issues } = {}) {
  const fetched = []
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_owner: isOwner } }) }) }) }),
  }
  const fetchImpl = async (url, opts) => {
    fetched.push([url, opts])
    return {
      ok: sentryOk,
      status: sentryOk ? 200 : 500,
      json: async () =>
        issues ?? [
          { id: '1', shortId: 'A-1', title: 'TypeError: x', culprit: 'App.jsx', level: 'error', count: '12', userCount: 3,
            firstSeen: '2026-09-28T10:00:00Z', lastSeen: '2026-09-29T10:00:00Z', permalink: 'https://sentry.io/x', status: 'unresolved', extra: 'dropped' },
        ],
    }
  }
  const handler = createAdminIssuesHandler({ getClient: () => client, fetchImpl, env })
  return { handler, fetched }
}
const req = (method = 'GET') => ({ method, headers: { authorization: 'Bearer t' } })

describe('admin-issues handler', () => {
  it('returns a trimmed issue list for the owner and calls Sentry with the server-side token', async () => {
    const { handler, fetched } = setup()
    const res = fakeRes()
    await handler(req(), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.configured).toBe(true)
    expect(res.body.issues).toEqual([
      { id: '1', shortId: 'A-1', title: 'TypeError: x', culprit: 'App.jsx', level: 'error', count: 12, userCount: 3,
        firstSeen: '2026-09-28T10:00:00Z', lastSeen: '2026-09-29T10:00:00Z', permalink: 'https://sentry.io/x' },
    ])
    expect(fetched[0][0]).toContain('/api/0/projects/my-org/javascript-react/issues/')
    expect(fetched[0][1].headers.Authorization).toBe('Bearer tok')
  })
  it('refuses non-owners and non-GET', async () => {
    const a = fakeRes(); await setup({ isOwner: false }).handler(req(), a)
    const b = fakeRes(); await setup().handler(req('POST'), b)
    expect([a.statusCode, b.statusCode]).toEqual([403, 405])
  })
  it('reports not configured when the Sentry settings are missing, without calling Sentry', async () => {
    const { handler, fetched } = setup({ environment: {} })
    const res = fakeRes()
    const h2 = createAdminIssuesHandler({ getClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_owner: true } }) }) }) }),
    }), fetchImpl: async () => { throw new Error('should not be called') }, env: {} })
    await h2(req(), res)
    expect(res.body).toEqual({ configured: false, issues: [] })
    expect(fetched).toHaveLength(0)
    void handler
  })
  it('rejects unsafe organisation or project names', async () => {
    const { handler, fetched } = setup({ environment: env })
    const bad = createAdminIssuesHandler({
      getClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_owner: true } }) }) }) }),
      }),
      fetchImpl: async () => { throw new Error('should not be called') },
      env: { ...env, SENTRY_ORG: '../evil' },
    })
    const res = fakeRes()
    await bad(req(), res)
    expect(res.body.configured).toBe(false)
    void handler; void fetched
  })
  it('returns a generic 502 when Sentry fails', async () => {
    const { handler } = setup({ sentryOk: false })
    const res = fakeRes()
    await handler(req(), res)
    expect(res.statusCode).toBe(502)
    expect(JSON.stringify(res.body)).not.toContain('tok')
  })
})
