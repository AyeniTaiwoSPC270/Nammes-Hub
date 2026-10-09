import { fromDayKey } from '../../../api/_lib/calendarDates.js'

// Date formatting shared by the calendar components.
//
// One set of Intl formatters rather than one per component, for two reasons. They are not cheap to build
// and the grid re-renders on every arrow key, and more importantly `Intl` output is user-facing copy:
// "5 Oct" and "Oct 5" must not disagree between the grid, the agenda and the day sheet.
//
// Everything formats a *local* Date built by `fromDayKey`, never `new Date('2026-10-05')`. A day key has
// no timezone, so asking Intl to parse one means asking for UTC midnight, which is the previous day
// anywhere west of Greenwich (calendarDates.js:13).
const MONTH_YEAR = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
const MONTH_YEAR_SHORT = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' })
const WEEKDAY_LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long' })
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const DAY_MONTH_LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

// Read off `getDay()` rather than a lookup table indexed by the theme's week start: the grid can hide the
// weekend, and slicing a fixed Mon-first list down to five would leave "Sun" sitting over a Monday.
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function monthLabel(date) {
  return MONTH_YEAR.format(date)
}

export function monthKeyLabel(key) {
  return MONTH_YEAR_SHORT.format(fromDayKey(`${key}-01`))
}

export function dayMonthLabel(key) {
  return DAY_MONTH.format(fromDayKey(key))
}

export function fullDayLabel(key) {
  return DAY_MONTH_LONG.format(fromDayKey(key))
}

export function weekdayLongLabel(key) {
  return WEEKDAY_LONG.format(fromDayKey(key))
}

export function weekdayLongName(date) {
  return WEEKDAY_LONG.format(date)
}

export function weekdayShortName(date) {
  return WEEKDAY_SHORT[date.getDay()]
}