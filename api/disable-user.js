import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { getCaller, bearerToken } from './_lib/authz.js'
import { isUuid } from './_lib/validate.js'

// ~100 years: Supabase Auth has no "banned forever" option, so this is the standard workaround.
const BAN_FOREVER = '876000h'

// Disabling an account does two things: flag the profile (RLS then refuses the user's writes)
// and ban the Auth user (sign-in and token refresh stop working). Enabling reverses both.
export function createDisableUserHandler(getClient) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const { userId, disabled } = req.body ?? {}
    if (!isUuid(userId) || typeof disabled !== 'boolean') {
      res.status(400).json({ error: 'userId (uuid) and disabled (boolean) are required' })
      return
    }

    const supabaseAdmin = getClient()
    const caller = await getCaller(supabaseAdmin, bearerToken(req))
    if (caller.error) {
      res.status(caller.error[0]).json({ error: caller.error[1] })
      return
    }
    if (!caller.isAdmin) {
      res.status(403).json({ error: 'Admin access required' })
      return
    }
    if (userId === caller.user.id) {
      res.status(400).json({ error: "You can't disable your own account" })
      return
    }

    const { data: targetAdmin } = await supabaseAdmin
      .from('admins')
      .select('is_owner')
      .eq('user_id', userId)
      .maybeSingle()
    if (targetAdmin?.is_owner) {
      res.status(400).json({ error: 'The owner cannot be disabled' })
      return
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ is_disabled: disabled })
      .eq('user_id', userId)
    if (profileError) {
      console.error('disable-user: profile update failed', profileError)
      res.status(500).json({ error: 'Could not update the account' })
      return
    }

    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: disabled ? BAN_FOREVER : 'none',
    })
    if (banError) {
      console.error('disable-user: auth ban update failed', banError)
      res.status(502).json({ error: 'Account flagged, but sign-in could not be updated. Try again.' })
      return
    }

    res.status(200).json({ success: true })
  }
}

export default createDisableUserHandler(getSupabaseAdmin)
