import { describe, it, expect } from 'vitest'
import { buildBookHtml } from '../../scripts/manual/book-lib.mjs'
import { makeContext } from '../../scripts/manual/book-content.mjs'
import { createHandbookBuildHandler } from './handlers/handbook-build.js'
import { escapeText, sanitizeHtml, overridesFromRows } from './handbookBuild.js'

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

function setup({ isAdmin = true, claimed = [{ id: 1 }], build } = {}) {
  const calls = { settingsUpdates: [], siteContent: [], uploads: [], removed: [] }
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
    from: (table) => {
      if (table === 'admins') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: isAdmin ? { is_owner: false } : null }) }) }) }
      if (table === 'feature_flags') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { enabled: false } }) }) }) }
      if (table === 'handbook_settings') {
        return {
          update: (fields) => {
            calls.settingsUpdates.push(fields)
            const chain = { eq: () => chain, or: () => chain, select: async () => ({ data: claimed, error: null }), then: (ok) => ok({ error: null }) }
            return chain
          },
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { edition: 'Second Edition', as_of: '', foreword_html: '' } }) }) }),
        }
      }
      if (table === 'handbook_chapters') return { select: async () => ({ data: [{ id: 'welcome', title: 'Hi', intro: '', html: '<p onclick="x()">Body</p>' }], error: null }) }
      if (table === 'site_content') return { update: (fields) => ({ eq: async () => { calls.siteContent.push(fields); return { error: null } } }) }
      if (table === 'error_log') return { upsert: async () => ({ error: null }) }
      throw new Error(`unexpected table ${table}`)
    },
    storage: {
      from: () => ({
        upload: async (name, body, opts) => { calls.uploads.push([name, opts]); return { error: null } },
        getPublicUrl: (name, opts) => ({ data: { publicUrl: `https://cdn.test/${name}?download=${opts.download}` } }),
        list: async () => ({ data: [{ name: 'old.pdf' }, { name: 'NAMMES-Hub-Handbook-20260930100000.pdf' }] }),
        remove: async (names) => { calls.removed.push(...names); return { error: null } },
      }),
    },
  }
  let seen
  const handler = createHandbookBuildHandler({
    getClient: () => client,
    build: build ?? (async (overrides) => { seen = overrides; return { pdf: Buffer.from('pdf'), pages: 98 } }),
    overridesFromRows: async (settings, chapters) => ({ settings, chapters }),
    now: () => Date.UTC(2026, 8, 30, 10, 0, 0),
  })
  return { handler, calls, seen: () => seen }
}
const req = (method = 'POST') => ({ method, headers: { authorization: 'Bearer t' } })

describe('handbook-build handler', () => {
  it('builds, uploads, links the new PDF and removes older copies', async () => {
    const { handler, calls, seen } = setup()
    const res = fakeRes()
    await handler(req(), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.pages).toBe(98)
    expect(calls.uploads[0][0]).toBe('NAMMES-Hub-Handbook-20260930100000.pdf')
    expect(calls.siteContent[0].handbook_pdf_url).toContain('NAMMES-Hub-Handbook-20260930100000.pdf')
    expect(calls.removed).toEqual(['old.pdf'])
    expect(calls.settingsUpdates.at(-1)).toMatchObject({ build_status: 'done', built_pages: 98 })
    expect(seen().settings.edition).toBe('Second Edition')
  })

  it('refuses non-admins and non-POST requests', async () => {
    const a = fakeRes(); await setup({ isAdmin: false }).handler(req(), a)
    const b = fakeRes(); await setup().handler(req('GET'), b)
    expect([a.statusCode, b.statusCode]).toEqual([403, 405])
  })

  it('returns 409 while another build is running', async () => {
    const res = fakeRes()
    await setup({ claimed: [] }).handler(req(), res)
    expect(res.statusCode).toBe(409)
  })

  it('records a failure without exposing the raw error', async () => {
    const { handler, calls } = setup({ build: async () => { throw new Error('chromium exploded at /tmp/x') } })
    const res = fakeRes()
    await handler(req(), res)
    expect(res.statusCode).toBe(500)
    expect(res.body.error).not.toContain('chromium')
    expect(calls.settingsUpdates.at(-1)).toMatchObject({ build_status: 'failed' })
  })
})

describe('handbook text safety', () => {
  it('escapes plain-text fields but keeps existing entities', () => {
    expect(escapeText('A & B <b>')).toBe('A &amp; B &lt;b&gt;')
    expect(escapeText('Don&rsquo;t')).toBe('Don&rsquo;t')
  })

  it('strips scripts, event handlers, embeds and javascript links from edited HTML', () => {
    const dirty = '<p onclick="x()">Hi</p><script>alert(1)</script><iframe src="https://evil"></iframe><a href="javascript:steal()">go</a><img src="../screens/home.jpg" onerror="x()"><style>body{}</style>'
    const clean = sanitizeHtml(dirty)
    expect(clean).not.toMatch(/script|iframe|onclick|onerror|javascript:|<style/i)
    expect(clean).toContain('<p>Hi</p>')
    expect(clean).toContain('../screens/home.jpg')
  })

  it('builds overrides from rows, blanking nothing that was left empty', () => {
    const o = overridesFromRows({ edition: 'X', as_of: '', foreword_html: '' }, [{ id: 'welcome', title: 'T <i>', intro: null, html: '<p>ok</p>' }])
    expect(o.settings).toEqual({ edition: 'X', as_of: '', foreword_html: '', texts: {} })
    expect(o.authors).toBeNull()
    expect(o.chapters.welcome).toEqual({ title: 'T &lt;i&gt;', intro: '', html: '<p>ok</p>' })
  })
})

describe('front and back matter overrides', () => {
  it('keeps only valid text, photo references and a sane number of people', () => {
    const o = overridesFromRows(
      {
        texts: { cover_title: 'My Book', finder: ['a', 'b'], junk: 5 },
        authors: {
          team: 'The Phoenix',
          session: '27/28',
          people: [
            { name: 'Ada Obi', role: 'President', photo: 'store:authors/1-a.jpg' },
            { name: 'Bad Path', role: 'VP', photo: 'store:../secrets.jpg' },
            { name: '', role: 'nobody', photo: '' },
          ],
        },
      },
      [],
    )
    expect(o.settings.texts).toEqual({ cover_title: 'My Book', finder: ['a', 'b'] })
    expect(o.authors.people).toEqual([
      { name: 'Ada Obi', role: 'President', photo: 'store:authors/1-a.jpg' },
      { name: 'Bad Path', role: 'VP', photo: '' },
    ])
  })

  it('fills team, session, title and authors through every page of the book', async () => {
    const ctx = makeContext({
      settings: { texts: { cover_title: 'The NAMMES Hub Guide', back_heading: 'Read <this>' } },
      authors: { team: 'The Phoenix', session: '27/28', people: [{ name: 'Ada <b>Obi', role: 'President', photo: 'builtin:soyemi-eniola' }] },
    })
    const html = await buildBookHtml(ctx, () => '00')
    expect(html).toContain('The Phoenix 27/28')
    expect(html).toContain('2027/2028 session')
    expect(html).toContain('The NAMMES <span>Hub</span> Guide')
    expect(html).toContain('Read &lt;this&gt;')
    expect(html).toContain('Ada &lt;b&gt;Obi')
    expect(html).not.toContain('Aegis')
    expect(html).not.toMatch(/\{\{(team|session|session_long|title|edition|as_of|site)\}\}/)
  })

  it('draws a placeholder instead of failing when a photo cannot be fetched', async () => {
    const { resolvePhotos } = await import('./handbookBuild.js')
    const ctx = makeContext({ authors: { people: [{ name: 'Ada Obi', role: 'President', photo: 'store:authors/missing.jpg' }] } })
    const supabase = { storage: { from: () => ({ download: async () => ({ data: null, error: new Error('gone') }) }) } }
    await resolvePhotos(ctx, { supabase })
    expect(ctx.people[0].img).toMatch(/^data:image\/svg\+xml/)
  })
})
