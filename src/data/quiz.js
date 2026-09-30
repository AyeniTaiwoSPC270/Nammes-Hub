import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

// Live quiz: the four answer colours (the same on the projector and on phones), input rules for the
// editor, timing helpers and the small client for /api/quiz. Spec: docs/superpowers/specs/2026-09-30-live-quiz-design.md

export const OPTION_STYLES = [
  { shape: '▲', bg: 'bg-red-600', text: 'text-red-700' },
  { shape: '◆', bg: 'bg-blue-600', text: 'text-blue-700' },
  { shape: '●', bg: 'bg-amber-600', text: 'text-amber-700' },
  { shape: '■', bg: 'bg-green-600', text: 'text-green-700' },
]

// Every player gets one of the four answer colours, chosen from their nickname so it never changes.
export function avatarStyle(nickname) {
  let hash = 0
  for (const ch of String(nickname)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0
  return OPTION_STYLES[hash % OPTION_STYLES.length]
}

export function initialOf(nickname) {
  const first = [...String(nickname).trim()][0]
  return first ? first.toUpperCase() : '?'
}

// Best score first, ties share a rank (the same rule the server uses for phones).
export function rankPlayers(players) {
  const sorted = [...players].sort((a, b) => b.total_score - a.total_score || a.nickname.localeCompare(b.nickname))
  let lastScore = null
  let lastRank = 0
  return sorted.map((p, i) => {
    const rank = p.total_score === lastScore ? lastRank : i + 1
    lastScore = p.total_score
    lastRank = rank
    return { ...p, rank }
  })
}

export function formatScore(n) {
  return Number(n).toLocaleString('en-US')
}

export const TIME_LIMIT_CHOICES = [10, 20, 30, 60]
export const POINT_CHOICES = [500, 1000, 2000]

export function blankQuestion() {
  return {
    id: crypto.randomUUID(),
    text: '',
    options: ['', '', '', ''],
    correct_index: 0,
    time_limit_seconds: 20,
    points: 1000,
  }
}

// Empty option boxes are dropped, so a question can have 2 to 4 answers.
export function cleanQuestion(q) {
  const kept = q.options.map((text, index) => ({ text: text.trim(), index })).filter((o) => o.text)
  const options = kept.map((o) => o.text)
  const correct_index = kept.findIndex((o) => o.index === q.correct_index)
  return { ...q, text: q.text.trim(), options, correct_index }
}

export function validateQuizDraft({ title, questions }) {
  if (!title || !title.trim()) return 'A title is required.'
  if (title.trim().length > 120) return 'The title must be 120 characters or fewer.'
  if (questions.length === 0) return 'Add at least one question.'
  for (const [i, raw] of questions.entries()) {
    const n = i + 1
    const q = cleanQuestion(raw)
    if (!q.text) return `Question ${n} needs some text.`
    if (q.text.length > 300) return `Question ${n} is too long (300 characters at most).`
    if (q.options.length < 2) return `Question ${n} needs at least two answers.`
    if (q.correct_index < 0) return `Question ${n}: pick a correct answer that is not empty.`
  }
  return null
}

// Seconds left on the clock, never below zero. `nowMs` should already be corrected to the server's clock.
export function secondsRemaining({ startedAtMs, timeLimitSeconds, nowMs }) {
  const left = timeLimitSeconds - (nowMs - startedAtMs) / 1000
  return Math.max(0, Math.ceil(left))
}

export async function callQuiz(action, body, accessToken) {
  const response = await fetch(`/api/quiz?action=${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  })
  let data = null
  try {
    data = await response.json()
  } catch {
    // not JSON (for example a gateway error page)
  }
  if (!response.ok) {
    const error = new Error(data?.error || 'Something went wrong. Please try again.')
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

export async function hostAction(action, body) {
  const { data } = await supabase.auth.getSession()
  return callQuiz(action, body, data.session?.access_token)
}

export async function fetchAllQuizzes() {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*, quiz_questions(count)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((q) => ({ ...q, questionCount: q.quiz_questions?.[0]?.count ?? 0 }))
}

export function useAllQuizzesQuery() {
  return useQuery({ queryKey: ['quizzes', 'all'], queryFn: fetchAllQuizzes })
}

export async function fetchQuizWithQuestions(id) {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*, quiz_questions(*)')
    .eq('id', id)
    .order('position', { referencedTable: 'quiz_questions' })
    .single()
  if (error) throw error
  return { ...data, questions: data.quiz_questions }
}

export function useQuizQuery(id) {
  return useQuery({ queryKey: ['quizzes', id], queryFn: () => fetchQuizWithQuestions(id), enabled: Boolean(id) })
}

// Saves a quiz and its questions. New questions carry a client-made uuid, so one upsert covers new,
// edited and reordered questions; questions the admin removed are deleted first.
export async function saveQuiz({ id, title, questions }) {
  const cleaned = questions.map(cleanQuestion)
  let quizId = id
  if (quizId) {
    const { error } = await supabase.from('quizzes').update({ title: title.trim() }).eq('id', quizId)
    if (error) throw error
    const { data: existing, error: listError } = await supabase.from('quiz_questions').select('id').eq('quiz_id', quizId)
    if (listError) throw listError
    const keep = new Set(cleaned.map((q) => q.id))
    const removed = existing.map((q) => q.id).filter((qid) => !keep.has(qid))
    if (removed.length > 0) {
      const { error: deleteError } = await supabase.from('quiz_questions').delete().in('id', removed)
      if (deleteError) throw deleteError
    }
  } else {
    const { data, error } = await supabase.from('quizzes').insert({ title: title.trim() }).select('id').single()
    if (error) throw error
    quizId = data.id
  }
  const rows = cleaned.map((q, position) => ({
    id: q.id,
    quiz_id: quizId,
    position,
    text: q.text,
    options: q.options,
    correct_index: q.correct_index,
    time_limit_seconds: q.time_limit_seconds,
    points: q.points,
  }))
  const { error } = await supabase.from('quiz_questions').upsert(rows, { onConflict: 'id' })
  if (error) throw error
  return quizId
}

export async function deleteQuiz(id) {
  const { data, error } = await supabase.from('quizzes').delete().eq('id', id).select()
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No changes were saved — your account may not have admin access to make this change.')
  }
}

export async function fetchQuizSessions(quizId) {
  const { data, error } = await supabase
    .from('quiz_sessions')
    .select('id, join_code, state, created_at, finished_at')
    .eq('quiz_id', quizId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data
}
