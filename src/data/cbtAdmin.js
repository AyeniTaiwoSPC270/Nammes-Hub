import { supabase } from '../lib/supabaseClient'
import { questionsFromCsv, questionsToCsv } from './quizCsv'
import { cleanQuestion, questionFromRow } from './quizQuestions'
import { sanitizeCustomQuestions, CBT_BANK_MAX_QUESTIONS } from '../../api/_lib/quizCustom.js'
import { normaliseCourseCode } from '../../api/_lib/cbt.js'

// Admin side of CBT practice: courses, exams and question banks, straight to Supabase (admins have write access by RLS;
// students only ever reach exams through /api/quiz?action=cbt). Spec: docs/superpowers/specs/2026-10-01-cbt-exam-mode.md

export const BANK_MAX = CBT_BANK_MAX_QUESTIONS
const CHUNK = 100

async function ok(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

export const fetchCourses = () => ok(supabase.from('cbt_courses').select('*').order('level').order('code'))
export const fetchExams = () => ok(supabase.from('cbt_exams').select('*').order('created_at', { ascending: false }))

export async function addCourse({ level, code, title }) {
  const clean = normaliseCourseCode(code)
  if (clean.length < 2) throw new Error('Enter the course code, like MTH 101.')
  if (!title.trim()) throw new Error('Enter the course title.')
  return ok(supabase.from('cbt_courses').insert({ level, code: clean, title: title.trim() }).select().single())
}

export async function deleteCourse(id) {
  const data = await ok(supabase.from('cbt_courses').delete().eq('id', id).select('id'))
  if (!data || data.length === 0) throw new Error('Nothing was removed. Your account may not have admin access.')
}

export async function createExam(courseId, title) {
  if (!title.trim()) throw new Error('Give the exam a title.')
  return ok(supabase.rpc('cbt_create_exam', { p_course: courseId, p_title: title.trim() }))
}

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

// What can be changed on an exam. Numbers are clamped to what the database allows.
export async function updateExam(id, form) {
  const patch = {
    title: form.title.trim(),
    session_label: form.session_label.trim() || null,
    mode: form.mode === 'fixed' ? 'fixed' : 'bank',
    draw_count: form.mode === 'fixed' || String(form.draw_count).trim() === '' ? null : clampInt(form.draw_count, 1, BANK_MAX, null),
    duration_minutes: clampInt(form.duration_minutes, 1, 240, 30),
    pass_mark_percent: clampInt(form.pass_mark_percent, 1, 100, 50),
    shuffle_questions: Boolean(form.shuffle_questions),
    shuffle_options: Boolean(form.shuffle_options),
    show_explanations: Boolean(form.show_explanations),
    allow_study_mode: Boolean(form.allow_study_mode),
    published: Boolean(form.published),
  }
  if (!patch.title) throw new Error('The exam needs a title.')
  const data = await ok(supabase.from('cbt_exams').update(patch).eq('id', id).select('id'))
  if (!data || data.length === 0) throw new Error('Nothing was saved. Your account may not have admin access.')
}

export async function deleteExam(id) {
  const data = await ok(supabase.from('cbt_exams').delete().eq('id', id).select('id'))
  if (!data || data.length === 0) throw new Error('Nothing was removed. Your account may not have admin access.')
}

export const fetchBank = (quizId) => ok(supabase.from('quiz_questions').select('*').eq('quiz_id', quizId).order('position').limit(1000))

export async function deleteBankQuestion(id) {
  await ok(supabase.from('quiz_questions').delete().eq('id', id).select('id'))
}

export const fetchStats = (examId) => ok(supabase.rpc('cbt_exam_stats', { p_exam: examId }))

// Reads pasted or uploaded spreadsheet text into rows ready to store, with problems named by line.
// Admin banks are trusted: no word filter, up to 500 questions, optional explanation / topic / no_shuffle columns.
export function bankFromText(text) {
  const { questions, problems } = questionsFromCsv(text, { max: BANK_MAX })
  const cleaned = questions.map((q) => cleanQuestion(q))
  const checked = sanitizeCustomQuestions(cleaned, { trusted: true })
  return { rows: checked.questions, problems: [...problems, ...checked.problems] }
}

// The bank as spreadsheet text (so it can be edited in Excel and imported back with "replace").
export function bankToCsv(rows) {
  return questionsToCsv(
    rows.map((r) => ({ ...questionFromRow(r), explanation: r.explanation ?? '', topic: r.topic ?? '', no_shuffle: r.no_shuffle === true })),
    { cbt: true },
  )
}

// Adds the rows to an exam's bank, or replaces the bank with them. New rows are stored first and the old ones
// removed after, so a failure never leaves the exam empty.
export async function importBank(quizId, rows, { replace, existing }) {
  if (!replace && existing.length + rows.length > BANK_MAX) throw new Error(`A question bank can hold ${BANK_MAX} questions. This would make ${existing.length + rows.length}.`)
  const start = existing.reduce((m, q) => Math.max(m, q.position), -1) + 1
  try {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK).map((row, n) => ({ quiz_id: quizId, position: start + i + n, ...row }))
      await ok(supabase.from('quiz_questions').insert(chunk))
    }
  } catch (error) {
    await supabase.from('quiz_questions').delete().eq('quiz_id', quizId).gte('position', start) // leave nothing half-added
    throw error
  }
  if (replace) {
    const oldIds = existing.map((q) => q.id)
    for (let i = 0; i < oldIds.length; i += CHUNK) await ok(supabase.from('quiz_questions').delete().in('id', oldIds.slice(i, i + CHUNK)).select('id'))
  }
}
