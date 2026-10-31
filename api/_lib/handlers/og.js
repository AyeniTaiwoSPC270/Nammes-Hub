import { getSupabaseAdmin } from '../supabaseAdmin.js'

// Server-rendered Open Graph tags, so a quiz link pasted into a WhatsApp group previews as itself instead of as a bare
// "Nammes Hub". WhatsApp does not run JavaScript, so the only thing it can read is what this function returns.
//
// Two decisions are worth stating, because both look like omissions:
//
//   * The join preview is deliberately generic. A join code only has to be unique while its game is running, and
//     resolving it here would turn the code into a public lookup endpoint. A preview is generated from a URL that is
//     by definition already in someone's hand, so there is nothing to protect. The invite is the code; the preview
//     only says that a quiz exists.
//   * This is registered on api/system.js rather than given its own entry point, which costs one serverless function
//     slot out of twelve used. See the note in api/system.js.
//
// No auth, and nothing here reads a secret: every value rendered is either a constant or public text, escaped.

const SITE = 'Nammes Hub'

// A quiz title is admin-authored and lands inside <meta content="...">. Unescaped, this endpoint is a reflected XSS
// sink on a public URL. `'` becomes &#x27; because that is what React emits, so the two agree.
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// The fallback copy for each kind of link. `target` is where a person ends up: a crawler reads the tags below, and
// anyone opening the link in a browser is redirected to this path instead.
export const PREVIEWS = {
  join: {
    title: 'A live quiz is waiting',
    description: 'Join on your phone and answer along with everyone else. Tap the link to get in.',
    target: (q) => `/play?code=${encodeURIComponent(q.code ?? '')}`,
  },
  battle: {
    title: 'A quiz battle is waiting',
    description: 'Someone is waiting to play you. Answer fast, answer right, and take the round.',
    target: (q) => `/battle?code=${encodeURIComponent(q.code ?? '')}`,
  },
  result: {
    title: 'Quiz results',
    description: 'The final leaderboard for this quiz. Open the link to see the board.',
    target: (q) => (UUID.test(String(q.session ?? '')) ? `/host/${q.session}` : '/'),
  },
}

export function siteOrigin() {
  return process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || 'nammes-hub.vercel.app'
}

export function renderPage({ title, description, path = '/', image, imageWidth, imageHeight }) {
  const origin = `https://${siteOrigin()}`
  const url = `${origin}${path}`
  // The article card passes its own generated image; a quiz preview falls back to the site mark.
  const imageHref = image ? String(image) : `${origin}/logo.png`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeHtml(SITE)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(imageHref)}">
${imageWidth && imageHeight ? `<meta property="og:image:width" content="${escapeHtml(imageWidth)}">\n<meta property="og:image:height" content="${escapeHtml(imageHeight)}">\n` : ''}
<meta property="og:url" content="${escapeHtml(url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(imageHref)}">
</head>
<body><p><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></p></body>
</html>`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// WhatsApp and the other preview fetchers do not send a browser's User-Agent, and they do not follow a redirect when
// they want a preview. A link a person taps does the opposite. Telling the two apart by UA is the standard way to serve
// one URL as both a card and a landing page, and it fails safe: an unrecognised fetch gets the tags, which is the
// harmless answer.
export function looksLikeBrowser(headers = {}) {
  return /Mozilla/i.test(String(headers['user-agent'] ?? headers['User-Agent'] ?? ''))
}

export function createOgHandler(getClient) {
  return async function handler(req, res) {
    const query = req.query ?? {}
    const type = typeof query.type === 'string' ? query.type : ''
    const preview = PREVIEWS[type]

    // Not this endpoint's business. A 404 rather than the app shell keeps a mistyped or stale /api/og out of the
    // crawlers' cache, instead of handing every broken link the same card.
    if (!preview) {
      res.status(404).type('text/plain').send('Not found')
      return
    }

    const session = typeof query.session === 'string' ? query.session : ''

    // A person tapping the link wants the quiz, not a page about it. No-store, because a redirect cached by a browser
    // would keep sending people to the next game's code.
    if (looksLikeBrowser(req.headers)) {
      res.setHeader('Cache-Control', 'no-store')
      res.redirect(302, preview.target(query))
      return
    }

    let copy = { title: preview.title, description: preview.description }

    if (type === 'result' && UUID.test(session)) {
      // A finished board is what the player has already chosen to share, so naming it discloses nothing new.
      const { data } = await getClient()
        .from('quiz_sessions')
        .select('state, quizzes(title)')
        .eq('id', session)
        .maybeSingle()
      const quizTitle = Array.isArray(data?.quizzes) ? data.quizzes[0]?.title : data?.quizzes?.title
      if (data?.state === 'finished' && quizTitle) copy = { ...copy, title: `${quizTitle} — final scores` }
    }

    // WhatsApp refetches aggressively. Without this, every preview cold-starts a serverless handler, which is how a
    // share feature becomes the reason a game feels slow.
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.status(200).type('text/html').send(renderPage({ ...copy, path: preview.target(query) }))
  }
}

export default createOgHandler(getSupabaseAdmin)