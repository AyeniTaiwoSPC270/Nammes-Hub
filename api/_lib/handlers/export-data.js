import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { logError } from '../logError.js'
import { getCaller, bearerToken } from '../authz.js'
import { getResendClient, FROM_ADDRESS } from '../resend.js'

// What a member is entitled to see about themselves. Votes are deliberately left out: ballots are secret
// and are not stored in a way that should be tied back to a person in a downloadable file.
const SOURCES = [
  { key: 'profile', table: 'profiles', column: 'user_id' },
  { key: 'cgpa_semesters', table: 'cgpa_semesters', column: 'user_id' },
  { key: 'form_responses', table: 'form_responses', column: 'respondent_id' },
  { key: 'award_nominations', table: 'award_nominations', column: 'submitted_by' },
  { key: 'outline_submissions', table: 'outline_submissions', column: 'submitted_by' },
]

export async function collectExport(supabaseAdmin, user, now = new Date()) {
  const data = {
    exported_at: now.toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
  }
  for (const { key, table, column } of SOURCES) {
    const { data: rows, error } = await supabaseAdmin.from(table).select('*').eq(column, user.id)
    if (error) throw error
    data[key] = key === 'profile' ? (rows?.[0] ?? null) : (rows ?? [])
  }
  return data
}

// Signed-in members only, and only their own data. delivery: 'download' (default) or 'email'.
export function createExportDataHandler({ getClient = getSupabaseAdmin, getResend = getResendClient } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const delivery = req.body?.delivery ?? 'download'
    if (delivery !== 'download' && delivery !== 'email') {
      res.status(400).json({ error: 'delivery must be "download" or "email"' })
      return
    }

    const supabaseAdmin = getClient()
    const caller = await getCaller(supabaseAdmin, bearerToken(req))
    if (caller.error) {
      res.status(caller.error[0]).json({ error: caller.error[1] })
      return
    }

    let exported
    try {
      exported = await collectExport(supabaseAdmin, caller.user)
    } catch (error) {
      console.error('export-data: read failed', error)
      await logError(supabaseAdmin, 'export-data', error, 500)
      res.status(500).json({ error: 'Could not prepare your data. Please try again.' })
      return
    }

    if (delivery === 'download') {
      res.status(200).json({ data: exported })
      return
    }

    if (!caller.user.email) {
      res.status(400).json({ error: 'Your account has no email address to send to' })
      return
    }
    try {
      const { error } = await getResend().emails.send({
        from: FROM_ADDRESS,
        to: caller.user.email,
        subject: 'Your NAMMES Hub data export',
        html: '<p>Your NAMMES Hub data export is attached as a JSON file. Keep it private: it contains your personal details.</p>',
        attachments: [{ filename: 'nammes-hub-data.json', content: Buffer.from(JSON.stringify(exported, null, 2)).toString('base64') }],
      })
      if (error) throw new Error(error.message || 'Email provider rejected the message')
    } catch (error) {
      console.error('export-data: email failed', error)
      await logError(supabaseAdmin, 'export-data', error, 502)
      res.status(502).json({ error: 'Could not send the email. Try the download instead.' })
      return
    }
    res.status(200).json({ sent: true })
  }
}

export default createExportDataHandler()
