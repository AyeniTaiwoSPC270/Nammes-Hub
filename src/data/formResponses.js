import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchFormResponses(formId) {
  const { data, error } = await supabase
    .from('form_responses')
    .select('*')
    .eq('form_id', formId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return data
}

export function useFormResponsesQuery(formId) {
  return useQuery({
    queryKey: ['form_responses', formId],
    queryFn: () => fetchFormResponses(formId),
    enabled: Boolean(formId),
  })
}

export async function fetchMyResponse(formId, userId) {
  const { data, error } = await supabase
    .from('form_responses')
    .select('*')
    .eq('form_id', formId)
    .eq('respondent_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export function useMyResponseQuery(formId, userId) {
  return useQuery({
    queryKey: ['form_responses', formId, 'mine', userId],
    queryFn: () => fetchMyResponse(formId, userId),
    enabled: Boolean(formId) && Boolean(userId),
  })
}

export function countResponsesByForm(rows) {
  const counts = {}
  rows.forEach((r) => {
    counts[r.form_id] = (counts[r.form_id] || 0) + 1
  })
  return counts
}

export async function fetchResponseCountsByForm() {
  const { data, error } = await supabase.from('form_responses').select('form_id')
  if (error) throw error
  return countResponsesByForm(data)
}

export function useResponseCountsQuery() {
  return useQuery({ queryKey: ['form_responses', 'counts'], queryFn: fetchResponseCountsByForm })
}

export function formatAnswerForDisplay(question, value) {
  if (value === undefined || value === null || value === '') return '—'
  if (question.type === 'checkboxes' && Array.isArray(value)) return value.join(', ')
  return String(value)
}

function countByOption(options, values) {
  return (options || []).map((option) => ({
    option,
    count: values.filter((v) => String(v) === String(option)).length,
  }))
}

function scaleOptions(question) {
  const opts = []
  for (let i = question.scale_min; i <= question.scale_max; i++) opts.push(String(i))
  return opts
}

export function buildResponseSummary(questions, responses) {
  return questions.map((q) => {
    const rawValues = responses.map((r) => r.answers?.[q.id])
    const values = rawValues.filter((v) => v !== undefined && v !== null && v !== '')

    if (q.type === 'multiple_choice' || q.type === 'dropdown') {
      return { question: q, kind: 'choice', counts: countByOption(q.options, values) }
    }
    if (q.type === 'checkboxes') {
      const flat = values.flatMap((v) => (Array.isArray(v) ? v : [v]))
      return { question: q, kind: 'choice', counts: countByOption(q.options, flat) }
    }
    if (q.type === 'linear_scale') {
      return { question: q, kind: 'choice', counts: countByOption(scaleOptions(q), values.map(String)) }
    }
    return { question: q, kind: 'text', answers: values.map(String) }
  })
}

function csvEscape(value) {
  const str = String(value ?? '')
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function responsesToCsv(questions, responses) {
  const header = ['Submitted at', ...questions.map((q) => q.label)]
  const lines = [header.map(csvEscape).join(',')]
  responses.forEach((r) => {
    const row = [
      r.submitted_at,
      ...questions.map((q) => {
        const display = formatAnswerForDisplay(q, r.answers?.[q.id])
        return display === '—' ? '' : display
      }),
    ]
    lines.push(row.map(csvEscape).join(','))
  })
  return lines.join('\n')
}

export function collectFileUploadUrls(questions, responses) {
  const fileQuestionIds = questions.filter((q) => q.type === 'file_upload').map((q) => q.id)
  const urls = []
  responses.forEach((r) => {
    fileQuestionIds.forEach((qid) => {
      const value = r.answers?.[qid]
      if (value) urls.push(value)
    })
  })
  return urls
}

export function storagePathFromUrl(url, bucket) {
  const marker = `/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
}
