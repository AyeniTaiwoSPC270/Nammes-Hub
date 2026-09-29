import { createClient } from '@supabase/supabase-js'
import { determineWinnerFromCounts } from './_lib/awardCardData.js'
import { renderAwardCard } from './_lib/awardCardRender.js'
import { isUuid, isAllowedImageUrl } from './_lib/validate.js'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const CACHE_HEADER = 'public, s-maxage=86400, stale-while-revalidate=604800'

// Public, unauthenticated route: use the anon key (all award content it reads is publicly selectable).
function getPublicClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Only fetch photos hosted on our own Supabase project, with a timeout and a size cap.
async function fetchPhotoBuffer(photoUrl) {
  if (!photoUrl) return null
  try {
    const allowedHosts = [new URL(process.env.VITE_SUPABASE_URL).hostname]
    if (!isAllowedImageUrl(photoUrl, allowedHosts)) return null
    const res = await fetch(photoUrl, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    if (Number(res.headers.get('content-length')) > MAX_PHOTO_BYTES) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    return buffer.length > MAX_PHOTO_BYTES ? null : buffer
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { type, nomineeId, categoryId } = req.query
  if (type !== 'campaign' && type !== 'winner') {
    res.status(400).json({ error: 'type must be "campaign" or "winner"' })
    return
  }

  const supabase = getPublicClient()

  try {
    if (type === 'campaign') {
      if (!isUuid(nomineeId)) {
        res.status(400).json({ error: 'Invalid nomineeId' })
        return
      }
      const { data: nominee, error: nomineeError } = await supabase
        .from('award_nominees')
        .select('*, award_categories(*, award_seasons(*))')
        .eq('id', nomineeId)
        .maybeSingle()
      if (nomineeError) throw nomineeError
      if (!nominee) {
        res.status(404).json({ error: 'Nominee not found' })
        return
      }
      const category = nominee.award_categories
      const season = category?.award_seasons
      const photoBuffer = await fetchPhotoBuffer(nominee.photo_url)
      const png = await renderAwardCard({
        variant: 'campaign',
        name: nominee.name,
        categoryTitle: category?.title || '',
        seasonTitle: season?.title || 'NAMMES Hub Awards',
        photoBuffer,
      })
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', CACHE_HEADER)
      res.status(200).send(png)
      return
    }

    // type === 'winner'
    if (!isUuid(categoryId)) {
      res.status(400).json({ error: 'Invalid categoryId' })
      return
    }
    const { data: category, error: categoryError } = await supabase
      .from('award_categories')
      .select('*, award_seasons(*)')
      .eq('id', categoryId)
      .maybeSingle()
    if (categoryError) throw categoryError
    if (!category || category.award_seasons?.phase !== 'revealed') {
      res.status(404).json({ error: 'Results are not available for this category' })
      return
    }

    const { data: nominees, error: nomineesError } = await supabase
      .from('award_nominees')
      .select('*')
      .eq('category_id', categoryId)
    if (nomineesError) throw nomineesError

    const { data: tally, error: tallyError } = await supabase.rpc('award_tally', {
      p_season_id: category.season_id,
    })
    if (tallyError) throw tallyError

    const winner = determineWinnerFromCounts(tally, nominees, categoryId)
    if (!winner) {
      res.status(404).json({ error: 'No winner recorded for this category' })
      return
    }

    const photoBuffer = await fetchPhotoBuffer(winner.nominee.photo_url)
    const png = await renderAwardCard({
      variant: 'winner',
      name: winner.nominee.name,
      categoryTitle: category.title,
      seasonTitle: category.award_seasons.title,
      photoBuffer,
    })
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', CACHE_HEADER)
    res.status(200).send(png)
  } catch (error) {
    console.error('award-card: render failed', error)
    res.status(500).json({ error: 'Could not generate the card' })
  }
}
