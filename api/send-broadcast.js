import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { getResendClient, FROM_ADDRESS } from './_lib/resend.js'
import { chunk } from './_lib/chunk.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' })
    return
  }

  const { subject, body } = req.body ?? {}
  if (!subject?.trim() || !body?.trim()) {
    res.status(400).json({ error: 'subject and body are required' })
    return
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData?.user) {
    res.status(401).json({ error: 'Invalid session' })
    return
  }

  const { data: adminRow } = await supabaseAdmin
    .from('admins')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (!adminRow) {
    res.status(403).json({ error: 'Admin access required' })
    return
  }

  const { data: recipients, error: recipientsError } = await supabaseAdmin.rpc('get_notification_recipients')
  if (recipientsError) {
    res.status(500).json({ error: 'Could not load recipients' })
    return
  }

  const emails = recipients.map((r) => r.email)
  const resend = getResendClient()
  let sentCount = 0
  for (const batch of chunk(emails, 100)) {
    try {
      await resend.batch.send(batch.map((email) => ({ from: FROM_ADDRESS, to: email, subject, html: body })))
      sentCount += batch.length
    } catch (sendError) {
      console.error('send-broadcast: batch send failed', sendError)
    }
  }

  if (emails.length > 0 && sentCount === 0) {
    res.status(502).json({ error: 'Failed to send to any recipients' })
    return
  }

  const { error: insertError } = await supabaseAdmin.from('broadcasts').insert({
    subject,
    body,
    sent_by: userData.user.id,
    recipient_count: sentCount,
  })
  if (insertError) console.error('send-broadcast: failed to record broadcast', insertError)

  res.status(200).json({ recipientCount: emails.length, sentCount })
}
