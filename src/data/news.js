import { useQuery } from '@tanstack/react-query'
import { fetchTable } from '../lib/supabaseQueries'
import { supabase } from '../lib/supabaseClient'
import { resolveVideo } from '../lib/newsVideo'

export const NEWS_CATEGORIES = ['Academics', 'Governance', 'Welfare', 'Industry', 'Call for papers', 'Resources']

// `<project>/storage/v1` -- the base Supabase serves public object URLs from. resolveVideo takes it
// rather than guessing, so a `video_url` is only ever trusted when it points into THIS project's own
// news-videos bucket. Without the env var nothing resolves to a video, which is the safe direction.
const STORAGE_BASE = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/storage/v1`

/**
 * A news row's video, cleaned, or null for a text-only post, an invalid URL, or a closed kill switch.
 *
 * Every surface (cards, article, studio preview) goes through here so they cannot disagree about what
 * counts as a video. `settings` is the optional `content_settings` row: its columns are the site
 * defaults for preview length and repeat, handed to the resolver under neutral names so no other
 * surface has to know which table the default came from.
 */
export function resolveNewsVideo(item, enabled = true, settings) {
  return resolveVideo(item, {
    enabled,
    storageBase: STORAGE_BASE,
    defaults: settings
      ? { seconds: settings.news_video_preview_seconds, loop: settings.news_video_loop }
      : undefined,
  })
}

/**
 * The `news_video` kill switch, as a plain boolean.
 *
 * Its own per-key query rather than a slice of `useFeatureFlagsQuery` (src/data/systemLogs.js:72), which
 * fetches every flag and is only enabled for admins -- while this decides what anonymous visitors see on
 * /news and Home, and `feature_flags` grants select to anon (20260929121000_feature_flags.sql:15).
 *
 * True until the row says otherwise, for the same reason `useCalendarFlag` (src/data/calendar.js:97) is:
 * a kill switch has to be able to switch something off, not hold a page blank while the query runs.
 */
export function useNewsVideoFlag() {
  const { data } = useQuery({
    queryKey: ['feature_flags', 'news_video'],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from('feature_flags')
        .select('enabled')
        .eq('key', 'news_video')
        .maybeSingle()
      // An unreachable table or a missing row both read as "not switched off": failing closed would
      // hide every video for every visitor whenever feature_flags is briefly unavailable.
      if (error) return true
      return row?.enabled ?? true
    },
  })
  return data ?? true
}

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
