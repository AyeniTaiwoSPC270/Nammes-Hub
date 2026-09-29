import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { logError } from './_lib/logError.js'
import { getResendClient, FROM_ADDRESS } from './_lib/resend.js'
import { chunk } from './_lib/chunk.js'
import { renderBroadcastEmail, BROADCAST_TEMPLATES } from './_lib/emailTemplates.js'
import { bearerToken, getCaller } from './_lib/authz.js'
import { isAllowedImageUrl, boundedString } from './_lib/validate.js'

const VALID_TEMPLATE_IDS = new Set(BROADCAST_TEMPLATES.map((t) => t.id))

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000

export function createSendBroadcastHandler({ getClient = getSupabaseAdmin, getResend = getResendClient } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const { subject, body, imageUrl, templateId } = req.body ?? {}
    if (!boundedString(subject, 1, 200) || !boundedString(body, 1, 20000)) {
      res.status(400).json({ error: 'subject (max 200 characters) and body (max 20000) are required' })
      return
    }
    if (imageUrl && !isAllowedImageUrl(imageUrl, [new URL(process.env.VITE_SUPABASE_URL).hostname])) {
      res.status(400).json({ error: 'imageUrl must be an image uploaded to this site' })
      return
    }
    const safeTemplateId = VALID_TEMPLATE_IDS.has(templateId) ? templateId : 'default'

    const supabaseAdmin = getClient()

    const caller = await getCaller(supabaseAdmin, bearerToken(req))
    if (caller.error) {
      res.status(caller.error[0]).json({ error: caller.error[1] })
      return
    }
    // A broadcast reaches every member and cannot be recalled, so only the owner may send one.
    if (!caller.isOwner) {
      res.status(403).json({ error: 'Owner access required' })
      return
    }
    const userData = { user: caller.user }

    // Kill switch: the owner can pause broadcasts (update feature_flags set enabled = false where key = 'broadcasts').
    const { data: flag } = await supabaseAdmin.from('feature_flags').select('enabled').eq('key', 'broadcasts').maybeSingle()
    if (flag && flag.enabled === false) {
      res.status(503).json({ error: 'Broadcasts are temporarily switched off' })
      return
    }

    // Guard against double-clicks and replays: the same message from the same sender within 10 minutes is refused.
    const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString()
    const { data: recent } = await supabaseAdmin
      .from('broadcasts')
      .select('id')
      .eq('sent_by', caller.user.id)
      .eq('subject', subject)
      .eq('body', body)
      .gte('created_at', since)
      .limit(1)
    if (recent?.length) {
      res.status(409).json({ error: 'This broadcast was already sent in the last 10 minutes' })
      return
    }

    const { data: recipients, error: recipientsError } = await supabaseAdmin.rpc('get_notification_recipients')
    if (recipientsError) {
      res.status(500).json({ error: 'Could not load recipients' })
      return
    }

    const { data: templateRow } = await supabaseAdmin
      .from('email_templates')
      .select('html')
      .eq('template_id', safeTemplateId)
      .maybeSingle()

    const emails = recipients.map((r) => r.email)
    const resend = getResend()
    const html = renderBroadcastEmail({
      subject,
      body,
      imageUrl,
      templateId: safeTemplateId,
      customHtml: templateRow?.html || undefined,
    })
    let sentCount = 0
    for (const batch of chunk(emails, 100)) {
      try {
        await resend.batch.send(batch.map((email) => ({ from: FROM_ADDRESS, to: email, subject, html })))
        sentCount += batch.length
      } catch (sendError) {
        console.error('send-broadcast: batch send failed', sendError)
        await logError(supabaseAdmin, 'send-broadcast', sendError, 500)
      }
    }

    if (emails.length > 0 && sentCount === 0) {
      res.status(502).json({ error: 'Failed to send to any recipients' })
      return
    }

    const { error: insertError } = await supabaseAdmin.from('broadcasts').insert({
      subject,
      body,
      image_url: imageUrl || null,
      template_id: safeTemplateId,
      sent_by: userData.user.id,
      recipient_count: sentCount,
    })
    if (insertError) {
      console.error('send-broadcast: failed to record broadcast', insertError)
      await logError(supabaseAdmin, 'send-broadcast', insertError, 500)
    }

    res.status(200).json({ recipientCount: emails.length, sentCount })
  }
}

export default createSendBroadcastHandler()
