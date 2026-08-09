import { fetchTable } from '../lib/supabaseQueries'

export function fetchExcos() {
  return fetchTable('excos', { orderBy: { column: 'sort_order', ascending: true } })
}
