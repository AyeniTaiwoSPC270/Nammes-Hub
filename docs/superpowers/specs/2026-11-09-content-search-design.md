# Global Content Search (⌘K)

Thousands of pages of outlines, news, events, and resources exist with no unified search — students
rediscover the same PDFs instead of finding them.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| UI | `⌘K` / `Ctrl-K` palette + search icon in navbar; grouped results (Outlines / News / Events / Resources / CGPA) |
| API | `GET /api/system?action=search&q=` — server-side `ilike` over 5 tables, top 5 each, ≤ 25 ms budget note. **A new top-level function is not an option: all 12 Hobby-plan slots are taken (see the comment in `api/system.js` — the OG previews already ride along there for exactly this reason). Search joins the `ACTIONS` map in `api/system.js` |
| Indexing | Trigram indexes (`pg_trgm`) on `outlines.course_title`, `news.title`, `opportunities.title`, `resources.title`, `events.title` |
| Commands | Palette also runs actions: "Go to timetable", "Open CGPA", "Report a problem" |
| Telemetry | Log zero-result queries to `hub_feedback`-adjacent table (or page_views prop) — shows what students want and can't find |

### Out

- **ElasticSearch/Typesense.** Postgres FTS is enough; add a service when query load demands.
- **Searching quiz question content.** Deliberately excluded (integrity).

---

## 2. The problem

The hub's value is "answers in one place" — yet the place has no front door. Students ask executives the same questions ("where is the 300-level outlines?") the search box could answer instantly. `page_views` analysis shows outline-detail as a top destination; navigation to it is browse-first.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Engine | Postgres `ILIKE` + `pg_trgm` GIN indexes | No new infra; good enough ≤ 10k rows/table |
| Ranking | Exact-prefix > substring > fuzzy (`similarity`) | Predictable |
| Scope | Public content only; admin search stays in admin tables | Security seam |
| Latency | 60 ms server budget; debounce 250 ms client | Feels instant |
| Empty state | "Nothing for '{q}' — try the course code, or tell us what's missing" + feedback link | Turns failure into product data |

## 4. The change

Migration: `create extension if not exists pg_trgm;` + 5 GIN indexes. A new `api/_lib/handlers/search.js` module (not a function slot — `_lib` is not routed) registered in `api/system.js`'s `ACTIONS` map as `search`; auth-optional, rate-limited via the rate-limit spec. `src/components/ui/CommandPalette.jsx` mounted in `Navbar.jsx`; keyboard shortcut hook; `/api/system?action=search` added to SW network-only (with the PWA spec). No serverless function is created, moved, or displaced.

## 5. Verification

1. `EXPLAIN` on search queries shows GIN index scans.
2. p95 server time < 60 ms on staging with seeded content.
3. Playwright: `⌘K` → "thermo" → Enter → outline page renders; zero-result query logs feedback row.

## 6. Risk

`%term%` scans on huge tables without indexes would melt the pool — indexes first, ship behind a flag (`feature_flags.search_enabled`), enable per audience. Trigram indexes add write overhead — measure on `news` (highest churn) before rollout.
