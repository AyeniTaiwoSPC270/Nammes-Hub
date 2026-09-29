import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { logError } from './_lib/logError.js'
import { getCaller, bearerToken } from './_lib/authz.js'
import { isUuid } from './_lib/validate.js'

const BAN_FOREVER = '876000h'

// For accounts that cannot be deleted because votes or submissions point at them: removes the personal
// details (profile, CGPA data, sign-in email) but keeps those records, which then show as an unknown user.
// Owner only. Order matters: lock the sign-in first, then scrub the database, then scrub the sign-in record.
export function createAnonymiseUserHandler(getClient) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const { userId } = req.body ?? {}
    if (!isUuid(userId)) {
      res.status(400).json({ error: 'userId (uuid) is required' })
      return
    }

    const supabaseAdmin = getClient()
    const caller = await getCaller(supabaseAdmin, bearerToken(req))
    if (caller.error) {
      res.status(caller.error[0]).json({ error: caller.error[1] })
      return
    }
    if (!caller.isOwner) {
      res.status(403).json({ error: 'Only the owner can anonymise accounts' })
      return
    }
    if (userId === caller.user.id) {
      res.status(400).json({ error: "You can't anonymise your own account" })
      return
    }

    const { data: targetAdmin } = await supabaseAdmin.from('admins').select('user_id').eq('user_id', userId).maybeSingle()
    if (targetAdmin) {
      res.status(400).json({ error: 'Remove admin access from this account first' })
      return
    }

    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: BAN_FOREVER })
    if (banError) {
      console.error('anonymise-user: ban failed', banError)
      await logError(supabaseAdmin, 'anonymise-user', banError, 500)
      res.status(500).json({ error: 'Could not lock the account' })
      return
    }

    const { error: rpcError } = await supabaseAdmin.rpc('anonymise_user', { p_user: userId })
    if (rpcError) {
      console.error('anonymise-user: database step failed', rpcError)
      await logError(supabaseAdmin, 'anonymise-user', rpcError, 500)
      res.status(500).json({ error: 'Could not remove the personal details' })
      return
    }

    const { error: scrubError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: `deleted-${userId}@invalid.example`,
      user_metadata: {},
    })
    if (scrubError) {
      console.error('anonymise-user: sign-in record scrub failed', scrubError)
      await logError(supabaseAdmin, 'anonymise-user', scrubError, 500)
      res.status(502).json({ error: 'Details removed, but the sign-in email could not be cleared. Run it again.' })
      return
    }

    res.status(200).json({ success: true })
  }
}

export default createAnonymiseUserHandler(getSupabaseAdmin)
