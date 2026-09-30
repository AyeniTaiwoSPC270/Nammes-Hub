import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

// ---------- saved styles ----------

export function useEmailStylesQuery() {
  return useQuery({
    queryKey: ['email_styles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('email_styles').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export async function saveEmailStyle({ name, design }) {
  const { data, error } = await supabase.from('email_styles').insert({ name: name.trim(), design }).select().single()
  if (error) throw error
  return data
}

export async function deleteEmailStyle(id) {
  const { error } = await supabase.from('email_styles').delete().eq('id', id)
  if (error) throw error
}

// ---------- drafts ----------

export function useBroadcastDraftsQuery() {
  return useQuery({
    queryKey: ['broadcast_drafts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('broadcast_drafts').select('*').order('updated_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export async function saveBroadcastDraft({ id, subject, templateId, blocks, design }) {
  const row = {
    subject: subject ?? '',
    template_id: templateId,
    blocks,
    design: design ?? null,
    updated_at: new Date().toISOString(),
  }
  if (id) {
    const { data, error } = await supabase.from('broadcast_drafts').update(row).eq('id', id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('broadcast_drafts').insert(row).select().single()
  if (error) throw error
  return data
}

export async function deleteBroadcastDraft(id) {
  const { error } = await supabase.from('broadcast_drafts').delete().eq('id', id)
  if (error) throw error
}

// ---------- template designs ----------

/** Saves (or clears, with null) the visual design of a template or automatic email. */
export async function updateEmailTemplateDesign(templateId, design) {
  const { data, error } = await supabase
    .from('email_templates')
    .update({ design, updated_at: new Date().toISOString() })
    .eq('template_id', templateId)
    .select()
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No changes were saved — the template may be missing or your account may not have admin access.')
  }
  return data[0]
}

// ---------- sending ----------

export async function sendDesignedBroadcast({ subject, blocks, design, templateId, testOnly = false }) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  const response = await fetch('/api/send-broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ subject, blocks, design, templateId, testOnly }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to send')
  return result
}
