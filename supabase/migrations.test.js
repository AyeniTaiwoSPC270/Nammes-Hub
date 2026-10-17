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