import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { submitPublic } from './publicSubmit'

/**
 * The `feedback` kill switch, as a plain boolean.
 *
 * Its own per-key query for the same reason the other three public flags have one: it decides
 * whether a modal and two links render for an anonymous visitor, and `feature_flags` grants select
 * to anon. True until the row says otherwise, so a failed read never hides a control for good.
 */
export function useFeedbackFlagQuery() {
  return useQuery({
    queryKey: ['feature_flags', 'feedback'],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from('feature_flags')
        .select('enabled')
        .eq('key', 'feedback')
        .maybeSingle()
      if (error) return true
      return row?.enabled ?? true
    },
  })
}

export function useFeedbackFlag() {
  const { data } = useFeedbackFlagQuery()
  return data ?? true
}

// Every reason is a single lowercase word, so capitalising it is the whole label. The list itself
// is the server's (api/_lib/publicSubmission.js), which is what keeps this honest.
export const feedbackCategoryLabel = (code) => (code ? `${code.charAt(0).toUpperCase()}${code.slice(1)}` : '—')

/**
 * Send a rating through the server, which runs the bot check and the flag.
 *
 * Identity travels as the caller's own session token rather than as an id in the payload: the
 * server resolves whoever the token belongs to, so a crafted request cannot file a rating under
 * somebody else's name. No session means no token, which the server reads as anonymous.
 */
export async function submitFeedback({ rating, category, message, pagePath }) {
  let accessToken
  try {
    const { data } = await supabase.auth.getSession()
    accessToken = data?.session?.access_token
  } catch {
    accessToken = undefined
  }
  return submitPublic({
    type: 'feedback',
    rating,
    category,
    message,
    page_path: pagePath,
    ...(accessToken ? { accessToken } : {}),
  })
}

// Bounded on purpose: the inbox shows the newest 200, and the dashboard's average reads the table
// directly rather than through this query.
export async function fetchHubFeedback() {
  const { data, error } = await supabase
    .from('hub_feedback')
    .select('id, rating, category, message, page_path, created_at, handled')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return data
}

export function useHubFeedbackQuery(enabled = true) {
  return useQuery({ queryKey: ['hub_feedback'], queryFn: fetchHubFeedback, enabled })
}

// The tick that empties the bell. Attribution is the same as the messages screen: RLS authorises,
// handled_by records who did it.
export async function setFeedbackHandled(id, handled, userId) {
  const { data, error } = await supabase
    .from('hub_feedback')
    .update({
      handled,
      handled_at: handled ? new Date().toISOString() : null,
      handled_by: handled ? userId ?? null : null,
    })
    .eq('id', id)
    .select('id, handled')
  if (error) throw error
  if (!data?.length) throw new Error('No changes were saved — only admins can update feedback.')
  return data[0]
}
