// Pasted academic calendar text in, reviewable rows and warnings out.
//
// The fixtures below are the source document itself, transcribed line for line from
// SENATE-PROPOSED-ACADEMIC-CALENDAR-2026-2027.pdf (University of Lagos), including its missing commas, its mixed
// dashes and its mangled U+FFFD en dashes. The whole point of this module is that an admin can paste those pages and
// see everything the senate printed, so nothing here is invented from the shape of a document the tests have not seen.
import { describe, it, expect } from 'vitest'
import { parseCalendarPaste } from './calendarPaste.js'

const FIRST_PAGE = [
  'Monday, October 5, 2026* Payment of Fees & Online Registration for All Returning Students',
  '',
  '*Monday, October 19, 2026 Resumption - 2026/2027 Session and Commencement of Lectures',
  '',
  'Friday, December 4, 2026     End of Registration of Courses for all Students',
  '',
  'To be determined Orientation Programme for Fresh Students',
  '(1 week)',
  '',
  'To be determined  Matriculation Ceremony',
  '',
  'Monday, December 7 - Sunday, December 20, 2026 Editing of Registered Courses',
  '(2 weeks)',
  '',
  'Monday, December 21, 2026 - Sunday, January 3, 2027 Christmas/New Year break',
  '(2 weeks)',
  '',
  'Monday, January 4, 2027 Resumption from Christmas/New Year Break',
  '',
  'Friday, January 15, 2027 Lectures end',
  '(13 Weeks)',
  '',
  'Monday, January 18 - Friday, January 22, 2027 Lecture free week/ GST Examinations',
  '',
  'Monday, January 25, 2027 - Friday, February 12, 2027 Undergraduate Examinations in all Faculties',
  '(3 weeks)',
  '',
  'Monday, February 15 \uFFFD Saturday February 20, 2027 Examinations in Core Courses in the Faculty of Education',
  '(1 week)',
  '',
  'Saturday February 20, 2027 End of First Semester/',
  'Opening of Second Semester 2026/2027 Registration Portal',
  '',
  'Monday, February 22 - 26, 2027 57th Convocation Ceremonies',
  '(1 week)',
  '',
  'Monday February 22 \uFFFD Saturday March 6, 2027   First Semester break',
  '(2 weeks)',
  '',
  'Monday, March 8, 2027     Resumption for Second Semester \uFFFD 2026/2027 Session',
  '',
  'Tuesday, March 23, 2027     Consideration of 1st Semester 2026/2027 Results by BCOS',
  '(4 weeks after examinations)',
  '',
  'Wednesday, March 31, 2027  Senate Meeting for the Consideration of 1st Semester 2026/2027',
  'Results',
  '',
].join('\n')

const SECOND_PAGE = [
  'Monday February 22, 2027*    Online Registration of Courses Commences',
  '',
  'March 8, 2027      Resumption/Commencement of Lectures',
  '',
  'Sunday, March 28, 2027     End of Registration of Courses',
  '(5 weeks)',
  '',
  'Monday, April 12 \uFFFD Sunday April 25, 2027   Editing of Registered Courses',
  '(2 weeks)',
  '',
  'Monday, April 5 \uFFFD Sunday May 2, 2027   Hall and Faculty Week',
  '(4 weeks) (Lectures Continue)',
  '',
  'Friday, June 4, 2027 Lectures End',
  '(13 weeks)',
  '',
  'Monday, June 7 - Friday, June 11, 2027 Lecture Free Week/ GST Examinations',
  '(1 week)',
  '',
  'Monday, June 14 \uFFFD Saturday July 3, 2027 Undergraduate Examinations in all Faculties',
  '(3 weeks)',
  '',
  'Monday, July 5 \uFFFD Saturday July 10, 2027 Examinations in Core Courses in the Faculty of Education',
  '(1 week)',
  '',
  'Saturday, July 10, 2027 End of Second Semester/Students depart',
  '',
  'Monday, July 12 - Saturday, August 7, 2027 DLI Residential Programme',
  '(4 weeks)',
  '',
  'Monday, September 13, 2027 Proposed Date of Resumption, 2027/2028 Session',
].join('\n')

const DOCUMENT = `${FIRST_PAGE}\n\n${SECOND_PAGE}`

// Every warning carries the raw line it came from, so the shape of a result is fixed here rather than repeated.
const titles = ({ rows }) => rows.map((row) => row.title)
const dates = ({ rows }) => rows.map((row) => [row.startsAt, row.endsAt])

describe('parseCalendarPaste — one shape at a time', () => {
  it('reads a single date with a trailing asterisk', () => {
    const { rows, warnings } = parseCalendarPaste('Monday, October 5, 2026* Payment of Fees & Online Registration for All Returning Students')
    expect(warnings).toEqual([])
    expect(rows).toEqual([{
      title: 'Payment of Fees & Online Registration for All Returning Students',
      startsAt: '2026-10-05',
      endsAt: null,
      note: null,
      semester: 1,
      session: '',
    }])
  })

  it('reads a leading asterisk before the weekday', () => {
    const { rows, warnings } = parseCalendarPaste('*Monday, October 19, 2026 Resumption - 2026/2027 Session and Commencement of Lectures')
    expect(warnings).toEqual([])
    expect(rows[0].startsAt).toBe('2026-10-19')
    // The dash inside the title is a dash, not a range: the second date would have to follow it.
    expect(rows[0].title).toBe('Resumption - 2026/2027 Session and Commencement of Lectures')
    expect(rows[0].endsAt).toBeNull()
  })

  it('reads a range with a weekday on both ends and lifts its parenthetical', () => {
    const { rows, warnings } = parseCalendarPaste('Monday, December 7 - Sunday, December 20, 2026 Editing of Registered Courses (2 weeks)')
    expect(warnings).toEqual([])
    expect(rows[0]).toMatchObject({ title: 'Editing of Registered Courses', startsAt: '2026-12-07', endsAt: '2026-12-20', note: '(2 weeks)' })
  })

  it('reads a range that crosses a year without swapping the ends', () => {
    const { rows, warnings } = parseCalendarPaste('Monday, December 21, 2026 - Sunday, January 3, 2027 Christmas/New Year break\n(2 weeks)')
    expect(warnings).toEqual([])
    expect(rows[0]).toMatchObject({ startsAt: '2026-12-21', endsAt: '2027-01-03', note: '(2 weeks)' })
  })

  it('reads a range with no comma after the weekday and an en dash', () => {
    const { rows, warnings } = parseCalendarPaste('Monday February 22 \u2013 Saturday March 6, 2027 First Semester break')
    expect(warnings).toEqual([])
    expect(rows[0]).toMatchObject({ startsAt: '2027-02-22', endsAt: '2027-03-06', title: 'First Semester break' })
  })

  it('treats a hyphen, an en dash and the mangled U+FFFD as the same separator', () => {
    const title = ' First Semester break'
    const results = ['-', '\u2013', '\uFFFD', '\u2014', '\u2212'].map((dash) =>
      parseCalendarPaste(`Monday February 22 ${dash} Saturday March 6, 2027${title}`),
    )
    for (const { rows, warnings } of results) {
      expect(warnings).toEqual([])
      expect(rows).toEqual([{
        title: 'First Semester break',
        startsAt: '2027-02-22',
        endsAt: '2027-03-06',
        note: null,
        semester: 1,
        session: '',
      }])
    }
  })

  it('reads a multi-space column separator as one boundary', () => {
    const { rows, warnings } = parseCalendarPaste('Friday, December 4, 2026     End of Registration of Courses for all Students')
    expect(warnings).toEqual([])
    expect(rows[0]).toMatchObject({ startsAt: '2026-12-04', title: 'End of Registration of Courses for all Students' })
  })

  it('lifts a trailing parenthetical into the note and strips it from the title', () => {
    const { rows } = parseCalendarPaste('Friday, January 15, 2027 Lectures end (13 Weeks)')
    expect(rows[0]).toMatchObject({ title: 'Lectures end', note: '(13 Weeks)' })
  })

  it('reads a date to be determined as an undated row', () => {
    const { rows, warnings } = parseCalendarPaste('To be determined Orientation Programme for Fresh Students\n(1 week)')
    expect(warnings).toEqual([])
    expect(rows).toEqual([{
      title: 'Orientation Programme for Fresh Students',
      startsAt: null,
      endsAt: null,
      note: '(1 week)',
      semester: 1,
      session: '',
    }])
  })

  it('reads a shortened end date against the start date’s month', () => {
    const { rows, warnings } = parseCalendarPaste('Monday, February 22 - 26, 2027 57th Convocation Ceremonies\n(1 week)')
    expect(warnings).toEqual([])
    expect(rows[0]).toMatchObject({ startsAt: '2027-02-22', endsAt: '2027-02-26', title: '57th Convocation Ceremonies', note: '(1 week)' })
  })

  it('reads a month and day with no weekday', () => {
    const { rows, warnings } = parseCalendarPaste('March 8, 2027      Resumption/Commencement of Lectures')
    expect(warnings).toEqual([])
    expect(rows[0]).toMatchObject({ startsAt: '2027-03-08', endsAt: null, title: 'Resumption / Commencement of Lectures' })
  })

  it('joins a title that runs onto the next line and tidies the slash', () => {
    const { rows, warnings } = parseCalendarPaste('Saturday February 20, 2027 End of First Semester/\nOpening of Second Semester 2026/2027 Registration Portal')
    expect(warnings).toEqual([])
    expect(rows[0]).toMatchObject({
      startsAt: '2027-02-20',
      // 'End of First Semester/' plus the next line, with the slash spaced and the year range left as written.
      title: 'End of First Semester / Opening of Second Semester 2026/2027 Registration Portal',
    })
  })

  it('keeps a year range in a title intact', () => {
    const { rows } = parseCalendarPaste('Wednesday, March 31, 2027  Senate Meeting for the Consideration of 1st Semester 2026/2027\nResults')
    expect(rows[0].title).toBe('Senate Meeting for the Consideration of 1st Semester 2026/2027 Results')
  })

  it('folds a double parenthetical into one note', () => {
    const { rows, warnings } = parseCalendarPaste('Monday, April 5 \uFFFD Sunday May 2, 2027   Hall and Faculty Week\n(4 weeks) (Lectures Continue)')
    expect(warnings).toEqual([])
    expect(rows[0]).toMatchObject({
      startsAt: '2027-04-05',
      endsAt: '2027-05-02',
      title: 'Hall and Faculty Week',
      note: '(4 weeks) (Lectures Continue)',
    })
  })

  it('accepts three-letter and lower-case month and weekday names', () => {
    const { rows, warnings } = parseCalendarPaste('mon, oct 5, 2026 Payment of Fees')
    expect(warnings).toEqual([])
    expect(rows[0]).toMatchObject({ startsAt: '2026-10-05', title: 'Payment of Fees' })
  })
})

describe('parseCalendarPaste — the whole senate document', () => {
  it('reads every line into a row and warns about nothing', () => {
    const { rows, warnings } = parseCalendarPaste(DOCUMENT)
    expect(warnings).toEqual([])
    expect(rows).toHaveLength(30)
  })

  it('reads the dates the design spec seeds as first-semester rows', () => {
    const { rows } = parseCalendarPaste(DOCUMENT, { session: '2026/2027', semester: 1 })
    // Rows stay in the order the document prints them, which is chronological per page rather than per row: the
    // 2027-02-22 second-semester registration opens page two and sits after the March first-semester entries.
    expect(dates({ rows: rows.slice(0, 18) })).toEqual([
      ['2026-10-05', null],
      ['2026-10-19', null],
      ['2026-12-04', null],
      [null, null],
      [null, null],
      ['2026-12-07', '2026-12-20'],
      ['2026-12-21', '2027-01-03'],
      ['2027-01-04', null],
      ['2027-01-15', null],
      ['2027-01-18', '2027-01-22'],
      ['2027-01-25', '2027-02-12'],
      ['2027-02-15', '2027-02-20'],
      ['2027-02-20', null],
      ['2027-02-22', '2027-02-26'],
      ['2027-02-22', '2027-03-06'],
      ['2027-03-08', null],
      ['2027-03-23', null],
      ['2027-03-31', null],
    ])
  })

  it('reads the undated rows and the ones the spec leaves out of the seed', () => {
    const { rows } = parseCalendarPaste(DOCUMENT)
    // Both 'To be determined' rows are present, plus the four the seed deliberately drops: the BCOS and Senate
    // rows (staff-only) and the DLI programme (out of scope). Dropping them is the admin's job, not the parser's.
    expect(rows.filter((row) => row.startsAt === null).map((row) => row.title)).toEqual([
      'Orientation Programme for Fresh Students',
      'Matriculation Ceremony',
    ])
    expect(titles({ rows })).toEqual([
      'Payment of Fees & Online Registration for All Returning Students',
      'Resumption - 2026/2027 Session and Commencement of Lectures',
      'End of Registration of Courses for all Students',
      'Orientation Programme for Fresh Students',
      'Matriculation Ceremony',
      'Editing of Registered Courses',
      'Christmas / New Year break',
      'Resumption from Christmas / New Year Break',
      'Lectures end',
      'Lecture free week / GST Examinations',
      'Undergraduate Examinations in all Faculties',
      'Examinations in Core Courses in the Faculty of Education',
      'End of First Semester / Opening of Second Semester 2026/2027 Registration Portal',
      '57th Convocation Ceremonies',
      'First Semester break',
      'Resumption for Second Semester - 2026/2027 Session',
      'Consideration of 1st Semester 2026/2027 Results by BCOS',
      'Senate Meeting for the Consideration of 1st Semester 2026/2027 Results',
      'Online Registration of Courses Commences',
      'Resumption / Commencement of Lectures',
      'End of Registration of Courses',
      'Editing of Registered Courses',
      'Hall and Faculty Week',
      'Lectures End',
      'Lecture Free Week / GST Examinations',
      'Undergraduate Examinations in all Faculties',
      'Examinations in Core Courses in the Faculty of Education',
      'End of Second Semester / Students depart',
      'DLI Residential Programme',
      'Proposed Date of Resumption, 2027/2028 Session',
    ])
  })

  it('reads the second-semester dates', () => {
    const { rows } = parseCalendarPaste(DOCUMENT, { semester: 2 })
    expect(dates({ rows: rows.slice(18) })).toEqual([
      ['2027-02-22', null],
      ['2027-03-08', null],
      ['2027-03-28', null],
      // The page prints the Editing row before the Hall and Faculty Week row even though the latter starts earlier.
      ['2027-04-12', '2027-04-25'],
      ['2027-04-05', '2027-05-02'],
      ['2027-06-04', null],
      ['2027-06-07', '2027-06-11'],
      ['2027-06-14', '2027-07-03'],
      ['2027-07-05', '2027-07-10'],
      ['2027-07-10', null],
      ['2027-07-12', '2027-08-07'],
      ['2027-09-13', null],
    ])
  })

  it('lifts every duration note in the document', () => {
    const { rows } = parseCalendarPaste(DOCUMENT)
    expect(rows.filter((row) => row.note).map((row) => row.note)).toEqual([
      '(1 week)',
      '(2 weeks)',
      '(2 weeks)',
      '(13 Weeks)',
      '(3 weeks)',
      '(1 week)',
      '(1 week)',
      '(2 weeks)',
      '(4 weeks after examinations)',
      '(5 weeks)',
      '(2 weeks)',
      '(4 weeks) (Lectures Continue)',
      '(13 weeks)',
      '(1 week)',
      '(3 weeks)',
      '(1 week)',
      '(4 weeks)',
    ])
  })
})

describe('parseCalendarPaste — a line it cannot read becomes a warning', () => {
  // The reverse test: corrupt exactly one date in the real document and check that exactly one thing is reported,
  // at the right line, and that nothing else moved. A parser that quietly dropped the line would still return 30
  // rows, just with one of them gone and no way for the admin to know which.
  it('reports one warning for one corrupted date and drops nothing else', () => {
    const corrupted = DOCUMENT.replace('October 5, 2026', 'Octember 5, 2026')
    expect(corrupted).not.toBe(DOCUMENT)
    const { rows, warnings } = parseCalendarPaste(corrupted)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toEqual({
      line: 1,
      text: 'Monday, Octember 5, 2026* Payment of Fees & Online Registration for All Returning Students',
      reason: 'the date could not be parsed',
    })
    // 29 rows, not 30: the corrupted line became a warning rather than a row, and every other line still parsed.
    expect(rows).toHaveLength(29)
    expect(titles({ rows })[0]).toBe('Resumption - 2026/2027 Session and Commencement of Lectures')
    expect(dates({ rows })[0]).toEqual(['2026-10-19', null])
    expect(titles({ rows })).toEqual(titles(parseCalendarPaste(DOCUMENT)).slice(1))
  })

  it('reports a corrupted date anywhere in the document without losing the lines around it', () => {
    const lines = DOCUMENT.split('\n')
    const at = lines.findIndex((line) => line.includes('Sunday, March 28, 2027'))
    lines[at] = lines[at].replace('March 28', 'Mxrch 28')
    const { rows, warnings } = parseCalendarPaste(lines.join('\n'))

    expect(warnings).toHaveLength(1)
    expect(warnings[0].line).toBe(at + 1)
    expect(warnings[0].text).toBe(lines[at])
    expect(warnings[0].reason).toBe('the date could not be parsed')
    expect(rows).toHaveLength(29)
    expect(rows.filter((row) => row.title === 'Editing of Registered Courses' && row.startsAt === '2027-04-12')).toHaveLength(1)
  })

  it('warns about a reversed range instead of quietly swapping its ends', () => {
    const { rows, warnings } = parseCalendarPaste('Monday, March 20, 2027 - Friday, March 10, 2027 Lecture Free Week')
    expect(rows).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({ line: 1, reason: 'the range ends before it starts' })
  })

  it('warns about garbage rather than throwing', () => {
    const { rows, warnings } = parseCalendarPaste('asdfghjkl')
    expect(rows).toEqual([])
    expect(warnings).toEqual([{ line: 1, text: 'asdfghjkl', reason: 'no date found' }])
  })

  it('warns about a date with no title and a footnote with nothing above it', () => {
    const untitled = parseCalendarPaste('Monday, October 5, 2026*')
    expect(untitled.rows).toEqual([])
    expect(untitled.warnings[0]).toMatchObject({ line: 1, reason: 'no title after the date' })

    const orphan = parseCalendarPaste('(2 weeks)')
    expect(orphan.rows).toEqual([])
    expect(orphan.warnings[0]).toMatchObject({ line: 1, reason: 'a footnote with no entry above it' })
  })

  it('warns about a date with no year, rather than guessing one', () => {
    const { rows, warnings } = parseCalendarPaste('Monday, October 5 Lectures commence')
    expect(rows).toEqual([])
    expect(warnings[0]).toMatchObject({ line: 1, reason: 'the date has no year' })
  })

  it('warns about a day that does not exist', () => {
    const { rows, warnings } = parseCalendarPaste('Monday, February 30, 2027 Lectures end')
    expect(rows).toEqual([])
    expect(warnings[0]).toMatchObject({ line: 1, reason: 'not a real calendar date' })
  })

  it('warns about a range with no readable end', () => {
    const { rows, warnings } = parseCalendarPaste('Monday, October 5, 2026 - Lectures begin')
    expect(rows).toEqual([])
    expect(warnings[0]).toMatchObject({ line: 1, reason: 'the range has no end date I can read' })
  })

  it('keeps the raw line in the warning, spaces and all', () => {
    const { warnings } = parseCalendarPaste('Monday, Octember 5, 2026   Payment   of   Fees   ')
    expect(warnings[0].text).toBe('Monday, Octember 5, 2026   Payment   of   Fees')
  })

  it('numbers warnings against the original lines, blank ones included', () => {
    const { warnings } = parseCalendarPaste('\n\nasdfghjkl\n\nMonday, Octember 5, 2026 Payment of Fees')
    expect(warnings.map((warning) => warning.line)).toEqual([3, 5])
  })
})

describe('parseCalendarPaste — input it must survive', () => {
  it('returns empty results for nothing at all', () => {
    for (const input of ['', '   ', '\n\n', null, undefined, 0, {}, [], {}]) {
      expect(parseCalendarPaste(input)).toEqual({ rows: [], warnings: [] })
    }
  })

  it('ignores page furniture and section headers', () => {
    const { rows, warnings } = parseCalendarPaste('UNIVERSITY OF LAGOS\nPlease Turn Over\nSTATUTORY PROGRAMMES\nMonday, October 5, 2026* Payment of Fees\nPage 2 of 4')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ startsAt: '2026-10-05', title: 'Payment of Fees' })
    expect(warnings).toEqual([])
  })

  it('returns no rows and no warnings for page furniture on its own', () => {
    expect(parseCalendarPaste('Please Turn Over\nUNIVERSITY OF LAGOS\nSTATUTORY PROGRAMMES')).toEqual({ rows: [], warnings: [] })
  })

  it('does not mutate the text it is given', () => {
    const original = FIRST_PAGE
    const before = original
    parseCalendarPaste(original, { session: '2026/2027', semester: 1 })
    expect(original).toBe(before)
    expect(parseCalendarPaste(original)).toEqual(parseCalendarPaste(original))
  })

  it('does not mutate a row it built earlier when the next line folds into it', () => {
    const first = parseCalendarPaste('Saturday February 20, 2027 End of First Semester/')
    const before = first.rows[0]
    const second = parseCalendarPaste('Saturday February 20, 2027 End of First Semester/\nOpening of Second Semester Registration Portal')
    expect(before.title).toBe('End of First Semester /')
    expect(second.rows[0].title).toBe('End of First Semester / Opening of Second Semester Registration Portal')
  })

  it('reads carriage returns and tabs as whitespace', () => {
    const { rows, warnings } = parseCalendarPaste('Monday, October 5, 2026*\tPayment of Fees\r\nMonday, October 19, 2026\tResumption')
    expect(warnings).toEqual([])
    expect(dates({ rows })).toEqual([['2026-10-05', null], ['2026-10-19', null]])
  })

  it('carries session and semester onto every row', () => {
    const { rows } = parseCalendarPaste(DOCUMENT, { session: '2026/2027', semester: 2 })
    expect(rows).toHaveLength(30)
    for (const row of rows) {
      expect(row.session).toBe('2026/2027')
      expect(row.semester).toBe(2)
    }
    expect(parseCalendarPaste(DOCUMENT).rows.every((row) => row.session === '' && row.semester === 1)).toBe(true)
  })

  it('never decides a kind, because the admin does that in the review screen', () => {
    const { rows } = parseCalendarPaste(DOCUMENT)
    expect(rows.every((row) => !('kind' in row))).toBe(true)
  })
})