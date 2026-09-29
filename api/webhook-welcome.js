import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { logError } from './_lib/logError.js'
import { enqueueEmails } from './_lib/emailQueue.js'
import { renderWelcomeEmail } from './_lib/emailTemplates.js'
import { isSafeRecordKey, isWebhookAuthentic } from './_lib/webhookAuth.js'

export function createWebhookWelcomeHandler({ getClient = getSupabaseAdmin, enqueue = enqueueEmails } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const record = req.body?.record
    if (!isSafeRecordKey(record?.user_id)) {
      res.status(400).json({ error: 'Missing or invalid record.user_id' })
      return
    }

    const supabaseAdmin = getClient()

    const authentic = await isWebhookAuthentic(supabaseAdmin, {
      headers: req.headers,
      table: 'profiles',
      key: record.user_id,
    })
    if (!authentic) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const { data, error } = await supabaseAdmin.auth.admin.getUserById(record.user_id)
    if (error || !data?.user?.email) {
      console.error('webhook-welcome: could not resolve email', error)
      await logError(supabaseAdmin, 'webhook-welcome', error, 500)
      res.status(200).json({ sent: false })
      return
    }

    const { queued, error: queueError } = await enqueue(supabaseAdmin, [
      {
        kind: 'welcome',
        to: data.user.email,
        subject: 'Welcome to NAMMES Hub',
        html: renderWelcomeEmail({ fullName: record.full_name }),
        dedupeKey: `welcome:${record.user_id}`,
      },
    ])
    if (queueError) {
      console.error('webhook-welcome: could not queue email', queueError)
      await logError(supabaseAdmin, 'webhook-welcome', queueError, 500)
      res.status(200).json({ sent: false })
      return
    }
    res.status(200).json({ sent: queued > 0 })
  }
}

export default createWebhookWelcomeHandler()
