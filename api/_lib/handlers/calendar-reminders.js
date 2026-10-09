import juice from 'juice'
import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { logError } from '../logError.js'
import { enqueueEmails } from '../emailQueue.js'
import { loadEmailDesign } from '../emailTemplates.js'
import { academicReminderContent, renderEmail, systemDesign } from '../emailDesign.js'
import { isSafeRecordKey, isWebhookAuthentic } from '../webhookAuth.js'
import { addDays, fromDayKey, toDayKey } from '../calendarDates.js'

const ROUTE = 'calendar-reminders'

// The signed identity this route answers to. A cron call has no row behind it, so the pair is fixed strings
// rather than a record id. They must differ from every other pair the verifier accepts -- an email_outbox/tick
// signature replayed here would verify, because the HMAC covers only these three parts and nothing else
// (webhookAuth.js:10).
const SIGN_TABLE = 'academic_calendar'
const SIGN_KEY = 'remind'

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

// remind_days is check-constrained to 0..30 (20261009090000_calendar.sql:25), so a due row can start no later
// than today + 30. The window keeps the daily read on the (session, starts_at) index and off the whole table,
// and it is a narrowing of the authoritative check below rather than a replacement for it.
const MAX_LEAD_DAYS = 30

// The calendar is printed in Lagos, so "today" is the Lagos day. The function runs in UTC, and the two differ
// for five hours a day: a tick at 23:30 UTC is already the next day in Lagos, and a student opening their mail at
// 08:00 the next morning would be reminded on the wrong day -- or, for the last tick of a day, not at all.
// The day is therefore read out of an Africa/Lagos formatter rather than off the host clock.
function lagosDayKey(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

// The day a reminder for this row is due: the senate date minus its lead time, as a day key.
//
// Both sides of the comparison are day keys, so the host timezone cannot move the answer. `fromDayKey` builds
// local midnight and `addDays` preserves the wall clock across month and DST boundaries, so adding a negative
// number of days and reading the local parts back gives the shifted key in every zone -- including the ones
// whose local midnight does not exist that day, where the Date lands at 01:00 and the key is still correct.
function reminderDayKey(startsAt, remindDays) {
  if (typeof startsAt !== 'string' || !DAY_KEY.test(startsAt)) return null
  const lead = Number(remindDays)
  if (!Number.isInteger(lead) || lead < 0 || lead > MAX_LEAD_DAYS) return null
  // A key that does not survive the round trip is a day the database never had ('2026-02-30', a truncated
  // hand-edit). calendarMerge.js:30 rejects the same thing for the same reason, and compares keys rather than
  // dates everywhere else so one bad row cannot shift the answer.
  if (toDayKey(fromDayKey(startsAt)) !== startsAt) return null
  return toDayKey(addDays(fromDayKey(startsAt), -lead))
}

/**
 * The dedupe key for one recipient's copy of one reminder.
 *
 * `email_outbox.dedupe_key` is unique and the queue upserts with ignoreDuplicates, so a key that identified the
 * entry alone would collapse the whole fan-out into a single row: every tick, and every recipient, would
 * resolve to the same key and the database would keep only the first. The entry and the date make the reminder
 * itself unique -- a re-run on the same day, a retried tick and a manual call all produce the identical key, so
 * the second one queues nothing -- and the recipient is what makes the key per person.
 */
export function reminderDedupeKey({ id, startsAt, email }) {
  return `academic-reminder:${id}:${startsAt}:${email}`
}

// A row without a usable id cannot be addressed, and inventing one would hand two rows the same key
// (calendarMerge.js:82 says the same about the merge).
function isDue(row, todayKey) {
  if (!row || !isSafeRecordKey(row.id)) return false
  return reminderDayKey(row.starts_at, row.remind_days) === todayKey
}

function cleanEmails(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map((r) => (typeof r?.email === 'string' ? r.email.trim() : '')).filter(Boolean)
}

export function createCalendarRemindersHandler({
  getClient = getSupabaseAdmin,
  enqueue = enqueueEmails,
  now = () => new Date(),
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const supabaseAdmin = getClient()
    // The headers are picked out explicitly so nothing else is ever treated as credentials.
    const authentic = await isWebhookAuthentic(supabaseAdmin, {
      headers: {
        'x-webhook-timestamp': req.headers['x-webhook-timestamp'],
        'x-webhook-signature': req.headers['x-webhook-signature'],
      },
      table: SIGN_TABLE,
      key: SIGN_KEY,
    })
    if (!authentic) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const at = now()
    const todayKey = lagosDayKey(at)

    // The kill switch the public calendar page already reads, so switching the calendar off without a deploy
    // switches its email off with it. Failing closed on an unreadable flag is safe here: a reminder day is a
    // whole day long, so a tick that gives up costs nothing and the next one still catches the same entries.
    const { data: flag, error: flagError } = await supabaseAdmin
      .from('feature_flags')
      .select('enabled')
      .eq('key', 'calendar')
      .maybeSingle()
    if (flagError) {
      console.error(`${ROUTE}: could not read the calendar flag`, flagError)
      await logError(supabaseAdmin, ROUTE, flagError, 500)
      res.status(500).json({ error: 'Could not read the calendar flag' })
      return
    }
    if (flag && flag.enabled === false) {
      res.status(200).json({ queued: 0, due: 0, skipped: 'calendar-flag-off' })
      return
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('calendar_settings')
      .select('active_session, reminder_enabled')
      .eq('id', 1)
      .maybeSingle()
    if (settingsError) {
      console.error(`${ROUTE}: could not read the calendar settings`, settingsError)
      await logError(supabaseAdmin, ROUTE, settingsError, 500)
      res.status(500).json({ error: 'Could not read the calendar settings' })
      return
    }
    const session = typeof settings?.active_session === 'string' ? settings.active_session.trim() : ''
    if (!session) {
      res.status(200).json({ queued: 0, due: 0, skipped: 'no-active-session' })
      return
    }
    // The studio's own switch. It is a column an admin can already set (src/data/calendar.js:22) and a switch
    // that does nothing would be worse than not having one.
    if (settings.reminder_enabled === false) {
      res.status(200).json({ queued: 0, due: 0, skipped: 'reminders-off' })
      return
    }

    // A due reminder fires on the day `starts_at - remind_days`, so its start is today or later -- never past.
    // That makes this a narrowing rather than the filter, which is why the checks are repeated below against
    // each row: a hand-edited row that the query did not exclude must not reach the outbox.
    const horizonKey = toDayKey(addDays(fromDayKey(todayKey), MAX_LEAD_DAYS))
    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('academic_calendar')
      .select('id, title, kind, starts_at, ends_at, note, remind_days')
      .eq('session', session)
      .not('starts_at', 'is', null)
      .not('remind_days', 'is', null)
      .gte('starts_at', todayKey)
      .lte('starts_at', horizonKey)
    if (rowsError) {
      console.error(`${ROUTE}: could not read the calendar`, rowsError)
      await logError(supabaseAdmin, ROUTE, rowsError, 500)
      res.status(500).json({ error: 'Could not read the calendar' })
      return
    }

    const due = (Array.isArray(rows) ? rows : []).filter((row) => isDue(row, todayKey))

    // The only source of addresses. Every other automatic email gets its list from here too, so one opt-out
    // switch covers them all and this handler has no path that reaches a profile row directly.
    const { data: recipientRows, error: recipientsError } = await supabaseAdmin.rpc('get_notification_recipients')
    if (recipientsError) {
      console.error(`${ROUTE}: could not load recipients`, recipientsError)
      await logError(supabaseAdmin, ROUTE, recipientsError, 500)
      res.status(500).json({ error: 'Could not load recipients' })
      return
    }
    const emails = cleanEmails(recipientRows)
    if (!emails.length || !due.length) {
      res.status(200).json({ queued: 0, due: due.length })
      return
    }

    // A saved design wins so an admin can restyle the reminder in the existing studio; the factory one keeps it
    // readable on the first run, before anyone has opened it.
    const savedDesign = await loadEmailDesign(supabaseAdmin, 'academic_reminder')
    const design = savedDesign ?? systemDesign('academic_reminder')

    const queue = []
    for (const row of due) {
      const content = academicReminderContent({
        title: row.title,
        kind: row.kind,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        note: row.note,
        daysAway: Number(row.remind_days),
      })
      const html = juice(renderEmail({ design, content, now: at }))
      for (const email of emails) {
        queue.push({
          kind: 'academic-reminder',
          to: email,
          subject: content.subject,
          html,
          dedupeKey: reminderDedupeKey({ id: row.id, startsAt: row.starts_at, email }),
        })
      }
    }

    const { queued, error: queueError } = await enqueue(supabaseAdmin, queue)
    if (queueError) {
      // Reported as a failure even though some rows may have landed: the next tick re-offers the identical keys
      // and the upsert adds only what is missing, so a partial insert self-heals and needs nothing deleted here.
      console.error(`${ROUTE}: could not queue reminder emails`, queueError)
      await logError(supabaseAdmin, ROUTE, queueError, 500)
      res.status(500).json({ error: 'Could not queue the reminder emails' })
      return
    }

    res.status(200).json({ queued, due: due.length })
  }
}

export default createCalendarRemindersHandler()