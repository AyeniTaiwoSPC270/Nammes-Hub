import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { bearerToken, getCaller } from './_lib/authz.js'

const SLUG_RE = /^[a-z0-9_-]{1,80}$/i

// Owner-only proxy to Sentry's issue list, so the Sentry token never reaches the browser.
export function createAdminIssuesHandler({
  getClient = getSupabaseAdmin,
  fetchImpl = fetch,
  env = process.env,
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const caller = await getCaller(getClient(), bearerToken(req))
    if (caller.error) {
      res.status(caller.error[0]).json({ error: caller.error[1] })
      return
    }
    if (!caller.isOwner) {
      res.status(403).json({ error: 'Owner access required' })
      return
    }

    const { SENTRY_AUTH_TOKEN: token, SENTRY_ORG: org, SENTRY_PROJECT: project } = env
    const base = env.SENTRY_API_BASE || 'https://de.sentry.io'
    if (!token || !SLUG_RE.test(org || '') || !SLUG_RE.test(project || '')) {
      res.status(200).json({ configured: false, issues: [] })
      return
    }

    try {
      const url = `${base}/api/0/projects/${org}/${project}/issues/?statsPeriod=14d&query=${encodeURIComponent('is:unresolved')}&limit=25`
      const response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) throw new Error(`Sentry responded ${response.status}`)
      const issues = (await response.json()).map((i) => ({
        id: i.id,
        shortId: i.shortId,
        title: i.title,
        culprit: i.culprit,
        level: i.level,
        count: Number(i.count) || 0,
        userCount: i.userCount ?? 0,
        firstSeen: i.firstSeen,
        lastSeen: i.lastSeen,
        permalink: i.permalink,
      }))
      res.status(200).json({ configured: true, issues })
    } catch (error) {
      console.error('admin-issues: Sentry lookup failed', error)
      res.status(502).json({ error: 'Could not load issues from Sentry' })
    }
  }
}

export default createAdminIssuesHandler()
