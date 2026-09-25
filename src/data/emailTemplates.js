import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchEmailTemplates() {
  const { data, error } = await supabase.from('email_templates').select('*').order('template_id')
  if (error) throw error
  return data
}

export function useEmailTemplatesQuery() {
  return useQuery({ queryKey: ['email_templates'], queryFn: fetchEmailTemplates })
}

export async function updateEmailTemplate(templateId, html) {
  const { data, error } = await supabase
    .from('email_templates')
    .update({ html, updated_at: new Date().toISOString() })
    .eq('template_id', templateId)
    .select()
    .single()
  if (error) throw error
  return data
}
