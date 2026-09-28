import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export const MATRIC_REGEX = /^\d{2}0406\d{3}$/

export function validateStudentId(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return 'Matric number is required.'
  if (!MATRIC_REGEX.test(trimmed)) return 'Use your department matric number (format: YY0406XXX, e.g. 240406012).'
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

export async function setOwnFullName(name) {
  const { error } = await supabase.rpc('set_own_full_name', { name })
  if (error) throw error
}

export function useSetFullNameMutation(userId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name) => setOwnFullName(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles', 'mine', userId] }),
  })
}

export async function setOwnEntryYear(year) {
  const { error } = await supabase.rpc('set_own_entry_year', { year })
  if (error) throw error
}

export function useSetEntryYearMutation(userId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (year) => setOwnEntryYear(year),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles', 'mine', userId] }),
  })
}
