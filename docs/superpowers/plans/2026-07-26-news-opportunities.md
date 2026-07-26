# News and Opportunities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `News`, `NewsDetail`, `Opportunities` placeholder pages with real layouts — a category-filterable reverse-chronological News list, a full post detail view, and a deadline-sorted Opportunities table — and trim Home's news teaser to source from the same data instead of duplicating it.

**Architecture:** Two new plain-JS sample-data modules (`src/data/news.js`, `src/data/opportunities.js`) following the existing `outlines.js`/`resources.js` convention, each exporting pure helper functions covered by Vitest. Pages consume those helpers and the existing `Card`/`Table`/`Badge`/`Breadcrumbs` components — no new UI components needed.

**Tech Stack:** React 19, react-router-dom 7 (`useParams`, `useSearchParams`, `Navigate`, `Link`), Vitest, Tailwind v4 (via existing design tokens).

## Global Constraints

- Data lives in plain JS modules under `src/data/`, not Supabase — matches `outlines.js`/`resources.js`; swap for Supabase only once Admin CRUD is scoped for these domains (per spec).
- No `/opportunities/:id` detail route — list-only with external `Apply` links (per spec, explicitly out of scope).
- No category filter on Opportunities — deadline order is the page's whole purpose (per spec, explicitly out of scope).
- No pagination — matches `DESIGN_SYSTEM.md`'s existing "revisit once real content exceeds ~50 rows" note.
- News post bodies are plain text only, no rich text/markdown (per spec).
- All decorative category images use `alt=""` + `aria-hidden="true"` — already enforced inside `Card`'s `image` prop, nothing extra to do per-page.
- `Badge` is word-only, no icons/emoji — already enforced by the existing `Badge` component.
- Empty-state copy follows the existing `ResourceList.jsx` pattern: a plain `<p className="text-ink-muted">` sentence, not a fancier empty-state component.

---

### Task 1: News data module

**Files:**
- Create: `src/data/news.js`
- Test: `src/data/news.test.js`

**Interfaces:**
- Produces: `NEWS_CATEGORIES: string[]`, `getNews(): NewsItem[]`, `getNewsById(id: string): NewsItem | undefined`, `filterNewsByCategory(list: NewsItem[], category: string | undefined): NewsItem[]`
- `NewsItem` shape: `{ id, category, tone, date, title, body, author, badge? }` where `tone` is `'neutral' | 'green' | 'orange'` (matches `Card`'s `tone` prop) and `badge` is `{ tone: 'new' | 'updated', label: string } | undefined`.
- `filterNewsByCategory` treats `undefined`, `'All'`, or any value not in `NEWS_CATEGORIES` as "no filter" — returns the full list unchanged in all three cases (this is what makes an unrecognized `?category=` value safely fall back to "All" at the page level).

- [ ] **Step 1: Write the failing tests**

Create `src/data/news.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { news, getNewsById, filterNewsByCategory } from './news'

describe('getNewsById', () => {
  it('finds a news item by id', () => {
    const item = getNewsById('dangote-site-visit')
    expect(item.title).toBe('Site Visit to Dangote Cement Slated for August')
  })

  it('returns undefined for an unknown id', () => {
    expect(getNewsById('does-not-exist')).toBeUndefined()
  })
})

describe('filterNewsByCategory', () => {
  it('filters the list down to a single category', () => {
    const result = filterNewsByCategory(news, 'Welfare')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('textbook-donation-drive')
  })

  it('returns the full list for "All"', () => {
    expect(filterNewsByCategory(news, 'All')).toEqual(news)
  })

  it('returns the full list when no category is given', () => {
    expect(filterNewsByCategory(news, undefined)).toEqual(news)
  })

  it('returns the full list for an unrecognized category instead of an empty result', () => {
    expect(filterNewsByCategory(news, 'Bogus')).toEqual(news)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/data/news.test.js`
Expected: FAIL — `Cannot find module './news'` (the file doesn't exist yet).

- [ ] **Step 3: Write the data module**

Create `src/data/news.js`:

```js
// Sample/placeholder news data. Swap for real Supabase-backed content once
// news posts are scoped for the Admin CRUD flow.

export const NEWS_CATEGORIES = ['Academics', 'Governance', 'Welfare', 'Industry', 'Call for papers', 'Resources']

export const news = [
  {
    id: 'exam-timetable-2025-2026-s2',
    category: 'Academics',
    tone: 'green',
    date: 'Jul 20, 2026',
    title: '2025/2026 Second Semester Exam Timetable Released',
    body:
      "Second semester exams begin Aug 4. Check the pinned drive folder for your level's full schedule and venue allocations.",
    author: 'NAMMES PRO Office',
    badge: { tone: 'new', label: 'New' },
  },
  {
    id: 'general-assembly-elections-notice',
    category: 'Governance',
    tone: 'neutral',
    date: 'Jul 15, 2026',
    title: 'NAMMES General Assembly & Elections Notice',
    body: 'All levels required to attend. New Exco nominations open at the assembly.',
    author: 'NAMMES PRO Office',
  },
  {
    id: 'seminar-series-resumes',
    category: 'Academics',
    tone: 'neutral',
    date: 'Jul 10, 2026',
    title: 'Departmental Seminar Series Resumes',
    body: 'Weekly seminars on corrosion engineering and welding metallurgy start this Thursday, 2 PM.',
    author: 'NAMMES PRO Office',
  },
  {
    id: 'materials-science-symposium',
    category: 'Call for papers',
    tone: 'orange',
    date: 'Jul 05, 2026',
    title: 'Materials Science Undergraduate Symposium',
    body: 'Submit abstracts by Jul 30.',
    author: 'NAMMES PRO Office',
    badge: { tone: 'updated', label: 'Updated' },
  },
  {
    id: 'resource-drive-400l-update',
    category: 'Resources',
    tone: 'neutral',
    date: 'Jun 28, 2026',
    title: '400 Level Drive Folder Updated',
    body: 'Design project templates and past FYP reports added to the shared drive.',
    author: 'NAMMES PRO Office',
  },
  {
    id: 'textbook-donation-drive',
    category: 'Welfare',
    tone: 'neutral',
    date: 'Jun 20, 2026',
    title: 'Textbook Donation Drive',
    body: 'Drop off or request departmental textbooks at the NAMMES office, Rm 214.',
    author: 'NAMMES PRO Office',
  },
  {
    id: 'dangote-site-visit',
    category: 'Industry',
    tone: 'green',
    date: 'Jun 12, 2026',
    title: 'Site Visit to Dangote Cement Slated for August',
    body: 'Interest form for 300/400 level students closes Jul 31.',
    author: 'NAMMES PRO Office',
  },
]

export function getNews() {
  return news
}

export function getNewsById(id) {
  return news.find((n) => n.id === id)
}

export function filterNewsByCategory(list, category) {
  if (!category || category === 'All' || !NEWS_CATEGORIES.includes(category)) return list
  return list.filter((n) => n.category === category)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/data/news.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/news.js src/data/news.test.js
git commit -m "feat: add news data module with category filtering"
```

---

### Task 2: Opportunities data module

**Files:**
- Create: `src/data/opportunities.js`
- Test: `src/data/opportunities.test.js`

**Interfaces:**
- Produces: `getOpportunities(): Opportunity[]`, sorted ascending by `deadline` (soonest first), without mutating the underlying `opportunities` array.
- `Opportunity` shape: `{ id, type, title, org, deadline, link }` where `type` is `'Scholarship' | 'Internship'` and `deadline` is a `Date`-parseable string like `'Aug 15, 2026'`.

- [ ] **Step 1: Write the failing tests**

Create `src/data/opportunities.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { opportunities, getOpportunities } from './opportunities'

describe('getOpportunities', () => {
  it('sorts opportunities by soonest deadline first', () => {
    const result = getOpportunities()
    const deadlines = result.map((o) => new Date(o.deadline).getTime())
    for (let i = 1; i < deadlines.length; i++) {
      expect(deadlines[i]).toBeGreaterThanOrEqual(deadlines[i - 1])
    }
    expect(result[0].id).toBe('nlng-siwes-internship')
  })

  it('does not mutate the original opportunities array', () => {
    const before = opportunities.map((o) => o.id)
    getOpportunities()
    expect(opportunities.map((o) => o.id)).toEqual(before)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/data/opportunities.test.js`
Expected: FAIL — `Cannot find module './opportunities'` (the file doesn't exist yet).

- [ ] **Step 3: Write the data module**

Create `src/data/opportunities.js`:

```js
// Sample/placeholder opportunities data. Swap for real Supabase-backed
// content once opportunities are scoped for the Admin CRUD flow.

export const opportunities = [
  {
    id: 'mtn-foundation-scholarship',
    type: 'Scholarship',
    title: 'MTN Foundation STEM Scholarship',
    org: 'MTN Foundation',
    deadline: 'Sep 30, 2026',
    link: 'https://example.com/opportunities/mtn-foundation-scholarship',
  },
  {
    id: 'dangote-industrial-internship',
    type: 'Internship',
    title: 'Dangote Cement Industrial Internship',
    org: 'Dangote Cement Plc',
    deadline: 'Aug 15, 2026',
    link: 'https://example.com/opportunities/dangote-industrial-internship',
  },
  {
    id: 'petan-undergraduate-scholarship',
    type: 'Scholarship',
    title: 'PETAN Undergraduate Scholarship',
    org: 'Petroleum Technology Association of Nigeria',
    deadline: 'Oct 20, 2026',
    link: 'https://example.com/opportunities/petan-undergraduate-scholarship',
  },
  {
    id: 'nlng-siwes-internship',
    type: 'Internship',
    title: 'NLNG SIWES Placement',
    org: 'Nigeria LNG Limited',
    deadline: 'Jul 31, 2026',
    link: 'https://example.com/opportunities/nlng-siwes-internship',
  },
]

export function getOpportunities() {
  return [...opportunities].sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/data/opportunities.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/opportunities.js src/data/opportunities.test.js
git commit -m "feat: add opportunities data module sorted by deadline"
```

---

### Task 3: Shared `categoryImage` helper + Home teaser trimmed to the news data module

**Files:**
- Modify: `src/lib/illustrations.js` (add exported helper at end of file)
- Modify: `src/pages/Home.jsx:1-10` (imports + local `categoryImage`), `src/pages/Home.jsx:78-102` (news Card block)

**Interfaces:**
- Consumes: `getNews()` from Task 1 (`src/data/news.js`), existing `CATEGORY_ICONS` from `src/lib/illustrations.js`.
- Produces: `categoryImage(category: string): { src: string } | undefined`, exported from `src/lib/illustrations.js` — used by both `Home.jsx` (this task) and `News.jsx` (Task 4).

- [ ] **Step 1: Move `categoryImage` into the shared illustrations module**

Add to the end of `src/lib/illustrations.js`:

```js
export function categoryImage(category) {
  const src = CATEGORY_ICONS[category]
  return src ? { src } : undefined
}
```

- [ ] **Step 2: Update Home.jsx's imports**

In `src/pages/Home.jsx`, replace lines 1–10:

```jsx
import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { HERO_ILLUSTRATION, CATEGORY_ICONS } from '../lib/illustrations'

function categoryImage(category) {
  const src = CATEGORY_ICONS[category]
  return src ? { src } : undefined
}
```

with:

```jsx
import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { HERO_ILLUSTRATION, categoryImage } from '../lib/illustrations'
import { getNews } from '../data/news'
```

- [ ] **Step 3: Replace the hardcoded news Cards with data-driven ones**

In `src/pages/Home.jsx`, inside `export default function Home()`, add before the `return`:

```jsx
  const [featuredNews, ...restNews] = getNews().slice(0, 4)
```

Then replace the news section (originally lines 78–102 — the featured `Card` plus the `grid` of 6 `Card`s) with:

```jsx
        <Card
          tone={featuredNews.tone}
          eyebrow={featuredNews.category}
          title={featuredNews.title}
          meta={featuredNews.date}
          image={categoryImage(featuredNews.category)}
        >
          {featuredNews.body}{' '}
          {featuredNews.badge && <Badge tone={featuredNews.badge.tone}>{featuredNews.badge.label}</Badge>}
        </Card>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {restNews.map((item) => (
            <Card
              key={item.id}
              tone={item.tone}
              eyebrow={item.category}
              title={item.title}
              meta={item.date}
              image={categoryImage(item.category)}
            >
              {item.body}{' '}
              {item.badge && <Badge tone={item.badge.tone}>{item.badge.label}</Badge>}
            </Card>
          ))}
        </div>
```

- [ ] **Step 4: Run the build to verify no errors**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 5: Manually verify Home renders identically**

Run: `npm run dev`, open the app in a browser, and confirm the Home page news section still shows 1 featured green "2025/2026 Second Semester Exam Timetable Released" card followed by a 3-card grid ("NAMMES General Assembly...", "Departmental Seminar Series Resumes", "Materials Science Undergraduate Symposium") — same content and styling as before, just now sourced from `news.js`. Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/illustrations.js src/pages/Home.jsx
git commit -m "refactor: source Home's news teaser from the shared news data module"
```

---

### Task 4: News page — full list with category filter pills

**Files:**
- Modify: `src/pages/News.jsx` (full rewrite, currently a 12-line `PagePlaceholder` wrapper)

**Interfaces:**
- Consumes: `getNews`, `filterNewsByCategory`, `NEWS_CATEGORIES` from `src/data/news.js` (Task 1); `categoryImage` from `src/lib/illustrations.js` (Task 3).
- Produces: the `News` page component, routed at `/news` (route already exists in `App.jsx`) and `/news/:id` links pointing at Task 5's `NewsDetail`.

- [ ] **Step 1: Rewrite News.jsx**

Replace the full contents of `src/pages/News.jsx` with:

```jsx
import { Link, useSearchParams } from 'react-router-dom'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { getNews, filterNewsByCategory, NEWS_CATEGORIES } from '../data/news'
import { categoryImage } from '../lib/illustrations'

const categories = ['All', ...NEWS_CATEGORIES]

export default function News() {
  const [searchParams, setSearchParams] = useSearchParams()
  const active = searchParams.get('category') || 'All'
  const items = filterNewsByCategory(getNews(), active)
  const [featured, ...rest] = items

  function selectCategory(category) {
    if (category === 'All') {
      setSearchParams({})
    } else {
      setSearchParams({ category })
    }
  }

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">News</div>
      <h1 className="mt-1.5 text-[32px]">Department news</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Department news and announcements, posted jointly with the PRO.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => selectCategory(category)}
            className={[
              'rounded-full px-4 py-2 text-sm font-semibold',
              category === active ? 'bg-green-100 text-green-700' : 'text-ink hover:text-green-700',
            ].join(' ')}
          >
            {category}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-ink-muted">No news posts in this category yet.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <Link to={`/news/${featured.id}`} className="block">
            <Card
              tone={featured.tone}
              eyebrow={featured.category}
              title={featured.title}
              meta={featured.date}
              image={categoryImage(featured.category)}
            >
              {featured.body}{' '}
              {featured.badge && <Badge tone={featured.badge.tone}>{featured.badge.label}</Badge>}
            </Card>
          </Link>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((item) => (
              <Link key={item.id} to={`/news/${item.id}`} className="block">
                <Card
                  tone={item.tone}
                  eyebrow={item.category}
                  title={item.title}
                  meta={item.date}
                  image={categoryImage(item.category)}
                >
                  {item.body}{' '}
                  {item.badge && <Badge tone={item.badge.tone}>{item.badge.label}</Badge>}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run the build to verify no errors**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Manually verify filtering and navigation**

Run: `npm run dev`, open `/news` in a browser. Confirm: all 7 posts render (1 featured + 6 grid); clicking the "Welfare" pill narrows the list to the single "Textbook Donation Drive" post shown as the featured card, and the URL becomes `/news?category=Welfare`; clicking "All" restores the full list and clears the query param; clicking any card navigates to `/news/<id>`. Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 4: Commit**

```bash
git add src/pages/News.jsx
git commit -m "feat: build News page with category filter pills"
```

---

### Task 5: NewsDetail page — full post view

**Files:**
- Modify: `src/pages/NewsDetail.jsx` (full rewrite, currently a 15-line `PagePlaceholder` wrapper)

**Interfaces:**
- Consumes: `getNewsById` from `src/data/news.js` (Task 1); existing `Breadcrumbs`, `Button`, `Badge` components.
- Produces: the `NewsDetail` page component, routed at `/news/:id` (route already exists in `App.jsx`).

- [ ] **Step 1: Rewrite NewsDetail.jsx**

Replace the full contents of `src/pages/NewsDetail.jsx` with:

```jsx
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { getNewsById } from '../data/news'

export default function NewsDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const post = getNewsById(id)
  if (!post) return <Navigate to="/news" replace />

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'News', to: '/news' }, { label: post.title }]} />

      <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
        {post.category}
      </div>
      <h1 className="mt-1.5 text-[32px]">{post.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-sm text-ink-muted">
        <span>Posted by {post.author}</span>
        <span aria-hidden="true">&middot;</span>
        <span>{post.date}</span>
        {post.badge && <Badge tone={post.badge.tone}>{post.badge.label}</Badge>}
      </div>

      <p className="mt-6 max-w-2xl leading-relaxed text-ink">{post.body}</p>

      <div className="mt-8">
        <Button variant="ghost" onClick={() => navigate('/news')}>
          Back to news
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run the build to verify no errors**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Manually verify the detail view and the invalid-id guard**

Run: `npm run dev`. Visit `/news/dangote-site-visit` and confirm the full post (category, title, "Posted by NAMMES PRO Office", date, body, "Back to news" button) renders. Visit `/news/does-not-exist` and confirm it redirects to `/news`. Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 4: Commit**

```bash
git add src/pages/NewsDetail.jsx
git commit -m "feat: build NewsDetail full post view"
```

---

### Task 6: Opportunities page — deadline-sorted table

**Files:**
- Modify: `src/pages/Opportunities.jsx` (full rewrite, currently a 12-line `PagePlaceholder` wrapper)

**Interfaces:**
- Consumes: `getOpportunities` from `src/data/opportunities.js` (Task 2); existing `Table` component.
- Produces: the `Opportunities` page component, routed at `/opportunities` (route already exists in `App.jsx`).

- [ ] **Step 1: Rewrite Opportunities.jsx**

Replace the full contents of `src/pages/Opportunities.jsx` with:

```jsx
import Table from '../components/ui/Table'
import { getOpportunities } from '../data/opportunities'

export default function Opportunities() {
  const items = getOpportunities()

  const rows = items.map((o) => [
    o.deadline,
    o.type,
    <div key={`${o.id}-title`}>
      <div className="font-semibold text-ink">{o.title}</div>
      <div className="text-ink-muted">{o.org}</div>
    </div>,
    <a
      key={o.id}
      href={o.link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border-2 border-transparent bg-transparent px-4.5 py-2 text-sm font-semibold text-ink transition-[background-color,transform] duration-150 ease-out hover:scale-[1.03] hover:bg-green-100"
    >
      Apply
    </a>,
  ])

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
        Opportunities
      </div>
      <h1 className="mt-1.5 text-[32px]">Scholarships & internships</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Manually curated opportunities, soonest deadline first.
      </p>

      <div className="mt-6">
        {items.length > 0 ? (
          <Table columns={['Deadline', 'Type', 'Title & Org', '']} rows={rows} />
        ) : (
          <p className="text-ink-muted">No opportunities posted yet.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run the build to verify no errors**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Manually verify the table**

Run: `npm run dev`, open `/opportunities` in a browser. Confirm the table shows 4 rows sorted soonest-deadline-first (NLNG SIWES Placement `Jul 31, 2026` first, MTN Foundation STEM Scholarship `Sep 30, 2026` last), and each "Apply" link opens `https://example.com/opportunities/...` in a new tab. Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Opportunities.jsx
git commit -m "feat: build Opportunities page as a deadline-sorted table"
```
