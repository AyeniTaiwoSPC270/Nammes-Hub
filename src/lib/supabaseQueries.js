import { supabase } from './supabaseClient'

export async function fetchTable(table, { orderBy } = {}) {
  let query = supabase.from(table).select('*')
  if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
  const { data, error } = await query
  if (error) throw error
  return data
}
