import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { QUESTION_TYPES } from '../api/_lib/quizTypes.js'

// Postgres checks every constraint on a row, not just the newest one. `quiz_questions` carries two: a column-level
// `check (type in (...))` added inline when the column was introduced, and the row-level `quiz_questions_shape` that
// later migrations drop and rebuild. A type added to only one of them is refused by the other, and the row insert
// fails with a constraint violation the editor reports as a toast and nothing else.
//
// That is how `order` and `diagram` reached production unable to be saved: the shape constraint listed them and the
// column constraint did not. So the type list in that column constraint is read out of the migrations and compared
// against the registry, rather than trusting anyone to remember both.

const migrations = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'))
// Windows checkouts give these files CRLF, so every pattern below is matched against normalised text.
const read = (file) => readFileSync(`supabase/migrations/${file}`, 'utf8').replace(/\r\n/g, '\n')
// Comments are stripped because these migrations explain the constraint in prose that quotes its own SQL, and a
// pattern will happily match the explanation instead of the statement.
const readSql = (file) => read(file).replace(/--[^\n]*/g, '')
const all = migrations.map(read).join('\n')
const allSql = migrations.map(readSql).join('\n')

const types = QUESTION_TYPES.map((t) => t.id ?? t).filter(Boolean)

describe('the quiz_questions type constraints accept every type the app can author', () => {
  it('the column-level type check lists all of them', () => {
    // Two forms write this list: the inline `add column type ... check (type in (...))` that created it, and the
    // `add constraint quiz_questions_type_check check (...)` that later replaced it. Only the LAST definition of the
    // named constraint is installed, so that is the one to read; the inline form is only a fallback for a database
    // that never got the widening migration.
    const named = migrations.filter((f) => read(f).includes('add constraint quiz_questions_type_check'))
    const source = named.length > 0 ? readSql(named[named.length - 1]) : allSql
    const line = source.match(/check \(\s*type in \(([\s\S]*?)\)/)?.[1] ?? source.match(/add column type[^,]*check \(type in \(([\s\S]*?)\)\)/)?.[1]
    expect(line, 'no migration defines a type check on quiz_questions.type').toBeTruthy()
    const listed = line.split(',').map((s) => s.trim().replace(/^'|'$/g, ''))
    for (const type of types) expect(listed, `"${type}" is missing from the live quiz_questions_type_check`).toContain(type)
  })

  it('the row-level shape constraint accepts all of them', () => {
    // Several migrations define quiz_questions_shape and each drops the previous one, so the definition that matters
    // is the LAST one in timestamp order. Checking the first would pass on a constraint the database no longer has.
    const defs = migrations.filter((f) => read(f).includes('add constraint quiz_questions_shape'))
    expect(defs.length, 'quiz_questions_shape was not found in any migration').toBeGreaterThan(0)
    const latest = readSql(defs[defs.length - 1])
    const block = latest.match(/add constraint quiz_questions_shape check \(([\s\S]*?)\)\s*;/)?.[1]
    expect(block, 'the shape constraint body could not be read').toBeTruthy()
    for (const type of types) {
      expect(block, `"${type}" is missing from the live quiz_questions_shape in ${defs[defs.length - 1]}`).toContain(`type = '${type}'`)
    }
  })

  it('no migration after the widening one re-narrows the list', () => {
    // The file that introduced the column legitimately writes `add column type` with a five-type list; that is the
    // history, not a regression. What would be a regression is a LATER file writing another narrow inline check, which
    // would install alongside the widened one and quietly undo it for any type it omits.
    const widenedAt = migrations.findIndex((f) => readSql(f).includes('add constraint quiz_questions_type_check'))
    expect(widenedAt, 'the type check is never widened, which the first test already reports').toBeGreaterThanOrEqual(0)
    for (const file of migrations.slice(widenedAt + 1)) {
      expect(readSql(file).includes('add column type'), `${file} re-narrows the type check after it was widened`).toBe(false)
    }
  })

  it('the widening migration exists and names the constraint Postgres generated', () => {
    // The inline check gets this name automatically, so a migration that says `drop constraint if exists` on any other
    // name would be a no-op and the old list would survive.
    expect(all, 'no migration drops the auto-named quiz_questions_type_check').toContain('drop constraint if exists quiz_questions_type_check')
    expect(all, 'no migration re-adds quiz_questions_type_check').toContain('add constraint quiz_questions_type_check')
  })
})

// A rebuild is "history, then migrations", so a guard that reads one half cannot prove it works. The original
// page_banners rows and the outlines table both live in supabase/history.
const history = readdirSync('supabase/history').filter((f) => f.endsWith('.sql'))
const allTrackedSql = [
  ...history.map((f) => readFileSync(`supabase/history/${f}`, 'utf8').replace(/\r\n/g, '\n').replace(/--[^\n]*/g, '')),
  ...migrations.map(readSql),
].join('\n')

describe('every editable page has a banner row a rebuild would seed', () => {
  it('the admin editor\'s page list matches the insert statements', () => {
    // Update-only is the right save path, so the row is the only thing that makes a page editable. Every key the
    // editor offers must therefore come from tracked SQL; one that does not fails silently in production.
    const source = readFileSync('src/pages/admin/AdminPageBanners.jsx', 'utf8').replace(/\r\n/g, '\n')
    const pages = [...(source.match(/const PAGES = \[([\s\S]*?)\]/)?.[1] ?? '').matchAll(/\{\s*key:\s*'([^']+)'/g)].map((m) => m[1])
    expect(pages.length, 'the PAGES array could not be read').toBeGreaterThan(0)

    const inserts = [...allTrackedSql.matchAll(/insert\s+into\s+public\.page_banners[\s\S]*?;/gi)].map((m) => m[0])
    const seeded = new Set(inserts.flatMap((block) => [...block.matchAll(/\(\s*'([a-z_]+)'\s*,/g)].map((m) => m[1])))

    for (const page of pages) expect(seeded, `no tracked SQL inserts a page_banners row for "${page}"`).toContain(page)
  })
})

describe('every outlines column the app reads has DDL', () => {
  it('the two name columns are created by tracked SQL', () => {
    // These are read by src/lib/outlinePdf.js, src/pages/outlines/OutlineDetail.jsx and
    // src/pages/admin/config/outlinesAdminConfig.js but were added through the dashboard, so a rebuild produced a
    // table the editor writes to and PostgREST rejects. The list is explicit rather than scanned out of the JSX: an
    // incidental property would fail a scan without being a column.
    for (const column of ['past_questions_name', 'lecturer_notes_name']) {
      const ddl = new RegExp(`add column (?:if not exists )?${column}\\b`)
      expect(allTrackedSql, `no tracked SQL creates outlines.${column}`).toMatch(ddl)
    }
  })
})