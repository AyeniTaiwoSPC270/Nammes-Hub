import { fetchTable } from '../lib/supabaseQueries'

export { LEVELS, SEMESTER_LABELS } from './outlines'

export function fetchResources() {
  return fetchTable('resources', { orderBy: { column: 'title', ascending: true } })
}

export function getResources(rows, level, semester) {
  return rows.filter((r) => String(r.level) === String(level) && String(r.semester) === String(semester))
}
