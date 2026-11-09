# Bundle Budget and Chunking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cap the initial JS at 250 KB gzip, split vendors deliberately, and keep heavy admin-only libraries off public chunks — enforced in CI so it stays true.

**Architecture:** `manualChunks` for react/router/supabase; `rollup-plugin-visualizer` behind `npm run build:analyze`; `size-limit` budgets on entry + vendor chunks in CI; hover/focus prefetch on the navbar.

**Tech Stack:** Vite 8, `size-limit`, `rollup-plugin-visualizer` (both dev-deps, free).

**Spec:** `docs/superpowers/specs/2026-11-09-bundle-and-chunking-design.md`

## Global Constraints

- No dependency added except the two dev tools. No SSR, no prerender in this plan.
- Public entry must never contain `recharts`, `jspdf`, `pdfjs-dist`, `katex` — verify with the analyzer, not by eye.
- Keep `lazyRetry` semantics (chunk-retry) untouched.

---

## Task 1: Analyzer first (see the truth)

- [ ] `npm install -D rollup-plugin-visualizer size-limit @size-limit/file`
- [ ] `vite.config.js`: add `const visualizer = (await import('rollup-plugin-visualizer')).visualizer` — or static import guarded by env flag: `plugins: [..., process.env.ANALYZE ? visualizer({ filename: 'dist/stats.html', open: false, gzipSize: true }) : null].filter(Boolean)`; script: `"build:analyze": "ANALYZE=1 vite build"`.
- [ ] `npm run build:analyze`; record top 10 chunks + gzip sizes in `docs/perf/bundle-baseline-2026-11.md`. Commit the doc.

## Task 2: manualChunks

- [ ] Add `build.rollupOptions.output.manualChunks`:

```js
manualChunks: {
  react: ['react', 'react-dom', 'scheduler'],
  router: ['react-router-dom'],
  supabase: ['@supabase/supabase-js'],
}
```

- [ ] Rebuild; record again in the same doc; confirm admin libs (`recharts`, `jspdf`) are absent from `index`/`react`/`router`/`supabase` chunks (they should only appear in admin route chunks or nowhere static).
- [ ] If circular-chunk warnings appear: group by package family or drop `router` from manualChunks and re-measure.

## Task 3: CI budget

- [ ] `.size-limit.json`: `[{
  "name": "entry", "path": "dist/assets/index-*.js", "limit": "250 KB", "gzip": true },
{ "name": "vendor-react", "path": "dist/assets/react-*.js", "limit": "160 KB", "gzip": true }]`
- [ ] Script `"size": "size-limit"`; CI `npm run build && npm run size` as a step after build in `ci.yml`.
- [ ] Verify the gate: temporarily import `jspdf` into `src/main.jsx` → `npm run size` fails → revert.

## Task 4: Navbar prefetch

- [ ] **Create** `src/lib/prefetch.js`: `export const prefetchRoute = (loader) => () => { try { loader(); } catch {} }` — with the actual lazy import map reused from `src/routes/…`? **Routes still live in App.jsx** (route-registry plan splits them); for now export `prefetchHome/Outlines/Cbt/Cgpa` map in `prefetch.js` calling the same dynamic `import()` paths as App.jsx (duplicate the paths — one line each).
- [ ] Navbar: primary links get `onMouseEnter`/`onFocus={prefetch}`; verify in dev: hover `/outlines` → network shows chunk fetched before click.
- [ ] Commit; note in doc.

## Task 5: Final numbers

- [ ] Throttled Lighthouse on `/` (4× CPU, Slow 3G): record LCP before/after in the PR.
- [ ] `npm test`, `npm run lint`, `npm run build`.

## Rollback

Remove manualChunks/`ANALYZE` flag/size script — three small reverts, no runtime code paths change.
