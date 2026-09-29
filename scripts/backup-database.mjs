// Exports every table in the public schema, plus the list of auth users, to JSON files.
// Supabase's free plan has no automatic backups, so run this weekly from your own computer:
//   node --env-file=.env scripts/backup-database.mjs
// Output goes to ./backups/<date>/ (git-ignored). It contains personal data: keep it private and
// encrypt it if it leaves your machine. The schema itself is rebuilt from supabase/migrations.
// Auth users are exported without passwords (the API never exposes hashes): after a restore,
// members would use "forgot password".
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TABLES = [
  'admins', 'audit_log', 'award_categories', 'award_nominations', 'award_nominees', 'award_seasons',
  'award_votes', 'broadcasts', 'cgpa_courses', 'cgpa_semesters', 'change_requests', 'contact_messages',
  'email_templates', 'event_photos', 'events', 'excos', 'feature_flags', 'form_questions',
  'form_responses', 'forms', 'news', 'opportunities', 'outline_submissions', 'outlines',
  'page_banners', 'profiles', 'resources', 'site_content', 'timetables',
]
const PAGE = 1000

async function readTable(table) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    // A stable order keeps pages from overlapping; tables without an id column fall back to unordered.
    let { data, error } = await db.from(table).select('*').order('id').range(from, from + PAGE - 1)
    if (error && /column .*id.* does not exist/i.test(error.message)) {
      ;({ data, error } = await db.from(table).select('*').range(from, from + PAGE - 1))
    }
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

const stamp = new Date().toISOString().slice(0, 10)
const dir = join(process.argv[2] ?? './backups', stamp)
await mkdir(dir, { recursive: true })

const summary = {}
for (const table of TABLES) {
  const rows = await readTable(table)
  await writeFile(join(dir, `${table}.json`), JSON.stringify(rows, null, 2))
  summary[table] = rows.length
}

const users = []
for (let page = 1; ; page += 1) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) throw new Error(`auth users: ${error.message}`)
  users.push(
    ...data.users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      email_confirmed_at: u.email_confirmed_at,
      banned_until: u.banned_until ?? null,
      user_metadata: u.user_metadata,
      app_metadata: u.app_metadata,
    })),
  )
  if (data.users.length < 1000) break
}
await writeFile(join(dir, 'auth_users.json'), JSON.stringify(users, null, 2))
summary.auth_users = users.length

await writeFile(join(dir, '_summary.json'), JSON.stringify({ takenAt: new Date().toISOString(), rows: summary }, null, 2))
console.log(`Backup written to ${dir}`)
console.table(summary)
