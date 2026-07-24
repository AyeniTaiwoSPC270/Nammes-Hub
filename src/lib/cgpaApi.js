import { supabase } from './supabaseClient'

export async function fetchSemesters(userId) {
  const { data, error } = await supabase
    .from('cgpa_semesters')
    .select('id, level, semester, cgpa_courses(id, code, title, units, grade, counts_toward_cgpa)')
    .eq('user_id', userId)

  if (error) return { data: null, error }

  const semesters = data.map((row) => ({
    id: row.id,
    level: row.level,
    semester: row.semester,
    courses: row.cgpa_courses,
  }))

  return { data: semesters, error: null }
}

export async function addSemester({ userId, level, semester }) {
  return supabase
    .from('cgpa_semesters')
    .insert({ user_id: userId, level, semester })
    .select()
    .single()
}

export async function deleteSemester(semesterId) {
  return supabase.from('cgpa_semesters').delete().eq('id', semesterId)
}

export async function addCourse({ semesterId, code, title, units, grade }) {
  return supabase
    .from('cgpa_courses')
    .insert({ semester_id: semesterId, code, title: title || null, units, grade })
    .select()
    .single()
}

export async function updateCourse(courseId, patch) {
  return supabase.from('cgpa_courses').update(patch).eq('id', courseId).select().single()
}

export async function deleteCourse(courseId) {
  return supabase.from('cgpa_courses').delete().eq('id', courseId)
}
