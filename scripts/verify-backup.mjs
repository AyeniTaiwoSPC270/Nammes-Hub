// Restore drill that never touches production data. It checks a backup made by backup-database.mjs:
//   node --env-file=.env scripts/verify-backup.mjs [backup folder]     (default: newest folder in ./backups)
// 1. every table in the schema files is in the backup (nothing forgotten),
// 2. every file reads back and matches the row counts recorded when it was made,
// 3. every reference (votes -> nominees, responses -> forms, ...) resolves inside the backup,
// 4. the backup is recent, and how production has moved on since (read-only counts).
// Exit code 1 if anything is wrong, so it can be run before trusting a backup.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  EXCLUDED_TABLES,
  tablesCreatedBySql,
  checkCoverage,
  checkReferences,
  checkCounts,
  checkAge,
  describeDrift,
} from './lib/backupChecks.mjs'

async function sqlFilesUnder(dir) {
  const names = (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort()
  return Promise.all(names.map((n) => readFile(join(dir, n), 'utf8')))
}

async function newestBackup() {
  const dirs = (await readdir('./backups', { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  if (dirs.length === 0) throw new Error('No backups found in ./backups. Run scripts/backup-database.mjs first.')
  return join('./backups', dirs.at(-1))
}

const dir = process.argv[2] ?? (await newestBackup())
const summary = JSON.parse(await readFile(join(dir, '_summary.json'), 'utf8'))
const problems = []
const notes = []

// 1. coverage: which tables does the schema create vs which does the backup contain
const schemaSql = [...(await sqlFilesUnder('supabase/history')), ...(await sqlFilesUnder('supabase/migrations'))].join('\n')
const schemaTables = tablesCreatedBySql(schemaSql)
const backedUp = Object.keys(summary.rows).filter((t) => t !== 'auth_users')
problems.push(...checkCoverage(schemaTables, backedUp))

// 2. every file reads back and matches its recorded count
const data = {}
const actualCounts = {}
for (const table of Object.keys(summary.rows)) {
  try {
    data[table] = JSON.parse(await readFile(join(dir, `${table}.json`), 'utf8'))
    actualCounts[table] = data[table].length
  } catch (error) {
    problems.push(`${table}.json could not be read: ${error.message}`)
  }
}
problems.push(...checkCounts(summary.rows, actualCounts))

// 3. references resolve; the backup stores auth users under "auth_users" with an "id" column
problems.push(...checkReferences(data))

// 4. age, and drift against production (read-only head counts)
problems.push(...checkAge(summary.takenAt))
if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const live = {}
  for (const table of backedUp) {
    const { count, error } = await db.from(table).select('*', { count: 'exact', head: true })
    if (!error) live[table] = count
  }
  notes.push(...describeDrift(actualCounts, live))
} else {
  notes.push('Skipped the comparison with production (no Supabase credentials in the environment).')
}

console.log(`Checked backup: ${dir} (taken ${summary.takenAt})`)
console.log(`Tables in schema files: ${schemaTables.size}. Tables in backup: ${backedUp.length}. Left out on purpose: ${EXCLUDED_TABLES.join(', ')}.`)
for (const note of notes) console.log(`note: ${note}`)
if (problems.length === 0) {
  console.log('OK: the backup is complete and consistent.')
} else {
  for (const problem of problems) console.error(`PROBLEM: ${problem}`)
  process.exit(1)
}
