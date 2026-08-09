import { supabaseAdmin } from './supabaseAdminClient.mjs'
import { outlines } from '../src/data/outlines.js'
import { slugify } from '../src/lib/adminFields.js'

const rows = []
for (const [level, semesters] of Object.entries(outlines)) {
  for (const [semester, courses] of Object.entries(semesters)) {
    for (const course of courses) {
      rows.push({
        id: slugify(course.code),
        ...course,
        level: Number(level),
        semester: Number(semester),
        texts: course.texts ?? null,
      })
    }
  }
}

const { error } = await supabaseAdmin.from('outlines').insert(rows)
if (error) throw error
console.log(`Seeded ${rows.length} outline rows.`)
