# API Payload Diet and Pagination — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Every row-returning endpoint has a bounded, explicit response — zero `select('*')`, every list paginated with a shared helper and a `{ rows, meta }` contract.

**Architecture:** `api/_lib/listQuery.js` parses and clamps `page`/`pageSize`; handlers select explicit columns and `.range(from, to)`; list responses become `{ rows, page, pageSize, total }`. Clients get minimal changes — where an array was read directly, keep returning `{ rows, meta }` and update the consumer in the same commit.

**Tech Stack:** Existing handlers, vitest, no new deps.

**Spec:** `docs/superpowers/specs/2026-11-09-api-payload-and-pagination-design.md`

## Global Constraints

- Explicit column lists are chosen from the **call site's actual property reads** — do not guess; grep the consumer.
- `pageSize` max 100, default 20; invalid input clamps, never 400s.
- Admin single-RPC reads (`admin_analytics`, `admin_inbox`) are already bounded server-side — leave them alone; this plan touches PostgREST direct queries only.
- Preserve response back-compat where trivial; where not, update the one consumer and its test in the same task.

---

## Task 1: Helper + tests

**Files:** Create `api/_lib/listQuery.js` + `api/_lib/listQuery.test.js`

```js
export function pageArgs(query = {}, { defaultSize = 20, maxSize = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, parseInt(query.pageSize, 10) || defaultSize));
  return { from: (page - 1) * pageSize, to: (page - 1) * pageSize + (pageSize - 1), meta: { page, pageSize } };
}
export const listMeta = (total) => ({ total });
export const respondWithRows = (res, { rows, total, page, pageSize }) =>
  res.status(200).json({ rows, meta: { page, pageSize, total } });
```

- [ ] Tests: defaults, clamp high/low/NaN, exact range math.

## Task 2: The 108 — burn down by domain

One commit per domain, each ending with `npm test` green:

- [ ] **Analytics/page_views** (`src/data/analytics.js` reads via `.select('*')`? — verify with `grep -rn "select('\*')" src api | wc -l`): rewrite to explicit lists; note the RPC `admin_analytics` is exempt (already explicit server-side).
- [ ] **Outlines/resources/timetables** (public lists): `select('id,title,…,updated_at')` + `.range(from,to)` + `count: 'exact'` for `total`.
- [ ] **Admin lists** (inbox via RPC is exempt; messages table, submissions, applications, users): explicit + range.
- [ ] **Quiz/CBT admin lists** (`quiz_questions`, `cbt_exams`): explicit + range.
- [ ] **Email** (`email_outbox` read in the worker): explicit; already bounded by LIMIT 1-ish claim processing — verify and cap.

Final gate: `grep -rn "select('\\*')" src api` → 0 hits.

## Task 3: Wire the helper into paginated lists

- [ ] Replace `.limit(N)` ad-hoc caps that truncate arbitrarily (the 8 found: they were correctness bugs hiding) with `pageArgs` — call out each in the commit message.
- [ ] Every paginated endpoint now also returns `total` (use `count: 'exact', head: false`).

## Task 4: Client touch-points

- [ ] `grep -rln "\.data\b" src --include='*.jsx' | xargs grep -ln "\.select(" ;` — for each changed query used directly as an array, adapt to `.rows`; snapshot key tests (`src/data/*.test.js`) must still pass.
- [ ] Where a list previously rendered everything (e.g., admin inbox archive), add a "Load more" button or pagination footer.

## Task 5: Verify

- [ ] `npm test` · `npm run lint` · `npm run build`
- [ ] Playwright/dev-server smoke: every touched screen renders and paging works forward/back.
- [ ] Spot network payload in devtools on `/outlines` before/after (record sizes in the PR).

## Rollback

Contract changes are per-commit; revert domain commits independently. No schema changes.
