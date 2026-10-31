import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { renderPage, looksLikeBrowser, siteOrigin } from './og.js'
import { renderNewsCard, OG_WIDTH, OG_HEIGHT } from '../newsCardRender.js'

// Link previews for a news article. WhatsApp, Telegram and X fetch the article's own URL and read
// whatever HTML comes back, so one URL has to serve two audiences: meta tags for a crawler, the
// built app shell for a browser. This is the same trick api/_lib/handlers/og.js already plays for
// quiz links, except that there the handler redirects a browser to a *different* path -- here the
// browser is already at the right one, so it is handed the shell instead of a redirect that would
// loop.
//
// Registered as `news-preview` and `news-image` on api/system.js rather than given their own
// entry points: the Hobby plan's twelve function slots are all taken.
//
// Spec: docs/superpowers/specs/2026-10-31-news-slugs-share-preview-design.md

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** First ~160 characters of the body as plain text: the whole article is not a description. */
export function newsExcerpt(body, max = 160) {
  const text = String(body ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

/** Read the built SPA shell. null means the deploy is missing it, which is a build fault. */
export function readShell() {
  try {
    return readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf8')
  } catch {
    return null
  }
}

/** The article's photo, fetched with a hard timeout. Any failure is "draw the gradient instead". */
export async function fetchArticleImage(url, timeoutMs = 3000) {
  if (typeof url !== 'string' || !url.startsWith('https://')) return null
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) return null
    return Buffer.from(await response.arrayBuffer())
  } catch {
    return null
  }
}

function readLogo() {
  try {
    return readFileSync(path.join(process.cwd(), 'public', 'logo.png'))
  } catch {
    return null
  }
}

async function findArticle(client, key) {
  const columns = 'id, slug, title, body, image_url'
  const { data } = await client
    .from('news')
    .select(columns)
    .eq(UUID.test(key) ? 'id' : 'slug', key)
    .maybeSingle()
  return data ?? null
}

async function isShareEnabled(client) {
  const { data: flag } = await client.from('feature_flags').select('enabled').eq('key', 'news_share').maybeSingle()
  // A missing row or a failed read means "not switched off": a kill switch must not take previews
  // down because feature_flags was briefly unreachable.
  return flag ? flag.enabled !== false : true
}

function keyOf(req) {
  const raw = req.query?.key
  return typeof raw === 'string' ? raw.trim().slice(0, 300) : ''
}

/**
 * Meta tags for a crawler, the app shell for a browser.
 *
 * Fails the same way in both directions: unknown key, or the flag off, and a crawler is handed the
 * shell so it reads the baseline tags index.html already carries rather than a bespoke 404 card.
 */
export function createNewsPreviewHandler({
  getClient = getSupabaseAdmin,
  shell = readShell,
} = {}) {
  return async function handler(req, res) {
    const key = keyOf(req)
    const client = getClient()
    const enabled = await isShareEnabled(client)
    const article = enabled && key ? await findArticle(client, key) : null

    if (looksLikeBrowser(req.headers)) {
      const html = shell()
      if (!html) {
        console.error('news-preview: dist/index.html is missing from the function bundle')
        res.status(500).type('text/plain').send('Service unavailable')
        return
      }
      // Revalidate rather than cache: index.html carries hashed asset URLs, and a stale copy would
      // point a visitor at files the current deployment has already deleted.
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
      res.status(200).type('text/html').send(html)
      return
    }

    const html = shell()
    if (!html) {
      res.status(404).type('text/plain').send('Not found')
      return
    }
    res.setHeader('Cache-Control', 'public, max-age=300')

    if (!article) {
      res.status(200).type('text/html').send(html)
      return
    }

    const keyForImage = article.slug ?? article.id
    const image = `https://${siteOrigin()}/api/news-image?key=${encodeURIComponent(keyForImage)}`
    res.status(200).type('text/html').send(
      renderPage({
        title: article.title,
        description: newsExcerpt(article.body),
        path: `/news/${keyForImage}`,
        image,
        imageWidth: OG_WIDTH,
        imageHeight: OG_HEIGHT,
      }),
    )
  }
}

/** The 1200x630 card itself, so the preview image can be cached independently of the tags. */
export function createNewsImageHandler({
  getClient = getSupabaseAdmin,
  fetchImage = fetchArticleImage,
  logo = readLogo,
} = {}) {
  return async function handler(req, res) {
    const key = keyOf(req)
    const client = getClient()
    if (!(await isShareEnabled(client))) {
      res.status(404).type('text/plain').send('Not found')
      return
    }
    const article = key ? await findArticle(client, key) : null
    if (!article) {
      res.status(404).type('text/plain').send('Not found')
      return
    }

    const imageBuffer = article.image_url ? await fetchImage(article.image_url) : null
    const png = await renderNewsCard({ title: article.title, imageBuffer, logoBuffer: logo() })

    // A card is derived from a row that changes rarely, and WhatsApp re-fetches aggressively;
    // caching it is what stops every preview cold-starting the canvas renderer.
    res.setHeader('Cache-Control', 'public, s-maxage=86400')
    res.status(200).type('image/png').send(png)
  }
}

export default createNewsPreviewHandler()
