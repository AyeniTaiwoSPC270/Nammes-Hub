import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { logError } from './_lib/logError.js'
import { enqueueEmails } from './_lib/emailQueue.js'
import { renderBroadcastEmail, renderBlocksBroadcast, BROADCAST_TEMPLATES, DEFAULT_BROADCAST_TEMPLATE_HTML } from './_lib/emailTemplates.js'
import { normalizeBlocks, normalizeDesign, presetDesign, blocksToPlainText } from './_lib/emailDesign.js'
import { bearerToken, getCaller } from './_lib/authz.js'
import { isAllowedImageUrl, boundedString } from './_lib/validate.js'

const VALID_TEMPLATE_IDS = new Set(BROADCAST_TEMPLATES.map((t) => t.id))

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000

export function createSendBroadcastHandler({ getClient = getSupabaseAdmin, enqueue = enqueueEmails } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const { subject, body, imageUrl, templateId, blocks: rawBlocks, design: rawDesign, testOnly } = req.body ?? {}
    const usesBlocks = Array.isArray(rawBlocks)
    if (!boundedString(subject, 1, 200)) {
      res.status(400).json({ error: 'subject (max 200 characters) is required' })
      return
    }
    if (!usesBlocks && !boundedString(body, 1, 20000)) {
      res.status(400).json({ error: 'body (max 20000) is required' })
      return
    }
    if (imageUrl && !isAllowedImageUrl(imageUrl, [new URL(process.env.VITE_SUPABASE_URL).hostname])) {
      res.status(400).json({ error: 'imageUrl must be an image uploaded to this site' })
      return
    }
    const allowedHosts = [new URL(process.env.VITE_SUPABASE_URL).hostname]
    const blocks = usesBlocks ? normalizeBlocks(rawBlocks, allowedHosts) : null
    if (usesBlocks && blocks.length === 0) {
      res.status(400).json({ error: 'Add some content to the email first' })
      return
    }
    // The stored text is what shows in history and what duplicate detection compares.
    const plainBody = usesBlocks ? blocksToPlainText(blocks) : body
    if (plainBody.length > 20000) {
      res.status(400).json({ error: 'body (max 20000) is required' })
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
    // A test send goes only to the sender, so it is exempt.
    if (!testOnly) {
      const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString()
      const { data: recent } = await supabaseAdmin
        .from('broadcasts')
        .select('id')
        .eq('sent_by', caller.user.id)
        .eq('subject', subject)
        .eq('body', plainBody)
        .gte('created_at', since)
        .limit(1)
      if (recent?.length) {
        res.status(409).json({ error: 'This broadcast was already sent in the last 10 minutes' })
        return
      }
    }

    let recipients
    if (testOnly) {
      if (!caller.user.email) {
        res.status(400).json({ error: 'Your account has no email address to send a test to' })
        return
      }
      recipients = [{ email: caller.user.email }]
    } else {
      const { data, error: recipientsError } = await supabaseAdmin.rpc('get_notification_recipients')
      if (recipientsError) {
        res.status(500).json({ error: 'Could not load recipients' })
        return
      }
      recipients = data
    }

    const { data: templateRow } = await supabaseAdmin
      .from('email_templates')
      .select('html, design')
      .eq('template_id', safeTemplateId)
      .maybeSingle()

    let html
    let savedDesign = null
    if (usesBlocks) {
      // Design priority: what the composer sent, then the template's saved design, then (unless an admin
      // hand-edited the template's HTML) the built-in look for that template.
      const handEdited = Boolean(templateRow?.html) && templateRow.html !== DEFAULT_BROADCAST_TEMPLATE_HTML[safeTemplateId]
      const chosen = rawDesign ?? templateRow?.design ?? (handEdited ? null : presetDesign(safeTemplateId))
      savedDesign = chosen ? normalizeDesign(chosen, allowedHosts) : null
      html = renderBlocksBroadcast({
        subject,
        blocks,
        design: savedDesign,
        templateId: safeTemplateId,
        customHtml: templateRow?.html || undefined,
        allowedHosts,
      })
    } else {
      html = renderBroadcastEmail({
        subject,
        body,
        imageUrl,
        templateId: safeTemplateId,
        customHtml: templateRow?.html || undefined,
      })
    }

    // Queued, not sent from this request: the worker delivers them within a minute or two and retries failures.
    // The batch id keeps two different broadcasts to the same person from colliding.
    const batchId = crypto.randomUUID()
    const { queued, error: queueError } = await enqueue(
      supabaseAdmin,
      recipients.map((r) => ({
        kind: testOnly ? 'broadcast-test' : 'broadcast',
        to: r.email,
        subject: testOnly ? `[Test] ${subject}` : subject,
        html,
        dedupeKey: `broadcast:${batchId}:${r.email}`,
      })),
    )
    if (queueError) {
      console.error('send-broadcast: could not queue emails', queueError)
      await logError(supabaseAdmin, 'send-broadcast', queueError, 500)
    }
    const emails = recipients
    // All or nothing: if queueing failed part-way, remove what was queued so a retry cannot send twice.
    if (queueError) {
      await supabaseAdmin.from('email_outbox').delete().like('dedupe_key', `broadcast:${batchId}:%`)
    }
    const sentCount = queueError ? 0 : queued

    if (emails.length > 0 && sentCount === 0) {
      res.status(502).json({ error: 'Could not queue the broadcast' })
      return
    }

    if (testOnly) {
      res.status(200).json({ recipientCount: emails.length, sentCount, queued: true, test: true })
      return
    }

    const { error: insertError } = await supabaseAdmin.from('broadcasts').insert({
      subject,
      body: plainBody,
      image_url: imageUrl || null,
      template_id: safeTemplateId,
      blocks: usesBlocks ? blocks : null,
      design: savedDesign,
      sent_by: userData.user.id,
      recipient_count: sentCount,
    })
    if (insertError) {
      console.error('send-broadcast: failed to record broadcast', insertError)
      await logError(supabaseAdmin, 'send-broadcast', insertError, 500)
    }

    res.status(200).json({ recipientCount: emails.length, sentCount, queued: true })
  }
}

export default createSendBroadcastHandler()
