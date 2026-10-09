// The tab list is data, not JSX, so the shell can render it, the tests can assert
// it, and a typo in a query string resolves the same way everywhere. Kept pure and
// react-router-free: this file decides WHICH tab, the component decides where to put it.
export const CALENDAR_TABS = [
  {
    id: 'dates',
    label: 'Dates',
    description: 'Add, edit and remove the senate’s lecture, exam and registration dates.',
  },
  {
    id: 'paste',
    label: 'Paste',
    description:
      'Paste the plain text of a published calendar. Every unreadable line is listed with its number and its text, and nothing is saved until you press the button at the bottom.',
  },
  {
    id: 'design',
    label: 'Design',
    description:
      'Choose the colours, icons, grid and defaults of the public calendar. Save the result as a named design and make it the one /calendar uses.',
  },
  {
    id: 'session',
    label: 'Session',
    description:
      'The public calendar shows one session at a time. Change which one, and the previous session’s dates come off the public page.',
  },
]

export const DEFAULT_CALENDAR_TAB = 'dates'

export function normalizeCalendarTab(value) {
  // The tab arrives from the URL, so anything at all can turn up in it — a stale link
  // after a tab is renamed, a hand-typed ?tab=, a search engine's guess. Falling back
  // to Dates keeps those on a working screen instead of an empty one. The comparison is
  // exact: a case-insensitive match would quietly accept ?tab=Dates and then fail to
  // highlight any tab, which is worse than landing on the default.
  return CALENDAR_TABS.some((tab) => tab.id === value) ? value : DEFAULT_CALENDAR_TAB
}
