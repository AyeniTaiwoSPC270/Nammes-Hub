# SLOs and Alerting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Two explicit SLOs (availability ≥ 99.5%, p95 < 500 ms), externally checked every 5 minutes, with fast-burn alerts to a Telegram channel — free tier throughout.

**Architecture:** UptimeRobot (free: 50 monitors, 5-min interval) polls `/api/health` externally; Sentry (exists) provides error rate + p95; a tiny Telegram notifier in `api/_lib/telegram.js` delivers alerts via a bot created in 2 minutes with BotFather. ADMIN.md records the SLOs and the review cadence.

**Tech Stack:** UptimeRobot, Sentry (`@sentry/react` exists), Telegram Bot API, existing `/api/health`.

**Spec:** `docs/superpowers/specs/2026-11-09-slo-and-alerting-design.md`

## Global Constraints

- Nothing paid. UptimeRobot free tier only; no PagerDuty/Opsgenie.
- `/api/health` must keep responding 200 quickly and must not leak internals (version ok; dependency breakdown stays admin-only).
- Alert on burn rate, not instantaneous spikes (fast burn 5% errors/5min = page; slow burn = weekly review).

---

## Task 1: Health endpoint contract

- [ ] Read `api/health.js`. Ensure: `Cache-Control: no-store`, status 200 always-observed, body `{ ok: true, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7) }`. No DB credentials, no table names.
- [ ] If it hits the DB, that's fine for correctness probing, but keep the query `select 1` so it stays < 50 ms.
- [ ] Commit if changed.

## Task 2: UptimeRobot (manual)

- [ ] Create monitor: `https://www.nammeshub.com.ng/api/health`, type HTTP(s), 5-min interval, 3 regions, alert contact email + (after Task 3) Telegram via webhook integration if offered on free tier; otherwise email-only is acceptable.
- [ ] Pause notifications windows? No — 24/7.

## Task 3: Telegram bot

- [ ] BotFather → `/newbot` → name `nammes-hub-alerts` → token. Create a private group "NAMMES Hub Alerts", add the bot, get chat id via `https://api.telegram.org/bot<token>/getUpdates`.
- [ ] Vercel env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (Production + Preview). Add to `.env.example`.
- [ ] **Files:** Create `api/_lib/telegram.js`:

```js
export async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  try { await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: text.slice(0, 3500), disable_web_page_preview: true }) }); } catch (e) { console.error('[telegram]', e.message); }
}
```

- [ ] Wire a self-test: `api/system.js` ACTIONS gains `'alert-test'` → handler calls `sendTelegram('Nammes-Hub alert pipeline OK ✅ (test)')` (owner-triggered, behind admin check) so verification is one authenticated curl.
- [ ] Commit.

## Task 4: Sentry alerts (manual)

- [ ] Sentry → Alerts → create: (a) error rate fast burn: `>5%` over 5 min → notify Telegram-webhook/email; (b) slow burn: weekly issue digest; (c) optionally metric alert on `span.op:http.server` p95 > 500 ms.
- [ ] Baseline: let one week collect; record p50/p75/p95 in `docs/runbooks/slo-baseline.md`.

## Task 5: Docs

- [ ] ADMIN.md "## Reliability": the two SLOs, what a 429/504/500 means, how to read UptimeRobot, halt-the-line rule for CBT exam windows (threshold halves), review on the first Monday of the month.
- [ ] Commit.

## Rollback

UptimeRobot monitor paused; Telegram token can stay. Revert `alert-test` handler; nothing else is wired into the request path.
