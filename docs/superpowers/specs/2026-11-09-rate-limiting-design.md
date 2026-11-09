# Rate Limiting for Public Endpoints

The API has no request-rate limiter — Turnstile stops form bots but nothing stops a single actor
hammering quiz-join, submit-public, or vote endpoints at machine speed.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Limiter | `api/_lib/rate-limit.js` — Upstash Redis fixed-window (mirror FYpro-v2's `_lib/rate-limit.js`) |
| Keys | `rl:{route}:{ip}` and `rl:{route}:user:{id}` for authenticated calls |
| Limits | Public POST: 30 req/min/IP; quiz-join: 10/min; votes: 20/min; auth: 10/min (already partially via auth_attempts — verify) |
| Response | 429 + `Retry-After`; admin UI unaffected |
| Bypass | `AAL2` admin sessions exempt; health endpoint exempt |

### Out

- **DDoS mitigation.** That is Cloudflare/Vercel territory (Turnstile + WAF), not app code.
- **Billing/cost caps.** Covered by the cost-guardrails spec.

---

## 2. The problem

`grep -ril 'upstash' api` → 0 files. Abuse modes: script-kiddie ballot stuffing in awards, form spam past Turnstile, one buggy client retrying quiz submit in a tight loop and starving the pool for real players. Public endpoints are the attack surface; authenticated admin routes are already behind `authz`.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Backend | Upstash Redis (REST) — same as FYpro-v2, one vendor, free tier adequate | No persistent connections from serverless |
| Algorithm | Fixed window with `INCR` + `EXPIRE` (matches FYpro implementation) | Simple, testable, good enough |
| Identity | `x-forwarded-for` first IP + authenticated user id when present | Vercel sets the header; trust it only behind Vercel |
| Fail-open vs closed | **Fail closed for auth endpoints, fail open for read-only GETs** | Availability where safe, strictness where money/votes live |
| Observability | 429s logged to `error_log` with route + hashed IP | Abuse patterns become visible pre-incident |

## 4. The change

`api/_lib/rate-limit.js` (port from FYpro-v2, strip AI-specific parts). Wrapped in the public POST handlers: `submit-public.js`, quiz join/cast/submit, `award-card.js` POST paths, forms submit, contact. `authz.js` gains `rateLimit(req, 'auth', 10)` on the unauthenticated branch. Env keys: `UPSTASH_REDIS_REST_URL/TOKEN` (already in `.env.example`? — add if absent).

## 5. Verification

1. Unit tests: window rollover, limit boundary, 429 + `Retry-After` header, fail-open/closed matrix.
2. Staging: `hey` or k6 burst from one IP — 429s observed; second IP unaffected.
3. Admin (AAL2) session unthrottled; normal quiz flow unaffected.

## 6. Risk

Shared/campus NAT — hundreds of students behind one campus IP. Raise limit for quiz-join specifically and key on user id once authenticated; IP-only limits must stay generous (30/min) to avoid punishing lecture-hall bursts.
