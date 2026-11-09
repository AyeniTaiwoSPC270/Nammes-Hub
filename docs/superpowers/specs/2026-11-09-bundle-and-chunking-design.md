# Bundle Budget and Chunking

The app has 104 lazy-routed pages but no chunk budget, no bundle analyzer, and no `manualChunks`,
so vendor code and React ship inside route chunks and the initial payload drifts upward unwatched.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| `vite.config.js` | `build.rollupOptions.output.manualChunks`: `react` vendor, `supabase` vendor, `recharts`/`jspdf` lazy-only |
| CI | `bundlesize` step (or `size-limit`) failing the build over the budget |
| Analyzer | `rollup-plugin-visualizer` behind `npm run build:analyze`, output gitignored |
| Nav prefetch | Hover/focus prefetch of the next likely route chunk in `Navbar` |

### Out

- **SSR or prerendering.** This spec is about shipping less JS, not about rendering strategy.
- **Per-route rewrites of existing pages.** Chunks split by import graph, not by page edits.

---

## 2. The problem

`vite.config.js` declares plugins and a test exclude and nothing else; there is no chunking policy,
so every deploy silently re-partitions vendor code. `App.jsx` lazy-imports pages with `lazyRetry`
(good), but `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js` and `recharts` land in
whichever chunk first imports them. `recharts` (used by admin analytics) is heavy enough to dominate a
chunk if it ever shares one with a public route.

There is no enforced upper limit. A performance regression today is invisible until a student on
3G notices.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Budget | Initial JS ≤ 250 KB gzip; per-route chunk ≤ 150 KB gzip | 3G mid-range Android is the design target |
| Vendor split | `react`+`react-dom`+`scheduler`, `router`, `supabase` in named vendor chunks | Long-term caching via content hash; app code changes don't bust vendor cache |
| Chart/PDF libs | Keep dynamic-imported only; no static import from public pages | They are admin-only; they must never reach the landing path |
| Analyzer | `npm run build:analyze` prints treemap to `dist/stats.html` | Inspect before merge, not after incident |
| CI gate | `size-limit` on the entry chunk | Budgets that aren't in CI are wishes |
| Prefetch | `onMouseEnter`/`onFocus` on primary nav links calls `import()` | Perceived instant navigation without eager download |

## 4. The change

```js
// vite.config.js (build key only)
build: {
  rollupOptions: { output: { manualChunks: {
    react: ['react', 'react-dom', 'scheduler'],
    router: ['react-router-dom'],
    supabase: ['@supabase/supabase-js'],
  } } },
},
```

Add `"size-limit": [{ "path": "dist/assets/index-*.js", "limit": "250 KB" }]` and a CI step after
`npm run build`. Prefetch: a tiny `prefetch(path)` helper in `src/lib/` used by `Navbar.jsx`.

## 5. Verification

1. `npm run build` then `npx size-limit` — entry chunk ≤ 250 KB gzip.
2. `npm run build:analyze` — no `recharts`/`jspdf` in the entry graph.
3. `npm run dev` smoke: nav works, prefetch fires, `lazyRetry` still retries a failed chunk.
4. Lighthouse on `/` before/after on throttled 3G; record LCP delta in the PR.

## 6. Risk

`manualChunks` can create circular chunk warnings with mixed static/dynamic imports; if that appears,
split by package family instead of by hand and re-measure. Prefetch must be hover-gated — prefetching
admin chunks from the public navbar would download code a student never runs.
