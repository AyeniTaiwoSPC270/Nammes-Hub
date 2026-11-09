# API Payload Diet and Pagination Contract

`api/` performs 108 `select('*')` queries across `src/` and `api/`, while only 8 `.limit()` / `.range()`
calls exist in the whole backend — unbounded list responses will dominate egress and latency exactly when
the site gets popular.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| API handlers | Replace `select('*')` with explicit column lists |
| List endpoints | Mandatory `.range()` pagination with `{ page, pageSize }` (default 20, max 100) |
| Shared helper | `api/_lib/listQuery.js` — parse page/pageSize, clamp, return `{ from, to }` + meta |
| Frontend | List pages consume the paginated contract; "load more" where UX requires |

### Out

- **GraphQL or a query DSL.** Not worth the complexity; explicit lists are honest.
- **Views/materialized views.** Covered by `2026-11-09-admin-analytics-rollup-design.md`.

---

## 2. The problem

`grep -rhoE "\.select\(('\*'|\"\*\")" api src` → **108** hits. `grep -rhoE '\.limit\(|\.range\(' api`
→ **8**. Every endpoint returning rows to an ever-growing table (`page_views`, `quiz_answers`,
`email_outbox`, `contact_messages`) can return unbounded JSON. On Vercel this burns the response
limit, Supabase egress, and the student's data plan, and it gets slower linearly with data age.

`select('*')` also couples the schema to every consumer: adding a column can leak new fields to the
client without a code review noticing.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Column lists | Explicit arrays in the query, e.g. `select('id,title,deadline')` | Schema change ≠ response change; smaller payloads |
| Pagination | Offset (`range`) with `?page=&pageSize=` | Matches PostgREST; cursor pagination is overkill at this scale |
| Defaults | pageSize 20, hard max 100 | Bounded cost on every endpoint |
| Meta | Every list response `{ rows, page, pageSize, total }` | Clients render "showing x of y" without a second query guess |
| Enforcement | Review checklist item + a lint test that fails on `select('*')` in new code | The 108 existing hits are burned down; new ones never land |
| rollup for hot aggregates | Analytics reads from rollup tables, not base tables | Keeps list payloads small |

## 4. The change

`api/_lib/listQuery.js` exports `pageArgs(query)` reading `req.query`, clamping `pageSize`, and
returning `{ from, to, meta }`. Handlers: `const { from, to, meta } = pageArgs(req); … .range(from, to)`.
A migration-free change; response shapes gain a `meta` sibling — coordinate with the one or two list UIs
that need it.

## 5. Verification

1. `grep -c "select('*')"` across api/src drops to 0 for new code; existing call-sites fixed in batches per domain.
2. `npm test` green; add `listQuery.test.js` (clamps, defaults, meta math).
3. k6 smoke against staging: p95 list latency before/after on `news`, `opportunities`, admin inbox.
4. Spot-check one list UI renders "load more" and totals correctly.

## 6. Risk

Some UIs already expect raw arrays; wrap responses in `{ rows, meta }` behind a shared helper so the
change is mechanical, or add `meta` beside the array rather than renaming it. Missing a column in an
explicit list silently breaks a render — mitigate by typing the expected shape in a colocated comment
during the conversion and running the existing vitest suite per domain.
