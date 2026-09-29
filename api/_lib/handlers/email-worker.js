import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { logError } from '../logError.js'
import { getResendClient, FROM_ADDRESS } from '../resend.js'
import { chunk } from '../chunk.js'
import { isWebhookAuthentic } from '../webhookAuth.js'
import { MAX_ATTEMPTS, nextAttemptAt } from '../emailQueue.js'

const CLAIM_LIMIT = 200
const SEND_BATCH = 100

// Called every minute by the database (signed request). Sends due emails from the outbox.
// A batch that fails is retried later with a growing delay; after MAX_ATTEMPTS the emails are marked failed
// and one entry is written to the error log.
export function createEmailWorkerHandler({ getClient = getSupabaseAdmin, getResend = getResendClient, now = () => new Date() } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const supabaseAdmin = getClient()
    // Signed requests only: the legacy shared-secret header is deliberately not accepted here.
    const authentic = await isWebhookAuthentic(supabaseAdmin, {
      headers: {
        'x-webhook-timestamp': req.headers['x-webhook-timestamp'],
        'x-webhook-signature': req.headers['x-webhook-signature'],
      },
      table: 'email_outbox',
      key: 'tick',
    })
    if (!authentic) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const { data: claimed, error: claimError } = await supabaseAdmin.rpc('claim_email_batch', { p_limit: CLAIM_LIMIT })
    if (claimError) {
      console.error('email-worker: could not claim emails', claimError)
      await logError(supabaseAdmin, 'email-worker', claimError, 500)
      res.status(500).json({ error: 'Could not read the queue' })
      return
    }
    if (!claimed?.length) {
      res.status(200).json({ sent: 0, retried: 0, failed: 0 })
      return
    }

    let resend
    try {
      resend = getResend()
    } catch (error) {
      console.error('email-worker: email provider not configured', error)
      await logError(supabaseAdmin, 'email-worker', error, 500)
      res.status(500).json({ error: 'Email provider is not configured' })
      return
    }

    let sent = 0
    let retried = 0
    let failed = 0
    for (const batch of chunk(claimed, SEND_BATCH)) {
      let failure = null
      try {
        const { error } = await resend.batch.send(
          batch.map((row) => ({
            from: FROM_ADDRESS,
            to: row.to_email,
            subject: row.subject,
            html: row.html,
            ...(row.reply_to ? { replyTo: row.reply_to } : {}),
          })),
        )
        if (error) failure = error
      } catch (error) {
        failure = error
      }

      const ids = batch.map((row) => row.id)
      if (!failure) {
        await supabaseAdmin
          .from('email_outbox')
          .update({ status: 'sent', sent_at: now().toISOString(), last_error: null })
          .in('id', ids)
        sent += batch.length
        continue
      }

      const message = String(failure.message ?? failure).slice(0, 300)
      // claim_email_batch already counted this attempt, so row.attempts is the number of tries made so far.
      const giveUp = batch.filter((row) => row.attempts >= MAX_ATTEMPTS)
      const retry = batch.filter((row) => row.attempts < MAX_ATTEMPTS)
      if (giveUp.length) {
        await supabaseAdmin
          .from('email_outbox')
          .update({ status: 'failed', last_error: message })
          .in('id', giveUp.map((row) => row.id))
        failed += giveUp.length
        await logError(supabaseAdmin, 'email-worker', new Error(`${giveUp.length} email(s) gave up after ${MAX_ATTEMPTS} attempts: ${message}`), 502)
      }
      // Rows with the same attempt count wait the same time, so update them together.
      const byAttempts = Map.groupBy(retry, (row) => row.attempts)
      for (const [attempts, rows] of byAttempts) {
        await supabaseAdmin
          .from('email_outbox')
          .update({ next_attempt_at: nextAttemptAt(attempts, now()), last_error: message })
          .in('id', rows.map((row) => row.id))
      }
      retried += retry.length
    }

    res.status(200).json({ sent, retried, failed })
  }
}

export default createEmailWorkerHandler()
