# App Route Registry

`src/App.jsx` is the integration hotspot (67 commits of churn) — every feature touches it, merge
conflicts concentrate there, and the 100+ routes are unstructured JSX.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Route config | `src/routes.jsx` — array of `{ path, element, guard?, prefetch? }` per domain |
| `App.jsx` | Shrinks to `<Routes>` map over the config + providers + `ErrorBoundary` |
| Domain files | `src/routes/public.jsx`, `src/routes/admin.jsx`, `src/routes/quiz.jsx`, … |
| Guards | `RequireAdmin`, `RequireAuth`, `FeatureFlagGate` as small wrappers referenced by name |

### Out

- **Data APIs / framework change.** No TanStack Router, no file-system routes; keep React Router v7 shape.
- **Per-route code-splitting changes.** Already lazy; config preserves the lazy imports.

---

## 2. The problem

67 churns in 4 months means every feature PR edits the same file — review diffs drown in route noise, and a bad merge silently drops a route. 104+ lazy imports inline in JSX make the dependency graph hard to reason about.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Shape | Config array per domain, flattened in `routes.jsx` | Domain-owned edits; one import site |
| Guards | Named wrappers (`<RequireAdmin>`), not inline `isAdmin ? …` ternaries | Authz logic stays in one file, testable |
| Lazy | Keep `lazyRetry` imports in the domain route files | Splitting travels with its routes |
| 404 | `path="*"` stays last; enforced by a unit test asserting last entry | No one ships an unreachable 404 |
| Tests | Snapshot of route table (paths+guards) — changes are deliberate diffs | Review one file, see every route change |

## 4. The change

Create `src/routes/*.jsx`; move `const X = lazyRetry(...)` blocks by domain; `App.jsx` maps
`routes.flatMap(r => <Route key={r.path} path={r.path} element={withGuard(r)} />)`. Add
`src/routes/routes.test.jsx` snapshot + assertion "last route is `*`".

## 5. Verification

1. Route snapshot stable pre/post migration (generate before moving anything).
2. Click-through of 10 representative routes incl. admin, CBT, quiz play, 404.
3. `npm run build` chunk layout unchanged (±1 chunk).

## 6. Risk

Subtle behavior differences (loader timing, suspense placement). Snapshot first, move mechanically,
and run the existing vitest suite per move batch. If a route had inline auth JSX, it becomes a guard —
that is the point, but each conversion needs a test.
