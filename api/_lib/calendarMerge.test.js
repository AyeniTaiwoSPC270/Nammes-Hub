import { describe, it, expect } from 'vitest'
import { mergeCalendarSources } from './calendarMerge.js'
import { toDayKey, fromDayKey } from './calendarDates.js'

// Every expected date in this file is built from explicit components and read back through toDayKey, so the
// assertions hold at any UTC offset. Nothing here spells a date as a bare string and trusts the parser.
// The one place a literal day key appears as *input* is a fixture column, where it is the value Supabase hands
// over for a `date` column — already offset-free by construction.
const d = (year, monthIndex, day, hours = 0, minutes = 0) => new Date(year, monthIndex, day, hours, minutes)
const key = (year, monthIndex, day) => toDayKey(d(year, monthIndex, day))

// A timestamptz fixture is written the way the database writes one: UTC, with the Z.
const stamp = (year, monthIndex, day, hours = 0, minutes = 0) => d(year, monthIndex, day, hours, minutes).toISOString()

const ids = (result) => result.items.map((item) => item.id)
const titles = (result) => result.items.map((item) => item.title)

describe('mergeCalendarSources: academic rows', () => {
  const academic = [
    {
      id: 'ac-multi',
      session: '2026/2027',
      semester: 1,
      title: 'Christmas/New Year Break',
      kind: 'break',
      starts_at: key(2026, 11, 21),
      ends_at: key(2027, 0, 3),
      note: '(2 weeks)',
      remind_days: 1,
    },
    {
      id: 'ac-single',
      session: '2026/2027',
      semester: 1,
      title: 'Resumption and Commencement of Lectures',
      kind: 'lectures',
      starts_at: key(2026, 9, 19),
      ends_at: null,
      note: null,
      remind_days: null,
    },
  ]

  it('reads a single-day row as one day', () => {
    const [item] = mergeCalendarSources({ academic: [academic[1]] }).items
    expect(item).toEqual({
      id: 'academic:ac-single',
      source: 'academic',
      title: 'Resumption and Commencement of Lectures',
      kind: 'lectures',
      startsAt: key(2026, 9, 19),
      // ends_at null is one day, not an open-ended range.
      endsAt: key(2026, 9, 19),
      allDay: true,
      note: null,
      // v1 has no academic detail page (spec §6).
      href: null,
      remindDays: null,
      isMultiDay: false,
    })
  })

  it('reads a multi-day row across a year boundary as one span', () => {
    const [item] = mergeCalendarSources({ academic: [academic[0]] }).items
    expect(item.startsAt).toBe(key(2026, 11, 21))
    expect(item.endsAt).toBe(key(2027, 0, 3))
    expect(item.isMultiDay).toBe(true)
    expect(item.allDay).toBe(true)
    expect(item.note).toBe('(2 weeks)')
    expect(item.remindDays).toBe(1)
  })

  it('sorts ascending by start', () => {
    const { items } = mergeCalendarSources({ academic })
    expect(titles({ items })).toEqual([
      'Resumption and Commencement of Lectures',
      'Christmas/New Year Break',
    ])
  })

  it('merges both sources into one list, ordered across both', () => {
    const { items } = mergeCalendarSources({
      academic: [academic[0]],
      events: [{ id: 'e-mid', title: 'Mid-Year Dinner', starts_at: stamp(2026, 10, 2, 18, 0) }],
    })
    expect(ids({ items })).toEqual(['event:e-mid', 'academic:ac-multi'])
  })

  it('returns nothing rather than throwing when given no sources at all', () => {
    expect(mergeCalendarSources()).toEqual({ items: [], tba: [], hasMore: false })
    expect(mergeCalendarSources({})).toEqual({ items: [], tba: [], hasMore: false })
    expect(mergeCalendarSources({ academic: [], events: [] })).toEqual({ items: [], tba: [], hasMore: false })
  })
})

describe('mergeCalendarSources: event rows', () => {
  it('places a timestamptz on its local day', () => {
    const { items } = mergeCalendarSources({
      events: [{ id: 'e-1', title: 'Freshers Welcome', starts_at: stamp(2026, 9, 5, 10, 0) }],
    })
    const [item] = items
    expect(item).toEqual({
      id: 'event:e-1',
      source: 'event',
      title: 'Freshers Welcome',
      kind: 'other',
      startsAt: key(2026, 9, 5),
      // A start time with no end time is a single day on the grid, not a bar to the end of time.
      endsAt: key(2026, 9, 5),
      allDay: false,
      note: null,
      href: '/events/e-1',
      remindDays: null,
      isMultiDay: false,
    })
  })

  it('treats an event with no meaningful time of day as all-day', () => {
    const { items } = mergeCalendarSources({
      events: [
        { id: 'e-midnight', title: 'Quiet Morning', starts_at: stamp(2026, 9, 5, 0, 0) },
        { id: 'e-timed', title: 'Lecture', starts_at: stamp(2026, 9, 5, 9, 30) },
      ],
    })
    // Read by id rather than position: both land on the same day, so their order here is the title sort and
    // says nothing about which is timed.
    const byId = Object.fromEntries(items.map((item) => [item.id, item]))
    expect(byId['event:e-midnight'].allDay).toBe(true)
    expect(byId['event:e-timed'].allDay).toBe(false)
  })

  it('reads a multi-day event and links it to its detail page', () => {
    const { items } = mergeCalendarSources({
      events: [
        {
          id: 'e-2',
          title: 'Faculty Week',
          starts_at: stamp(2027, 3, 5, 9, 0),
          ends_at: stamp(2027, 4, 2, 17, 0),
          kind: 'lectures',
          description: 'Lectures continue',
          remind_days: 7,
        },
      ],
    })
    expect(items[0]).toMatchObject({
      startsAt: key(2027, 3, 5),
      endsAt: key(2027, 4, 2),
      isMultiDay: true,
      allDay: false,
      href: '/events/e-2',
      kind: 'lectures',
      note: 'Lectures continue',
      remindDays: 7,
    })
  })

  it('falls back to the legacy free-text date when starts_at is null', () => {
    const { items } = mergeCalendarSources({
      events: [{ id: 'e-legacy', title: 'Independence Day', date: '3rd August 2026' }],
    })
    expect(items[0].startsAt).toBe(key(2026, 7, 3))
    expect(items[0].allDay).toBe(true)
  })

  it('prefers starts_at over the legacy date when both are present', () => {
    const { items } = mergeCalendarSources({
      events: [
        { id: 'e-both', title: 'Both Columns', starts_at: stamp(2027, 1, 15, 14, 0), date: '3rd August 2026' },
      ],
    })
    expect(items[0].startsAt).toBe(key(2027, 1, 15))
    expect(items[0].allDay).toBe(false)
  })
})

describe('mergeCalendarSources: undated rows', () => {
  it('puts an academic row with no starts_at in the TBA panel, not the grid', () => {
    const { items, tba } = mergeCalendarSources({
      academic: [
        { id: 'ac-tba', title: 'Orientation Programme for Fresh Students', kind: 'orientation', starts_at: null },
      ],
    })
    expect(items).toEqual([])
    expect(tba).toHaveLength(1)
    expect(tba[0]).toMatchObject({ id: 'academic:ac-tba', startsAt: null, endsAt: null, isMultiDay: false })
  })

  it('puts an event with neither a timestamp nor a readable date in the TBA panel', () => {
    const { items, tba } = mergeCalendarSources({
      events: [{ id: 'e-tba', title: 'Date To Be Announced', starts_at: null, date: 'TBA' }],
    })
    expect(items).toEqual([])
    expect(ids({ items })).toEqual([])
    expect(tba.map((item) => item.id)).toEqual(['event:e-tba'])
    expect(tba[0].startsAt).toBeNull()
  })

  it('keeps TBA rows out of a bounded range, which has no day for them to sit in', () => {
    const { items, tba } = mergeCalendarSources(
      {
        academic: [{ id: 'ac-tba', title: 'Matriculation Ceremony', kind: 'orientation', starts_at: null }],
        events: [{ id: 'e-tba', title: 'Sometime Soon', starts_at: null, date: 'not a date at all' }],
      },
      { from: key(2026, 9, 1), to: key(2026, 9, 31) },
    )
    expect(items).toEqual([])
    expect(tba).toHaveLength(2)
  })

  it('orders the TBA panel by title then id, deterministically', () => {
    const build = () => ({
      academic: [{ id: 'b', title: 'Zebra Day', kind: 'other', starts_at: null }],
      events: [{ id: 'a', title: 'Alpha Day', starts_at: null }],
    })
    const forward = mergeCalendarSources(build())
    const reversed = mergeCalendarSources({ academic: [...build().academic], events: [...build().events] })
    expect(forward.tba.map((item) => item.id)).toEqual(['event:a', 'academic:b'])
    expect(reversed.tba.map((item) => item.id)).toEqual(forward.tba.map((item) => item.id))
  })
})

describe('mergeCalendarSources: id namespacing', () => {
  it('keeps two sources apart when they share a literal id', () => {
    const { items } = mergeCalendarSources({
      academic: [{ id: 'shared', title: 'Senate Date', kind: 'exams', starts_at: key(2026, 9, 5) }],
      events: [{ id: 'shared', title: 'Departmental Event', starts_at: stamp(2026, 9, 5, 10, 0) }],
    })
    // Same day, so the tie falls through to title: "Departmental Event" sorts before "Senate Date".
    expect(items.map((item) => item.id)).toEqual(['event:shared', 'academic:shared'])
    expect(new Set(items.map((item) => item.id)).size).toBe(2)
  })

  it('gives a row with no id no identity at all', () => {
    const { items, tba } = mergeCalendarSources({
      academic: [{ title: 'No Identifier', kind: 'other', starts_at: key(2026, 9, 5) }],
      events: [{ id: '  ', title: 'Blank Identifier', starts_at: stamp(2026, 9, 5, 10, 0) }],
    })
    expect(items).toEqual([])
    expect(tba).toEqual([])
  })
})

describe('mergeCalendarSources: the from/to window', () => {
  const spanning = { id: 'ac-span', title: 'Examinations', kind: 'exams', starts_at: key(2027, 0, 28), ends_at: key(2027, 1, 3) }
  const before = { id: 'ac-before', title: 'Lectures End', kind: 'lectures', starts_at: key(2027, 0, 15), ends_at: key(2027, 0, 15) }
  const after = { id: 'ac-after', title: 'Convocation', kind: 'convocation', starts_at: key(2027, 2, 8), ends_at: key(2027, 2, 12) }
  const all = { academic: [spanning, before, after] }

  it('includes a span that crosses a month boundary when the window covers only part of it', () => {
    // February alone holds the second half of the span.
    expect(ids(mergeCalendarSources(all, { from: key(2027, 1, 1), to: key(2027, 2, 1) }))).toEqual(['academic:ac-span'])
    // January alone holds the first half, plus the single day that sits inside it.
    expect(ids(mergeCalendarSources(all, { from: key(2027, 0, 1), to: key(2027, 1, 1) }))).toEqual([
      'academic:ac-before',
      'academic:ac-span',
    ])
  })

  it('returns everything when no window is given', () => {
    expect(ids(mergeCalendarSources(all))).toEqual(['academic:ac-before', 'academic:ac-span', 'academic:ac-after'])
  })

  it('treats `to` as exclusive: an item whose only day is `to` is out', () => {
    const onTheBoundary = { academic: [{ id: 'ac-edge', title: 'Edge', kind: 'other', starts_at: key(2027, 2, 1) }] }
    expect(ids(mergeCalendarSources(onTheBoundary, { from: key(2027, 1, 1), to: key(2027, 2, 1) }))).toEqual([])
  })

  it('treats `to` as exclusive: an item starting exactly on it is out, however long it runs', () => {
    const starting = { academic: [{ id: 'ac-edge', title: 'Edge', kind: 'other', starts_at: key(2027, 2, 1), ends_at: key(2027, 2, 12) }] }
    expect(ids(mergeCalendarSources(starting, { from: key(2027, 1, 1), to: key(2027, 2, 1) }))).toEqual([])
  })

  it('treats `to` as exclusive: an item straddling it is in', () => {
    const straddling = { academic: [{ id: 'ac-straddle', title: 'Straddle', kind: 'other', starts_at: key(2027, 1, 27), ends_at: key(2027, 2, 2) }] }
    expect(ids(mergeCalendarSources(straddling, { from: key(2027, 1, 1), to: key(2027, 2, 1) }))).toEqual(['academic:ac-straddle'])
  })

  // An item whose *end* is `to` is still in the window, because it covers days before `to` too. Excluding it would
  // hide an exam week that ran most of the month — the overlap test asks "is any day of this inside the window",
  // and the answer for a span reaching the boundary is yes.
  it('includes an item that ends exactly on `to`, since it covers the days before it', () => {
    const ending = { academic: [{ id: 'ac-ending', title: 'Ending', kind: 'exams', starts_at: key(2027, 1, 10), ends_at: key(2027, 2, 1) }] }
    expect(ids(mergeCalendarSources(ending, { from: key(2027, 1, 1), to: key(2027, 2, 1) }))).toEqual(['academic:ac-ending'])
  })

  it('accepts either bound on its own', () => {
    expect(ids(mergeCalendarSources(all, { from: key(2027, 1, 1) }))).toEqual(['academic:ac-span', 'academic:ac-after'])
    expect(ids(mergeCalendarSources(all, { to: key(2027, 1, 1) }))).toEqual(['academic:ac-before', 'academic:ac-span'])
  })

  it('ignores a bound that is not a day key rather than reading it as the year 1', () => {
    expect(ids(mergeCalendarSources(all, { from: 'not-a-date', to: 'also-not-a-date' }))).toEqual([
      'academic:ac-before',
      'academic:ac-span',
      'academic:ac-after',
    ])
  })
})

describe('mergeCalendarSources: the limit', () => {
  const many = (count) => ({
    academic: Array.from({ length: count }, (_, i) => ({
      id: `ac-${i}`,
      title: `Row ${i}`,
      kind: 'other',
      starts_at: key(2026, 9, 1 + i),
    })),
  })

  it('reports hasMore once the list runs past the cap, and stops there', () => {
    const { items, hasMore } = mergeCalendarSources(many(5), { limit: 3 })
    expect(items).toHaveLength(3)
    expect(hasMore).toBe(true)
    // The first three by start order, so the cap never shows the tail of an arbitrary slice.
    expect(items[0].id).toBe('academic:ac-0')
    expect(items[2].id).toBe('academic:ac-2')
  })

  it('reports hasMore false when everything fits', () => {
    const { items, hasMore } = mergeCalendarSources(many(3), { limit: 3 })
    expect(items).toHaveLength(3)
    expect(hasMore).toBe(false)
  })

  it('caps at 500 by default, which is more than a real calendar ever holds', () => {
    const { items, hasMore } = mergeCalendarSources(many(501))
    expect(items).toHaveLength(500)
    expect(hasMore).toBe(true)
    expect(mergeCalendarSources(many(500)).hasMore).toBe(false)
  })

  it('falls back to the default when the cap is nonsense', () => {
    for (const limit of [-1, Number.NaN, 'ten', null]) {
      expect(mergeCalendarSources(many(501), { limit }).items).toHaveLength(500)
    }
  })

  it('caps the dated list only — the TBA panel is never truncated', () => {
    const { tba } = mergeCalendarSources(
      { academic: Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, title: `Undated ${i}`, kind: 'other', starts_at: null })) },
      { limit: 1 },
    )
    expect(tba).toHaveLength(5)
  })
})

describe('mergeCalendarSources: determinism', () => {
  const build = () => ({
    academic: [
      { id: 'a3', title: 'Same Title', kind: 'exams', starts_at: key(2026, 9, 10), ends_at: key(2026, 9, 12) },
      { id: 'a1', title: 'Same Title', kind: 'exams', starts_at: key(2026, 9, 10), ends_at: key(2026, 9, 12) },
      { id: 'a2', title: 'Another Title', kind: 'exams', starts_at: key(2026, 9, 10), ends_at: key(2026, 9, 12) },
      { id: 'a4', title: 'Earlier', kind: 'break', starts_at: key(2026, 8, 1), ends_at: key(2026, 8, 1) },
      { id: 'a5', title: 'Tied End', kind: 'break', starts_at: key(2026, 9, 10), ends_at: key(2026, 9, 14) },
      { id: 'a6', title: 'Undated', kind: 'orientation', starts_at: null },
    ],
    events: [{ id: 'e1', title: 'Departmental', starts_at: stamp(2026, 9, 10, 9, 0) }],
  })

  // start, then end, then title, then id — every tie is broken, so two rows that agree on the first three keys
  // still cannot swap places between renders.
  it('breaks every tie with the id rather than the input order', () => {
    // The order key is start, then end, then title, then id — and the end date comes before the title, which is what
    // puts the one-day event ahead of the three-day rows sharing its start. a4 is first on its earlier start; a5
    // is last because its later end outranks every title.
    const { items } = mergeCalendarSources(build())
    expect(ids({ items })).toEqual(['academic:a4', 'event:e1', 'academic:a2', 'academic:a1', 'academic:a3', 'academic:a5'])
  })

  it('gives the same order whichever way the rows arrive', () => {
    const forward = mergeCalendarSources(build())
    const backward = mergeCalendarSources({ academic: [...build().academic].reverse(), events: [...build().events].reverse() })
    const interleaved = mergeCalendarSources({ academic: [build().academic[3], build().academic[0], build().academic[5], build().academic[2], build().academic[4], build().academic[1]], events: build().events })

    expect(ids(backward)).toEqual(ids(forward))
    expect(ids(interleaved)).toEqual(ids(forward))
    expect(interleaved.tba.map((item) => item.id)).toEqual(forward.tba.map((item) => item.id))
  })
})

describe('mergeCalendarSources: malformed rows', () => {
  it('does not throw and does not emit NaN for junk in either source', () => {
    const { items, tba, hasMore } = mergeCalendarSources({
      academic: [
        { id: 'bad-day', title: 'Unparseable', kind: 'exams', starts_at: 'not-a-date', ends_at: key(2026, 9, 9) },
        { id: 'short-key', title: 'Truncated', kind: 'exams', starts_at: '2026-10', ends_at: null },
        { id: 'impossible', title: 'No Such Day', kind: 'exams', starts_at: '2026-02-30', ends_at: null },
        { id: 'reversed', title: 'Backwards', kind: 'exams', starts_at: key(2026, 9, 20), ends_at: key(2026, 9, 5) },
        { id: 'junk-end', title: 'Junk End', kind: 'exams', starts_at: key(2026, 9, 20), ends_at: 'not-a-date' },
        { id: 'wrong-type', title: 'Wrong Type', kind: 'exams', starts_at: 20261020, ends_at: null },
        { id: 'bad-kind', title: 'Unknown Kind', kind: 'lunch', starts_at: key(2026, 9, 21) },
        { id: 'bad-remind', title: 'Bad Lead Time', kind: 'other', starts_at: key(2026, 9, 22), remind_days: 999 },
      ],
      events: [
        { id: 'bad-stamp', title: 'Unparseable', starts_at: 'not-a-date', ends_at: 'also-not-a-date' },
        { id: 'nullish', title: null, starts_at: null, ends_at: null, date: '' },
      ],
    })

    const serialised = JSON.stringify({ items, tba, hasMore })
    expect(serialised).not.toContain('NaN')
    expect(serialised).not.toContain('null,null')

    // Nothing that could not be read as a day lands in the grid; nothing with a start lands in TBA.
    for (const item of [...items, ...tba]) {
      expect(item.startsAt === null || /^\d{4}-\d{2}-\d{2}$/.test(item.startsAt)).toBe(true)
      expect(item.endsAt === null || /^\d{4}-\d{2}-\d{2}$/.test(item.endsAt)).toBe(true)
      expect(Number.isNaN(item.remindDays)).toBe(false)
    }
  })

  it('recovers a reversed range as a single day rather than a bar running backwards', () => {
    const { items } = mergeCalendarSources({
      academic: [{ id: 'reversed', title: 'Backwards', kind: 'exams', starts_at: key(2026, 9, 20), ends_at: key(2026, 9, 5) }],
    })
    expect(items[0]).toMatchObject({ startsAt: key(2026, 9, 20), endsAt: key(2026, 9, 20), isMultiDay: false })
  })

  it('drops a row that is not an object, and survives a source that is not a list', () => {
    expect(mergeCalendarSources({ academic: [null, undefined, 'nope', 42], events: [null] }).items).toEqual([])
    expect(mergeCalendarSources({ academic: 'nope', events: {} })).toEqual({ items: [], tba: [], hasMore: false })
  })

  it('normalises an unknown kind to one the theme can paint', () => {
    const { items } = mergeCalendarSources({
      academic: [{ id: 'k', title: 'Department Social', kind: 'lunch', starts_at: key(2026, 9, 5) }],
      events: [{ id: 'e', title: 'Jam', kind: null, starts_at: stamp(2026, 9, 5, 12, 0) }],
    })
    expect(items.map((item) => item.kind)).toEqual(['other', 'other'])
  })
})

describe('mergeCalendarSources: inputs are left alone', () => {
  it('does not mutate the rows or the arrays it is given', () => {
    const academic = [
      { id: 'a1', title: 'One', kind: 'exams', starts_at: key(2026, 9, 5), ends_at: key(2026, 9, 9) },
      { id: 'a2', title: 'Two', kind: 'exams', starts_at: null },
    ]
    const events = [
      { id: 'e1', title: 'Three', date: '3rd August 2026', starts_at: null },
      { id: 'e2', title: 'Four', starts_at: stamp(2026, 9, 12, 9, 0), ends_at: stamp(2026, 9, 14, 17, 0) },
    ]
    const academicBefore = JSON.parse(JSON.stringify(academic))
    const eventsBefore = JSON.parse(JSON.stringify(events))

    const first = mergeCalendarSources({ academic, events })
    mergeCalendarSources({ academic, events })
    // Re-reading the very same arrays must give the same answer, which it cannot if the first pass sorted them.
    const second = mergeCalendarSources({ academic, events })

    expect(academic).toEqual(academicBefore)
    expect(events).toEqual(eventsBefore)
    expect(ids(second)).toEqual(ids(first))
  })

  it('does not mutate the sources it is handed, even when nothing survives the limit', () => {
    const academic = [{ id: 'a1', title: 'One', kind: 'other', starts_at: key(2026, 9, 5) }]
    const order = [...academic].map((row) => row.id)
    mergeCalendarSources({ academic, events: [] }, { limit: 0 })
    expect(academic.map((row) => row.id)).toEqual(order)
  })
})

describe('mergeCalendarSources: timezone safety', () => {
  // The two places a day key is produced from a wall clock rather than a `date` column: a legacy free-text date and
  // a timestamptz read as an instant. Both go through the offset that this app is developed in, so the local day is
  // asserted rather than assumed.
  it('reads the local day of a timestamptz, not the UTC one', () => {
    // 23:30 local on the 5th is already the 6th in UTC, so a toISOString implementation would leak a day.
    const late = mergeCalendarSources({ events: [{ id: 'late', title: 'Late', starts_at: stamp(2026, 9, 5, 23, 30) }] })
    expect(late.items[0].startsAt).toBe(key(2026, 9, 5))
    const early = mergeCalendarSources({ events: [{ id: 'early', title: 'Early', starts_at: stamp(2026, 9, 5, 0, 30) }] })
    expect(early.items[0].startsAt).toBe(key(2026, 9, 5))
  })

  it('keeps a multi-day span on the same days after the same trip through toDayKey', () => {
    const { items } = mergeCalendarSources({
      academic: [{ id: 's', title: 'Span', kind: 'exams', starts_at: key(2027, 0, 28), ends_at: key(2027, 1, 3) }],
    })
    expect(items[0].startsAt).toBe(toDayKey(fromDayKey(items[0].startsAt)))
    expect(items[0].endsAt).toBe(toDayKey(fromDayKey(items[0].endsAt)))
  })
})