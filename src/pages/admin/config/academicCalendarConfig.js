import { KIND_ORDER } from '../../../../api/_lib/calendarTheme.js'

// Field config for `academic_calendar`, consumed unchanged by AdminResourceManager
// (src/components/admin/AdminResourceManager.jsx) exactly like eventsAdminConfig.js.
//
// Only field types adminFields.js already carries are used here. `starts_at`/`ends_at` are `date`, which is
// not one of the six named branches in buildFormState/buildPayload but rides the final `else` in both --
// the same branch `time` and `url` use in timetablesAdminConfig.js:22-23 and outlinesAdminConfig.js:24,28.
// It is the right type rather than `text` because FormField hands `type` straight to the <input>
// (src/components/ui/FormField.jsx:43-51), so the browser renders a date picker that emits `YYYY-MM-DD`,
// which is exactly the wire format of a Postgres `date` column. A text box would have asked the admin to
// type that format by hand for 26 rows.
//
// The session's rows are read through `active_session` (calendar_settings), never filtered out, so this
// list deliberately shows every session: archiving a session must not hide its dates from the admin who
// may still need to correct them.
export const academicCalendarConfig = {
  title: 'Calendar Dates',
  idField: 'title',
  // Matches eventsAdminConfig.js:4. academic_calendar's insert/update policies are owner-only
  // (20261009090000_calendar.sql:111-114), so a non-owner admin's create and edit become a queued change
  // request instead of a write. Delete is not reviewable -- see AdminCalendar.jsx.
  reviewGated: true,
  groupField: 'semester',
  groupLabel: 'Semester',
  listColumns: [
    { field: 'starts_at', label: 'Starts' },
    { field: 'ends_at', label: 'Ends' },
    { field: 'title', label: 'Title' },
    { field: 'kind', label: 'Kind' },
    { field: 'session', label: 'Session' },
    // Blank means "no reminder": NULL is not 0, and the reminder worker skips NULL rows
    // (spec §9), so the two states must stay distinguishable in what the admin can see.
    { field: 'remind_days', label: 'Remind (days)' },
  ],
  fields: [
    // First field and the trailing note take the full panel width; the pairs between them are laid out
    // two-up by AdminResourceForm's groupFields, so the two dates end up side by side.
    { field: 'title', label: 'Title', type: 'text' },
    // The seven kinds are the table's own CHECK constraint (20261009090000_calendar.sql:20-21), read from
    // the shared module rather than retyped, so this dropdown cannot drift from what the public calendar
    // knows how to colour.
    { field: 'kind', label: 'Kind', type: 'select', options: KIND_ORDER },
    { field: 'session', label: 'Session', type: 'text' },
    // A select rather than a number on purpose: semester is `check (semester in (1, 2))`, so a number box
    // could only ever offer the admin a way to fail with a raw Postgres error. The option values are
    // strings because FormField renders `<option value={o}>` from the same array
    // (src/components/ui/FormField.jsx:26-31); PostgREST coerces them on the way into the int column.
    { field: 'semester', label: 'Semester', type: 'select', options: ['1', '2'] },
    // Empty stays NULL rather than 0: adminFields.js:53 sends null for an empty number, and a 0-day lead
    // time is a different thing from "never remind me" (the worker skips NULL, not 0).
    { field: 'remind_days', label: 'Remind (days before)', type: 'number', optional: true },
    // Both nullable by design: an undated row (the senate prints "To be determined" for Orientation and
    // Matriculation) shows in the TBA panel and is never given a day cell, so forcing a date would
    // corrupt it (spec §3.1).
    { field: 'starts_at', label: 'Starts', type: 'date', optional: true },
    { field: 'ends_at', label: 'Ends', type: 'date', optional: true },
    { field: 'note', label: 'Note', type: 'text', optional: true },
  ],
}
