# News and Opportunities pages

Date: 2026-07-26

## Problem

`News`, `NewsDetail`, and `Opportunities` still render `PagePlaceholder` — per project convention, full layouts weren't invented ahead of a design handoff. No handoff exists for these yet, but the placeholder copy already states clear intent (`News`: "posted jointly with the PRO... reverse-chronological, blog-style"; `Opportunities`: "manually curated... soonest deadline first"), and Home's news teaser already implements most of the visual pattern News needs (featured Card + grid of Cards, category eyebrows, illustration images). Building these now reuses that existing pattern rather than waiting on a handoff that would likely specify the same thing.

## Decision

Build `News` + `NewsDetail` (reusing Home's Card-grid pattern, extended into a full reverse-chronological, category-filterable list) and `Opportunities` (a deadline-sorted `Table`, list-only with external apply links). Both follow the existing per-page sample-data convention (`outlines.js`, `resources.js`): plain JS data modules today, swapped for Supabase once Admin CRUD is scoped for these domains.

## Scope

| Page | Treatment | Files touched |
|---|---|---|
| News | Full reverse-chronological list of all posts, category filter pills (`All` + the 6 existing categories), same featured-Card + grid-of-Cards visual pattern as Home's teaser | `src/pages/News.jsx`, `src/data/news.js` (new) |
| NewsDetail | Full post view: breadcrumb, category eyebrow, title, byline, date, body, badge if present | `src/pages/NewsDetail.jsx` |
| Home | Teaser trimmed to "latest 4" (1 featured + 3 grid) sourced from the same `news.js`, instead of 7 hardcoded items | `src/pages/Home.jsx` |
| Opportunities | `Table` of Deadline / Type / Title & Org / Apply, sorted soonest-deadline-first, external links | `src/pages/Opportunities.jsx`, `src/data/opportunities.js` (new) |

Out of scope: an `/opportunities/:id` detail page (list + external link is sufficient — these exist to route students to the actual application, not to host a second copy of the description), category filtering on Opportunities (not requested — deadline order is the whole point of that page), Admin CRUD for either domain (still future, once scoped), pagination (per `DESIGN_SYSTEM.md`'s existing accessibility note, revisit once real content exceeds ~50 rows), rich text/markdown in news bodies (plain text only for v1).

## Data layer

**`src/data/news.js`**
```js
export const NEWS_CATEGORIES = ['Academics', 'Governance', 'Welfare', 'Industry', 'Call for papers', 'Resources']

// array of { id, category, date, title, body, author, badge? }, newest first
export const news = [ /* seeded from the 7 items currently hardcoded in Home.jsx */ ]

export function getNews() { return news }
export function getNewsById(id) { return news.find((n) => n.id === id) }
export function filterNewsByCategory(list, category) {
  return category && category !== 'All' ? list.filter((n) => n.category === category) : list
}
```
`badge` is optional (`'new' | 'updated'`, matching `Badge`'s existing tones); most items won't have one.

**`src/data/opportunities.js`**
```js
// array of { id, type, title, org, deadline, link }, type is 'Scholarship' | 'Internship'
export const opportunities = [ /* sample data */ ]

export function getOpportunities() {
  return [...opportunities].sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
}
```

## Components & routing

- **`Home.jsx`**: replace the 7 hardcoded news items with `getNews().slice(0, 4)` — first item stays the featured green `Card`, next 3 form the grid. Existing `categoryImage()` mapping (from the illustrations work) is unchanged.
- **`News.jsx`**: filter pill row above the list — `All` plus `NEWS_CATEGORIES`, styled like the Navbar's active-link pill (green-100 bg / green-700 text when active, transparent otherwise). Selected category is read/written via `useSearchParams` as `?category=`. Filtered list uses the same featured-first-then-grid pattern as Home (first match in the filtered set is the featured Card). Each `Card` is wrapped in `<Link to={`/news/${id}`} className="block">` — no change needed to the `Card` component itself.
- **`NewsDetail.jsx`**: `Breadcrumbs` (`News` → post title, matching the `OutlineDetail`/`ResourceList` sub-page pattern), category eyebrow, `h1` title, byline ("Posted by `{author}`"), date, full body text, `Badge` if `badge` is set.
- **`Opportunities.jsx`**: `Table` with columns `Deadline / Type / Title & Org / Apply`, rows from `getOpportunities()` (pre-sorted). Apply column renders an external link styled identically to `ResourceList`'s "Open" link (`target="_blank" rel="noopener noreferrer"`).

## Error handling

- `NewsDetail`: unknown `:id` → `<Navigate to="/news" replace />`, the same pattern `ResourceList`/`OutlineDetail` use for invalid route params.
- `News`: an unrecognized `?category=` value is treated as "All" (silently ignored) — it's query state, not a route param, so no redirect.
- `Opportunities`: empty list renders "No opportunities posted yet." — matching `ResourceList`'s existing empty-state copy pattern.

## Testing

The only non-presentational logic is filtering and sorting, kept as pure exported functions so they get direct Vitest coverage, consistent with how this project already tests pure data functions (CGPA grading math, trend-chart coordinate math) rather than testing through rendered components:
- `filterNewsByCategory` — filters correctly by category, returns full list for `undefined`/`'All'`.
- `getOpportunities` — returns items sorted ascending by deadline.

Everything else (page layout, filter pill rendering, Card/Table usage) is presentational and verified by inspection, same as the illustration work.
