import { useQuery } from '@tanstack/react-query'
import { fetchTable } from '../lib/supabaseQueries'

export const NEWS_CATEGORIES = ['Academics', 'Governance', 'Welfare', 'Industry', 'Call for papers', 'Resources']

export function fetchNews() {
  return fetchTable('news', { orderBy: { column: 'date', ascending: false } })
}

export function useNewsQuery() {
  return useQuery({ queryKey: ['news'], queryFn: fetchNews })
}

export function getNews(list) {
  return [...list].sort((a, b) => new Date(b.date) - new Date(a.date))
}

export function getNewsById(list, id) {
  return list.find((n) => n.id === id)
}

export function filterNewsByCategory(list, category) {
  if (!category || category === 'All' || !NEWS_CATEGORIES.includes(category)) return list
  return list.filter((n) => n.category === category)
}
