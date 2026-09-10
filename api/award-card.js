import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { determineWinner } from './_lib/awardCardData.js'
import { renderAwardCard } from './_lib/awardCardRender.js'

async function fetchPhotoBuffer(photoUrl) {
  if (!photoUrl) return null
  try {
    const res = await fetch(photoUrl)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
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

  const supabaseAdmin = getSupabaseAdmin()

  try {
    if (type === 'campaign') {
      if (!nomineeId) {
        res.status(400).json({ error: 'Missing nomineeId' })
        return
      }
      const { data: nominee, error: nomineeError } = await supabaseAdmin
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
      res.setHeader('Cache-Control', 'public, max-age=3600')
      res.status(200).send(png)
      return
    }

    // type === 'winner'
    if (!categoryId) {
      res.status(400).json({ error: 'Missing categoryId' })
      return
    }
    const { data: category, error: categoryError } = await supabaseAdmin
      .from('award_categories')
      .select('*, award_seasons(*)')
      .eq('id', categoryId)
      .maybeSingle()
    if (categoryError) throw categoryError
    if (!category || category.award_seasons?.phase !== 'revealed') {
      res.status(404).json({ error: 'Results are not available for this category' })
      return
    }

    const { data: nominees, error: nomineesError } = await supabaseAdmin
      .from('award_nominees')
      .select('*')
      .eq('category_id', categoryId)
    if (nomineesError) throw nomineesError

    const { data: votes, error: votesError } = await supabaseAdmin
      .from('award_votes')
      .select('nominee_id')
      .eq('category_id', categoryId)
    if (votesError) throw votesError

    const winner = determineWinner(votes, nominees)
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
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.status(200).send(png)
  } catch (error) {
    console.error('award-card: render failed', error)
    res.status(500).json({ error: 'Could not generate the card' })
  }
}
