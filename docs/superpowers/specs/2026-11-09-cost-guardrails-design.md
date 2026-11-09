# Cost Guardrails and Billing Alerts

The hub runs on layered free/tiered services (Vercel, Supabase, Resend, Sentry, Upstash) with no spend
caps or billing alerts — one runaway query or mail blast could produce a four-figure invoice silently.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Inventory | `docs/ops/cost-inventory.md` — service × plan × current usage × hard cap each |
| Alerts | 80% usage alerts — **all free**: Vercel bandwidth/functions, Supabase DB size + egress (5 GB free), Resend sends (3k/mo free), Sentry events (5k/mo free), Upstash commands (10k/day free), GitHub Actions minutes (free on public repos) |
| Caps | Resend: pause broadcasts at cap (`email_outbox` worker checks quota before send); Supabase: statement timeout 10 s on API role |
| Reporting | Monthly one-line cost note in ADMIN.md log |
| Kill-thresholds | Documented: at 90% of any cap → pause non-critical jobs (rollup digest, OG generation) before user-facing features |

### Out

- **Cost optimization re-architecture.** This spec monitors and caps; tuning comes after data exists.
- **Paid plans procurement — ever.** The project has no budget (owner's statement, 2026-11-09). Every alert fires a *degradation* (pause a non-critical job, queue a broadcast), never a purchase. If a free cap is hit, the spec is to make the site limp gracefully, not to buy headroom.

---

## 2. The problem

"Free until it isn't" stacks: Resend free = 3k emails/mo (a full broadcast to a 2.5k-member list ≈ entire quota); Supabase egress 5 GB/mo free; Vercel Hobby fair-use; Sentry 5k errors/mo. The 9.3 MB PDF and full-list broadcasts are the two realistic bomb triggers — and today nothing would warn before the overage bill or suspension.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Monitoring | Native billing emails + UptimeRobot-style HTTP probes on quota endpoints where available (Supabase management API) | Zero custom infra |
| Enforcement | Worker-side quota check for email broadcasts (`daily_email_count` vs cap) | The one irreversible blast |
| DB safety | `alter role authenticator set statement_timeout = '10s';` via SQL editor (documented) | Kills runaway scans at source |
| Alert routing | Same Telegram channel as SLOs | One pane for "something is wrong" |
| Review | Quarterly cost review vs the inventory table | Plans drift |

## 4. The change

Write the inventory (pull current numbers from each dashboard); set billing alerts + payment-method limits; `email-worker` gains quota gate + `SELF_PAUSE` flag in `app_config`; document `statement_timeout` step; ADMIN.md gains monthly cost line; Telegram bot reuses SLO wiring.

## 5. Verification

1. Test broadcast with quota=1 in staging → worker sends 1, pauses, logs, alerts Telegram.
2. Inventory shows real numbers (not placeholders) — checked into the doc.
3. `show statement_timeout` confirms 10 s on the API role.

## 6. Risk

Statement timeout can kill legit long analytics queries — 10 s applies to the API role; the rollup aggregation should run on the postgres role (or be batched), which the analytics-rollup spec already does.
