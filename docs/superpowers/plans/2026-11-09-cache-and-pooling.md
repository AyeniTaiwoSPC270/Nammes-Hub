# Cache Tiering and Supabase Connection Pooling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Serve hot reads from cache and force all server-side Supabase traffic through the free shared transaction pooler — the two changes that decide whether thousands of concurrent students see 200s or 500s.

**Architecture:** HTTP stale-while-revalidate headers on idempotent public GETs; a Redis read-through helper (`api/_lib/cache.js`) wrapping Upstash REST for hot keys; Admin mutations bust keys after write; `api/_lib/supabaseAdmin.js` prefers `SUPABASE_POOLER_URL` (port 6543, `pgbouncer=true`) when set.

**Tech Stack:** Upstash Redis REST (free tier), `vercel.json` headers, existing handlers, vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-cache-and-pooling-design.md`

## Global Constraints

- Never cache per-user rows or anything behind `is_admin()`; cache keys are public-content only (`site_content`, `resources:list`, `quiz_state:<id>`, `outlines:list`).
- Redis failure must degrade to direct Postgres reads — log a warning, never throw.
- The pooler URL is optional-at-runtime: if unset, fall back to the current direct URL (behavior identical to today) so the change is independently revertable.

---

## Task 1: Env + docs

- [ ] `.env.example`: add `UPSTASH_REDIS_REST_URL=`, `UPSTASH_REDIS_REST_TOKEN=`, `SUPABASE_POOLER_URL=` with one comment block explaining 6543 vs 5432 (migrations/dashboard only on 5432).
- [ ] ADMIN.md "## Performance": what the pooler is, why the site needs it at thousands of users, how to read Upstash usage.

## Task 2: Pooler plumbing

**Files:** Modify `api/_lib/supabaseAdmin.js`

- [ ] Read the file; if it builds the client inline, change the connection to `process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_URL` (or the file's equivalent key). No behavioral change when the var is absent.
- [ ] Verify against staging: unset → app works (as today); set → app works and dashboard connection count drops.
- [ ] Commit.

## Task 3: Cache helper

**Files:** Create `api/_lib/cache.js` + `api/_lib/cache.test.js`

```js
// api/_lib/cache.js — Upstash REST, zero deps (fetch is global)
const TTL = { site_content: 60, 'resources:list': 300, 'outlines:list': 60, quiz_state: 2 } // seconds
export async function cacheGet(key) { … }          // null on miss/error
export async function cacheSet(key, value, ttl = TTL[key] ?? 60) { … }
export async function cacheBust(...keys) { … }      // DEL, best-effort
export const withCache = (key, ttl, fetcher) => async (...args) => { const hit = await cacheGet(key); if (hit != null) return hit; const v = await fetcher(...args); cacheSet(key, v, ttl); return v; }
```

- [ ] Tests with mocked `fetch`: hit, miss, set TTL from map, Redis 500 → falls through, bust no-ops on error.
- [ ] Commit.

## Task 4: Apply to hot reads

- [ ] Public outlines list handler (see `api/system.js` ACTIONS or data modules — the server-side query behind `/outlines`): wrap key `outlines:list`.
- [ ] Resources list: `resources:list`.
- [ ] Quiz state handler (`api/_lib/handlers/quiz-state.js`): wrap key `` `quiz_state:${sessionId}` ``, TTL 2 — **verify first that 2s staleness is acceptable** (it is: 2s leaderboard lag in a party game; note it in the PR).
- [ ] `site_content` reads (anywhere server-side — grep `from('site_content')` in `api/`): wrap `site_content`.
- [ ] Commit per call site.

## Task 5: Bust on write

- [ ] Admin mutations that edit the above (banner/content editor action, quiz open/close/publish, resources editor): after successful write call `cacheBust('outlines:list','site_content', …)` as applicable. Find write sites with `grep -rn "update(\|insert(\|delete(" api/_lib/handlers | grep -E 'site_content|resources|outlines|quiz'`.

## Task 6: HTTP headers

- [ ] `vercel.json` headers: add a rule for `/api/public/(.*)`? — **do not invent public paths**; instead set per-handler headers inside cached GET handlers: `res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')` in the cached read handlers (CDN honors it only for GETs — safe).
- [ ] Verify: `curl -sI $STAGING/…outline-list…` shows the header (if the handler is GET).

## Task 7: Prove it

- [ ] Staging load burst (k6 smoke or curl loop): before/after p95 on `/api/health` stays flat (untouched), list endpoints improve; Upstash dashboard shows > 0 commands; quiz flow unaffected (bust works — edit a resource on staging, see it within 60s).
- [ ] `npm test`, `npm run lint`, `npm run build`.

## Rollback

Unset `SUPABASE_POOLER_URL` (direct connections return) and `UPSTASH_*` (cache self-disables with warnings). Headers revert with the handler commits.
