import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { buildCalendarIcs } from '../calendarIcs.js'

// A public, unauthenticated subscribe feed. The rows it reads are already `select ... using (true)` for anon, and
// a token in a feed URL would break subscribing on every client that hides the URL.
//
// It is registered as an action on api/system.js rather than given a file of its own: the Hobby plan allows twelve
// serverless functions and all twelve are taken. The public URL is still /api/calendar-ics, via the rewrite in
// vercel.json -- that is the part a subscriber keeps, and it must not move.
const CACHE = 'public, max-age=300, stale-while-revalidate=86400'
const NO_STORE = 'no-store'

export function createCalendarIcsHandler({ getClient = getSupabaseAdmin, now = () => new Date() } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Cache-Control', NO_STORE)
      res.status(405).end()
      return
    }

    const db = getClient()

    // The `calendar` key is the kill switch. Off is a 404 rather than a valid-but-empty feed: an empty calendar
    // would wipe every subscriber's dates, while a 404 keeps their last copy.
    const { data: flag, error: flagError } = await db
      .from('feature_flags')
      .select('enabled')
      .eq('key', 'calendar')
      .maybeSingle()
    if (flagError) {
      res.setHeader('Cache-Control', NO_STORE)
      res.status(500).end()
      return
    }
    if (flag && flag.enabled === false) {
      res.setHeader('Cache-Control', NO_STORE)
      res.status(404).end()
      return
    }

    const { data: settings, error: settingsError } = await db
      .from('calendar_settings')
      .select('active_session')
      .eq('id', 1)
      .maybeSingle()
    if (settingsError) {
      res.setHeader('Cache-Control', NO_STORE)
      res.status(500).end()
      return
    }
    const session = typeof settings?.active_session === 'string' ? settings.active_session.trim() : ''

    // No session means no senate rows to publish; the events are still real, so the feed is a valid calendar
    // rather than an error.
    const academicQuery = session
      ? db
          .from('academic_calendar')
          .select('id, title, kind, starts_at, ends_at, note, updated_at')
          .eq('session', session)
          .order('starts_at', { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [], error: null })
    const eventsQuery = db
      .from('events')
      .select('id, title, description, meta, starts_at, ends_at, date')
      .order('starts_at', { ascending: true, nullsFirst: false })

    let academic
    let events
    try {
      const [academicResult, eventsResult] = await Promise.all([academicQuery, eventsQuery])
      if (academicResult?.error || eventsResult?.error) throw academicResult?.error ?? eventsResult.error
      academic = academicResult?.data ?? []
      events = eventsResult?.data ?? []
    } catch {
      // Never a partial calendar: clients delete the events that did not make it into a truncated file.
      res.setHeader('Cache-Control', NO_STORE)
      res.status(500).end()
      return
    }

    const body = buildCalendarIcs({ academic, events }, { now: now() })
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Cache-Control', CACHE)
    res.status(200)
    // HEAD returns the same headers with no body, so a health check can prove the feed is alive cheaply.
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    res.send(body)
  }
}

export default createCalendarIcsHandler()
