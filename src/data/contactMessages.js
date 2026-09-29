import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchContactMessages() {
  const { data, error } = await supabase
    .from('contact_messages')
    .select('id, name, email, message, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export function useContactMessagesQuery() {
  return useQuery({ queryKey: ['contact_messages'], queryFn: fetchContactMessages })
}

export async function deleteContactMessage(id) {
  const { data, error } = await supabase.from('contact_messages').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('No changes were saved — only the owner can delete messages.')
}
