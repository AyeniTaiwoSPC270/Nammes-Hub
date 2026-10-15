// The tab list for the two admin pages that host the Events and News Design Studio. Data, not JSX, so the
// shell can render it and the tests can assert it without a router.
//
// Kept pure and react-router-free: this file decides WHICH tab, the component decides where to put it.
// That is the rule adminCalendarTabs.js:1-3 sets out, and this is the second consumer of it.
//
// One module serves both pages because the two tabs are identical and the page name is the only thing
// that differs -- a second list would be two places for a label to drift.
import { PAGES } from '../../api/_lib/contentTheme.js'

export const CONTENT_TABS = [
  {
    id: 'content',
    label: 'Content',
    description: 'Add, edit and remove the rows on this page. This is the screen you land on.',
  },
  {
    id: 'design',
    label: 'Design',
    description:
      'Choose the accent, the cards and the layout of this page. Save the result as a named design, then make it the one visitors see.',
  },
]

export const DEFAULT_CONTENT_TAB = 'content'

export function normalizeContentTab(value) {
  // The tab arrives from the URL, so anything at all can turn up in it -- a stale link after a tab is
  // renamed, a hand-typed ?tab=, a search engine's guess. Falling back to Content keeps those on a working
  // screen instead of an empty one. The comparison is exact, for the reason adminCalendarTabs.js:33-37
  // gives: a case-insensitive match would accept ?tab=Design and then fail to highlight any tab.
  return CONTENT_TABS.some((tab) => tab.id === value) ? value : DEFAULT_CONTENT_TAB
}

/**
 * The panel ids for a page, so `role="tabpanel"` and `aria-controls` agree between the tab strip and the
 * body on both routes. Without the page in the key, /admin/events and /admin/news would render identical
 * DOM ids for different screens.
 */
export function contentTabIds(page) {
  const safe = PAGES.includes(page) ? page : 'content'
  return { tablist: `${safe}-tablist`, panel: `${safe}-tabpanel` }
}