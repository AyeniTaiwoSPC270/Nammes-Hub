import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchOwnAdminRow(userId) {
  const { data, error } = await supabase.from('admins').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data
}

export function useOwnAdminRowQuery(userId) {
  return useQuery({
    queryKey: ['admins', 'mine', userId],
    queryFn: () => fetchOwnAdminRow(userId),
    enabled: Boolean(userId),
  })
}

export async function fetchAllAdmins() {
  const { data, error } = await supabase.from('admins').select('*')
  if (error) throw error
  return data
}

export function useAllAdminsQuery() {
  return useQuery({ queryKey: ['admins', 'all'], queryFn: fetchAllAdmins })
}

export async function assignAdmin(userId) {
  const { error } = await supabase.from('admins').insert({ user_id: userId })
  if (error) throw error
}

export async function revokeAdmin(userId) {
  const { error } = await supabase.from('admins').delete().eq('user_id', userId)
  if (error) throw error
}

export async function transferOwnership(newOwnerId) {
  const { error } = await supabase.rpc('transfer_ownership', { new_owner: newOwnerId })
  if (error) throw error
}
