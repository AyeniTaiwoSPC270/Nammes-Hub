# Cost Guardrails and Billing Alerts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Never receive a surprise invoice: every free cap documented, watched, and coupled to an automatic degradation (pause a non-critical job) — never a purchase.

**Architecture:** `docs/ops/cost-inventory.md` is the source of truth; service-side alerts where free (Vercel/Billing, Supabase, Resend, Upstash, Sentry quotas); a quota check inside the email worker (pause broadcasts when over cap, checked hourly); monthly one-line ADMIN.md cost log.

**Tech Stack:** Dashboards (manual, free), `email-worker.js` extension, ADMIN.md.

**Spec:** `docs/superpowers/specs/2026-11-09-cost-guardrails-design.md`

## Global Constraints

- **No paid plans, ever** — the owner has no budget (2026-11-09). Every response to a cap hit is a degradation documented in advance; spending is not an available action for this system or its operators.
- Alert at 80% (page) and 90% (act) of every cap.
- Nothing in a hot path may start making an extra external call for accounting.

---

## Task 1: The inventory

**Files:** Create `docs/ops/cost-inventory.md`

Table: Service | Free cap | Current usage (as of 2026-11) | 80% alert | 90% action.

Fill from dashboards: Vercel (bandwidth 100 GB free? — Hobby: 100 GB? record actual from dashboard at audit time), Supabase (DB 0.5 GB, egress 5 GB, MAU 50k), Resend (3k emails/mo), Sentry (5k errors/mo), Upstash (10k commands/day), GitHub Actions (public repo — unlimited for public; skip), Storage (1 GB), Cloudflare (none — DNS only), Telegram (bot API free), UptimeRobot (50 monitors).

- [ ] Commit.

## Task 2: Alerts where the product allows (manual)

- [ ] Vercel → Usage → set Spend Management / usage alerts (free email alerting available).
- [ ] Supabase → Project Settings → Usage: enable email alerts for DB size + egress; record the 80/90 thresholds in the inventory.
- [ ] Resend → Usage page: monthly quota alert email on.
- [ ] Sentry → Subscription: notifications at 80% of plan events.
- [ ] Upstash → usage alert emails/webhook if offered; else weekly dashboard glance in the monthly log.

## Task 3: Email worker quota gate (the one piece of code)

**Files:** Modify `api/_lib/handlers/email-worker.js`

- [ ] Before claiming a batch: `if (process.env.EMAIL_QUOTA_PAUSED === 'true') return res.json({ ok: true, paused: true });` — a manual kill, documented; **plus** a soft auto-guard: if sends this UTC month (count rows in `email_outbox` with `sent_at` in month, or a cheap Resend usage call if available via API key scope) exceed `EMAIL_MONTHLY_CAP` (default 2800), set a flag row in `app_config` (`email_quota_paused=true`) and send ONE admin Telegram/email alert, then skip sends.
- [ ] Provide the exact SQL to count month-to-date sends; unit-test the decision function (`shouldPause(sentThisMonth, cap)`) — pure.
- [ ] ADMIN.md: how to pause/resume broadcasts, how the guard trips, how to see month-to-date usage.

## Task 4: Kill-threshold runbook

- [ ] **Create** `docs/runbooks/cost-tripwire.md`: table — "at 90% of X → pause Y" (non-critical: OG image generation cron, rollup digest, any future AI features) before user-facing; restart order after month rolls; who gets notified.
- [ ] Link from ADMIN.md + incident-response plan's runbook index.

## Task 5: Monthly cost log

- [ ] ADMIN.md: "## Monthly cost note" — one line per month: `YYYY-MM — max usage item = X% of cap — actions: none/…`. Seed with this month's snapshot after the inventory task reads dashboards.

## Task 6: Verify

- [ ] Unit tests green; simulate guard: set `EMAIL_MONTHLY_CAP=1` and `EMAIL_QUOTA_PAUSED=false` locally, run worker with a queued email → paused response + flag set; revert; staging drill once with placeholder cap and an undo afterwards.
- [ ] `npm test`/`lint`/`build`.

## Rollback

Unset `EMAIL_QUOTA_PAUSED`; the guard is a no-op without hitting cap; inventory/runbooks are docs.
