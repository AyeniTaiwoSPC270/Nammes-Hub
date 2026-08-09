import { supabaseAdmin } from './supabaseAdminClient.mjs'
import { resources } from '../src/data/resources.js'
import { slugify } from '../src/lib/adminFields.js'

const rows = []
for (const [level, semesters] of Object.entries(resources)) {
  for (const [semester, items] of Object.entries(semesters)) {
    for (const item of items) {
      rows.push({
        id: slugify(item.title),
        ...item,
        level: Number(level),
        semester: Number(semester),
      })
    }
  }
}

const { error } = await supabaseAdmin.from('resources').insert(rows)
if (error) throw error
console.log(`Seeded ${rows.length} resources rows.`)
