# Web Vitals and Real User Monitoring

There is no Core Web Vitals telemetry in the app today — performance regressions ship silently and the
team finds out from complaints, not dashboards.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| RUM reporter | `web-vitals` library, reports LCP/INP/CLS/TTFB to Sentry (or a tiny `/api/vitals` beacon) |
| Dashboards | Sentry performance view + a `page_vitals` table fallback if Sentry quotas bite |
| Budgets | LCP < 2.5 s (p75), INP < 200 ms, CLS < 0.1 on `/`, `/timetable`, `/cbt`, quiz play |
| Alert | Sentry alert when p75 LCP regresses > 20% week-over-week |

### Out

- **Synthetic monitoring.** UptimeRobot covers availability; this is user-experience telemetry.
- **Full tracing.** Sample at 10%; budgets over traces.

---

## 2. The problem

Sentry catches errors; nothing catches "the homepage takes 6 s on a Tecno phone". The app targets
UNILAG students on campus Wi-Fi and mobile data — the gap between the dev laptop and the median user is
the product's real performance.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Reporter | `web-vitals` (`onLCP/onINP/onCLS/onTTFB`) in `src/main.jsx` behind `VITE_APP_ENV==='production'` | 3 KB, battle-tested |
| Sink | Sentry `browserTracing` integration at `tracesSampleRate: 0.1` with `beforeSend` dropping PII | Reuses existing Sentry org; no new vendor |
| Budget attribution | Tag by `route` (path template, not raw URL) | No PII in telemetry |
| Targets | p75 thresholds above; failing week blocks "done" on perf-tagged PRs | Budgets with teeth |

## 4. The change

`npm i web-vitals`; `src/lib/vitals.js` registers reporters tagged with the route template; `main.jsx`
imports it only in production. Sentry `beforeSend` strips query strings. Dashboard: Sentry → Performance
→ Web Vitals; document p75 baselines in `docs/` after one week of data.

## 5. Verification

1. Local throttled run shows vitals events in the Sentry test project.
2. p75 numbers appear for `/` and quiz play within 48 h of deploy.
3. A deliberately heavy import (e.g., static `jspdf` on home) trips the budget alert in staging.

## 6. Risk

Beacon volume inflating Sentry quota — cap with `tracesSampleRate` and `sampleRate: 0.5` if needed.
Route-template tagging must map dynamic segments (`/outlines/:courseId`) or cardinality explodes.
