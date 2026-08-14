# App Performance & State System — Design

## Problem

The app feels slow and janky even where actual load times are reasonable:

- Every data-driven page shows a bare `<p>Loading…</p>` (e.g. `src/pages/News.jsx:34-40`), so the user sees blank → loading text → content: three visual jumps with no shape continuity (a "flash").
- `App.jsx` imports every page eagerly — the initial bundle ships all admin pages, all forms, everything, before the user sees the homepage.
- No error boundaries anywhere. A failed Supabase call leaves a page stuck on "Loading…" forever, or a render crash shows a white screen.
- No route transitions — `react-router-dom` swaps content instantly, which reads as jarring.
- No consistent empty-state, success-feedback, or micro-interaction (focus/press/success) treatment across the app.
- Data is re-fetched from Supabase on every mount, including on back-navigation to a page the user just left.

The design handoff (`../NAMMES Hub Design System/design_handoff_nammes_hub/`) only specifies Button/Card/Badge/Table/FormField/Navbar/Footer — it has no skeleton, error, empty, or toast components. This is genuinely undesigned territory, not something this work overrides.

## Goals

1. Eliminate the loading "flash" — skeletons shaped like the real content, no layout shift.
2. Give every data-driven screen a consistent Ideal / Empty / Loading / Error / Imperfect treatment.
3. Reduce actual load cost — route-level code splitting, cached/deduped data fetching.
4. Add subtle, consistent route transitions.
5. Round out micro-interaction states (focus, press, success) on existing components, scoped to what this app actually uses — not the full abstract taxonomy.

## Non-goals

- No redesign of any page's content layout — this only adds states around existing content per `DESIGN_SYSTEM.md`.
- No On/Off toggle component — no toggle/switch exists in the app today.
- No "filling vs filled" visual distinction — nothing here does per-keystroke async validation to justify a separate typing state beyond focus.
- No dark mode, no new icon set (per `DESIGN_SYSTEM.md`'s existing out-of-scope list).

## New dependencies

- `@tanstack/react-query` — data fetching/caching/mutation state.
- `motion` (Framer Motion) — route transition animation.

## Delivery approach

Phased, not big-bang, because macro-state components depend on the query infrastructure, and rolling transitions in before the flicker is fixed would animate broken states. Each phase is a separate implementation step/PR:

1. Infrastructure (query client, code splitting, error boundary)
2. Macro states (skeleton/empty/error/toast), rolled out per page
3. Micro-interaction polish
4. Route transitions

## 1. Infrastructure

**Query client** — `src/lib/queryClient.js` exports a configured `QueryClient` (short `staleTime`, e.g. 30s, so back-navigation within that window is instant with no refetch; 1 retry on failure; refetch-on-window-focus left on for freshness). Wrapped around `<App/>` in `src/main.jsx` via `QueryClientProvider`.

**Code splitting** — every page import in `App.jsx` becomes `React.lazy(() => import('./pages/...'))`. A single `<Suspense>` wraps `<Routes>` inside `Layout`, with a fallback shell (a minimal skeleton, not a spinner — see §2) so the first paint after a route change is already shaped like content.

**Error boundary** — `src/components/ErrorBoundary.jsx`, a class component implementing `componentDidCatch`, wraps `<Layout/>` in `App.jsx`. On catch, renders the shared `ErrorState` (§2) full-page, with a "Reload page" action (`window.location.reload()`).

## 2. Macro states

New shared components in `src/components/ui/`, following existing token/shape conventions (`rounded-lg` cards, `rounded-md` tables, hairline/green-100 tones, no new colors):

- **`Skeleton.jsx`** — exports `SkeletonText` (one or more `bg-hairline` pulse bars, configurable width/count), `SkeletonCard` (matches `Card`'s `rounded-lg` shape and padding, with placeholder eyebrow/title/body bars, optional image-block for `imageVariant="cover"` cards), `SkeletonTable` (matches `Table`'s `rounded-md`, header + N placeholder rows). Pulse via a shared `animate-pulse` treatment.
- **`EmptyState.jsx`** — props: `title`, `body`, optional `action` (label + onClick, renders as `Button`). No icon (no icon set chosen per design system) — leans on the existing category illustrations where a page already has one in context (e.g. News empty-by-category could reuse the relevant category icon), otherwise text-only.
- **`ErrorState.jsx`** — props: `message` (defaults to a generic "Something went wrong" copy), `onRetry`. Renders message + a `Button` wired to `onRetry`.
- **`Toast.jsx` + `src/lib/ToastContext.jsx`** — `ToastProvider` (mounted once in `main.jsx` or `Layout`) exposes a `useToast()` hook returning `{ success(msg), error(msg) }`. Toasts stack bottom-right (or bottom-center on mobile), auto-dismiss after ~4s, use `success`/`danger` tokens, dismissible on click.

**Data flow change:** existing fetch functions in `src/data/*.js` (`fetchNews`, etc.) become the `queryFn` for a `useQuery` call. Each domain gets a thin hook alongside its existing exports, e.g. `src/data/news.js` adds `useNewsQuery()` → `useQuery({ queryKey: ['news'], queryFn: fetchNews })`. Pages consume `{ data, isLoading, isError, refetch }` instead of hand-rolled `useState`/`useEffect`. Admin create/update/delete becomes `useMutation` with `onSuccess: () => { queryClient.invalidateQueries(['news']); toast.success(...) }` and `onError` triggering `toast.error(...)`.

**Rollout order** (list pages first, they're the most-visited): News → Events → Resources → Outlines → Opportunities → Cgpa → Admin lists (News/Events/Resources/Outlines/Opportunities/Excos). Each page: loading → matching `Skeleton*`; empty (zero rows, or zero after filter) → `EmptyState`; error → `ErrorState` with retry; success with content → unchanged existing rendering (this is the "Ideal" state, already built). "Imperfect" (partial/truncated content) is handled via `line-clamp` on card titles/body where content can overflow, so long titles truncate gracefully instead of breaking card layout.

## 3. Micro-interactions

Scoped to states this app can actually distinguish:

- **Button** (`src/components/ui/Button.jsx`) — already has hover (`hover:scale-[1.03]`), disabled/loading (`opacity-50`), and the global `:focus-visible` ring. Add an explicit `active:scale-[0.98]` for press feedback (currently presses look identical to hover).
- **FormField** (`src/components/ui/FormField.jsx`) — add `focus:border-green-700 focus:outline-none` (currently relies only on the global focus ring, no border change) and a success state: when a `success` prop is true (caller-driven, e.g. Signup's password-confirmation match, or a required field that's filled and passed validation), border goes `border-success` with an inline checkmark-free label color change (no new icon).
- **Card** (`src/components/ui/Card.jsx`) — when rendered inside a `<Link>` (News/Events cards), add a hover lift: `hover:shadow-md hover:-translate-y-0.5 transition` so it reads as clickable, matching the existing `duration-150` motion language.
- **ImageUploadField** (`src/components/admin/ImageUploadField.jsx`) — the resize handle already has a working drag interaction (`handlePointerDown/Move/Up`); add a visual dragged state (ring/scale on the handle while `dragState.current` is set) so the interaction is visible, not just functional.
- **Navbar** — active/selected state already implemented (green-100 bg + green-700 text); no change.

Explicitly not building: On/Off toggle (nothing to toggle yet), a separate "filling" state distinct from focus.

## 4. Route transitions

`motion`'s `AnimatePresence` wraps the `<Outlet/>` in `Layout.jsx`; each route's content is a `motion.div` with a fade + 8px vertical slide, ~180ms, easing consistent with the design system's `duration-150` feel. Respects `prefers-reduced-motion` via `useReducedMotion()` — reduces to opacity-only fade with no slide. No transition plays on the very first page load, only on navigation between routes (`Suspense` fallback from §1 handles the code-split loading gap; the motion transition handles the swap once resolved).

## Error handling summary

| Failure | Handling |
|---|---|
| Supabase query fails | `ErrorState` with retry, via `isError`/`refetch` from `useQuery` |
| Component render throws | `ErrorBoundary` → full-page `ErrorState`, "Reload page" |
| Form validation fails | Existing `FormField` `error` prop (unchanged) |
| Admin mutation fails | `Toast.error(...)`, form/list stays in place for retry |

## Testing

Matches the existing project convention (no component-level tests exist today for Button/Card/etc. — no React Testing Library dependency is installed). New UI components (`Skeleton`, `EmptyState`, `ErrorState`, `Toast`) stay unit-test-free, consistent with the rest of `src/components/ui/`. Any new pure logic (e.g. a query-key helper, if one emerges) gets a `.test.js` file matching the existing `src/data/*.test.js` / `src/lib/*.test.js` pattern.

Verification is manual, per phase:
- Infrastructure: dev server loads, network tab shows per-route JS chunks instead of one bundle, a thrown error in a test component is caught by the boundary.
- Macro states: throttle network (DevTools) to observe skeletons before content; go offline to see error+retry; filter News to an empty category to see the empty state; confirm admin create/update/delete shows success/error toasts.
- Micro-interactions: manual hover/focus (keyboard tab)/press/success check on Button, FormField, Card, and the image resize handle.
- Route transitions: navigate between pages, confirm fade/slide plays once per navigation and respects `prefers-reduced-motion` (OS-level toggle or DevTools emulation).

## Rollout phases (for the implementation plan)

1. **Infrastructure** — `@tanstack/react-query` setup, code splitting in `App.jsx`, `ErrorBoundary`.
2. **Macro states, list pages** — `Skeleton`/`EmptyState`/`ErrorState`/`Toast` built, applied to News → Events → Resources → Outlines → Opportunities → Cgpa.
3. **Macro states, Admin** — same components applied to Admin list/CRUD pages, mutations wired to toasts.
4. **Micro-interactions** — Button/FormField/Card/ImageUploadField polish.
5. **Route transitions** — `motion` added, `Layout.jsx` wrapped.
