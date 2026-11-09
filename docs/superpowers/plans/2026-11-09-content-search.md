# Global Content Search (⌘K) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A ⌘K/Ctrl-K palette over outlines, news, events, resources and opportunities — "the answer in one place" literally.

**Architecture:** `GET /api/system?action=search&q=` — a new handler in the ACTIONS map (the 12 Hobby slots stay full). Server-side `ILIKE` + `pg_trgm` GIN indexes. Client: `src/components/search/CommandPalette.jsx` with 250 ms debounce; action shortcuts ("Go to timetable", "Open CGPA", "Report a problem"). Zero-result queries logged.

**Tech Stack:** `pg_trgm`, one SQL migration + rollback, existing `ACTIONS` pattern, React, React Query.

**Spec:** `docs/superpowers/specs/2026-11-09-content-search-design.md`

## Global Constraints

- No new top-level function under `api/` — `system.js` ACTIONS entry only (verified: comment at `api/system.js:14`).
- Public content only (same RLS the anon site already reads); quiz questions are deliberately never searchable.
- No new dependencies — no fuse.js, no UI kit. Hand-rolled palette (few components, one hook).
- Results ≤ 25 per group of 5; response < 60 ms on staging p95.

---

## Task 1: Trigram migration

**Files:** Create `supabase/migrations/20261113090000_content_search_trgm.sql` + rollback

```sql
create extension if not exists pg_trgm;
create index if not exists outlines_title_trgm on public.outlines using gin (title gin_trgm_ops);
create index if not exists outlines_code_trgm on public.outlines using gin (code gin_trgm_ops);
create index if not exists news_title_trgm on public.news using gin (title gin_trgm_ops);
create index if not exists opportunities_title_trgm on public.opportunities using gin (title gin_trgm_ops);
create index if not exists resources_title_trgm on public.resources using gin (title gin_trgm_ops);
create index if not exists events_title_trgm on public.events using gin (title gin_trgm_ops);
```

- [ ] Rollback drops the six indexes (keeps extension — other plans may use it).
- [ ] `npm test` (migrations ordering); apply staging first.

## Task 2: Search handler

**Files:** Create `api/_lib/handlers/search.js`; modify `api/system.js` ACTIONS + import

```js
// handler(req): q = String(req.query.q ?? '').trim().slice(0, 120)
// if q.length < 2 → 400 { error: 'Keep typing…' }
// await Promise.all over five supabaseAdmin.from(t).ilike(col, '%'+q+'%').select(cols).limit(5)
// rank: starts-with > contains (sort server-side, stable); score = similarity()
// return { groups: { outlines: [...], news: [...], events: [...], resources: [...], opportunities: [...] } }
```

- [ ] outlines match `title ILIKE` OR `code ILIKE`; news `title`; opportunities `title`; resources `title`; events `title`.
- [ ] Each row shaped minimally: `{ label, to, hint }` — e.g. `{ label: 'CSC 301 · Operating Systems', to: '/outlines/3/1/CSC301', hint: 'Outlines' }`. Route shapes from `src/App.jsx` — outlines detail is `/outlines/:level/:semester/:code`; news detail `/news/:key` (key = slug ?? id — read `getNewsByKey` to confirm); events `/events/:id`.
- [ ] Log zero-result queries: `console.log('[search] zero-results', q.length, hash(q))`? — spec said log zero-result queries to a table; **decision**: write one row into `hub_feedback`? That table takes user-shaped rows. Simpler honest call: `console.log` the query text — it contains no PII (search terms of a public catalog) and goes to Vercel logs; ADMIN.md notes where to look. Note the deviation in the PR.
- [ ] Unit test the ranking/trimming pure functions (extract `rankResults`).

## Task 3: Palette UI

**Files:** Create `src/components/search/CommandPalette.jsx`, `src/lib/useCommandPalette.js`; modify `src/components/Navbar.jsx`

- [ ] Global keydown: `(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'` → toggle; Escape closes; focus into input on open; `aria-dialog`/`role="dialog" aria-label="Search"`; focus trap optional but Escape-return-focus required.
- [ ] Debounced `useQuery(['search', q])` against `/api/system?action=search&q=`; TanStack cache 30 s; abort in-flight on new keystroke (React Query handles via key change + `signal: AbortSignal`? — vanilla fetch is fine; keep it simple).
- [ ] Results grouped with headings + full keyboard (↑↓ navigate, Enter opens, Tab to commands). Empty query shows 3 suggested shortcuts. Zero results: "Nothing found for '<q>'" + Report-a-problem link.
- [ ] Navbar: search icon button (before user avatar) + kbd hint `⌘K` on ≥ lg.

## Task 4: Action commands

- [ ] Static list in the palette (always present, filtered client-side): "Go to timetable" → /timetable, "Open CGPA calculator" → /cgpa, "Report a problem" → `mailto:` from ReportProblem's existing link, "Open my account" → /account.

## Task 5: Verify

- [ ] Staging: seed has data (outlines seeded) — search "CSC", "score", a nonsense string; p95 from 10 runs `curl -s -w` (target < 100 ms); anon key rate-limited? — rely on the rate-limiting plan for `/api/system` (add bucket `search` 30/min in that plan's sweep if missing — note to self during audit pass).
- [ ] Keyboard-only full navigation through results; SR announces result count (`aria-live` polite on the list container).
- [ ] `npm test`/`lint`/`build`.

## Rollback

Remove ACTIONS entry + palette mount; indexes drop via rollback; nothing else depends on search.
