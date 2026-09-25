import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'

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

  const { userId } = req.body ?? {}
  if (!userId) {
    res.status(400).json({ error: 'userId is required' })
    return
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token)
  if (callerError || !callerData?.user) {
    res.status(401).json({ error: 'Invalid session' })
    return
  }

  const { data: callerAdminRow } = await supabaseAdmin
    .from('admins')
    .select('is_owner')
    .eq('user_id', callerData.user.id)
    .maybeSingle()
  if (!callerAdminRow?.is_owner) {
    res.status(403).json({ error: 'Only the owner can delete accounts' })
    return
  }

  if (userId === callerData.user.id) {
    res.status(400).json({ error: "You can't delete your own account" })
    return
  }

  const { data: targetAdminRow } = await supabaseAdmin
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (targetAdminRow) {
    res.status(400).json({ error: 'Remove admin access from this account before deleting it' })
    return
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (deleteError) {
    const blocked = /foreign key|violat/i.test(deleteError.message || '')
    res.status(blocked ? 409 : 500).json({
      error: blocked
        ? "Couldn't delete — this account has existing submissions, votes, or forms linked to it. Disable the account instead to preserve those records."
        : deleteError.message || 'Failed to delete account',
    })
    return
  }

  res.status(200).json({ success: true })
}
