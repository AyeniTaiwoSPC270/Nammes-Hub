import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { fetchAllAdmins } from './admins'

const ACTIVE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

export function isActive(lastSeenAt, now = new Date()) {
  if (!lastSeenAt) return false
  return now.getTime() - new Date(lastSeenAt).getTime() <= ACTIVE_WINDOW_MS
}

export async function fetchAllProfiles() {
  const { data, error } = await supabase.from('profiles').select('*')
  if (error) throw error
  return data
}

export async function fetchAllUsers() {
  const [profiles, admins] = await Promise.all([fetchAllProfiles(), fetchAllAdmins()])
  const adminByUserId = new Map(admins.map((a) => [a.user_id, a]))
  return profiles.map((p) => {
    const adminRow = adminByUserId.get(p.user_id)
    return {
      ...p,
      isAdmin: Boolean(adminRow),
      isOwner: Boolean(adminRow?.is_owner),
      active: isActive(p.last_seen_at),
    }
  })
}

export function useAllUsersQuery() {
  return useQuery({ queryKey: ['users', 'all'], queryFn: fetchAllUsers })
}

export async function setUserDisabled(userId, disabled) {
  const { error } = await supabase.rpc('admin_set_user_disabled', { target: userId, disabled })
  if (error) throw error
}
