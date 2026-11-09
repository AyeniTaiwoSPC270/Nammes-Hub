# App Route Registry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the 100+ route declarations out of `src/App.jsx` into per-domain config files, with a route-table snapshot test so no route is ever silently lost.

**Architecture:** `src/routes/*.jsx` config arrays, flattened in `src/routes/index.jsx` and mapped by `<Routes>` in App.jsx. Guards (`RequireAuth`, `RequireAdmin`, maybe `FeatureFlagGate`) become small named components. The `*` 404 route is asserted last by a test.

**Tech Stack:** React Router v7, `lazyRetry` (src/lib/lazyRetry.js), vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-app-route-registry-design.md`

## Global Constraints

- Behavior must not change: paths, lazy-loading, auth redirects identical. Snapshot first, then move.
- One domain per commit; `npm test` after each; `git log --follow` history preserved via `git mv`.
- Do **not** rename pages or their default exports in this plan.

---

## Task 1: Capture the baseline route table

- [ ] Read `src/App.jsx` fully. Extract every `<Route path=…>` + its guard/element conditions into `docs/perf/routes-baseline-2026-11.md` (path · guard · element). Expect 100+ entries.
- [ ] Note how auth redirects work today (some routes likely inline `<RequireAuth>` or check `useAuth` inside pages — record which).

## Task 2: Guard components

**Files:** Create `src/components/RequireAuth.jsx`, `src/components/RequireAdmin.jsx`

- [ ] `RequireAuth`: unauthenticated → `Navigate to '/login' state={{ from: location }}` (match current behavior — copy the exact redirect target App.jsx uses).
- [ ] `RequireAdmin`: unauthenticated → login; authenticated non-admin → inline "Not authorized" card (or current behavior; mirror it).
- [ ] Component tests with a mocked AuthContext (vitest + `renderToString`? — keep to prop-driven smoke if no RTL exists; this codebase has no component tests, so a `routes.test.jsx` doing plain data assertions is preferred over JSX rendering).

## Task 3: Domain configs

**Files:** Create `src/routes/{public,academics,community,admin,quiz,cbt}.jsx` + `src/routes/index.jsx`

Each domain file:

```jsx
import { lazyRetry } from '../lib/lazyRetry';
const Home = lazyRetry(() => import('../pages/Home'));
…
export const publicRoutes = [
  { path: '/', element: <Layout><Home /></Layout> },        // mirror however App.jsx wraps (check Layout usage first!)
  …
];
```

- [ ] Move routes domain by domain: public pages → `public.jsx`; outlines/curriculum/timetable/cbt/cgpa/resources → `academics.jsx`; news/events/opportunities/forms/awards → `community.jsx`; quiz family (incl. `/play`, host/play/battle) → `quiz.jsx`; CBT → `cbt.jsx`; `/admin/*` → `admin.jsx` (RequireAdmin).
- [ ] `routes/index.jsx` flattens: `export const routes = [...publicRoutes, ...academicsRoutes, …, { path: '*', element: <NotFound /> }];`
- [ ] App.jsx becomes: providers + `<Routes>{routes.map(r => <Route key={r.path} path={r.path} element={r.element} />)}</Routes>`.

## Task 4: The safety-net test

**Files:** Create `src/routes/routes.test.jsx`

- [ ] Assert: every path from `docs/perf/routes-baseline-2026-11.md` appears exactly once; last route is `*`; admin paths all render under RequireAdmin (inspect config structure, not rendering).

## Task 5: Verify

- [ ] Click-through of 12 routes (public 5, quiz 2, CBT 1, admin 4 incl. login redirect) in dev server + `npm test`/`lint`/`build`. Bundle unaffected (same dynamic imports, just relocated).

## Rollback

`git revert` per-domain commits; App.jsx stays buildable at every step.
