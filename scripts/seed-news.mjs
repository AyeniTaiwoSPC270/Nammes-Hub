import { supabaseAdmin } from './supabaseAdminClient.mjs'
import { news } from '../src/data/news.js'

const rows = news.map(({ badge, ...rest }) => ({
  ...rest,
  badge_tone: badge?.tone ?? null,
  badge_label: badge?.label ?? null,
}))

const { error } = await supabaseAdmin.from('news').insert(rows)
if (error) throw error
console.log(`Seeded ${rows.length} news rows.`)
