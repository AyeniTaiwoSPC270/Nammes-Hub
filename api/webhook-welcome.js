import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { getResendClient, FROM_ADDRESS } from './_lib/resend.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const record = req.body?.record
  if (!record?.user_id) {
    res.status(400).json({ error: 'Missing record.user_id' })
    return
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data: isValidSecret } = await supabaseAdmin.rpc('verify_webhook_secret', {
    candidate: req.headers['x-webhook-secret'] || '',
  })
  if (!isValidSecret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(record.user_id)
  if (error || !data?.user?.email) {
    console.error('webhook-welcome: could not resolve email', error)
    res.status(200).json({ sent: false })
    return
  }

  try {
    await getResendClient().emails.send({
      from: FROM_ADDRESS,
      to: data.user.email,
      subject: 'Welcome to NAMMES Hub',
      html: `<p>Hi ${record.full_name || 'there'},</p><p>Welcome to NAMMES Hub — glad to have you.</p>`,
    })
    res.status(200).json({ sent: true })
  } catch (sendError) {
    console.error('webhook-welcome: send failed', sendError)
    res.status(200).json({ sent: false })
  }
}
