# Cache Tiering and Supabase Connection Pooling

The site serves 100% of traffic through serverless functions talking directly to Postgres with no
documented pooling, and caching exists only ad-hoc (33 `cache` references, no TTL policy) — thousands of
concurrent students will exhaust connections and hammer hot rows.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Supavisor | Transaction-pooler connection string for all server-side Supabase clients (port 6543) |
| HTTP caching | `Cache-Control: s-maxage=60, stale-while-revalidate=300` on safe public GET endpoints/CDN |
| Redis (Upstash) | Read-through cache for hot keys: `site_content`, `quiz_state:<id>`, `resources:list` |
| Cache busting | Admin mutation helpers delete/revalidate affected keys |
| Tests | TTL and bust-on-write covered in `_lib` unit tests |

### Out

- **Full-text search infra.** Covered by `2026-11-09-content-search-design.md`.
- **Edge runtime / Workers.** Vercel Node functions stay; caching moves to Redis, not the runtime.

---

## 2. The problem

Serverless functions multiply connections: 50 warm instances × 10 queries each can exhaust the default
Supabase connection limit long before the database is otherwise stressed. Supabase ships **Supavisor**
(transaction mode, port 6543) exactly for this; the repo's clients (`api/_lib/supabaseAdmin`,
`src/lib/supabaseClient`) do not record which they use.

Reads that never change within a minute (site content, quiz open state, resources list) are re-fetched
per request. During a live quiz, every player's client and every spectator hit the same rows.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Pooler | `?pgbouncer=true` transaction mode for API handlers; session mode 5432 only for migrations/admin DDL | Transaction pooling is the serverless-correct mode; prepared statements differ — PostgREST handles this for you, direct `pg` needs care |
| Pool budget | **Free tier**: the Supabase *shared* transaction pooler (port 6543) is included free and is mandatory — direct connections on free projects are capped low. Leave headroom for the dashboard; no plan upgrade is required | The pooler, not more connections, is the fix |
| Redis (Upstash free) | 10k commands/day free tier is enough for a 60-second `site_content` cache at this traffic; exceed and cache simply misses — site stays up. Watch usage in the Upstash dashboard monthly | Zero cost; graceful degradation |
| HTTP layer | `s-maxage=60` + SWR on public idempotent GETs via `vercel.json` headers | Free CDN caching, zero code in handlers |
| Redis | `cacheGet/cacheSet` with per-key TTL map (`quiz_state`: 2 s, `site_content`: 60 s, `resources`: 300 s) | Hot paths only; never cache per-user rows |
| Busting | Admin mutations call `cacheBust(key)` after successful write | Stale-while-revalidate hides the 60 s window anyway |
| Degradation | Redis miss/error falls through to Postgres | Cache is an optimization, never a single point of failure |

## 4. The change

New `api/_lib/cache.js` (wrap Upstash REST like FYpro-v2, free tier) and `api/_lib/poolNote.js` documenting the
two connection strings. `supabaseAdmin.js` reads `SUPABASE_POOLER_URL` (shared pooler, port 6543 — free on all plans) when set. `vercel.json` gains
`headers` for `/api/public-*` (or the read endpoints) with the SWR policy. Quiz open/tick handlers wrap
their state read in `withCache('quiz_state:'+id, 2, fetch)`.

## 5. Verification

1. Load test (`2026-11-09-load-testing-live-quiz-design.md`): connection errors = 0; p95 improves ≥30%.
2. Cache hit-rate log lines on `site_content` ≥ 80% over a day.
3. Admin edit → within one TTL the change is visible without a deploy (bust works).
4. Redis outage drill (unset token): site still serves, slower — no 500s.

## 6. Risk

Transaction pooling breaks `LISTEN/NOTIFY` and session state — keep migrations and any future realtime
subscriptions on the session pooler. A buggy cache-bust leaves stale public content; SWR + short TTLs
bounded blast radius, and admin UI should show "published (may take a minute)".
