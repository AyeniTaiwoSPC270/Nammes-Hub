// Pure checks used by scripts/verify-backup.mjs. Each returns a list of problem strings (empty = fine).

// Tables that are deliberately not backed up (short-lived operational data).
export const EXCLUDED_TABLES = ['error_log']

// Every child column must point at an id that exists in the backup: otherwise a restore would fail
// or silently orphan rows. `nullable` columns may be null.
export const REFERENCES = [
  { table: 'profiles', column: 'user_id', to: 'auth_users', target: 'id' },
  { table: 'admins', column: 'user_id', to: 'auth_users', target: 'id' },
  { table: 'cgpa_semesters', column: 'user_id', to: 'auth_users', target: 'id' },
  { table: 'cgpa_courses', column: 'semester_id', to: 'cgpa_semesters', target: 'id' },
  { table: 'award_categories', column: 'season_id', to: 'award_seasons', target: 'id' },
  { table: 'award_nominees', column: 'category_id', to: 'award_categories', target: 'id' },
  { table: 'award_nominations', column: 'category_id', to: 'award_categories', target: 'id' },
  { table: 'award_nominations', column: 'submitted_by', to: 'auth_users', target: 'id' },
  { table: 'award_votes', column: 'category_id', to: 'award_categories', target: 'id' },
  { table: 'award_votes', column: 'nominee_id', to: 'award_nominees', target: 'id' },
  { table: 'award_votes', column: 'voter_id', to: 'auth_users', target: 'id' },
  { table: 'forms', column: 'created_by', to: 'auth_users', target: 'id' },
  { table: 'form_questions', column: 'form_id', to: 'forms', target: 'id' },
  { table: 'form_responses', column: 'form_id', to: 'forms', target: 'id' },
  { table: 'form_responses', column: 'respondent_id', to: 'auth_users', target: 'id', nullable: true },
  { table: 'event_photos', column: 'event_id', to: 'events', target: 'id' },
  { table: 'outline_submissions', column: 'outline_id', to: 'outlines', target: 'id' },
  { table: 'outline_submissions', column: 'submitted_by', to: 'auth_users', target: 'id' },
]

// Table names created by the schema SQL files (history + migrations), ignoring the auth/storage schemas.
export function tablesCreatedBySql(sqlText) {
  const found = new Set()
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(\w+)\.)?(\w+)/gi
  for (const [, schema, name] of sqlText.matchAll(re)) {
    if (!schema || schema.toLowerCase() === 'public') found.add(name.toLowerCase())
  }
  return found
}

export function checkCoverage(schemaTables, backedUpTables, excluded = EXCLUDED_TABLES) {
  const problems = []
  for (const table of schemaTables) {
    if (!backedUpTables.includes(table) && !excluded.includes(table)) {
      problems.push(`Table "${table}" exists in the schema but is not in the backup script`)
    }
  }
  for (const table of backedUpTables) {
    if (!schemaTables.has(table)) problems.push(`Backup script lists "${table}" but no schema file creates it`)
  }
  return problems
}

// data: { tableName: rows[] }
export function checkReferences(data, references = REFERENCES) {
  const problems = []
  for (const { table, column, to, target, nullable } of references) {
    const ids = new Set((data[to] ?? []).map((row) => row[target]))
    let bad = 0
    for (const row of data[table] ?? []) {
      const value = row[column]
      if (value === null || value === undefined) {
        if (!nullable) bad += 1
      } else if (!ids.has(value)) {
        bad += 1
      }
    }
    if (bad > 0) problems.push(`${table}.${column}: ${bad} row(s) point at a missing ${to}.${target}`)
  }
  return problems
}

export function checkCounts(summaryRows, actualCounts) {
  const problems = []
  for (const [table, expected] of Object.entries(summaryRows)) {
    if (actualCounts[table] !== expected) {
      problems.push(`${table}: summary says ${expected} rows but the file has ${actualCounts[table] ?? 'no file'}`)
    }
  }
  return problems
}

export function checkAge(takenAtIso, now = new Date(), maxDays = 8) {
  const days = (now - new Date(takenAtIso)) / 86_400_000
  return days > maxDays ? [`The backup is ${Math.floor(days)} days old (weekly backups are expected)`] : []
}

// Compares live row counts with the backup and reports tables that changed since. Informational only.
export function describeDrift(backupCounts, liveCounts) {
  const notes = []
  for (const [table, backedUp] of Object.entries(backupCounts)) {
    const live = liveCounts[table]
    if (live === undefined) continue
    if (live < backedUp) notes.push(`${table}: live has FEWER rows than the backup (${live} vs ${backedUp})`)
    else if (live > backedUp) notes.push(`${table}: ${live - backedUp} new row(s) since the backup`)
  }
  return notes
}
