import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function submitChangeRequest(entityType, action, recordId, payload) {
  const { data, error } = await supabase.rpc('submit_change_request', {
    p_entity_type: entityType,
    p_action: action,
    p_record_id: recordId,
    p_payload: payload,
  })
  if (error) throw error
  return data
}

export async function fetchMyPendingRequests(entityType, userId) {
  const { data, error } = await supabase
    .from('change_requests')
    .select('*')
    .eq('entity_type', entityType)
    .eq('submitted_by', userId)
    .eq('status', 'pending')
  if (error) throw error
  return data
}

export function useMyPendingRequestsQuery(entityType, userId) {
  return useQuery({
    queryKey: ['change_requests', 'mine', entityType, userId],
    queryFn: () => fetchMyPendingRequests(entityType, userId),
    enabled: Boolean(entityType) && Boolean(userId),
  })
}

export async function fetchAllPendingRequests() {
  const { data, error } = await supabase
    .from('change_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export function useAllPendingRequestsQuery() {
  return useQuery({ queryKey: ['change_requests', 'pending', 'all'], queryFn: fetchAllPendingRequests })
}

export async function approveChangeRequest(id) {
  const { error } = await supabase.rpc('apply_change_request', { p_id: id })
  if (error) throw error
}

export async function rejectChangeRequest(id, reason) {
  const { error } = await supabase.rpc('reject_change_request', { p_id: id, p_reason: reason })
  if (error) throw error
}

export function computeFieldDiff(before, after) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  const changes = []
  for (const key of keys) {
    const beforeValue = before?.[key] ?? null
    const afterValue = after?.[key] ?? null
    if (String(beforeValue ?? '') !== String(afterValue ?? '')) {
      changes.push({ field: key, before: beforeValue, after: afterValue })
    }
  }
  return changes
}
