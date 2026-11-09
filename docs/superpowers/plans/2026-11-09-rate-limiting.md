# Rate Limiting for Public Endpoints — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reject abusive request bursts at the boundary with a 429, using a zero-cost Upstash Redis fixed window — protecting quiz-join, votes, forms and auth from single-actor hammering.

**Architecture:** One `_lib` module (`api/_lib/rate-limit.js`) ports FYpro-v2's proven implementation (fixed window via `INCR` + `EXPIRE` over Upstash REST). Public POST handlers and the unauthenticated branch of `authz` call it; a shared `429` helper sends `Retry-After`. No new serverless functions — this is a library, and Hobby's 12 slots stay full as they are.

**Tech Stack:** Upstash Redis REST (free tier), existing handlers, vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-rate-limiting-design.md`

## Global Constraints

- `_lib` files only; never a new file directly under `api/` (12/12 slots taken; the `system.js` ACTIONS map pattern is the only sanctioned multiplexer).
- Fail **closed** for auth and vote endpoints, fail **open** for read-only GETs (a Redis outage must not blank the site).
- Campus NAT headroom: IP limits stay ≥ 30/min for non-critical writes; quiz-join raises to a generous 60/min but authenticated players key on `user id`, not IP.
- No changes to admin (AAL2) paths beyond bypass.

---

## Task 1: Env contract

- [ ] Add to `.env.example`: `UPSTASH_REDIS_REST_URL=`, `UPSTASH_REDIS_REST_TOKEN=` (same names FYpro-v2 uses). Document in README/ADMIN.md that both are required in production; without them the limiter logs a warning and fails open (except auth/vote routes, which fail closed → see Task 4).

## Task 2: The limiter module

**Files:** Create `api/_lib/rate-limit.js`, `api/_lib/rate-limit.test.js`

Port from `/home/user/repos/FYpro-v2/api/_lib/rate-limit.js` (read it; strip AI-specific bits) — target API:

```js
// api/_lib/rate-limit.js
export async function rateLimit(key, limit, windowSeconds = 60) -> { ok, remaining, reset }
export async function limitRequest(req, res, { bucket, limit, userId = null, failClosed = false }) -> boolean
```

Behavior: fixed window keyed `rl:{bucket}:{ip|user:{id}}`; `INCR`; on `EXPIRE` only when `result === 1`; on Redis error: `failClosed` → 429, else allow + `console.warn('[rate-limit] redis unavailable', err.message)`. Response: `429` with `Retry-After: <reset>` and JSON `{ error: 'Too many requests. Try again in a minute.' }`.

- [ ] Unit tests (mock `fetch`): window rollover, limit boundary, 429 payload, fail-open vs fail-closed matrix, userId keying preferred over IP when present.

## Task 3: Apply to handlers

- [ ] `api/submit-public.js` — at entry: `if (!(await limitRequest(req, res, { bucket: 'submit-public', limit: 30 }))) return`.
- [ ] Quiz writes in `api/_lib/handlers/quiz-join.js`, `quiz-cast.js`, `quiz-submit.js` (paths verified; if names drifted, apply to the equivalent handler the route dispatches to): join → limit 60/IP **or** userId 120/min; cast/submit → 120/min/user.
- [ ] Awards vote POST (`api/award-card.js` POST path): `bucket: 'vote', limit: 20, userId`; failClosed **true**.
- [ ] Forms submit (the forms action in `api/system.js` handlers or `submit-public`): `bucket: 'form', limit: 20`.
- [ ] `api/_lib/authz.js` — unauthenticated branch: `limitRequest(req, res, { bucket: 'auth', limit: 10, failClosed: true })` before any Supabase call.
- [ ] `api/health.js` — exempt (return before limiter).
- [ ] Commit per handler group: `git commit -m "feat(rate-limit): <area>"`

## Task 4: Failure-mode drill

- [ ] Unset the env vars locally; call an auth endpoint → expect 429 (closed). Call a GET → 200 (open). Redo with vars set.
- [ ] Staging burst: `for i in {1..70}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST $STAGING/api/system?action=...; done | sort | uniq -c` → mix of 429 after the limit.

## Task 5: Observability

- [ ] On 429, insert one row into `error_log` (or `hub_feedback`? — use `error_log`, it exists and is admin-visible) with `source='rate-limit'`, route, hashed IP (`sha256(ip).slice(0,16)`), behind a try/catch.
- [ ] ADMIN.md: "Too many requests" entry — what it means, that voted/duplicate actions are rejected by design.

## Rollback

Unset `UPSTASH_*` → everything fails open except auth/votes (fail closed) — i.e., site works, abuse protection relaxes. Full revert = revert the limiter commit; handlers without headers behave as before.
