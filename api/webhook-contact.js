import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { logError } from './_lib/logError.js'
import { enqueueEmails } from './_lib/emailQueue.js'
import { escapeHtml } from './_lib/emailTemplates.js'
import { isSafeRecordKey, isWebhookAuthentic } from './_lib/webhookAuth.js'

const FLOOD_WINDOW_MS = 10 * 60 * 1000
const FLOOD_LIMIT = 20
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/

function renderAlertHtml({ name, email, message, created_at }) {
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;">
  <p><strong>New message from the NAMMES Hub contact form</strong></p>
  <p><strong>Name:</strong> ${escapeHtml(name)}<br><strong>Email:</strong> ${escapeHtml(email)}<br><strong>Received:</strong> ${escapeHtml(created_at)}</p>
  <p style="white-space:pre-wrap;border-left:3px solid #ae3200;padding-left:12px;">${escapeHtml(message)}</p>
  <p style="color:#666;font-size:13px;">Reply to this email to answer the sender. You can also read and delete messages in Admin, Messages.</p>
</div>`
}

export function createWebhookContactHandler({ getClient = getSupabaseAdmin, enqueue = enqueueEmails } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const { table, record } = req.body ?? {}
    if (table !== 'contact_messages' || !isSafeRecordKey(record?.id)) {
      res.status(400).json({ error: 'Unsupported table or invalid record.id' })
      return
    }

    const supabaseAdmin = getClient()

    // The headers are picked out explicitly so nothing else is ever treated as credentials.
    const authentic = await isWebhookAuthentic(supabaseAdmin, {
      headers: {
        'x-webhook-timestamp': req.headers['x-webhook-timestamp'],
        'x-webhook-signature': req.headers['x-webhook-signature'],
      },
      table,
      key: record.id,
    })
    if (!authentic) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    // The database row is the source of truth, not the request body.
    const { data: message } = await supabaseAdmin
      .from('contact_messages')
      .select('id, name, email, message, created_at')
      .eq('id', record.id)
      .maybeSingle()
    if (!message) {
      res.status(200).json({ sent: false })
      return
    }

    // Someone flooding the public form must not flood the owner's inbox or the email quota.
    const since = new Date(Date.now() - FLOOD_WINDOW_MS).toISOString()
    const { count } = await supabaseAdmin
      .from('contact_messages')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
    if ((count ?? 0) > FLOOD_LIMIT) {
      res.status(200).json({ sent: false })
      return
    }

    const { data: owners } = await supabaseAdmin.from('admins').select('user_id').eq('is_owner', true)
    const recipients = []
    for (const owner of owners ?? []) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(owner.user_id)
      if (data?.user?.email) recipients.push(data.user.email)
    }
    if (!recipients.length) {
      res.status(200).json({ sent: false })
      return
    }

    const { queued, error: queueError } = await enqueue(
      supabaseAdmin,
      recipients.map((to) => ({
        kind: 'contact-alert',
        to,
        // Fixed subject: visitor text never reaches a header.
        subject: 'New contact message',
        html: renderAlertHtml(message),
        replyTo: EMAIL_RE.test(message.email) ? message.email : undefined,
        dedupeKey: `contact:${message.id}:${to}`,
      })),
    )
    if (queueError) {
      console.error('webhook-contact: could not queue alert', queueError)
      await logError(supabaseAdmin, 'webhook-contact', queueError, 500)
      res.status(200).json({ sent: false })
      return
    }
    res.status(200).json({ sent: queued > 0 })
  }
}

export default createWebhookContactHandler()
