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

  return { user: data.user, isAdmin: Boolean(adminRow), isOwner: Boolean(adminRow?.is_owner) }
}
