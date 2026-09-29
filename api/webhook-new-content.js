import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { logError } from './_lib/logError.js'
import { getResendClient, FROM_ADDRESS } from './_lib/resend.js'
import { chunk } from './_lib/chunk.js'
import { renderNewContentEmail, SITE_URL } from './_lib/emailTemplates.js'
import { isSafeRecordKey, isWebhookAuthentic } from './_lib/webhookAuth.js'
import { boundedString } from './_lib/validate.js'

const CONTENT_META = {
  news: { eyebrow: 'News Update', subjectPrefix: 'News update' },
  events: { eyebrow: 'New Event', subjectPrefix: 'New event' },
}

export default async function handler(req, res) {
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

  const supabaseAdmin = getSupabaseAdmin()

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

  const emails = recipients.map((r) => r.email)
  const resend = getResendClient()
  const url = `${SITE_URL}/${table}/${record.id}`
  const html = renderNewContentEmail({ eyebrow: meta.eyebrow, title: record.title, url, imageUrl: record.image_url })
  const subject = `${meta.subjectPrefix}: ${record.title}`
  let sent = 0
  for (const batch of chunk(emails, 100)) {
    try {
      await resend.batch.send(
        batch.map((email) => ({
          from: FROM_ADDRESS,
          to: email,
          subject,
          html,
        })),
      )
      sent += batch.length
    } catch (sendError) {
      console.error('webhook-new-content: batch send failed', sendError)
      await logError(supabaseAdmin, 'webhook-new-content', sendError, 500)
    }
  }

  res.status(200).json({ sent })
}
