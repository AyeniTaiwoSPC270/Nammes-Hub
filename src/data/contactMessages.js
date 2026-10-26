import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchContactMessages() {
  const { data, error } = await supabase
    .from('contact_messages')
    .select('id, name, email, message, created_at, handled_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export function useContactMessagesQuery() {
  return useQuery({ queryKey: ['contact_messages'], queryFn: fetchContactMessages })
}

// The analytics dashboard counts messages with no handled_at as "unanswered", so this is the only
// thing that can make that number go down. handled_by is attribution -- RLS is what authorises it.
export async function setContactMessageHandled(id, handled, userId) {
  const { data, error } = await supabase
    .from('contact_messages')
    .update({
      handled_at: handled ? new Date().toISOString() : null,
      handled_by: handled ? userId ?? null : null,
    })
    .eq('id', id)
    .select('id, handled_at')
  if (error) throw error
  if (!data?.length) throw new Error('No changes were saved — only admins can update messages.')
  return data[0]
}

export async function deleteContactMessage(id) {
  const { data, error } = await supabase.from('contact_messages').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('No changes were saved — only the owner can delete messages.')
}
