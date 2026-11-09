# SLOs and Alerting

The app has error monitoring (Sentry) and a health endpoint but no defined availability/latency targets
and no proactive alerting — incidents are discovered by users, not graphs.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| SLOs | Availability ≥ 99.5% (monthly), p95 API latency < 500 ms, error rate < 0.5% |
| Checks | UptimeRobot (or equivalent) hitting `/api/health` every 5 min, 3 locations |
| Alerts | Sentry alerts → Telegram (bot already used by sibling project) + email to admin |
| Latency metrics | `response_times`-style logging or Sentry performance on the 6 hottest endpoints |
| Review | Monthly SLO readout in the ADMIN.md log |

### Out

- **A status page.** Nice later; not before the SLOs exist.
- **Paging infrastructure.** Telegram is the pager; rotation is a manual exec handover.

---

## 2. The problem

`api/health.js` exists but nothing watches it from outside. Sentry errors notify only if someone opens
the dashboard. During exam season (CBT week), a silent 2-hour outage of the CBT path is an academic(!)
incident, not just a technical one.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| SLO source | UptimeRobot uptime % + Sentry p95 + error rate | Cheap, external, already-available tooling |
| Alert routing | Telegram chat for admins (same pattern as FYpro-v2) | Zero new accounts; phones buzz reliably in Lagos |
| Burn-rate alerting | 2 alerts: fast burn (5% errors over 5 min — page now), slow burn (error budget 50% gone over 7 days — weekly review) | Fewer false pages than threshold-per-minute |
| Freeze trigger | During known exam windows, alert threshold halves | Exam stakes justify noise |

## 4. The change

Register monitor on `https://nammeshub.com.ng/api/health` (5-min interval). Sentry: create alerts for
error-rate fast/slow burn; enable ` tracesSampleRate: 0.1` on the 6 endpoints. Add
`docs/runbooks/slo.md` (see incident spec). Telegram: create bot, store token in `TELEGRAM_BOT_TOKEN` +
`TELEGRAM_CHAT_ID` envs, wire a `_lib/telegram.js` ping from the Sentry webhook or a `/api/system?action=alert-test`.

## 5. Verification

1. `/api/health` returns 200 externally; UptimeRobot shows monitor up.
2. Deliberate error spike in staging → Telegram message within 5 min.
3. p95 dashboard populates for the hot endpoints after one week.

## 6. Risk

Alert fatigue from noisy Thresholds — start with fast-burn only, add slow-burn after two quiet weeks.
Public health endpoint must not leak internals: version string ok, dependency details admin-only.
