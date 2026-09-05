import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchBroadcastHistory() {
  const { data, error } = await supabase
    .from('broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export function useBroadcastHistoryQuery() {
  return useQuery({ queryKey: ['broadcasts', 'history'], queryFn: fetchBroadcastHistory })
}

export async function sendBroadcast({ subject, body }) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  const response = await fetch('/api/send-broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ subject, body }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to send broadcast')
  return result
}
