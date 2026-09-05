import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { getResendClient, FROM_ADDRESS } from './_lib/resend.js'
import { chunk } from './_lib/chunk.js'

const LABEL_BY_TABLE = { news: 'News', events: 'Events' }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (req.headers['x-webhook-secret'] !== process.env.WEBHOOK_SHARED_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { table, record } = req.body ?? {}
  const label = LABEL_BY_TABLE[table]
  if (!label || !record?.title) {
    res.status(400).json({ error: 'Unsupported table or missing record.title' })
    return
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data: recipients, error } = await supabaseAdmin.rpc('get_notification_recipients')
  if (error) {
    console.error('webhook-new-content: could not load recipients', error)
    res.status(200).json({ sent: 0 })
    return
  }

  const emails = recipients.map((r) => r.email)
  const resend = getResendClient()
  const singular = label.slice(0, -1)
  let sent = 0
  for (const batch of chunk(emails, 100)) {
    try {
      await resend.batch.send(
        batch.map((email) => ({
          from: FROM_ADDRESS,
          to: email,
          subject: `New ${singular}: ${record.title}`,
          html: `<p>A new ${label.toLowerCase()} item was just published on NAMMES Hub: <strong>${record.title}</strong></p><p><a href="https://nammeshub.com.ng/${table}">View it here</a></p>`,
        })),
      )
      sent += batch.length
    } catch (sendError) {
      console.error('webhook-new-content: batch send failed', sendError)
    }
  }

  res.status(200).json({ sent })
}
