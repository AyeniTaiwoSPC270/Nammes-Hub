# App Performance & State System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the loading "flash," add consistent Ideal/Empty/Loading/Error/Imperfect states across every data-driven page, cut real load cost via route-level code splitting and cached data fetching, and round out micro-interaction (focus/press/success) and route-transition polish.

**Architecture:** TanStack Query replaces hand-rolled `useEffect`/`useState` fetch bookkeeping on every page, giving each page `isLoading`/`isError`/`refetch` for free. New shared `Skeleton`/`EmptyState`/`ErrorState`/`Toast` primitives in `src/components/ui/` render those states consistently. `App.jsx` switches to `React.lazy` per route with a single `Suspense` boundary inside `Layout.jsx` (so the Navbar/Footer never unmount on navigation), backed by an `ErrorBoundary` for render crashes. `motion` drives a subtle route-transition fade/slide, added last so it doesn't animate over broken loading states.

**Tech Stack:** React 19, Vite, Tailwind v4, react-router-dom v7, Supabase, `@tanstack/react-query` (new), `motion` (new).

**Spec:** `docs/superpowers/specs/2026-08-14-app-performance-state-system-design.md`

## Global Constraints

- Only two new dependencies: `@tanstack/react-query` and `motion`. Don't add anything else (no React Testing Library, no icon set, no animation library beyond `motion`).
- No new colors — every state component uses existing tokens from `src/index.css`'s `@theme` block (`bg-hairline`, `bg-green-100`, `text-success`, `bg-danger-bg`, etc.), never raw hex.
- Radius/shape must match the existing scale: `rounded-lg` (cards), `rounded-md` (tables), `rounded-sm` (buttons/inputs/small chips), `rounded-full` (pills/buttons).
- Motion duration stays in the existing `150`-ish ms range (`duration-150`, or `0.18s` for the route transition) — nothing slower reads as sluggish, which is the opposite of this plan's goal.
- Route transitions and any new `motion` usage must respect `prefers-reduced-motion` (via `useReducedMotion` from `motion/react`).
- No dark mode, no new icon set — this repeats `DESIGN_SYSTEM.md`'s existing out-of-scope list and still applies to every new component here.
- Testing convention: this codebase has **zero** component-level tests today (no React Testing Library dependency; `src/lib/*.test.js` and `src/data/*.test.js` only test pure logic). New UI components (`Skeleton`, `EmptyState`, `ErrorState`, `Toast`) stay untested by vitest, consistent with `Button`/`Card`/`Badge` having no tests either. Every task's verification is: `npm run lint`, `npm run build`, `npm run test` (when a `src/data/*.js` file changed, to confirm the existing suite is unaffected), and a concrete manual dev-server check.
- Scope note on Cgpa: `src/pages/Cgpa.jsx` already has working per-mutation error feedback (`formError` banner) for its five mutations (add/delete semester, add/delete course, toggle CGPA inclusion). This plan does **not** migrate those to TanStack Query — only the blank (`return null`) loading state is fixed, per Task 15. Migrating the mutations is out of scope; flag it as a follow-up if the team wants it later.
- Commit after every task, using the working tree's existing conventions (`feat:`, `fix:`, etc. — check `git log` if unsure).

---

## Task 1: TanStack Query setup

**Files:**
- Create: `src/lib/queryClient.js`
- Modify: `src/main.jsx`

**Interfaces:**
- Produces: `queryClient` (a configured `QueryClient` instance) exported from `src/lib/queryClient.js`, imported by `src/main.jsx`. Every later task that adds a `useQuery`/`useMutation` hook relies on this provider being mounted.

- [ ] **Step 1: Install the dependency**

Run: `npm install @tanstack/react-query`

- [ ] **Step 2: Create the query client**

Create `src/lib/queryClient.js`:

```js
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})
```

- [ ] **Step 3: Wrap the app in the provider**

Modify `src/main.jsx`:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'
import { queryClient } from './lib/queryClient.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
```

- [ ] **Step 4: Verify**

Run: `npm run lint`
Run: `npm run build`
Run: `npm run test` — expect all existing tests still pass (nothing here touches tested logic).
Manual: `npm run dev`, open the app, confirm the homepage still renders with no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queryClient.js src/main.jsx package.json package-lock.json
git commit -m "feat: add TanStack Query provider"
```

---

## Task 2: Skeleton primitives

**Files:**
- Create: `src/components/ui/Skeleton.jsx`

**Interfaces:**
- Produces: `SkeletonText({ lines = 1, className = '' })`, `SkeletonCard({ imageVariant = 'none' })`, `SkeletonTable({ columns = 4, rows = 5 })` — all default+named exports from `src/components/ui/Skeleton.jsx`. Every page-rollout task (7 onward) imports one or more of these.

- [ ] **Step 1: Create the component**

Create `src/components/ui/Skeleton.jsx`:

```jsx
export function SkeletonText({ lines = 1, className = '' }) {
  return (
    <div className={['flex flex-col gap-2', className].join(' ')}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded-sm bg-hairline"
          style={{ width: lines > 1 && i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ imageVariant = 'none' }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface">
      {imageVariant === 'cover' && <div className="aspect-[4/3] w-full animate-pulse rounded-t-lg bg-hairline" />}
      <div className="flex flex-col gap-2 p-6">
        <div className="h-3 w-20 animate-pulse rounded-sm bg-hairline" />
        <div className="h-5 w-3/4 animate-pulse rounded-sm bg-hairline" />
        <SkeletonText lines={2} />
      </div>
    </div>
  )
}

export function SkeletonTable({ columns = 4, rows = 5 }) {
  return (
    <div className="nm-table-wrap overflow-x-auto">
      <div className="w-full overflow-hidden rounded-md border border-hairline">
        <div className="flex bg-green-100 px-4 py-2.5">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="mr-6 h-3 w-16 animate-pulse rounded-sm bg-hairline last:mr-0" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, ri) => (
          <div key={ri} className="flex border-t border-hairline px-4 py-3">
            {Array.from({ length: columns }).map((_, ci) => (
              <div key={ci} className="mr-6 h-3 w-20 animate-pulse rounded-sm bg-hairline last:mr-0" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Run: `npm run build`
Manual: temporarily render `<SkeletonCard imageVariant="cover" />` and `<SkeletonTable />` inside `src/pages/Home.jsx`'s return (above the existing content), `npm run dev`, confirm pulse animation and shapes look right, then revert the temporary render (this component has no consumer yet — that comes in Task 7+).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Skeleton.jsx
git commit -m "feat: add Skeleton primitives"
```

---

## Task 3: EmptyState component

**Files:**
- Create: `src/components/ui/EmptyState.jsx`

**Interfaces:**
- Consumes: `Button` (default export from `src/components/ui/Button.jsx`, existing).
- Produces: `EmptyState({ title, body, actionLabel, onAction })`, default export.

- [ ] **Step 1: Create the component**

Create `src/components/ui/EmptyState.jsx`:

```jsx
import Button from './Button'

export default function EmptyState({ title, body, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg bg-green-100 p-8 text-left">
      <h3 className="text-xl text-green-900">{title}</h3>
      {body && <p className="max-w-md text-ink-muted">{body}</p>}
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Run: `npm run build`
Manual: temporarily render `<EmptyState title="No news yet" body="Check back soon." actionLabel="Refresh" onAction={() => {}} />` in `src/pages/Home.jsx`, `npm run dev`, confirm layout/tone, then revert.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/EmptyState.jsx
git commit -m "feat: add EmptyState component"
```

---

## Task 4: ErrorState component

**Files:**
- Create: `src/components/ui/ErrorState.jsx`

**Interfaces:**
- Consumes: `Button` (existing).
- Produces: `ErrorState({ message, onRetry })`, default export. `message` defaults to a generic string. Consumed by every page-rollout task and by `ErrorBoundary` (Task 6).

- [ ] **Step 1: Create the component**

Create `src/components/ui/ErrorState.jsx`:

```jsx
import Button from './Button'

export default function ErrorState({ message = "Something went wrong. Please try again.", onRetry }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg bg-danger-bg p-8 text-left">
      <h3 className="text-xl text-danger">Couldn&rsquo;t load this</h3>
      <p className="max-w-md text-ink">{message}</p>
      {onRetry && (
        <Button variant="destructive" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Run: `npm run build`
Manual: temporarily render `<ErrorState message="Test error" onRetry={() => alert('retry')} />` in `src/pages/Home.jsx`, `npm run dev`, click "Try again", confirm the alert fires, then revert.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ErrorState.jsx
git commit -m "feat: add ErrorState component"
```

---

## Task 5: Toast system

**Files:**
- Create: `src/components/ui/Toast.jsx`
- Create: `src/lib/ToastContext.jsx`
- Modify: `src/main.jsx`

**Interfaces:**
- Produces: `useToast()` hook (from `src/lib/ToastContext.jsx`) returning `{ success(message), error(message) }`. Consumed by Task 14 (Admin mutations).
- Produces: `Toast({ tone, onDismiss, children })`, default export from `src/components/ui/Toast.jsx`, consumed only by `ToastProvider` internally.

- [ ] **Step 1: Create the visual Toast component**

Create `src/components/ui/Toast.jsx`:

```jsx
const tones = {
  success: 'bg-success text-white',
  danger: 'bg-danger text-white',
}

export default function Toast({ tone = 'success', onDismiss, children }) {
  return (
    <div
      role="status"
      className={[
        'pointer-events-auto flex items-center gap-3 rounded-full px-4.5 py-2.5 text-sm font-semibold shadow-md',
        tones[tone] || tones.success,
      ].join(' ')}
    >
      <span>{children}</span>
      <button type="button" onClick={onDismiss} className="rounded-full text-white/80 hover:text-white" aria-label="Dismiss">
        ✕
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create the provider and hook**

Create `src/lib/ToastContext.jsx`:

```jsx
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import Toast from '../components/ui/Toast'

const ToastContext = createContext(undefined)
let nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const push = useCallback((tone, message) => {
    const id = ++nextId
    setToasts((prev) => [...prev, { id, tone, message }])
    timers.current[id] = setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  const value = {
    success: (message) => push('success', message),
    error: (message) => push('danger', message),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map((t) => (
          <Toast key={t.id} tone={t.tone} onDismiss={() => dismiss(t.id)}>
            {t.message}
          </Toast>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
```

- [ ] **Step 3: Mount the provider**

Modify `src/main.jsx` (adds `ToastProvider` inside `AuthProvider`, wrapping `App`):

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'
import { ToastProvider } from './lib/ToastContext.jsx'
import { queryClient } from './lib/queryClient.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
```

- [ ] **Step 4: Verify**

Run: `npm run lint`
Run: `npm run build`
Manual: temporarily call `useToast().success('Test toast')` from a button's `onClick` in `src/pages/Home.jsx`, `npm run dev`, click it, confirm the toast appears bottom-right, auto-dismisses after ~4s, and the ✕ button dismisses it early. Revert the temporary call.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Toast.jsx src/lib/ToastContext.jsx src/main.jsx
git commit -m "feat: add Toast notification system"
```

---

## Task 6: Route-level code splitting, Suspense fallback, error boundary

**Files:**
- Create: `src/components/ErrorBoundary.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/Layout.jsx`

**Interfaces:**
- Consumes: `ErrorState` (Task 4), `SkeletonText` (Task 2).
- Produces: `ErrorBoundary` (default export, class component) wrapping the whole route tree in `App.jsx`. `Layout.jsx` now wraps `<Outlet/>` in `<Suspense>` — Task 20 will replace this `Suspense` block's contents with a `motion`-animated version, so its structure must stay easy to extend.

- [ ] **Step 1: Create the error boundary**

Create `src/components/ErrorBoundary.jsx`:

```jsx
import { Component } from 'react'
import ErrorState from './ui/ErrorState'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
          <ErrorState
            message="The page ran into a problem. Reloading usually fixes it."
            onRetry={() => window.location.reload()}
          />
        </div>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 2: Code-split every route and wrap in the error boundary**

Modify `src/App.jsx`:

```jsx
import { lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'

const Home = lazy(() => import('./pages/Home'))
const Outlines = lazy(() => import('./pages/Outlines'))
const OutlineLevel = lazy(() => import('./pages/outlines/OutlineLevel'))
const OutlineCourses = lazy(() => import('./pages/outlines/OutlineCourses'))
const OutlineDetail = lazy(() => import('./pages/outlines/OutlineDetail'))
const Events = lazy(() => import('./pages/Events'))
const Resources = lazy(() => import('./pages/Resources'))
const ResourceLevel = lazy(() => import('./pages/resources/ResourceLevel'))
const ResourceList = lazy(() => import('./pages/resources/ResourceList'))
const News = lazy(() => import('./pages/News'))
const NewsDetail = lazy(() => import('./pages/NewsDetail'))
const Opportunities = lazy(() => import('./pages/Opportunities'))
const Cgpa = lazy(() => import('./pages/Cgpa'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Admin = lazy(() => import('./pages/Admin'))
const AdminNews = lazy(() => import('./pages/admin/AdminNews'))
const AdminOpportunities = lazy(() => import('./pages/admin/AdminOpportunities'))
const AdminEvents = lazy(() => import('./pages/admin/AdminEvents'))
const AdminResources = lazy(() => import('./pages/admin/AdminResources'))
const AdminExcos = lazy(() => import('./pages/admin/AdminExcos'))
const AdminOutlines = lazy(() => import('./pages/admin/AdminOutlines'))

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="outlines" element={<Outlines />} />
          <Route path="outlines/:level" element={<OutlineLevel />} />
          <Route path="outlines/:level/:semester" element={<OutlineCourses />} />
          <Route path="outlines/:level/:semester/:code" element={<OutlineDetail />} />
          <Route path="cgpa" element={<Cgpa />} />
          <Route path="events" element={<Events />} />
          <Route path="resources" element={<Resources />} />
          <Route path="resources/:level" element={<ResourceLevel />} />
          <Route path="resources/:level/:semester" element={<ResourceList />} />
          <Route path="news" element={<News />} />
          <Route path="news/:id" element={<NewsDetail />} />
          <Route path="opportunities" element={<Opportunities />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route element={<ProtectedRoute />}>
            <Route path="admin" element={<Admin />} />
            <Route path="admin/news" element={<AdminNews />} />
            <Route path="admin/opportunities" element={<AdminOpportunities />} />
            <Route path="admin/events" element={<AdminEvents />} />
            <Route path="admin/resources" element={<AdminResources />} />
            <Route path="admin/excos" element={<AdminExcos />} />
            <Route path="admin/outlines" element={<AdminOutlines />} />
          </Route>
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 3: Add the Suspense boundary around the routed content**

Modify `src/components/Layout.jsx`:

```jsx
import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import { SkeletonText } from './ui/Skeleton'

export default function Layout() {
  return (
    <div className="min-h-svh flex flex-col bg-paper">
      <Navbar />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
              <SkeletonText lines={3} />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint`
Run: `npm run build` — check the build output lists separate chunk files per page (e.g. `News-*.js`, `AdminNews-*.js`) instead of one bundle.
Manual: `npm run dev`, open DevTools Network tab, navigate from Home to News — confirm a new JS chunk loads on that navigation and the Navbar/Footer do not flicker or unmount. Then navigate to `/admin` while logged out — confirm the redirect still works (route splitting shouldn't break `ProtectedRoute`).
Manual crash test: temporarily add `throw new Error('test')` at the top of `src/pages/Home.jsx`'s component body, reload, confirm `ErrorBoundary`'s `ErrorState` renders instead of a white screen, then remove the temporary throw.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/Layout.jsx src/components/ErrorBoundary.jsx
git commit -m "feat: code-split routes and add error boundary"
```

---

## Task 7: News list — query hook + macro states

**Files:**
- Modify: `src/data/news.js`
- Modify: `src/pages/News.jsx`

**Interfaces:**
- Produces: `useNewsQuery()` (from `src/data/news.js`) → `useQuery` result `{ data, isLoading, isError, refetch, ... }` where `data` is `News[] | undefined`. Consumed by Task 8 (`NewsDetail.jsx`) and Task 9 (`Home.jsx`).
- Consumes: `SkeletonCard` (Task 2), `EmptyState` (Task 3), `ErrorState` (Task 4).

- [ ] **Step 1: Add the query hook**

Modify `src/data/news.js`:

```js
import { useQuery } from '@tanstack/react-query'
import { fetchTable } from '../lib/supabaseQueries'

export const NEWS_CATEGORIES = ['Academics', 'Governance', 'Welfare', 'Industry', 'Call for papers', 'Resources']

export function fetchNews() {
  return fetchTable('news', { orderBy: { column: 'date', ascending: false } })
}

export function useNewsQuery() {
  return useQuery({ queryKey: ['news'], queryFn: fetchNews })
}

export function getNews(list) {
  return [...list].sort((a, b) => new Date(b.date) - new Date(a.date))
}

export function getNewsById(list, id) {
  return list.find((n) => n.id === id)
}

export function filterNewsByCategory(list, category) {
  if (!category || category === 'All' || !NEWS_CATEGORIES.includes(category)) return list
  return list.filter((n) => n.category === category)
}
```

- [ ] **Step 2: Rewrite the page**

Modify `src/pages/News.jsx`:

```jsx
import { Link, useSearchParams } from 'react-router-dom'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { SkeletonCard } from '../components/ui/Skeleton'
import { useNewsQuery, getNews, filterNewsByCategory, NEWS_CATEGORIES } from '../data/news'

const categories = ['All', ...NEWS_CATEGORIES]

export default function News() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, isLoading, isError, refetch } = useNewsQuery()

  const requestedCategory = searchParams.get('category')
  const active = categories.includes(requestedCategory) ? requestedCategory : 'All'
  const items = filterNewsByCategory(getNews(data ?? []), active)
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

      {isError ? (
        <div className="mt-8">
          <ErrorState message="Couldn't load news right now." onRetry={refetch} />
        </div>
      ) : isLoading ? (
        <div className="mt-6 flex flex-col gap-4">
          <SkeletonCard imageVariant="cover" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SkeletonCard imageVariant="cover" />
            <SkeletonCard imageVariant="cover" />
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No news yet" body="No news posts in this category yet." />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <Link to={`/news/${featured.id}`} className="block">
            <Card
              tone={featured.tone}
              eyebrow={featured.category}
              title={featured.title}
              meta={featured.date}
              image={featured.image_url ? { src: featured.image_url } : undefined}
              imageVariant="cover"
              imageAspect="video"
            >
              {featured.body}{' '}
              {featured.badge_tone && <Badge tone={featured.badge_tone}>{featured.badge_label}</Badge>}
            </Card>
          </Link>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rest.map((item) => (
              <Link key={item.id} to={`/news/${item.id}`} className="block">
                <Card
                  tone={item.tone}
                  eyebrow={item.category}
                  title={item.title}
                  meta={item.date}
                  image={item.image_url ? { src: item.image_url } : undefined}
                  imageVariant="cover"
                  imageAspect="standard"
                >
                  {item.body}{' '}
                  {item.badge_tone && <Badge tone={item.badge_tone}>{item.badge_label}</Badge>}
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

- [ ] **Step 3: Verify**

Run: `npm run lint`
Run: `npm run build`
Run: `npm run test` — `src/data/news.test.js` must still pass unchanged (the pure functions it tests are untouched).
Manual: `npm run dev`, open DevTools Network tab, throttle to "Slow 3G", visit `/news` — confirm skeleton cards render before real content (no more "Loading…" text flash). Go offline (DevTools → Network → Offline), reload `/news` — confirm `ErrorState` renders with a working "Try again" button. Filter to a category with zero posts (if none exists, temporarily test with a category that has no seeded rows) — confirm `EmptyState` renders.

- [ ] **Step 4: Commit**

```bash
git add src/data/news.js src/pages/News.jsx
git commit -m "feat: add loading/empty/error states to News"
```

---

## Task 8: News detail — macro states

**Files:**
- Modify: `src/pages/NewsDetail.jsx`

**Interfaces:**
- Consumes: `useNewsQuery`, `getNewsById` (Task 7), `ErrorState` (Task 4), `SkeletonText` (Task 2).

- [ ] **Step 1: Rewrite the page**

Modify `src/pages/NewsDetail.jsx`:

```jsx
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import ErrorState from '../components/ui/ErrorState'
import { SkeletonText } from '../components/ui/Skeleton'
import { useNewsQuery, getNewsById } from '../data/news'

export default function NewsDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useNewsQuery()

  if (isError) {
    return (
      <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this post right now." onRetry={refetch} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
        <SkeletonText lines={1} className="w-40" />
        <div className="mt-4">
          <SkeletonText lines={4} />
        </div>
      </div>
    )
  }

  const post = getNewsById(data ?? [], id)
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
        {post.badge_tone && <Badge tone={post.badge_tone}>{post.badge_label}</Badge>}
      </div>

      {post.image_url && (
        <img
          src={post.image_url}
          alt=""
          style={{ width: `${post.image_width_pct || 100}%` }}
          className="mt-6 rounded-lg"
        />
      )}

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

- [ ] **Step 2: Verify**

Run: `npm run lint`
Run: `npm run build`
Manual: `npm run dev`, visit a `/news/:id` URL directly (fresh load, not via client-side nav) with network throttled — confirm the skeleton shows before the post appears. Visit `/news/does-not-exist` — confirm it redirects to `/news` (unchanged behavior). Go offline and reload a `/news/:id` URL — confirm `ErrorState` renders with retry.

- [ ] **Step 3: Commit**

```bash
git add src/pages/NewsDetail.jsx
git commit -m "feat: add loading/error states to NewsDetail"
```

---

## Task 9: Home — news + excos macro states

**Files:**
- Modify: `src/data/excos.js`
- Modify: `src/pages/Home.jsx`

**Interfaces:**
- Produces: `useExcosQuery()` (from `src/data/excos.js`), same shape as `useNewsQuery`.
- Consumes: `useNewsQuery` (Task 7), `SkeletonCard`, `SkeletonText` (Task 2), `ErrorState` (Task 4).

- [ ] **Step 1: Add the excos query hook**

Modify `src/data/excos.js`:

```js
import { useQuery } from '@tanstack/react-query'
import { fetchTable } from '../lib/supabaseQueries'

export function fetchExcos() {
  return fetchTable('excos', { orderBy: { column: 'sort_order', ascending: true } })
}

export function useExcosQuery() {
  return useQuery({ queryKey: ['excos'], queryFn: fetchExcos })
}
```

- [ ] **Step 2: Rewrite the page**

Modify `src/pages/Home.jsx`:

```jsx
import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import ErrorState from '../components/ui/ErrorState'
import { SkeletonCard, SkeletonText } from '../components/ui/Skeleton'
import { HERO_ILLUSTRATION } from '../lib/illustrations'
import { useNewsQuery, getNews } from '../data/news'
import { useExcosQuery } from '../data/excos'

export default function Home() {
  const navigate = useNavigate()
  const newsQuery = useNewsQuery()
  const excosQuery = useExcosQuery()

  const [featuredNews, ...restNews] = getNews(newsQuery.data ?? []).slice(0, 4)

  return (
    <div>
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

      <div className="mx-auto max-w-[880px] px-5 pt-14 pb-18 sm:px-6">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
              Department news
            </div>
            <h2 className="mt-1.5 text-[28px]">What&rsquo;s happening in the department</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/news')}>
            View all news
          </Button>
        </div>

        {newsQuery.isError ? (
          <ErrorState message="Couldn't load news right now." onRetry={newsQuery.refetch} />
        ) : newsQuery.isLoading ? (
          <>
            <SkeletonCard imageVariant="cover" />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SkeletonCard imageVariant="cover" />
              <SkeletonCard imageVariant="cover" />
              <SkeletonCard imageVariant="cover" />
            </div>
          </>
        ) : featuredNews ? (
          <>
            <Card
              tone={featuredNews.tone}
              eyebrow={featuredNews.category}
              title={featuredNews.title}
              meta={featuredNews.date}
              image={featuredNews.image_url ? { src: featuredNews.image_url } : undefined}
              imageVariant="cover"
              imageAspect="video"
            >
              {featuredNews.body}{' '}
              {featuredNews.badge_tone && <Badge tone={featuredNews.badge_tone}>{featuredNews.badge_label}</Badge>}
            </Card>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {restNews.map((item) => (
                <Card
                  key={item.id}
                  tone={item.tone}
                  eyebrow={item.category}
                  title={item.title}
                  meta={item.date}
                  image={item.image_url ? { src: item.image_url } : undefined}
                  imageVariant="cover"
                  imageAspect="standard"
                >
                  {item.body}{' '}
                  {item.badge_tone && <Badge tone={item.badge_tone}>{item.badge_label}</Badge>}
                </Card>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="mx-auto max-w-[880px] px-5 pb-18 sm:px-6">
        <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
          Executives · 2025/2026
        </div>
        <h2 className="mt-1.5 mb-6 text-[28px]">Meet the Excos</h2>
        {excosQuery.isError ? (
          <ErrorState message="Couldn't load the Excos list right now." onRetry={excosQuery.refetch} />
        ) : excosQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2.5">
                <div className="h-[120px] w-[120px] animate-pulse rounded-full bg-hairline" />
                <SkeletonText lines={2} className="w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {excosQuery.data.map((x) => (
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
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Run: `npm run build`
Manual: `npm run dev` with network throttled, visit `/` — confirm both the news section and the Excos grid show skeletons before content, no layout jump when content arrives. Go offline and reload — confirm both sections show their own `ErrorState` independently (one query failing shouldn't block the other section).

- [ ] **Step 4: Commit**

```bash
git add src/data/excos.js src/pages/Home.jsx
git commit -m "feat: add loading/error states to Home"
```

---

## Task 10: Events — query hook + macro states

**Files:**
- Modify: `src/data/events.js`
- Modify: `src/pages/Events.jsx`

**Interfaces:**
- Produces: `useEventsQuery()` from `src/data/events.js`.

- [ ] **Step 1: Add the query hook**

Modify `src/data/events.js`:

```js
import { useQuery } from '@tanstack/react-query'
import { fetchTable } from '../lib/supabaseQueries'

export function fetchEvents() {
  return fetchTable('events', { orderBy: { column: 'created_at', ascending: true } })
}

export function useEventsQuery() {
  return useQuery({ queryKey: ['events'], queryFn: fetchEvents })
}
```

- [ ] **Step 2: Rewrite the page**

Modify `src/pages/Events.jsx`:

```jsx
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { SkeletonCard } from '../components/ui/Skeleton'
import { EVENT_TONE_ICONS } from '../lib/illustrations'
import { useEventsQuery } from '../data/events'

export default function Events() {
  const { data, isLoading, isError, refetch } = useEventsQuery()
  const rows = data ?? []

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <h1 className="text-[32px]">Events</h1>
      {isError ? (
        <div className="mt-6">
          <ErrorState message="Couldn't load events right now." onRetry={refetch} />
        </div>
      ) : isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No events yet" body="No events posted yet." />
        </div>
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

- [ ] **Step 3: Verify**

Run: `npm run lint`
Run: `npm run build`
Manual: same throttle/offline/empty checks as Task 7, applied to `/events`.

- [ ] **Step 4: Commit**

```bash
git add src/data/events.js src/pages/Events.jsx
git commit -m "feat: add loading/empty/error states to Events"
```

---

## Task 11: Resources pages — query hook + macro states

**Files:**
- Modify: `src/data/resources.js`
- Modify: `src/pages/resources/ResourceLevel.jsx`
- Modify: `src/pages/resources/ResourceList.jsx`

**Interfaces:**
- Produces: `useResourcesQuery()` from `src/data/resources.js`.

- [ ] **Step 1: Add the query hook**

Modify `src/data/resources.js`:

```js
import { useQuery } from '@tanstack/react-query'
import { fetchTable } from '../lib/supabaseQueries'

export { LEVELS, SEMESTER_LABELS } from './outlines'

export function fetchResources() {
  return fetchTable('resources', { orderBy: { column: 'title', ascending: true } })
}

export function useResourcesQuery() {
  return useQuery({ queryKey: ['resources'], queryFn: fetchResources })
}

export function getResources(rows, level, semester) {
  return rows.filter((r) => String(r.level) === String(level) && String(r.semester) === String(semester))
}
```

- [ ] **Step 2: Rewrite ResourceLevel**

Modify `src/pages/resources/ResourceLevel.jsx`:

```jsx
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonText } from '../../components/ui/Skeleton'
import { LEVELS, SEMESTER_LABELS, useResourcesQuery, getResources } from '../../data/resources'

export default function ResourceLevel() {
  const { level } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useResourcesQuery()

  if (!LEVELS.includes(level)) return <Navigate to="/resources" replace />

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Resources', to: '/resources' }, { label: `${level} Level` }]} />
      <h1 className="text-[32px]">{level} Level</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">Choose a semester to see its shared resources.</p>

      {isError ? (
        <div className="mt-8">
          <ErrorState message="Couldn't load resources right now." onRetry={refetch} />
        </div>
      ) : isLoading ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-lg bg-orange-100 p-6">
              <SkeletonText lines={3} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries(SEMESTER_LABELS).map(([sem, label]) => {
            const count = getResources(data ?? [], level, sem).length
            return (
              <button
                key={sem}
                type="button"
                onClick={() => navigate(`/resources/${level}/${sem}`)}
                className="flex flex-col items-start gap-2 rounded-lg bg-orange-100 p-6 text-left transition-transform duration-150 ease-out hover:scale-[1.02]"
              >
                <span className="font-mono text-xs font-semibold uppercase tracking-[.04em] text-orange-600">
                  Semester {sem}
                </span>
                <span className="font-display text-xl text-green-900">{label}</span>
                <span className="font-mono text-sm text-ink-muted">
                  {count} resource{count === 1 ? '' : 's'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Rewrite ResourceList**

Modify `src/pages/resources/ResourceList.jsx`:

```jsx
import { useParams, Navigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import Table from '../../components/ui/Table'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { LEVELS, SEMESTER_LABELS, useResourcesQuery, getResources } from '../../data/resources'

export default function ResourceList() {
  const { level, semester } = useParams()
  const { data, isLoading, isError, refetch } = useResourcesQuery()

  if (!LEVELS.includes(level) || !SEMESTER_LABELS[semester]) return <Navigate to="/resources" replace />

  const items = getResources(data ?? [], level, semester)

  const tableRows = items.map((r) => [
    r.category,
    r.title,
    r.updated,
    <a
      key={r.id}
      href={r.link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border-2 border-transparent bg-transparent px-4.5 py-2 text-sm font-semibold text-ink transition-[background-color,transform] duration-150 ease-out hover:scale-[1.03] hover:bg-green-100"
    >
      Open
    </a>,
  ])

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <Breadcrumbs
        items={[
          { label: 'Resources', to: '/resources' },
          { label: `${level} Level`, to: `/resources/${level}` },
          { label: SEMESTER_LABELS[semester] },
        ]}
      />
      <h1 className="text-[32px]">
        {level} Level &middot; {SEMESTER_LABELS[semester]}
      </h1>
      <p className="mt-2 max-w-2xl text-ink-muted">Shared Drive links and other resources for this semester.</p>

      <div className="mt-6">
        {isError ? (
          <ErrorState message="Couldn't load resources right now." onRetry={refetch} />
        ) : isLoading ? (
          <SkeletonTable columns={4} rows={4} />
        ) : items.length > 0 ? (
          <Table columns={['Category', 'Title', 'Updated', '']} rows={tableRows} />
        ) : (
          <EmptyState title="Nothing here yet" body="No resources published for this semester yet." />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint`
Run: `npm run build`
Run: `npm run test` — `src/data/resources.test.js` must still pass.
Manual: throttle/offline/empty checks on `/resources/:level` and `/resources/:level/:semester`.

- [ ] **Step 5: Commit**

```bash
git add src/data/resources.js src/pages/resources/ResourceLevel.jsx src/pages/resources/ResourceList.jsx
git commit -m "feat: add loading/empty/error states to Resources"
```

---

## Task 12: Outlines pages — query hook + macro states

**Files:**
- Modify: `src/data/outlines.js`
- Modify: `src/pages/outlines/OutlineLevel.jsx`
- Modify: `src/pages/outlines/OutlineCourses.jsx`
- Modify: `src/pages/outlines/OutlineDetail.jsx`

**Interfaces:**
- Produces: `useOutlinesQuery()` from `src/data/outlines.js`.

- [ ] **Step 1: Add the query hook**

Modify `src/data/outlines.js`:

```js
import { useQuery } from '@tanstack/react-query'
import { fetchTable } from '../lib/supabaseQueries'

export const LEVELS = ['100', '200', '300', '400', '500']

export const SEMESTER_LABELS = {
  1: 'First Semester',
  2: 'Second Semester',
}

export function fetchOutlines() {
  return fetchTable('outlines', { orderBy: { column: 'code', ascending: true } })
}

export function useOutlinesQuery() {
  return useQuery({ queryKey: ['outlines'], queryFn: fetchOutlines })
}

export function getCourses(rows, level, semester) {
  return rows.filter((c) => String(c.level) === String(level) && String(c.semester) === String(semester))
}

export function getCourse(rows, level, semester, code) {
  return getCourses(rows, level, semester).find(
    (c) => c.code.replace(/\s+/g, '').toLowerCase() === code.toLowerCase()
  )
}
```

- [ ] **Step 2: Rewrite OutlineLevel**

Modify `src/pages/outlines/OutlineLevel.jsx`:

```jsx
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonText } from '../../components/ui/Skeleton'
import { LEVELS, SEMESTER_LABELS, useOutlinesQuery, getCourses } from '../../data/outlines'

export default function OutlineLevel() {
  const { level } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useOutlinesQuery()

  if (!LEVELS.includes(level)) return <Navigate to="/outlines" replace />

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Outlines', to: '/outlines' }, { label: `${level} Level` }]} />
      <h1 className="text-[32px]">{level} Level</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">Choose a semester to see its course list.</p>

      {isError ? (
        <div className="mt-8">
          <ErrorState message="Couldn't load outlines right now." onRetry={refetch} />
        </div>
      ) : isLoading ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-lg bg-orange-100 p-6">
              <SkeletonText lines={3} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries(SEMESTER_LABELS).map(([sem, label]) => {
            const count = getCourses(data ?? [], level, sem).length
            return (
              <button
                key={sem}
                type="button"
                onClick={() => navigate(`/outlines/${level}/${sem}`)}
                className="flex flex-col items-start gap-2 rounded-lg bg-orange-100 p-6 text-left transition-transform duration-150 ease-out hover:scale-[1.02]"
              >
                <span className="font-mono text-xs font-semibold uppercase tracking-[.04em] text-orange-600">
                  Semester {sem}
                </span>
                <span className="font-display text-xl text-green-900">{label}</span>
                <span className="font-mono text-sm text-ink-muted">
                  {count} course{count === 1 ? '' : 's'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Rewrite OutlineCourses**

Modify `src/pages/outlines/OutlineCourses.jsx`:

```jsx
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import Table from '../../components/ui/Table'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { LEVELS, SEMESTER_LABELS, useOutlinesQuery, getCourses } from '../../data/outlines'

export default function OutlineCourses() {
  const { level, semester } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useOutlinesQuery()

  if (!LEVELS.includes(level) || !SEMESTER_LABELS[semester]) return <Navigate to="/outlines" replace />

  const courses = getCourses(data ?? [], level, semester)
  const slug = (code) => code.replace(/\s+/g, '').toLowerCase()

  const tableRows = courses.map((c) => [
    c.code,
    c.title,
    String(c.units),
    <Button
      key={c.code}
      variant="ghost"
      size="sm"
      onClick={() => navigate(`/outlines/${level}/${semester}/${slug(c.code)}`)}
    >
      View outline
    </Button>,
  ])

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <Breadcrumbs
        items={[
          { label: 'Outlines', to: '/outlines' },
          { label: `${level} Level`, to: `/outlines/${level}` },
          { label: SEMESTER_LABELS[semester] },
        ]}
      />
      <h1 className="text-[32px]">
        {level} Level &middot; {SEMESTER_LABELS[semester]}
      </h1>
      <p className="mt-2 max-w-2xl text-ink-muted">Select a course to view its detailed outline.</p>

      <div className="mt-6">
        {isError ? (
          <ErrorState message="Couldn't load courses right now." onRetry={refetch} />
        ) : isLoading ? (
          <SkeletonTable columns={4} rows={5} />
        ) : courses.length > 0 ? (
          <Table columns={['Code', 'Title', 'Units', '']} rows={tableRows} />
        ) : (
          <EmptyState title="Nothing here yet" body="No courses published for this semester yet." />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rewrite OutlineDetail**

Modify `src/pages/outlines/OutlineDetail.jsx`:

```jsx
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonText } from '../../components/ui/Skeleton'
import { LEVELS, SEMESTER_LABELS, useOutlinesQuery, getCourse } from '../../data/outlines'

export default function OutlineDetail() {
  const { level, semester, code } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useOutlinesQuery()

  if (!LEVELS.includes(level) || !SEMESTER_LABELS[semester]) return <Navigate to="/outlines" replace />

  if (isError) {
    return (
      <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this outline right now." onRetry={refetch} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
        <SkeletonText lines={1} className="w-40" />
        <div className="mt-4">
          <SkeletonText lines={5} />
        </div>
      </div>
    )
  }

  const course = getCourse(data ?? [], level, semester, code)
  if (!course) return <Navigate to={`/outlines/${level}/${semester}`} replace />

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <Breadcrumbs
        items={[
          { label: 'Outlines', to: '/outlines' },
          { label: `${level} Level`, to: `/outlines/${level}` },
          { label: SEMESTER_LABELS[semester], to: `/outlines/${level}/${semester}` },
          { label: course.code },
        ]}
      />

      <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
        {course.code} &middot; {course.units} unit{course.units === 1 ? '' : 's'}
      </div>
      <h1 className="mt-1.5 text-[32px]">{course.title}</h1>
      <div className="mt-2 font-mono text-sm text-ink-muted">
        Lecturer: {course.lecturer} &middot; Updated {course.updated}
      </div>

      <p className="mt-6 max-w-2xl leading-relaxed text-ink">{course.description}</p>

      <Card className="mt-6" eyebrow="Topics covered" padded>
        <ul className="list-disc space-y-1.5 pl-5">
          {course.topics.map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      </Card>

      {course.texts?.length > 0 && (
        <Card className="mt-6" eyebrow="Recommended texts" padded>
          <ul className="list-disc space-y-1.5 pl-5">
            {course.texts.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-8">
        <Button variant="ghost" onClick={() => navigate(`/outlines/${level}/${semester}`)}>
          Back to course list
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify**

Run: `npm run lint`
Run: `npm run build`
Run: `npm run test` — `src/data/outlines.test.js` must still pass.
Manual: throttle/offline/empty checks across `/outlines/:level`, `/outlines/:level/:semester`, and `/outlines/:level/:semester/:code`.

- [ ] **Step 6: Commit**

```bash
git add src/data/outlines.js src/pages/outlines/OutlineLevel.jsx src/pages/outlines/OutlineCourses.jsx src/pages/outlines/OutlineDetail.jsx
git commit -m "feat: add loading/empty/error states to Outlines"
```

---

## Task 13: Opportunities — query hook + macro states

**Files:**
- Modify: `src/data/opportunities.js`
- Modify: `src/pages/Opportunities.jsx`

**Interfaces:**
- Produces: `useOpportunitiesQuery()` from `src/data/opportunities.js`.

- [ ] **Step 1: Add the query hook**

Modify `src/data/opportunities.js`:

```js
import { useQuery } from '@tanstack/react-query'
import { fetchTable } from '../lib/supabaseQueries'

export function fetchOpportunities() {
  return fetchTable('opportunities')
}

export function useOpportunitiesQuery() {
  return useQuery({ queryKey: ['opportunities'], queryFn: fetchOpportunities })
}

export function getOpportunities(list) {
  return [...list].sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
}
```

- [ ] **Step 2: Rewrite the page**

Modify `src/pages/Opportunities.jsx`:

```jsx
import Table from '../components/ui/Table'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { SkeletonTable } from '../components/ui/Skeleton'
import { useOpportunitiesQuery, getOpportunities } from '../data/opportunities'

export default function Opportunities() {
  const { data, isLoading, isError, refetch } = useOpportunitiesQuery()

  const items = getOpportunities(data ?? [])

  const tableRows = items.map((o) => [
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
        {isError ? (
          <ErrorState message="Couldn't load opportunities right now." onRetry={refetch} />
        ) : isLoading ? (
          <SkeletonTable columns={4} rows={5} />
        ) : items.length > 0 ? (
          <Table columns={['Deadline', 'Type', 'Title & Org', '']} rows={tableRows} />
        ) : (
          <EmptyState title="Nothing here yet" body="No opportunities posted yet." />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Run: `npm run build`
Run: `npm run test` — `src/data/opportunities.test.js` must still pass.
Manual: throttle/offline/empty checks on `/opportunities`.

- [ ] **Step 4: Commit**

```bash
git add src/data/opportunities.js src/pages/Opportunities.jsx
git commit -m "feat: add loading/empty/error states to Opportunities"
```

---

## Task 14: Admin — query/mutation states + toast feedback (all 6 admin pages)

**Files:**
- Modify: `src/components/admin/AdminResourceManager.jsx`
- Modify: `src/components/admin/AdminResourceList.jsx`

**Interfaces:**
- Consumes: `useToast` (Task 5), `ErrorState`, `EmptyState` (Tasks 3-4), `SkeletonTable` (Task 2).
- This single component drives all 6 admin CRUD pages (`AdminNews`, `AdminOpportunities`, `AdminEvents`, `AdminResources`, `AdminExcos`, `AdminOutlines` all render `<AdminResourceManager table=... title=... config=... orderBy=... />`), so this task covers every admin page at once.

- [ ] **Step 1: Rewrite AdminResourceManager**

Modify `src/components/admin/AdminResourceManager.jsx`:

```jsx
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import AdminResourceList from './AdminResourceList'
import AdminResourceForm from './AdminResourceForm'
import ErrorState from '../ui/ErrorState'
import { SkeletonTable } from '../ui/Skeleton'
import { generateId } from '../../lib/adminFields'
import { useToast } from '../../lib/ToastContext'

async function loadRows(table, orderBy) {
  let query = supabase.from(table).select('*')
  if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export default function AdminResourceManager({ table, title, config, orderBy }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [view, setView] = useState({ mode: 'list' })

  const { data: rows, isLoading, isError, refetch } = useQuery({
    queryKey: [table],
    queryFn: () => loadRows(table, orderBy),
  })

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (view.mode === 'edit') {
        const result = await supabase.from(table).update(payload).eq('id', view.record.id).select()
        if (result.error) throw result.error
        if (!result.data || result.data.length === 0) {
          throw new Error('No changes were saved — your account may not have admin access to make this change.')
        }
        return result.data
      }
      const id = generateId(payload[config.idField])
      const result = await supabase.from(table).insert({ ...payload, id })
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] })
      toast.success(view.mode === 'edit' ? `${title} updated.` : `${title} added.`)
      setView({ mode: 'list' })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (row) => {
      const { data, error } = await supabase.from(table).delete().eq('id', row.id).select()
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('No changes were saved — your account may not have admin access to make this change.')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] })
      toast.success(`${title} deleted.`)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <Link to="/admin" className="text-sm font-semibold text-green-700 no-underline hover:underline">
        ← Back to Admin
      </Link>
      <h1 className="text-[32px]">{title}</h1>

      {isError ? (
        <div className="mt-6">
          <ErrorState message={`Couldn't load ${title.toLowerCase()} right now.`} onRetry={refetch} />
        </div>
      ) : isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={config.listColumns.length + 1} rows={5} />
        </div>
      ) : view.mode === 'list' ? (
        <div className="mt-6">
          <AdminResourceList
            config={config}
            rows={rows}
            onEdit={(record) => setView({ mode: 'edit', record })}
            onDelete={(row) => deleteMutation.mutate(row)}
            onAddNew={() => setView({ mode: 'new' })}
          />
        </div>
      ) : (
        <div className="mt-6">
          <AdminResourceForm
            config={config}
            record={view.mode === 'edit' ? view.record : undefined}
            onSubmit={(payload) => saveMutation.mutate(payload)}
            onCancel={() => setView({ mode: 'list' })}
            saving={saveMutation.isPending}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Swap the inline empty-state text for EmptyState**

Modify `src/components/admin/AdminResourceList.jsx`:

```jsx
import { useState } from 'react'
import Table from '../ui/Table'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'

export default function AdminResourceList({ config, rows, onEdit, onDelete, onAddNew }) {
  const [confirmingId, setConfirmingId] = useState(null)

  const tableRows = rows.map((row) => [
    ...config.listColumns.map((col) => String(row[col.field] ?? '')),
    <div key={row.id} className="flex gap-2">
      <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
        Edit
      </Button>
      {confirmingId === row.id ? (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            setConfirmingId(null)
            onDelete(row)
          }}
        >
          Confirm delete
        </Button>
      ) : (
        <Button variant="destructive" size="sm" onClick={() => setConfirmingId(row.id)}>
          Delete
        </Button>
      )}
    </div>,
  ])

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" size="sm" onClick={onAddNew}>
          Add new
        </Button>
      </div>
      {rows.length > 0 ? (
        <Table columns={[...config.listColumns.map((c) => c.label), '']} rows={tableRows} />
      ) : (
        <EmptyState
          title={`No ${config.title.toLowerCase()} yet`}
          body={`Add your first ${config.title.toLowerCase()} entry to get started.`}
          actionLabel="Add new"
          onAction={onAddNew}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Run: `npm run build`
Manual: sign in with an Exco account, visit `/admin/news`. Confirm the skeleton table shows on first load. Add a news item — confirm a success toast appears and the list refreshes without a full page reload. Edit an item — confirm the update toast appears. Delete an item — confirm the delete toast appears and the row disappears. Delete all rows (or test on a table you can empty) — confirm `EmptyState` with "Add new" renders. Force a failure (e.g. temporarily rename a required field in the payload to violate a DB constraint, or go offline before submitting) — confirm an error toast appears and you stay on the form/list to retry. Repeat spot-checks on at least one more admin page (e.g. `/admin/events`) to confirm the shared component works generically.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminResourceManager.jsx src/components/admin/AdminResourceList.jsx
git commit -m "feat: add query/mutation states and toast feedback to Admin CRUD"
```

---

## Task 15: Cgpa — fix blank loading state

**Files:**
- Modify: `src/pages/Cgpa.jsx`

**Interfaces:**
- Consumes: `SkeletonCard`, `SkeletonTable` (Task 2). No change to any mutation logic (see Global Constraints — Cgpa's mutation error handling is left as-is).

- [ ] **Step 1: Replace the blank loading return**

Modify `src/pages/Cgpa.jsx` — add the import:

```jsx
import { SkeletonCard, SkeletonTable } from '../components/ui/Skeleton'
```

and replace this block:

```jsx
  if (authLoading || loading) {
    return null
  }
```

with:

```jsx
  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
        <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
          CGPA calculator
        </div>
        <h1 className="mt-1.5 text-[32px]">Your academic record</h1>
        <div className="mt-6">
          <SkeletonCard />
        </div>
        <div className="mt-6">
          <SkeletonTable columns={6} rows={3} />
        </div>
      </div>
    )
  }
```

Every other line in the file is unchanged.

- [ ] **Step 2: Verify**

Run: `npm run lint`
Run: `npm run build`
Manual: `npm run dev`, sign in, throttle network, visit `/cgpa` — confirm a skeleton shell shows instead of a blank white page while semesters load.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Cgpa.jsx
git commit -m "fix: replace Cgpa's blank loading state with a skeleton"
```

---

## Task 16: Button — press feedback

**Files:**
- Modify: `src/components/ui/Button.jsx`

- [ ] **Step 1: Add an active/press state**

Modify `src/components/ui/Button.jsx` — change this line:

```jsx
        isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.03]',
```

to:

```jsx
        isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.03] active:scale-[0.98]',
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Run: `npm run build`
Manual: `npm run dev`, click and hold any primary button — confirm it visibly shrinks slightly on press (distinct from the hover grow), and releases back on mouseup.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Button.jsx
git commit -m "feat: add press feedback to Button"
```

---

## Task 17: FormField — focus + success states

**Files:**
- Modify: `src/components/ui/FormField.jsx`
- Modify: `src/pages/Signup.jsx`

**Interfaces:**
- Produces: `FormField` gains an optional `success` boolean prop (default `false`). Existing callers are unaffected since it defaults off.

- [ ] **Step 1: Add the prop and styling**

Modify `src/components/ui/FormField.jsx`:

```jsx
export default function FormField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  helper,
  error,
  options,
  required = false,
  success = false,
}) {
  const controlClass = [
    'rounded-sm border px-3 py-2.5 text-base bg-surface text-ink transition-colors duration-150',
    'focus:outline-none focus:border-green-700',
    error ? 'border-danger' : success ? 'border-success' : 'border-hairline',
  ].join(' ')

  return (
    <label className="flex flex-col gap-1.5 font-body">
      <span className="text-sm font-medium text-green-900">{label}</span>
      {type === 'select' ? (
        <select value={value} onChange={onChange} required={required} className={controlClass}>
          {(options || []).map((o, i) => (
            <option key={i} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          rows={5}
          className={controlClass}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className={controlClass}
        />
      )}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : success ? (
        <span className="text-xs text-success">Looks good</span>
      ) : helper ? (
        <span className="text-xs text-ink-muted">{helper}</span>
      ) : null}
    </label>
  )
}
```

- [ ] **Step 2: Use it on Signup's confirm-password field**

Modify `src/pages/Signup.jsx` — change the "Confirm password" `FormField`:

```jsx
        <FormField
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          success={confirmPassword.length > 0 && confirmPassword === password && !errors.confirmPassword}
        />
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Run: `npm run build`
Manual: `npm run dev`, tab into any form input — confirm the border turns green-700 on focus (in addition to the existing orange focus ring). Visit `/signup`, type a password, then type a matching confirm-password — confirm the field's border turns success-green and "Looks good" appears below it; make it mismatch — confirm it reverts to the error state instead.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/FormField.jsx src/pages/Signup.jsx
git commit -m "feat: add focus and success states to FormField"
```

---

## Task 18: Card — interactive hover lift

**Files:**
- Modify: `src/components/ui/Card.jsx`
- Modify: `src/pages/News.jsx`

**Interfaces:**
- Produces: `Card` gains an optional `interactive` boolean prop (default `false`). Existing callers are unaffected since it defaults off.

- [ ] **Step 1: Add the prop and styling**

Modify `src/components/ui/Card.jsx`:

```jsx
const tones = {
  neutral: { bg: 'bg-surface', eyebrow: 'text-ink-muted', title: 'text-green-900', meta: 'text-ink-muted', body: 'text-ink' },
  green: { bg: 'bg-green-700', eyebrow: 'text-orange-400', title: 'text-white', meta: 'text-white/70', body: 'text-white/90' },
  orange: { bg: 'bg-orange-100', eyebrow: 'text-orange-600', title: 'text-green-900', meta: 'text-ink-muted', body: 'text-ink' },
}

const imageAspects = {
  standard: 'aspect-[4/3]',
  video: 'aspect-[16/9]',
}

export default function Card({
  eyebrow,
  title,
  meta,
  children,
  padded = true,
  tone = 'neutral',
  className = '',
  image,
  imageVariant = 'icon',
  imageAspect = 'standard',
  interactive = false,
}) {
  const t = tones[tone] || tones.neutral

  return (
    <div
      className={[
        'flex flex-col gap-2 rounded-lg transition-[transform,box-shadow] duration-150 ease-out',
        interactive ? 'hover:-translate-y-0.5 hover:shadow-md' : '',
        t.bg,
        className,
      ].join(' ')}
    >
      {image && imageVariant === 'cover' && (
        <img
          src={image.src}
          alt=""
          aria-hidden="true"
          className={['w-full rounded-t-lg object-cover', imageAspects[imageAspect] || imageAspects.standard].join(' ')}
        />
      )}
      <div className={['flex flex-col gap-2', padded ? 'p-6' : ''].join(' ')}>
        {image && imageVariant === 'icon' && (
          <img src={image.src} alt="" aria-hidden="true" className="h-16 w-16 object-contain" />
        )}
        {eyebrow && (
          <div className={['font-mono text-xs uppercase tracking-[.04em] font-semibold', t.eyebrow].join(' ')}>
            {eyebrow}
          </div>
        )}
        {title && <h3 className={['text-xl m-0', t.title].join(' ')}>{title}</h3>}
        {meta && <div className={['font-mono text-sm', t.meta].join(' ')}>{meta}</div>}
        {children && <div className={['text-base leading-relaxed', t.body].join(' ')}>{children}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Apply it to News' linked cards**

Modify `src/pages/News.jsx` — add `interactive` to both `<Card>` usages (the featured one and the grid one):

```jsx
            <Card
              interactive
              tone={featured.tone}
              eyebrow={featured.category}
              title={featured.title}
              meta={featured.date}
              image={featured.image_url ? { src: featured.image_url } : undefined}
              imageVariant="cover"
              imageAspect="video"
            >
```

and

```jsx
                <Card
                  interactive
                  tone={item.tone}
                  eyebrow={item.category}
                  title={item.title}
                  meta={item.date}
                  image={item.image_url ? { src: item.image_url } : undefined}
                  imageVariant="cover"
                  imageAspect="standard"
                >
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Run: `npm run build`
Manual: `npm run dev`, visit `/news`, hover a card — confirm it lifts slightly with a shadow (distinct from non-interactive cards elsewhere, e.g. Home's news teaser cards or Events cards, which should NOT lift since they don't pass `interactive`).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Card.jsx src/pages/News.jsx
git commit -m "feat: add interactive hover state to Card"
```

---

## Task 19: ImageUploadField — visible drag feedback

**Files:**
- Modify: `src/components/admin/ImageUploadField.jsx`

- [ ] **Step 1: Track and show a dragging state**

Modify `src/components/admin/ImageUploadField.jsx`:

```jsx
import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { clampImageWidth } from '../../lib/adminFields'

export default function ImageUploadField({ label, url, widthPct, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const previewRef = useRef(null)
  const dragState = useRef(null)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB.')
      return
    }
    setError('')
    setUploading(true)
    const path = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const { error: uploadError } = await supabase.storage.from('news-images').upload(path, file)
    setUploading(false)
    if (uploadError) {
      setError(uploadError.message)
      return
    }
    const { data } = supabase.storage.from('news-images').getPublicUrl(path)
    onChange({ url: data.publicUrl, widthPct: widthPct || 100 })
  }

  function handlePointerDown(e) {
    if (!previewRef.current) return
    dragState.current = {
      startX: e.clientX,
      startWidth: widthPct || 100,
      containerWidth: previewRef.current.offsetWidth,
    }
    setDragging(true)
    e.target.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e) {
    if (!dragState.current) return
    const { startX, startWidth, containerWidth } = dragState.current
    const deltaPct = ((e.clientX - startX) / containerWidth) * 100
    onChange({ url, widthPct: clampImageWidth(startWidth + deltaPct) })
  }

  function handlePointerUp() {
    dragState.current = null
    setDragging(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-green-900">{label}</span>
      <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} />
      {error && <span className="text-xs text-danger">{error}</span>}
      {url && (
        <div ref={previewRef} className="relative mt-2 max-w-[400px] rounded-sm bg-green-100 p-2">
          <img src={url} alt="" style={{ width: `${widthPct || 100}%` }} className="rounded-sm" />
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={[
              'absolute bottom-2 right-2 h-4 w-4 cursor-nwse-resize rounded-sm bg-green-700 transition-transform duration-150',
              dragging ? 'scale-125 ring-2 ring-orange-500' : '',
            ].join(' ')}
            title="Drag to resize"
          />
          <span className="mt-1 block font-mono text-xs text-ink-muted">{widthPct || 100}% width</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Run: `npm run build`
Manual: sign in, go to `/admin/news`, add/edit an item with an image, drag the resize handle — confirm it visibly scales up and gets an orange ring while dragging, and returns to normal on release.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ImageUploadField.jsx
git commit -m "feat: add visible drag feedback to ImageUploadField"
```

---

## Task 20: Route transitions

**Files:**
- Modify: `src/components/Layout.jsx`

**Interfaces:**
- Consumes: `motion`, `AnimatePresence`, `useReducedMotion` from `motion/react` (new dependency).

- [ ] **Step 1: Install the dependency**

Run: `npm install motion`

- [ ] **Step 2: Wrap the routed content in a transition**

Modify `src/components/Layout.jsx`:

```jsx
import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Navbar from './Navbar'
import Footer from './Footer'
import { SkeletonText } from './ui/Skeleton'

export default function Layout() {
  const location = useLocation()
  const reducedMotion = useReducedMotion()

  return (
    <div className="min-h-svh flex flex-col bg-paper">
      <Navbar />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
              <SkeletonText lines={3} />
            </div>
          }
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Run: `npm run build`
Manual: `npm run dev`, navigate between several pages (e.g. Home → News → Events) — confirm a brief fade+slide plays on each navigation, and it does NOT play on the very first page load (hard refresh). Enable "prefers reduced motion" (DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`, or your OS accessibility setting) and navigate again — confirm the transition drops to instant/no-slide.

- [ ] **Step 4: Commit**

```bash
git add src/components/Layout.jsx package.json package-lock.json
git commit -m "feat: add route transition animation"
```

---

## Self-Review Notes

- **Spec coverage:** Infrastructure (Tasks 1, 6) ✓. Macro state primitives (Tasks 2-5) ✓. Rollout across News/NewsDetail/Home/Events/Resources/Outlines/Opportunities (Tasks 7-13) ✓ — Home was added beyond the spec's explicit page list because it independently fetches news and excos and has the exact same flash/blank-state problem; this is a natural extension of the approved design, not scope creep. Admin (Task 14) ✓, covers all 6 admin pages via the shared `AdminResourceManager`. Micro-interactions — Button (16), FormField (17), Card (18), ImageUploadField (19) ✓. Route transitions (Task 20) ✓. Cgpa scope reduction is called out explicitly in Global Constraints, not silently dropped.
- **Type/interface consistency:** every `useXQuery()` hook returns the same shape (`{ data, isLoading, isError, refetch }`) and every consumer destructures the same names — checked across Tasks 7-13. `Card`'s new `interactive` prop and `FormField`'s new `success` prop both default to off, so no existing call site needs updating except the ones intentionally changed in Tasks 17-18.
- **Placeholder scan:** no TBD/TODO markers; every step shows the literal file contents or diff.
