# NAMMES Hub Improvement Program — Setup Checklist (No Code Required)

**Date:** 2026-11-09. **What this is:** everything you must **create, sign up for, install, or grant** before/while the 35 implementation plans run — no code involved. Items marked **[blocker]** stop one or more plans until done. Items marked **[optional]** can be deferred.

Estimated total effort: 3–4 hours of signups + ~1 hour of installing tools.

---

## A. Accounts and hosted services

### A1. Supabase — create a free **staging project** [blocker]
- Go to supabase.com → New project → name `nammes-hub-staging`, region closest to lagos (e.g. `eu-west-1` — match prod if you know it; settings → general shows the prod region).
- Record: project ref, anon key, service-role key, DB password.
- The schema is built from `supabase/history/` + `supabase/migrations/` by the staging plan — you just keep the project alive (see B6 keep-alive).
- **No PITR/backups — free tier; the backup plan handles that with dumps.**

### A2. Upstash Redis — free tier [blocker for Phases 3–4]
- upstash.com → sign up → Create Database → Redis, region `eu-west-1`, **disable** eviction? (keep default), name `nammes-hub`.
- Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- Free tier: 10k commands/day — enough for rate limiting + cache until traffic grows. Watch the dashboard monthly (cost-guardrails plan).

### A3. UptimeRobot — free tier [blocker for Phase 3]
- uptimerobot.com → sign up → Add monitor: HTTPS, `https://www.nammeshub.com.ng/api/health`, 5-minute interval, 3 monitors if you also want `/` and `/outlines`.
- Alert contacts: your email + (after A4) Telegram.

### A4. Telegram — create the ops bot and group [blocker for Phase 3]
- Open Telegram → chat with **@BotFather** → `/newbot` → name `nammes-hub-alerts` → username like `nammeshub_alerts_bot` → copy the **bot token**.
- Create a private group `NAMMES Hub Alerts`; add the bot.
- Get the **chat id**: send any message in the group, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` → copy `"chat":{"id":-100…}`.
- Record `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

### A5. Google Search Console [Phase 7]
- search.google.com/search-console → Add property → **Domain** `nammeshub.com.ng` → verify via DNS TXT at your registrar (Cloudflare/where the domain is managed).
- After the SEO plan deploys: submit `sitemap.xml`, request indexing for `/`, `/outlines`, `/news`, `/cbt`.

### A6. Sentry — confirm existing project [Phase 3+]
- sentry.io → the Nammes-Hub project: note the DSN (should already be in Vercel envs), set **alerts**: (a) issue spike, (b) 80% of monthly quota (5k events free), (c) optional metric alert p75 LCP > 3 s.
- Verify nobody's personal card is attached (free tier never charges unless you add one).

### A7. Resend — confirm key and quota [Phase 3+/7]
- resend.com → API Keys → confirm `RESEND_API_KEY` (already used by email-worker). Set the 80% usage alert email in the dashboard. 3k emails/month free — the broadcast path must respect that cap (cost-guardrails plan wires it).

### A8. Vercel — access + settings [blocker for staging plan]
- vercel.com → project `nammes-hub` → note: Hobby plan (must stay Hobby — 12 function slots), domain(s) served, and:
- Add a **Preview** environment variable set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` — pointing at the **staging** project (this is what the staging plan builds).
- The `staging` branch alias for Previews (staging plan configures; you just confirm you can create branch `staging` and push it).
- Confirm the **bandwidth/function usage alerts** are on (Usage tab → alerts — free, email).

### A9. GitHub — ruleset + secrets [Phase 1–2]
- Repo → Settings → Rules → **Rulesets** → new ruleset for `master`: require PR, require CI status checks (lint/test/build + new security checks), block force-push **after** the repo-hygiene rewrite completes (do it before? The rewrite itself force-pushes — so: ruleset on, but allow bypass for the owner during the hygiene window, then lock).
- Secrets to add (Settings → Secrets and variables → Actions): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SUPABASE_DB_URL` (staging read-only user? **owner decision**: the backup dumps use the **prod** DB read URL — create the read-only `backup_reader` role per backup plan, then store `SUPABASE_DB_URL` = prod direct connection string with that role; `SUPABASE_POOLER_URL` for runtime pooler (Phase 4); `BACKUP_AGE_KEY` (public key only — private key stays **offline** with you, never in GitHub); `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`; `STAGING_DB_URL` (staging, for restore drills).

### A10. Cloudflare / DNS [Phase 7]
- If DNS is already Cloudflare or your registrar: no changes needed for SEO (verification only). If anything proxies `nammeshub.com.ng` incorrectly for preview deploys, fix there (out of scope of all plans — note it).

---

## B. Software to install on your machine (free)

| # | Tool | Install | Needed by |
|---|---|---|---|
| B1 | Node 22 LTS | nodejs.org or `nvm install 22` | everything (CI uses 22) |
| B2 | Git | system | everything |
| B3 | GitHub CLI (`gh`) | cli.github.com | repo-hygiene (ruleset/branch), release assets (backup, video) |
| B4 | git filter-repo | `pipx install git-filter-repo` | repo-hygiene (history rewrite) |
| B5 | k6 | k6.io | load-testing plan |
| B6 | PostgreSQL client tools (`psql`, `pg_dump`) | postgresql.org | backup + restore drill; match server major version |
| B7 | age (encryption) | github.com/FiloSottile/age | backup plan |
| B8 | Playwright + chromium | `npx playwright install --with-deps chromium` | e2e plan |
| B9 | axe DevTools (browser ext) | chrome web store | accessibility spot-checks |
| B10 | Supabase CLI | `npm i -g supabase` | optional — migrations are applied via SQL editor; CLI only for local dumps |
| B11 | jq | system | verify-restore script, triage scripts |

### B12. Keep-alive calendar entries (Google Calendar / phone) [blocker]
- **Weekly:** staging keep-alive workflow runs automatically (staging plan) — just watch for a failure issue.
- **Monthly (1st Mon):** 15-min admin review — UptimeRobot green? Sentry quota? Upstash commands? (cost-guardrails + SLO plans)
- **Quarterly:** restore drill (backup plan) + dependency PR merge + axe sweep + knip report.
- **Every 90 days:** rotate TURNSTILE_SECRET, RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, UPSTASH tokens, TELEGRAM_BOT_TOKEN — order in the rotation runbook (dev-workflow/audit plan).
- **Every August (exam week + AGM):** CBT freeze checklist from incident-response plan; exec handover walkthrough from admin-handbook plan.

---

## C. Decisions only you can make (owner)

1. **Force-push sign-off** — repo-hygiene rewrite of history (required for `video/` removal). Until you sign, that plan stays unstarted; everything else proceeds. The rewrite is done on a fresh clone with a bundle backup first.
2. **Restore drill keeper** — who runs the quarterly drill (you or a trusted exec) and where the `age` private key is stored (recommend: offline, printed or in a personal password manager, never cloud).
3. **Staging data policy** — staging holds synthetic fixtures only; confirm you never load real student data there (backup drill restores **schema+anonymized fixtures**, not prod dumps — the plan enforces this).
4. **Admin/owner split** — who else (if anyone) gets admin (AAL2) access, and the confirm-before-irreversible list (user deletion, broadcast send, quiz lock).
5. **Telegram group membership** — who besides you sees alerts (recommended: you + one technical exec).
6. **Resend cap** — accept the 3k/month ceiling with auto-pause (cost-guardrails), or tell the email plan to throttle differently.

## D. Things NOT to do

- **Do not enable a payment method** anywhere "just in case" (Supabase, Vercel, Resend, Sentry, Upstash all convert free → paid silently only with a card on file; without one, they degrade or block, which is exactly what the cost-guardrails plan wants).
- Do not create public Supabase storage buckets except the planned `documents` bucket (handbook PDF, public by design).
- Do not share the `backup_reader` DB credential or `age` key over chat/email.
- Do not bypass the GitHub ruleset after it locks — that includes you; break-glass requires documenting why in the ruleset bypass log.

## E. Verification that setup is complete

Before starting Phase 3 of the build order, run these spot-checks:
- [ ] `gh auth status` ok on your machine; target repo resolves.
- [ ] Staging URL renders the site (empty fixtures) over HTTPS.
- [ ] `curl -s https://nammeshub.com.ng/api/health` → `{ ok: true … }`.
- [ ] UptimeRobot shows 100% (or explains itself) for the last 24 h.
- [ ] A test message reaches your Telegram group via the bot.
- [ ] `k6 version`, `pg_dump --version`, `age --version`, `git filter-repo --help` all respond.
