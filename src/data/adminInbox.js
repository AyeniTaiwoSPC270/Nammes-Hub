import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { INBOX_CATEGORIES, normaliseInbox, validateAnnouncement } from '../lib/adminInbox'

export const ADMIN_INBOX_KEY = ['admin', 'inbox']

export async function fetchAdminInbox() {
  const { data, error } = await supabase.rpc('admin_inbox')
  if (error) throw error
  return normaliseInbox(data)
}

export function useAdminInboxQuery(enabled = true) {
  return useQuery({
    queryKey: ADMIN_INBOX_KEY,
    queryFn: fetchAdminInbox,
    enabled,
    // A feed that changes a few times a day does not need realtime; a minute is soon enough for
    // a bell and costs one indexed RPC per open admin tab.
    refetchInterval: 60_000,
  })
}

// Marking every category, not only the ones in the payload, is deliberate: a category the server
// starts returning between the fetch and the click would otherwise be unread on the next poll.
export async function markInboxSeen(userId, categories = INBOX_CATEGORIES.map((c) => c.key)) {
  if (!userId) return
  const seen_at = new Date().toISOString()
  const rows = categories.map((category) => ({ user_id: userId, category, seen_at }))
  if (!rows.length) return
  const { error } = await supabase
    .from('admin_inbox_seen')
    .upsert(rows, { onConflict: 'user_id,category' })
  if (error) throw error
}

export function useMarkInboxSeenMutation(userId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => markInboxSeen(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_INBOX_KEY }),
  })
}

export async function postAnnouncement({ title, body, userId }) {
  const problem = validateAnnouncement({ title, body })
  if (problem) throw new Error(problem)
  if (!userId) throw new Error('Sign in again to post an announcement.')
  const { error } = await supabase.from('admin_announcements').insert({
    title: title.trim(),
    body: body.trim(),
    created_by: userId,
  })
  if (error) throw error
}

export function usePostAnnouncementMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: postAnnouncement,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_INBOX_KEY }),
  })
}
