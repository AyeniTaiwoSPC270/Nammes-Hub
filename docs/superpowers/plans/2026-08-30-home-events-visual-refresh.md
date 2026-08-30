# Home + Events Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make NAMMES Hub feel less static by introducing a shared photo-forward page-header pattern, a redesigned Home hero + Welcome Message + featured-Excos treatment, and a denser, photo-forward Events grid.

**Architecture:** A new `PageHeader` component (full-bleed banner over a duotone-gradient placeholder background — no real photo exists yet, but the visual language mimics one) replaces the bare `<h1>` block on Events/Resources/Outlines/Opportunities. Home's hero is reworked to use the same gradient-placeholder visual language at larger scale, a new `WelcomeMessage` component is inserted below it, and the Excos section is split into a larger "featured" row (top 3 by existing `sort_order`) plus the existing smaller grid for the rest, via a new pure `splitFeaturedExcos` function. Events additionally executes the already-written, never-implemented `2026-08-10-events-photo-upload` plan and widens its grid to 3 columns.

**Tech Stack:** React 19 (Vite), Tailwind CSS v4 (utility classes only, tokens defined in `src/index.css`), Vitest for pure-function tests. No new dependencies, no new image assets (placeholder visuals are CSS gradients, not files).

**Spec:** `docs/superpowers/specs/2026-08-30-home-events-visual-refresh-design.md`

## Global Constraints

- Design tokens only — no raw hex values in class names (e.g. `bg-green-700`, never `bg-[#127a3e]`).
- No dark mode / single light theme — don't introduce a theme toggle or dark-mode variants.
- All decorative images/placeholders stay `alt=""` + `aria-hidden="true"` where applicable, matching the existing convention for illustrations and uploaded photos.
- No new npm dependencies. No new binary/image assets — placeholder "photo" surfaces are Tailwind gradient utilities (`bg-gradient-to-br from-green-900 via-green-700 to-orange-600`) built so a real photo can be swapped in later without changing any component's props.
- Placeholder copy (Welcome Message) must be visibly marked as placeholder (prefixed `[Placeholder]`) — never presented as if it were real content from an actual NAMMES leader.
- Following existing repo convention: presentational components (`Card`, `Button`, `Navbar`, etc.) have no component-level tests in this codebase, and this plan doesn't add any (no `@testing-library/react` dependency exists) — only pure functions get Vitest unit tests, verified by inspection otherwise (dev server walkthrough).
- `npm run lint` and `npm run build` must stay clean after every task.
- Don't modify `src/components/ui/Card.jsx`, `src/components/admin/ImageUploadField.jsx`, `src/components/admin/AvatarUploadField.jsx`, or any News/Excos file beyond `src/pages/Home.jsx` — this plan only adds new files/sections, it doesn't touch shared pieces those already depend on.

---

### Task 1: `PageHeader` component + adoption on Events/Resources/Outlines/Opportunities

**Files:**
- Create: `src/components/PageHeader.jsx`
- Modify: `src/pages/Events.jsx`
- Modify: `src/pages/Resources.jsx`
- Modify: `src/pages/Outlines.jsx`
- Modify: `src/pages/Opportunities.jsx`

**Interfaces:**
- Produces: `PageHeader` — default export, props `{ eyebrow?: string, title: string, subtitle?: string }`. Renders a full-bleed banner; consumers render it as the first element returned, outside any `max-w` wrapper.

- [ ] **Step 1: Create `PageHeader.jsx`**

```jsx
export default function PageHeader({ eyebrow, title, subtitle }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-green-900 via-green-700 to-orange-600 px-6 py-14 sm:px-8">
      <div className="relative mx-auto max-w-[880px]">
        {eyebrow && (
          <div className="font-mono text-xs font-semibold uppercase tracking-[.04em] text-orange-400">
            {eyebrow}
          </div>
        )}
        <h1 className="mt-2 text-3xl text-white sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-white/90">{subtitle}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Adopt it in `Events.jsx`, and bump the grid to 3 columns**

Add the import at the top, alongside the existing ones:
```js
import PageHeader from '../components/PageHeader'
```

Replace the full `return` statement. Before:
```jsx
  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <h1 className="text-[32px]">Events</h1>
      {loading ? (
        <p className="mt-6 text-ink-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-ink-muted">No events posted yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rows.map((event) => (
            <Card
              key={event.id}
              tone={event.tone}
              eyebrow={event.date}
              title={event.title}
              meta={event.meta || undefined}
              image={{ src: EVENT_TONE_ICONS[event.tone] || EVENT_TONE_ICONS.green }}
            >
              {event.description}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
```
After:
```jsx
  return (
    <div>
      <PageHeader
        eyebrow="Activities"
        title="Events"
        subtitle="See all programs and activities of NAMMES."
      />
      <div className="mx-auto max-w-[880px] px-5 pt-10 pb-12 sm:px-6">
        {loading ? (
          <p className="text-ink-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-ink-muted">No events posted yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((event) => (
              <Card
                key={event.id}
                tone={event.tone}
                eyebrow={event.date}
                title={event.title}
                meta={event.meta || undefined}
                image={{ src: EVENT_TONE_ICONS[event.tone] || EVENT_TONE_ICONS.green }}
              >
                {event.description}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

(Task 6 later changes only the `<Card>` props inside this block — the `PageHeader`/wrapper structure here stays as-is.)

- [ ] **Step 3: Adopt it in `Resources.jsx`**

Add the import at the top, alongside the existing ones:
```js
import PageHeader from '../components/PageHeader'
```

Replace the full `return` statement. Before:
```jsx
  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
        Resources
      </div>
      <h1 className="mt-1.5 text-[32px]">Choose your level</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Pick a level, then a semester, to see shared Drive links and other resources.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => navigate(`/resources/${level}`)}
            className="flex flex-col items-center gap-1 rounded-lg bg-green-700 p-6 text-center transition-transform duration-150 ease-out hover:scale-[1.03] hover:bg-green-900"
          >
            {LEVEL_ICONS[level] && (
              <img src={LEVEL_ICONS[level]} alt="" aria-hidden="true" className="mb-1 h-12 w-12" />
            )}
            <span className="font-display text-3xl text-white">{level}</span>
            <span className="font-mono text-xs uppercase tracking-[.04em] text-orange-400">Level</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```
After:
```jsx
  return (
    <div>
      <PageHeader
        eyebrow="Resources"
        title="Choose your level"
        subtitle="Pick a level, then a semester, to see shared Drive links and other resources."
      />
      <div className="mx-auto max-w-[880px] px-5 pt-10 pb-12 sm:px-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => navigate(`/resources/${level}`)}
              className="flex flex-col items-center gap-1 rounded-lg bg-green-700 p-6 text-center transition-transform duration-150 ease-out hover:scale-[1.03] hover:bg-green-900"
            >
              {LEVEL_ICONS[level] && (
                <img src={LEVEL_ICONS[level]} alt="" aria-hidden="true" className="mb-1 h-12 w-12" />
              )}
              <span className="font-display text-3xl text-white">{level}</span>
              <span className="font-mono text-xs uppercase tracking-[.04em] text-orange-400">Level</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Adopt it in `Outlines.jsx`**

Add the import at the top, alongside the existing ones:
```js
import PageHeader from '../components/PageHeader'
```

Replace the full `return` statement. Before:
```jsx
  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
        Course outlines
      </div>
      <h1 className="mt-1.5 text-[32px]">Choose your level</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Pick a level, then a semester, to see the course list and detailed outlines.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => navigate(`/outlines/${level}`)}
            className="flex flex-col items-center gap-1 rounded-lg bg-green-700 p-6 text-center transition-transform duration-150 ease-out hover:scale-[1.03] hover:bg-green-900"
          >
            {LEVEL_ICONS[level] && (
              <img src={LEVEL_ICONS[level]} alt="" aria-hidden="true" className="mb-1 h-12 w-12" />
            )}
            <span className="font-display text-3xl text-white">{level}</span>
            <span className="font-mono text-xs uppercase tracking-[.04em] text-orange-400">Level</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```
After:
```jsx
  return (
    <div>
      <PageHeader
        eyebrow="Course outlines"
        title="Choose your level"
        subtitle="Pick a level, then a semester, to see the course list and detailed outlines."
      />
      <div className="mx-auto max-w-[880px] px-5 pt-10 pb-12 sm:px-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => navigate(`/outlines/${level}`)}
              className="flex flex-col items-center gap-1 rounded-lg bg-green-700 p-6 text-center transition-transform duration-150 ease-out hover:scale-[1.03] hover:bg-green-900"
            >
              {LEVEL_ICONS[level] && (
                <img src={LEVEL_ICONS[level]} alt="" aria-hidden="true" className="mb-1 h-12 w-12" />
              )}
              <span className="font-display text-3xl text-white">{level}</span>
              <span className="font-mono text-xs uppercase tracking-[.04em] text-orange-400">Level</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Adopt it in `Opportunities.jsx`**

Add the import at the top, alongside the existing ones:
```js
import PageHeader from '../components/PageHeader'
```

This file has an early `loading` return as well as the main return — both need the banner for consistency while loading. Replace the loading branch. Before:
```jsx
  if (loading) {
    return (
      <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
        <p className="text-ink-muted">Loading…</p>
      </div>
    )
  }
```
After:
```jsx
  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Opportunities" title="Scholarships & internships" />
        <div className="mx-auto max-w-[880px] px-5 pt-10 pb-12 sm:px-6">
          <p className="text-ink-muted">Loading…</p>
        </div>
      </div>
    )
  }
```

Then replace the main `return` statement further down. Before:
```jsx
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
          <Table columns={['Deadline', 'Type', 'Title & Org', '']} rows={tableRows} />
        ) : (
          <p className="text-ink-muted">No opportunities posted yet.</p>
        )}
      </div>
    </div>
  )
}
```
After:
```jsx
  return (
    <div>
      <PageHeader
        eyebrow="Opportunities"
        title="Scholarships & internships"
        subtitle="Manually curated opportunities, soonest deadline first."
      />
      <div className="mx-auto max-w-[880px] px-5 pt-10 pb-12 sm:px-6">
        {items.length > 0 ? (
          <Table columns={['Deadline', 'Type', 'Title & Org', '']} rows={tableRows} />
        ) : (
          <p className="text-ink-muted">No opportunities posted yet.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed. If either fails, it's almost always an unbalanced `<div>` from the indentation changes above — check each file's closing tags.

- [ ] **Step 7: Commit**

```bash
git add src/components/PageHeader.jsx src/pages/Events.jsx src/pages/Resources.jsx src/pages/Outlines.jsx src/pages/Opportunities.jsx
git commit -m "$(cat <<'EOF'
feat: add shared PageHeader banner to Events/Resources/Outlines/Opportunities

Replaces each page's bare <h1> block with a consistent full-bleed
banner, and bumps Events' grid to 3 columns to match its upcoming
photo-forward cards.
EOF
)"
```

---

### Task 2: `splitFeaturedExcos` pure function (TDD)

**Files:**
- Create: `src/lib/excos.js`
- Test: `src/lib/excos.test.js`

**Interfaces:**
- Produces: `splitFeaturedExcos(rows, featuredCount = 3)` — named export, returns `{ featured: Array, rest: Array }`. `rows` is expected pre-sorted (Home already fetches Excos ordered by `sort_order` ascending via `fetchExcos`); this function only slices, it doesn't sort.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { splitFeaturedExcos } from './excos'

describe('splitFeaturedExcos', () => {
  it('splits the first 3 into featured by default', () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]
    const { featured, rest } = splitFeaturedExcos(rows)
    expect(featured).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    expect(rest).toEqual([{ id: 4 }, { id: 5 }])
  })

  it('puts everything in featured when there are fewer rows than the count', () => {
    const rows = [{ id: 1 }, { id: 2 }]
    const { featured, rest } = splitFeaturedExcos(rows)
    expect(featured).toEqual([{ id: 1 }, { id: 2 }])
    expect(rest).toEqual([])
  })

  it('handles an empty or undefined list', () => {
    expect(splitFeaturedExcos([])).toEqual({ featured: [], rest: [] })
    expect(splitFeaturedExcos(undefined)).toEqual({ featured: [], rest: [] })
  })

  it('respects a custom featuredCount', () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const { featured, rest } = splitFeaturedExcos(rows, 1)
    expect(featured).toEqual([{ id: 1 }])
    expect(rest).toEqual([{ id: 2 }, { id: 3 }])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/excos.test.js`
Expected: FAIL — `src/lib/excos.js` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```js
export function splitFeaturedExcos(rows, featuredCount = 3) {
  const list = rows || []
  return {
    featured: list.slice(0, featuredCount),
    rest: list.slice(featuredCount),
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/excos.test.js`
Expected: PASS, all 4 cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/excos.js src/lib/excos.test.js
git commit -m "feat: add splitFeaturedExcos for the Home featured-leaders row"
```

---

### Task 3: Wire featured Excos into Home

**Files:**
- Modify: `src/pages/Home.jsx`

**Interfaces:**
- Consumes: `splitFeaturedExcos` from Task 2 (`src/lib/excos.js`).

- [ ] **Step 1: Import `splitFeaturedExcos` and compute the split**

Add the import alongside Home's other imports:
```js
import { splitFeaturedExcos } from '../lib/excos'
```

Add this line next to the existing `featuredNews`/`restNews` computation (after `const [featuredNews, ...restNews] = getNews(newsRows).slice(0, 4)`):
```js
const { featured: featuredExcos, rest: restExcos } = splitFeaturedExcos(excosRows)
```

- [ ] **Step 2: Replace the Excos grid markup**

Before:
```jsx
        {excosError ? (
          <p className="text-ink-muted">Couldn&rsquo;t load the Excos list right now.</p>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {excosRows.map((x) => (
              <div key={x.id} className="flex flex-col items-center gap-2.5">
                <div className="flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full bg-green-100 font-display text-2xl text-green-700">
                  {x.photo_url ? (
                    <img src={x.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (x.name || x.role).charAt(0)
                  )}
                </div>
                <div className="text-center">
                  <div className="text-[15px] font-semibold">{x.name || 'Name Surname'}</div>
                  <div className="mt-0.5 font-mono text-xs text-ink-muted">{x.role}</div>
                </div>
              </div>
            ))}
          </div>
        )}
```
After:
```jsx
        {excosError ? (
          <p className="text-ink-muted">Couldn&rsquo;t load the Excos list right now.</p>
        ) : (
          <>
            {featuredExcos.length > 0 && (
              <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
                {featuredExcos.map((x) => (
                  <div key={x.id} className="flex flex-col items-center gap-3 rounded-lg bg-green-700 p-6 text-center">
                    <div className="flex h-[160px] w-[160px] items-center justify-center overflow-hidden rounded-full bg-green-100 font-display text-4xl text-green-700">
                      {x.photo_url ? (
                        <img src={x.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (x.name || x.role).charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-white">{x.name || 'Name Surname'}</div>
                      <div className="mt-0.5 font-mono text-xs uppercase tracking-[.04em] text-orange-400">
                        {x.role}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {restExcos.length > 0 && (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                {restExcos.map((x) => (
                  <div key={x.id} className="flex flex-col items-center gap-2.5">
                    <div className="flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full bg-green-100 font-display text-2xl text-green-700">
                      {x.photo_url ? (
                        <img src={x.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (x.name || x.role).charAt(0)
                      )}
                    </div>
                    <div className="text-center">
                      <div className="text-[15px] font-semibold">{x.name || 'Name Surname'}</div>
                      <div className="mt-0.5 font-mono text-xs text-ink-muted">{x.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
```

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "$(cat <<'EOF'
feat: give the top 3 Excos more visual weight on Home

Splits the Excos grid into a larger "featured" row (top 3 by the
existing sort_order) plus the current smaller grid for the rest,
via splitFeaturedExcos. No schema/admin changes — same data, same
fetch, just presented with more weight for leadership.
EOF
)"
```

---

### Task 4: Home hero → duotone gradient hero

**Files:**
- Modify: `src/pages/Home.jsx`

**Interfaces:** none new — purely presentational within Home.

- [ ] **Step 1: Replace the hero block**

Before:
```jsx
      <div className="relative overflow-hidden bg-orange-500 px-6 py-14 sm:px-8">
        <div
          aria-hidden="true"
          className="absolute -top-[90px] -right-[70px] h-[260px] w-[260px] rounded-full bg-green-700"
        />
        <div className="relative mx-auto flex max-w-[960px] flex-col items-center gap-8 sm:flex-row">
          <div className="max-w-[560px]">
            <div className="inline-block w-fit whitespace-nowrap rounded-full bg-white px-3.5 py-1 font-mono text-[13px] font-bold uppercase text-green-900">
              NAMMES · 2025/2026 SESSION
            </div>
            <h1 className="mt-5 text-[30px] text-white sm:text-[44px]">
              Everything the department publishes, in one place.
            </h1>
            <p className="mt-3 text-[17px] text-white/90">
              Course outlines, event records, drive links, department news and opportunities —
              built for finding what you need in seconds.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button variant="primary" onClick={() => navigate('/outlines')}>
                Browse outlines
              </Button>
              <Button variant="secondary" onClick={() => navigate('/events')}>
                See events
              </Button>
            </div>
          </div>
          <img
            src={HERO_ILLUSTRATION}
            alt=""
            aria-hidden="true"
            className="w-52 sm:w-auto sm:max-w-[320px] sm:flex-1"
          />
        </div>
      </div>
```
After:
```jsx
      <div className="relative overflow-hidden bg-gradient-to-br from-green-900 via-green-700 to-orange-600 px-6 py-20 sm:px-8 sm:py-24">
        <div className="relative mx-auto max-w-[960px]">
          <div className="max-w-[560px]">
            <div className="inline-block w-fit whitespace-nowrap rounded-full bg-white px-3.5 py-1 font-mono text-[13px] font-bold uppercase text-green-900">
              NAMMES · 2025/2026 SESSION
            </div>
            <h1 className="mt-5 text-[30px] text-white sm:text-[44px]">
              Everything the department publishes, in one place.
            </h1>
            <p className="mt-3 text-[17px] text-white/90">
              Course outlines, event records, drive links, department news and opportunities —
              built for finding what you need in seconds.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button variant="primary" onClick={() => navigate('/outlines')}>
                Browse outlines
              </Button>
              <Button variant="secondary" onClick={() => navigate('/events')}>
                See events
              </Button>
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 2: Remove the now-unused `HERO_ILLUSTRATION` import**

Before:
```js
import { HERO_ILLUSTRATION } from '../lib/illustrations'
```

Delete this line entirely — nothing else in `Home.jsx` references `HERO_ILLUSTRATION`. (The export itself stays in `src/lib/illustrations.js`, unused — same precedent as `EVENT_TONE_ICONS` being left in place after Events dropped its icon usage.)

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed (an unremoved `HERO_ILLUSTRATION` import would fail lint as unused).

- [ ] **Step 4: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "$(cat <<'EOF'
feat: replace Home's illustration hero with a photo-placeholder band

Drops the flat illustration and decorative circle for a full-bleed
duotone-gradient band (green-900/green-700/orange-600) — no real
photo exists yet, but the component is structured so one can replace
the gradient later without touching layout or copy.
EOF
)"
```

---

### Task 5: `WelcomeMessage` component + insertion on Home

**Files:**
- Create: `src/components/WelcomeMessage.jsx`
- Modify: `src/pages/Home.jsx`

**Interfaces:**
- Produces: `WelcomeMessage` — default export, no props (all content is inline placeholder copy for now).

- [ ] **Step 1: Create `WelcomeMessage.jsx`**

```jsx
export default function WelcomeMessage() {
  return (
    <div className="mx-auto max-w-[880px] px-5 py-14 sm:px-6">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
        <div className="mx-auto flex h-[220px] w-[180px] shrink-0 items-center justify-center rounded-sm border-4 border-white bg-green-100 sm:mx-0">
          <span className="px-4 text-center font-mono text-xs uppercase tracking-[.04em] text-ink-muted">
            Photo coming soon
          </span>
        </div>
        <div>
          <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
            Welcome message
          </div>
          <h2 className="mt-1.5 text-[28px]">A note from your NAMMES leadership</h2>
          <div className="mt-4 flex max-w-2xl flex-col gap-3 text-ink">
            <p>
              [Placeholder] On behalf of the Executive Council, it is my honor to welcome you to
              the official digital home of NAMMES. This platform exists to put everything the
              department publishes — outlines, events, opportunities, and news — in one place.
            </p>
            <p>
              [Placeholder] Replace this section with a real message, photo, name, and role once
              leadership has one ready.
            </p>
          </div>
          <div className="mt-5">
            <div className="font-semibold text-green-900">[Placeholder] Leader Name</div>
            <div className="mt-0.5 font-mono text-xs uppercase tracking-[.04em] text-ink-muted">
              President, NAMMES · 2025/2026 Session
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Insert it into `Home.jsx`**

Add the import alongside Home's other imports:
```js
import WelcomeMessage from '../components/WelcomeMessage'
```

Insert `<WelcomeMessage />` immediately after the closing `</div>` of the hero block (from Task 4) and before the `<div className="mx-auto max-w-[880px] px-5 pt-14 pb-18 sm:px-6">` that starts the "Department news" section:
```jsx
      </div>

      <WelcomeMessage />

      <div className="mx-auto max-w-[880px] px-5 pt-14 pb-18 sm:px-6">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
              Department news
```

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/components/WelcomeMessage.jsx src/pages/Home.jsx
git commit -m "$(cat <<'EOF'
feat: add a Welcome Message section to Home

Placeholder leader photo/name/role/message, clearly marked as
placeholder, positioned between the hero and the news feed.
EOF
)"
```

---

### Task 6: Events real-photo upload (execute existing plan)

**Files:** see `docs/superpowers/plans/2026-08-10-events-photo-upload.md` Tasks 1-4 (Supabase migration, `EventImageUploadField.jsx`, `AdminResourceForm.jsx`, `eventsAdminConfig.js`, `Events.jsx`, `ADMIN.md`, `DESIGN_SYSTEM.md`).

**Interfaces:**
- Consumes: `Card`'s existing `imageVariant="cover"`/`imageAspect="standard"` (unchanged, already shipped for News).
- Produces: `events.image_url` column; `event-images` Storage bucket; `EventImageUploadField` component; Events cards render real photos when present.

This plan was written in a previous session and never executed. Its decisions (schema, storage policies, component shape, no-resize-UI rationale) were reviewed as part of this refresh's design and are being adopted as-is — do not redesign any part of it.

- [ ] **Step 1: Execute Task 1 of the referenced plan** (Supabase schema + storage bucket) exactly as written there.

- [ ] **Step 2: Execute Task 2 of the referenced plan** (`EventImageUploadField.jsx`, `AdminResourceForm.jsx`, `eventsAdminConfig.js`, `ADMIN.md`, lint/build, commit) exactly as written there.

- [ ] **Step 3: Execute Task 3 of the referenced plan** (`Events.jsx` switches to `imageVariant="cover"`, `DESIGN_SYSTEM.md` Events line) exactly as written there — the `Card` props diff in that plan applies on top of this refresh's Task 1 changes to `Events.jsx` (the `PageHeader` adoption and `lg:grid-cols-3` bump); only the `<Card ...>` props themselves change, the surrounding `PageHeader`/grid wrapper from this plan's Task 1 stays as-is.

- [ ] **Step 4: Execute Task 4 of the referenced plan** (manual verification: seed a temporary photo, verify `/events`, revert, confirm News/Excos unaffected, flag the admin-upload-form spot-check to the user) exactly as written there.

No separate commit for this task — each step above already commits per the referenced plan's own instructions.

---

### Task 7: `DESIGN_SYSTEM.md` documentation pass

**Files:**
- Modify: `DESIGN_SYSTEM.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Add a `PageHeader` entry under "## Components"**

Insert after the existing "### FormField" section (before "### Navbar"):

```markdown
### PageHeader

Props: `eyebrow` (optional), `title`, `subtitle` (optional). Full-bleed banner used at the top of every inner page (Events, Resources, Outlines, Opportunities) in place of a bare `<h1>`.
- Background: duotone-gradient placeholder (`bg-gradient-to-br from-green-900 via-green-700 to-orange-600`) — stands in for a real photo until the department has one; built so a `photo` prop can be added later without changing layout.
- Content constrained to `max-w-[880px]`, `py-14`/`px-6 sm:px-8`. Eyebrow: mono/xs/uppercase/orange-400. Title: `font-display text-3xl sm:text-4xl` white. Subtitle: `text-white/90 max-w-2xl`.
```

- [ ] **Step 2: Update the Home line under "## Pages implemented from the handoff UI kit"**

Before:
```
- **Home** (`src/pages/Home.jsx`) — orange hero with the one decorative green circle plus a custom illustration (right side, desktop only), department news section (1 featured green Card + 3-col grid of Cards, each with a category illustration via `Card`'s `image` prop), Exco grid (4-col, 10 roles — circular initial avatars stand in for real photos until the department supplies them).
```
After:
```
- **Home** (`src/pages/Home.jsx`) — duotone-gradient hero (placeholder for a real department photo), a Welcome Message section (`src/components/WelcomeMessage.jsx`, placeholder leader photo/copy), department news section (1 featured green Card + 3-col grid of Cards, each with a category illustration via `Card`'s `image` prop), then Excos: a featured row (top 3 by `sort_order`, larger circular photos on green cards) plus a smaller 4-col grid for the rest — circular initial avatars stand in for real photos until the department supplies them.
```

- [ ] **Step 3: Update the Events line**

Before:
```
- **Events** (`src/pages/Events.jsx`) — 2-col grid of tone Cards.
```
After (this supersedes the update Task 6's referenced plan already makes to this line — apply this version, which additionally reflects the `PageHeader` and 3-col grid from this plan's Task 1):
```
- **Events** (`src/pages/Events.jsx`) — `PageHeader` banner, then a 3-col grid of Cards showing a full-bleed cover photo (`imageVariant="cover"`) when an event has one uploaded, otherwise just the colored tone block (no icon).
```

- [ ] **Step 4: Fix the stale Resources note**

Before:
```
Resources and Admin aren't in the handoff kit yet — they still render `PagePlaceholder`, now restyled to the new tokens (mono orange-600 eyebrow, Newsreader h1, ink-muted body). Build their real layouts as those designs arrive, following the component specs above rather than ad hoc styling — don't invent page designs the handoff hasn't specified.
```
After:
```
Resources now has a real layout (`src/pages/Resources.jsx`, `PageHeader` banner + level-picker grid identical in structure to Outlines) rather than `PagePlaceholder` — this note was stale. Admin isn't in the handoff kit; build its real layout as that design arrives, following the component specs above rather than ad hoc styling.
```

- [ ] **Step 5: Commit**

```bash
git add DESIGN_SYSTEM.md
git commit -m "docs: document PageHeader and refresh Home/Events/Resources descriptions"
```

---

### Task 8: Full-site manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including the new `src/lib/excos.test.js` from Task 2.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev` (background).

- [ ] **Step 3: Verify Home (`/`)**

Confirm: hero shows the gradient band with headline/CTAs (no illustration, no decorative circle), Welcome Message section renders with the placeholder photo box and clearly-marked placeholder copy, Excos section shows a larger featured row of (up to) 3 followed by the existing smaller grid for the rest — check this looks reasonable both with the real Excos data (however many rows currently exist) and doesn't break if there are fewer than 3 total.

- [ ] **Step 4: Verify Events (`/events`)**

Confirm: `PageHeader` banner renders above the grid, grid is 3-wide on desktop / 2-wide on tablet / 1-wide on mobile, and (once Task 6 is done) a seeded photo shows full-bleed on a card.

- [ ] **Step 5: Verify Resources (`/resources`), Outlines (`/outlines`), Opportunities (`/opportunities`)**

Confirm each shows the new `PageHeader` banner with correct eyebrow/title/subtitle, and that the content below (level-picker grid or table) is otherwise unchanged from before this plan.

- [ ] **Step 6: Verify untouched pages are unaffected**

Open `/news` and `/login` — confirm both render exactly as before (neither was touched by this plan).

- [ ] **Step 7: Stop the dev server**

Kill the `npm run dev` process started in Step 2.
