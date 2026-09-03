import { useQuery } from '@tanstack/react-query'
import { fetchTable } from '../lib/supabaseQueries'

export const LEVELS = ['100', '200', '300', '400', '500']

export const SEMESTER_LABELS = {
  1: 'First Semester',
  2: 'Second Semester',
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export function fetchTimetables() {
  return fetchTable('timetables', { orderBy: { column: 'start_time', ascending: true } })
}

export function useTimetablesQuery() {
  return useQuery({ queryKey: ['timetables'], queryFn: fetchTimetables })
}

export function getTimetable(rows, level, semester, type) {
  return rows.filter(
    (r) =>
      String(r.level) === String(level) && String(r.semester) === String(semester) && r.type === type
  )
}
