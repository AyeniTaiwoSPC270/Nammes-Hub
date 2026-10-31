import { describe, it, expect } from 'vitest'
import { createNewsPreviewHandler, createNewsImageHandler, newsExcerpt } from './newsPreview.js'

const ARTICLE = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'matriculation-2026',
  title: 'Matriculation 2026 — dates announced',
  body: '  The ceremony holds on the 14th of March at the main auditorium.  Bring your fee receipt.  ',
  image_url: 'https://example.supabase.co/storage/v1/object/public/news-images/m.webp',
}

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {}, contentType: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.setHeader = (key, value) => { res.headers[key] = value }
  res.type = (value) => { res.contentType = value; return res }
  res.send = (value) => { res.body = value; return res }
  res.json = (value) => { res.body = value; return res }
  return res
}

function fakeClient({ article = ARTICLE, flags = { news_share: true } } = {}) {
  return {
    from(table) {
      if (table === 'feature_flags') {
        return { select: () => ({ eq: (_col, key) => ({ maybeSingle: async () => ({ data: key in flags ? { enabled: flags[key] } : null }) }) }) }
      }
      if (table === 'news') {
        return {
          select: () => ({
            eq: (_col, value) => ({
              maybeSingle: async () => ({ data: article && (article.id === value || article.slug === value) ? article : null }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
}

const SHELL = '<!doctype html><html><head><meta property="og:title" content="NAMMES Hub"></head></html>'
const shell = () => SHELL
const req = (key, headers = {}) => ({ query: { key }, headers })
const crawler = (key) => req(key, { 'user-agent': 'WhatsApp/2.0' })
const browser = (key) => req(key, { 'user-agent': 'Mozilla/5.0 (Macintosh)' })

describe('newsExcerpt', () => {
  it('collapses whitespace and stops at 160 characters', () => {
    expect(newsExcerpt('a   b\nc')).toBe('a b c')
    expect(newsExcerpt('word '.repeat(80))).toHaveLength(160)
    expect(newsExcerpt('short body')).toBe('short body')
    expect(newsExcerpt(null)).toBe('')
  })
})

describe('news-preview', () => {
  const make = (options) => createNewsPreviewHandler({ getClient: () => fakeClient(options), shell })

  it('gives a browser the app shell with a revalidating cache header', async () => {
    const handler = make()
    const res = fakeRes()
    await handler(browser('matriculation-2026'), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe(SHELL)
    expect(res.headers['Cache-Control']).toBe('public, max-age=0, must-revalidate')
  })

  it('gives a crawler the article tags, with an absolute image URL', async () => {
    const handler = make()
    const res = fakeRes()
    await handler(crawler('matriculation-2026'), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('og:title" content="Matriculation 2026 — dates announced')
    expect(res.body).toContain('og:url" content="https://')
    expect(res.body).toContain('/news/matriculation-2026')
    expect(res.body).toMatch(/og:image" content="https:\/\/[^"]+\/api\/news-image\?key=matriculation-2026/)
    expect(res.body).toContain('og:image:width" content="1200"')
    expect(res.body).toContain('og:image:height" content="630"')
    expect(res.body).toContain('The ceremony holds on the 14th')
    expect(res.headers['Cache-Control']).toBe('public, max-age=300')
  })

  it('resolves an old id link too, and advertises the slug form', async () => {
    const handler = make()
    const res = fakeRes()
    await handler(crawler(ARTICLE.id), res)
    expect(res.body).toContain('/news/matriculation-2026')
    expect(res.body).toContain('key=matriculation-2026')
  })

  it('escapes an admin-authored title', async () => {
    const handler = make({ article: { ...ARTICLE, title: '<script>"x"</script>' } })
    const res = fakeRes()
    await handler(crawler('matriculation-2026'), res)
    expect(res.body).not.toContain('<script>')
    expect(res.body).toContain('&lt;script&gt;')
  })

  it('serves the shell to a crawler when the key is unknown or the flag is off', async () => {
    const unknown = make({ article: null })
    const a = fakeRes(); await unknown(crawler('nope'), a)
    expect(a.statusCode).toBe(200)
    expect(a.body).toBe(SHELL)

    const off = make({ flags: { news_share: false } })
    const b = fakeRes(); await off(crawler('matriculation-2026'), b)
    expect(b.body).toBe(SHELL)
    expect(b.body).not.toContain('Matriculation')
  })

  it('fails loudly when the app shell is missing rather than serving nothing to a browser', async () => {
    const handler = createNewsPreviewHandler({ getClient: () => fakeClient(), shell: () => null })
    const res = fakeRes()
    await handler(browser('matriculation-2026'), res)
    expect(res.statusCode).toBe(500)
  })
})

describe('news-image', () => {
  const make = (options = {}) =>
    createNewsImageHandler({
      getClient: () => fakeClient(options),
      fetchImage: options.fetchImage ?? (async () => null),
      logo: () => null,
    })

  // PNG layout: 8-byte signature, 4-byte IHDR length, "IHDR", then width and height as uint32.
  const pngSize = (buffer) => ({
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  })

  it('draws a 1200x630 card with no photo at all', async () => {
    const handler = make()
    const res = fakeRes()
    await handler(crawler('matriculation-2026'), res)
    expect(res.statusCode).toBe(200)
    expect(res.contentType).toBe('image/png')
    expect(Buffer.isBuffer(res.body)).toBe(true)
    expect(res.body.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(pngSize(res.body)).toEqual({ width: 1200, height: 630 })
    expect(res.headers['Cache-Control']).toBe('public, s-maxage=86400')
  })

  it('still draws the card when the photo fetch fails', async () => {
    const handler = make({ fetchImage: async () => null })
    const res = fakeRes()
    await handler(crawler('matriculation-2026'), res)
    expect(res.statusCode).toBe(200)
    expect(pngSize(res.body)).toEqual({ width: 1200, height: 630 })
  })

  it('404s for an unknown key and when the switch is off', async () => {
    const unknown = make({ article: null })
    const a = fakeRes(); await unknown(crawler('nope'), a)
    const off = make({ flags: { news_share: false } })
    const b = fakeRes(); await off(crawler('matriculation-2026'), b)
    expect([a.statusCode, b.statusCode]).toEqual([404, 404])
  })
})
