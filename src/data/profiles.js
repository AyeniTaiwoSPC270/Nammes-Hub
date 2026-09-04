import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export const MATRIC_REGEX = /^240406\d{3}$/

export function validateStudentId(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return 'Matric number is required.'
  if (!MATRIC_REGEX.test(trimmed)) return 'Use your department matric number (format: 240406XXX).'
  return null
}

export async function isStudentIdTaken(studentId) {
  const { data, error } = await supabase.rpc('is_student_id_taken', { p_student_id: studentId.trim() })
  if (error) throw error
  return data
}

export async function fetchOwnProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data
}

export function useOwnProfileQuery(userId) {
  return useQuery({
    queryKey: ['profiles', 'mine', userId],
    queryFn: () => fetchOwnProfile(userId),
    enabled: Boolean(userId),
  })
}
