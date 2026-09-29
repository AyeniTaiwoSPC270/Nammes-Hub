// Shared caller check for admin-only API routes.
// Verifies the JWT with Supabase (server-side, not just decoded) and looks up the admin row.

export function bearerToken(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

// Returns { error: [status, message] } or { user, isAdmin, isOwner }.
export async function getCaller(supabaseAdmin, token) {
  if (!token) return { error: [401, 'Missing bearer token'] }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return { error: [401, 'Invalid session'] }

  const { data: adminRow } = await supabaseAdmin
    .from('admins')
    .select('is_owner')
    .eq('user_id', data.user.id)
    .maybeSingle()

  const isAdmin = Boolean(adminRow)

  // When the owner has switched on two-factor enforcement, admins must have passed the code step
  // (JWT aal = aal2). Anything unreadable counts as the lowest level.
  if (isAdmin && tokenAal(token) !== 'aal2') {
    const { data: flag } = await supabaseAdmin
      .from('feature_flags')
      .select('enabled')
      .eq('key', 'require_admin_mfa')
      .maybeSingle()
    if (flag?.enabled === true) return { error: [403, 'Two-factor verification required'] }
  }

  return { user: data.user, isAdmin, isOwner: Boolean(adminRow?.is_owner) }
}

// The token was already verified by Supabase (getUser above); this only reads its assurance level.
function tokenAal(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return payload.aal
  } catch {
    return undefined
  }
}
