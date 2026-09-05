import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchNotificationPref(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('email_notifications_enabled')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.email_notifications_enabled ?? true
}

export function useNotificationPrefQuery(userId) {
  return useQuery({
    queryKey: ['profiles', 'notification-pref', userId],
    queryFn: () => fetchNotificationPref(userId),
    enabled: Boolean(userId),
  })
}

export async function setNotificationPref(enabled) {
  const { error } = await supabase.rpc('set_own_email_notifications', { enabled })
  if (error) throw error
}

export function useSetNotificationPrefMutation(userId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (enabled) => setNotificationPref(enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles', 'notification-pref', userId] }),
  })
}
