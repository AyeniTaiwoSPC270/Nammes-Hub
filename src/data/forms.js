import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export const QUESTION_TYPES = [
  { value: 'short_text', label: 'Short answer', hasOptions: false, isScale: false },
  { value: 'paragraph', label: 'Paragraph', hasOptions: false, isScale: false },
  { value: 'multiple_choice', label: 'Multiple choice', hasOptions: true, isScale: false },
  { value: 'checkboxes', label: 'Checkboxes', hasOptions: true, isScale: false },
  { value: 'dropdown', label: 'Dropdown', hasOptions: true, isScale: false },
  { value: 'linear_scale', label: 'Linear scale', hasOptions: false, isScale: true },
  { value: 'file_upload', label: 'File upload', hasOptions: false, isScale: false },
  { value: 'date', label: 'Date', hasOptions: false, isScale: false },
  { value: 'time', label: 'Time', hasOptions: false, isScale: false },
]

export function validateFormDraft({ title }) {
  if (!title || !title.trim()) return 'A title is required.'
  return null
}

export function validateQuestionDraft(question) {
  if (!question.label || !question.label.trim()) return 'Every question needs a label.'
  const type = QUESTION_TYPES.find((t) => t.value === question.type)
  if (type?.hasOptions) {
    const options = (question.options || []).filter((o) => o.trim())
    if (options.length === 0) return 'Add at least one option.'
  }
  if (type?.isScale) {
    const min = Number(question.scale_min)
    const max = Number(question.scale_max)
    if (!(min < max)) return 'Scale minimum must be less than maximum.'
  }
  return null
}

export function validateQuestions(questions) {
  for (const q of questions) {
    const error = validateQuestionDraft(q)
    if (error) return error
  }
  return null
}

export function validateAnswers(questions, answers) {
  for (const q of questions) {
    if (!q.required) continue
    const value = answers[q.id]
    const isEmpty =
      value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
    if (isEmpty) return `"${q.label}" is required.`
  }
  return null
}

export function isFormOpen(form, now = new Date()) {
  if (!form.is_accepting_responses) return false
  if (form.closes_at && new Date(form.closes_at) <= now) return false
  return true
}

export async function fetchOpenForms() {
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('is_accepting_responses', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.filter((f) => isFormOpen(f))
}

export function useFormsQuery() {
  return useQuery({ queryKey: ['forms', 'open'], queryFn: fetchOpenForms })
}

export async function fetchAllForms() {
  const { data, error } = await supabase.from('forms').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export function useAllFormsQuery() {
  return useQuery({ queryKey: ['forms', 'all'], queryFn: fetchAllForms })
}

export async function fetchFormWithQuestions(id) {
  const { data, error } = await supabase
    .from('forms')
    .select('*, form_questions(*)')
    .eq('id', id)
    .order('position', { referencedTable: 'form_questions' })
    .single()
  if (error) throw error
  return { ...data, questions: data.form_questions }
}

export function useFormQuery(id) {
  return useQuery({ queryKey: ['forms', id], queryFn: () => fetchFormWithQuestions(id), enabled: Boolean(id) })
}
