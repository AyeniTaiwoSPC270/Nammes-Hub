import { useQuery } from '@tanstack/react-query'
import { fetchTable } from '../lib/supabaseQueries'

export const LEVELS = ['100', '200', '300', '400', '500']

export const SEMESTER_LABELS = {
  1: 'First Semester',
  2: 'Second Semester',
}

export function fetchOutlines() {
  return fetchTable('outlines', { orderBy: { column: 'code', ascending: true } })
}

export function useOutlinesQuery() {
  return useQuery({ queryKey: ['outlines'], queryFn: fetchOutlines })
}

export function getCourses(rows, level, semester) {
  return rows.filter((c) => String(c.level) === String(level) && String(c.semester) === String(semester))
}

export function getCourse(rows, level, semester, code) {
  return getCourses(rows, level, semester).find(
    (c) => c.code.replace(/\s+/g, '').toLowerCase() === code.toLowerCase()
  )
}
