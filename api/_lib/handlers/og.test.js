import { describe, it, expect } from 'vitest'
import { createOgHandler, escapeHtml, renderPage } from './og.js'
import { QUIZ, SESSION, fakeDb, fakeRes } from '../quizTestKit.js'

const UUID = '33333333-3333-4333-8333-333333333333'

// A fake response that also records the content type, so "this is HTML, not JSON" is an assertion and not a hope.
function res() {
  const r = fakeRes()
  const headers = {}
  r.setHeader = (k, v) => { headers[k] = v; r.headers[k] = v }
  r.type = (t) => { r.contentType = t; return r }
  r.send = (b) => { r.body = b; return r }
  r.redirect = (status, location) => { r.redirected = { status, location }; return r }
  return r
}

// A preview service does not send a browser's User-Agent. Defaulting to that is what keeps the tests on the card path.
const BOT = { 'user-agent': 'WhatsApp/2.26.5 A' }

function run(db, query, headers = BOT) {
  const r = res()
  return createOgHandler(() => db)({ method: 'GET', headers, query }, r).then(() => r)
}

// fakeDb ignores select columns and cannot do the quizzes(title) join, so the related row is seeded onto the session
// the way Supabase returns it for a to-one relation.
const finishedGame = (title = 'Naming Origins') =>
  fakeDb({
    quizzes: [{ id: QUIZ, title }],
    quiz_sessions: [{ id: SESSION, quiz_id: QUIZ, state: 'finished', quizzes: { title } }],
  })

const runningGame = (title = 'Naming Origins') =>
  fakeDb({
    quizzes: [{ id: QUIZ, title }],
    quiz_sessions: [{ id: SESSION, quiz_id: QUIZ, state: 'question', quizzes: { title } }],
  })

describe('the Open Graph endpoint', () => {
  it('answers with HTML, never JSON', async () => {
    const r = await run(finishedGame(), { type: 'join' })
    expect(r.statusCode).toBe(200)
    expect(r.contentType).toBe('text/html')
    expect(typeof r.body).toBe('string')
    expect(r.body).toContain('<!doctype html>')
  })

  it('sends the tags WhatsApp actually reads', async () => {
    const r = await run(finishedGame(), { type: 'join' })
    for (const tag of ['og:title', 'og:description', 'og:image', 'og:url']) {
      expect(r.body, tag).toContain(`property="${tag}"`)
    }
    // The twitter: tags use name=, not property=. Mixing them up is how a card silently loses its image.
    for (const tag of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
      expect(r.body, tag).toContain(`name="${tag}"`)
    }
    expect(r.body).toContain('summary_large_image')
    // Absolute, or the crawler has nothing to fetch.
    expect(r.body).toContain('content="https://')
  })

  it('caches, because WhatsApp refetches hard and a cold start per preview is a slow game', async () => {
    const r = await run(finishedGame(), { type: 'join' })
    expect(r.headers['Cache-Control']).toBe('public, max-age=300')
  })

  it('never puts the join code in the preview copy, which is the only thing protecting a live quiz', async () => {
    const r = await run(finishedGame(), { type: 'join', code: 'ABCD2345' })
    expect(r.body).toContain('A live quiz is waiting')
    // og:url necessarily echoes the link being previewed -- the crawler already has it, so that is not a disclosure.
    // What must not happen is the code appearing in the words a person reads before deciding to tap.
    const visible = /<title>(.*?)<\/title>|og:title" content="(.*?)"|og:description" content="(.*?)"/g
    for (const match of r.body.matchAll(visible)) {
      expect([...match].slice(1).join(''), 'preview copy').not.toContain('ABCD2345')
    }
  })

  it('names a finished board, but not one still running', async () => {
    const done = await run(finishedGame(), { type: 'result', session: SESSION })
    expect(done.body).toContain('Naming Origins')
    expect(done.body).toContain('final scores')

    const live = await run(runningGame(), { type: 'result', session: SESSION })
    expect(live.body).not.toContain('Naming Origins')
    expect(live.body).toContain('Quiz results')
  })

  it('404s a type it has no preview for, instead of serving the app shell to a crawler', async () => {
    for (const query of [{}, { type: 'nonsense' }, { type: '' }]) {
      const r = await run(finishedGame(), query)
      expect(r.statusCode, JSON.stringify(query)).toBe(404)
    }
  })

  it('ignores a session that is not a uuid rather than passing it into a query', async () => {
    for (const session of ["' or 1=1--", '../../etc/passwd', '']) {
      const r = await run(finishedGame(), { type: 'result', session })
      expect(r.statusCode, session).toBe(200)
      expect(r.body, session).not.toContain('Naming Origins')
    }
  })
})

// A preview service does not follow a redirect when it wants a card, and a person does not want a page about a link.
// So the same URL has to be both, which is why the User-Agent is the switch.
describe('one URL, two audiences', () => {
  const BROWSER = { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' }

  it('sends a browser straight to the join page', async () => {
    const r = await run(finishedGame(), { type: 'join', code: 'ABCD2345' }, BROWSER)
    expect(r.redirected).toEqual({ status: 302, location: '/play?code=ABCD2345' })
    expect(r.body).toBeNull()
  })

  it('sends a browser to the finished board', async () => {
    const r = await run(finishedGame(), { type: 'result', session: SESSION }, BROWSER)
    expect(r.redirected.location).toBe(`/host/${SESSION}`)
  })

  it('never caches the redirect, or a browser keeps playing last week\'s game', async () => {
    const r = await run(finishedGame(), { type: 'join', code: 'ABCD2345' }, BROWSER)
    expect(r.headers['Cache-Control']).toBe('no-store')
  })

  it('sends the card to a preview service instead', async () => {
    const r = await run(finishedGame(), { type: 'join', code: 'ABCD2345' })
    expect(r.redirected).toBeUndefined()
    expect(r.statusCode).toBe(200)
    expect(r.body).toContain('og:title')
  })

  it('404s a browser asking for a type it has no preview for', async () => {
    const r = await run(finishedGame(), { type: 'nonsense' }, BROWSER)
    expect(r.statusCode).toBe(404)
    expect(r.redirected).toBeUndefined()
  })

  it('falls back to the site root rather than building a route from a junk code', async () => {
    const r = await run(finishedGame(), { type: 'result', session: 'not-a-uuid' }, BROWSER)
    expect(r.redirected.location).toBe('/')
  })
})
describe('escaping', () => {
  it('neutralises every character that could close the attribute or open a tag', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(escapeHtml(`" onload="x`)).toBe('&quot; onload=&quot;x')
    expect(escapeHtml("it's")).toBe('it&#x27;s')
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes the ampersand first, so an entity in the title is not double-decoded', () => {
    expect(escapeHtml('&lt;b&gt;')).toBe('&amp;lt;b&amp;gt;')
  })

  it('renders a hostile quiz title as text, not markup', async () => {
    const db = finishedGame('</title><script>alert(1)</script>')
    const r = await run(db, { type: 'result', session: SESSION })
    expect(r.body).not.toContain('<script>')
    expect(r.body).not.toContain('</title><script>')
    expect(r.body).toContain('&lt;script&gt;')
    // The head still closes exactly once.
    expect(r.body.match(/<\/head>/g)).toHaveLength(1)
  })

  it('escapes the canonical url too', () => {
    const html = renderPage({ title: 'T', description: 'D', path: '/x"><script>' })
    expect(html).not.toContain('"><script>')
  })
})