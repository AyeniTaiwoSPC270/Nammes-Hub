import { describe, it, expect } from 'vitest'
import {
  tablesCreatedBySql,
  checkCoverage,
  checkReferences,
  checkCounts,
  checkAge,
  describeDrift,
} from './lib/backupChecks.mjs'

describe('tablesCreatedBySql', () => {
  it('finds public tables and ignores other schemas', () => {
    const sql = `create table news (id text);
      CREATE TABLE IF NOT EXISTS public.events (id text);
      create table storage.foo (id int);
      create table auth.bar (id int);`
    expect([...tablesCreatedBySql(sql)].sort()).toEqual(['events', 'news'])
  })
})

describe('checkCoverage', () => {
  it('flags a schema table missing from the backup, except deliberate exclusions', () => {
    const problems = checkCoverage(new Set(['news', 'events', 'error_log']), ['news'])
    expect(problems).toEqual(['Table "events" exists in the schema but is not in the backup script'])
  })

  it('flags a backed-up table that no schema file creates', () => {
    expect(checkCoverage(new Set(['news']), ['news', 'ghost'])).toHaveLength(1)
  })
})

describe('checkReferences', () => {
  const refs = [
    { table: 'votes', column: 'nominee_id', to: 'nominees', target: 'id' },
    { table: 'responses', column: 'user_id', to: 'auth_users', target: 'id', nullable: true },
  ]

  it('accepts rows whose references exist, and null where allowed', () => {
    const data = {
      nominees: [{ id: 'n1' }],
      votes: [{ nominee_id: 'n1' }],
      auth_users: [{ id: 'u1' }],
      responses: [{ user_id: null }, { user_id: 'u1' }],
    }
    expect(checkReferences(data, refs)).toEqual([])
  })

  it('reports orphans and null in a required column', () => {
    const data = { nominees: [{ id: 'n1' }], votes: [{ nominee_id: 'gone' }, { nominee_id: null }], auth_users: [], responses: [] }
    expect(checkReferences(data, refs)).toEqual(['votes.nominee_id: 2 row(s) point at a missing nominees.id'])
  })
})

describe('checkCounts', () => {
  it('flags files that do not match the recorded counts', () => {
    expect(checkCounts({ a: 2, b: 1 }, { a: 2, b: 0 })).toHaveLength(1)
    expect(checkCounts({ a: 2 }, {})).toEqual(['a: summary says 2 rows but the file has no file'])
    expect(checkCounts({ a: 2 }, { a: 2 })).toEqual([])
  })
})

describe('checkAge', () => {
  it('warns only when older than the limit', () => {
    const now = new Date('2026-10-10T00:00:00Z')
    expect(checkAge('2026-10-05T00:00:00Z', now)).toEqual([])
    expect(checkAge('2026-09-29T00:00:00Z', now)).toHaveLength(1)
  })
})

describe('describeDrift', () => {
  it('notes new rows and, more urgently, fewer rows than the backup', () => {
    const notes = describeDrift({ a: 5, b: 5, c: 5 }, { a: 5, b: 8, c: 3 })
    expect(notes).toEqual(['b: 3 new row(s) since the backup', 'c: live has FEWER rows than the backup (3 vs 5)'])
  })
})
