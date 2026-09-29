import { describe, it, expect } from 'vitest'
import { scrubText, scrubEvent } from './sentryScrub'

describe('scrubText', () => {
  it('masks email addresses', () => {
    expect(scrubText('failed for ada@example.com today')).toBe('failed for [email] today')
  })
  it('masks department matric numbers', () => {
    expect(scrubText('student 240406012 not found')).toBe('student [matric] not found')
  })
  it('masks bearer tokens and JWTs', () => {
    expect(scrubText('Authorization: Bearer abc.def.ghi')).toBe('Authorization: Bearer [token]')
    expect(scrubText('token eyJhbGciOi.eyJzdWIiOi.SflKxwRJSM')).toBe('token [token]')
  })
  it('leaves ordinary text alone', () => {
    expect(scrubText('Cannot read properties of undefined')).toBe('Cannot read properties of undefined')
  })
})

describe('scrubEvent', () => {
  it('scrubs strings anywhere in the event and removes user and request details', () => {
    const event = {
      message: 'error for 240406012',
      user: { email: 'a@b.co', id: 'u1', ip_address: '1.2.3.4' },
      request: { url: 'https://x.test/p?email=a@b.co', headers: { cookie: 'c' }, cookies: { a: 'b' }, data: 'secret' },
      exception: { values: [{ value: 'bad ada@example.com' }] },
      breadcrumbs: [{ message: 'clicked 240406013' }],
    }
    const out = scrubEvent(event)
    expect(out.user).toBeUndefined()
    expect(out.request.headers).toBeUndefined()
    expect(out.request.cookies).toBeUndefined()
    expect(out.request.data).toBeUndefined()
    expect(out.request.url).toBe('https://x.test/p?email=[email]')
    expect(out.message).toBe('error for [matric]')
    expect(out.exception.values[0].value).toBe('bad [email]')
    expect(out.breadcrumbs[0].message).toBe('clicked [matric]')
  })
})
