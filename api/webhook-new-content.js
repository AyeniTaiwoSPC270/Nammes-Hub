import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { logError } from './_lib/logError.js'
import { enqueueEmails } from './_lib/emailQueue.js'
import { renderNewContentEmail, loadEmailDesign, SITE_URL } from './_lib/emailTemplates.js'
import { safeLink } from './_lib/emailDesign.js'
import { isSafeRecordKey, isWebhookAuthentic } from './_lib/webhookAuth.js'
import { boundedString } from './_lib/validate.js'

const CONTENT_META = {
  news: { eyebrow: 'News Update', subjectPrefix: 'News update' },
  events: { eyebrow: 'New Event', subjectPrefix: 'New event' },
  opportunities: { eyebrow: 'New Opportunity', subjectPrefix: 'New opportunity' },
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// `deadline` is a `date` column, so it is read as three numbers rather than through `new Date(string)`, which
// would treat the value as UTC midnight and print the day before for any host west of Greenwich.
function formatDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''))
  if (!match) return ''
  const month = MONTHS[Number(match[2]) - 1]
  return month ? `${Number(match[3])} ${month} ${match[1]}` : ''
}

// The apply link is the one thing a member actually needs from an opportunity email, but it is
// admin-authored, so it goes through the same allow-list every other email link does.
function applyUrl(link) {
  const safe = safeLink(link)
  return safe.startsWith('https://') || safe.startsWith('mailto:') ? safe : ''
}

function opportunityDetails(record) {
  return [
    { label: 'Organization', value: record.org },
    { label: 'Type', value: record.type },
    { label: 'Deadline', value: formatDay(record.deadline) },
  ].filter((detail) => detail.value)
}

export function createWebhookNewContentHandler({ getClient = getSupabaseAdmin, enqueue = enqueueEmails } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const { table, record } = req.body ?? {}
    const meta = CONTENT_META[table]
    if (!meta || !boundedString(record?.title, 1, 300) || !isSafeRecordKey(record?.id)) {
      res.status(400).json({ error: 'Unsupported table, missing record.title or invalid record.id' })
      return
    }

    const supabaseAdmin = getClient()

    const authentic = await isWebhookAuthentic(supabaseAdmin, {
      headers: req.headers,
      table,
      key: record.id,
    })
    if (!authentic) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const { data: recipients, error } = await supabaseAdmin.rpc('get_notification_recipients')
    if (error) {
      console.error('webhook-new-content: could not load recipients', error)
      await logError(supabaseAdmin, 'webhook-new-content', error, 500)
      res.status(200).json({ sent: 0 })
      return
    }

    // Opportunities have no detail route, so the button lands on the list; a known apply link takes it
    // instead, because one click to the application beats two clicks through the hub.
    const pageUrl = table === 'opportunities' ? `${SITE_URL}/opportunities` : `${SITE_URL}/${table}/${record.id}`
    const apply = table === 'opportunities' ? applyUrl(record.link) : ''
    const url = apply || pageUrl
    const details = table === 'opportunities' ? opportunityDetails(record) : []
    const buttonText = apply ? 'Apply now →' : 'Read more →'
    const design = await loadEmailDesign(supabaseAdmin, 'new_content')
    const html = renderNewContentEmail(
      { eyebrow: meta.eyebrow, title: record.title, url, imageUrl: record.image_url, details, buttonText },
      design,
    )
    const subject = `${meta.subjectPrefix}: ${record.title}`
    // Queued, not sent here: the worker delivers them and retries failures. The key stops a repeated webhook
    // from queueing the same email twice.
    const { queued, error: queueError } = await enqueue(
      supabaseAdmin,
      recipients.map((r) => ({
        kind: 'new-content',
        to: r.email,
        subject,
        html,
        dedupeKey: `new-content:${table}:${record.id}:${r.email}`,
      })),
    )
    if (queueError) {
      console.error('webhook-new-content: could not queue emails', queueError)
      await logError(supabaseAdmin, 'webhook-new-content', queueError, 500)
    }

    res.status(200).json({ queued })
  }
}

export default createWebhookNewContentHandler()
