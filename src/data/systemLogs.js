import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchAuditLog() {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, at, actor, action, entity, entity_id')
    .order('id', { ascending: false })
    .limit(100)
  if (error) throw error
  return data
}

export async function fetchErrorLog() {
  const { data, error } = await supabase
    .from('error_log')
    .select('id, at, route, status, message')
    .order('id', { ascending: false })
    .limit(100)
  if (error) throw error
  return data
}

export async function fetchSentryIssues() {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  const response = await fetch('/api/admin-issues', { headers: { Authorization: `Bearer ${token}` } })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Could not load app errors')
  return result
}

export const useAuditLogQuery = (enabled = true) =>
  useQuery({ queryKey: ['system', 'audit'], queryFn: fetchAuditLog, enabled })
export const useErrorLogQuery = (enabled = true) =>
  useQuery({ queryKey: ['system', 'errors'], queryFn: fetchErrorLog, enabled })
export const useSentryIssuesQuery = (enabled = true) =>
  useQuery({ queryKey: ['system', 'sentry'], queryFn: fetchSentryIssues, enabled, retry: false })

export async function runServerTest() {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  const response = await fetch('/api/system-test', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'The server could not write the test entry')
  return result
}
