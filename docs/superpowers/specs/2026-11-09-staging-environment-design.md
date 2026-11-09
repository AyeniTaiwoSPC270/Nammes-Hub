# Staging Environment on Free Tiers

Every reliability/performance spec in this program assumes a place to rehearse — `npm run preview` is not
staging, and shipping against production is how a migration mistake reaches students at 8 a.m. before class.
This spec stands up a real staging environment at **zero cost** using free tiers only.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

**Hard constraint (owner's statement, 2026-11-09): no paid plans of any service. Everything here must run on free tiers.**

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Staging DB | A **second Supabase free-tier project** (free organizations allow two free projects) — `nammes-hub-staging` |
| Staging app | Vercel preview deployment per PR + a pinned `staging` branch tracking `master`; Hobby tier is free |
| Config | `.env.staging` (gitignored) + Vercel Preview environment variables pointing at the staging Supabase keys |
| Seed | `scripts/seed-staging.mjs` — deterministic fixture: admin, 20 students, one quiz (20 questions), one CBT exam, outlines, events, forms |
| Anonymized snapshot | Optional: `pg_dump` of prod → `scripts/anonymize.mjs` (scramble emails/matrics) → restore into staging for realistic load shapes |
| Keepalive | Weekly GitHub Action pinging staging `/api/health` so the free project does not auto-pause after ~7 idle days |
| Access | Owner-only keys; no student data in staging by default (fixtures preferred over copies) |

### Out

- **Custom domains for staging.** Preview URLs (`nammes-hub-git-staging-…vercel.app`) are free and sufficient.
- **Production data mirroring with real PII.** The anonymizer exists for realism but fixtures are the default path.
- **Paid Supabase add-ons.** PITR, branching, and read replicas are explicitly excluded — see §3.

---

## 2. The problem

The specs reference staging repeatedly (load tests, fuzzing handlers, restore drills, cache TTL validation).
Without it: either nothing is rehearsed, or production *is* the rehearsal. Two earlier assumptions were invalid
for a no-budget project (see §3) — staging replaces both.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Staging DB | Second **free** Supabase project | Two free projects per org are included; isolated keys prevent accidents |
| Paid PITR | **Replaced** — nightly `pg_dump` backups (see `2026-11-09-backup-and-restore-drill-design.md`) | Pro-only on Supabase; not buyable here |
| Staging hosting | Vercel Hobby preview/staging deployments | Free, per-PR URLs, same build pipeline as production |
| Idle pause | `.github/workflows/staging-keepalive.yml` — Monday 06:00 UTC GET on staging `/api/health` (and a trivial SQL ping via PostgREST) | Free projects pause after inactivity; 30-second job prevents that surprise |
| Data realism | Fixtures by default; anonymized dump available via the backup file from the backup spec | Realism when needed, privacy always |
| Keys | Separate `SUPABASE_SERVICE_ROLE_KEY` for staging; never shared with prod, never committed | Blast-radius control, zero cost |
| Verification parity | Staging migrations applied **first**, then prod — `supabase/migrations.test.js` already guarantees ordering mechanically | Catches "worked locally" drift |
| Analytics on staging | Sentry staging DSN optional; if quota is a concern, `VITE_APP_ENV=staging` suppresses beacon | Free quotas are finite |

## 4. The change

1. Create the staging Supabase project; run `supabase/history` + `supabase/migrations` in order (same rebuild the backup drill rehearses).
2. Create `.env.staging.example` (committed, placeholders only); real `.env.staging` documented in ADMIN.md.
3. Vercel → Project → Environment Variables: `Preview` scope gets staging keys; `Production` keeps prod keys. `staging` branch gets its own alias automatically.
4. `scripts/seed-staging.mjs` (idempotent; service-role client; upserts by fixed UUIDs).
5. Keepalive workflow; ADMIN.md gains "Staging" section: how to promote migrations staging → prod, how to seed, how to point a PR preview at it.
6. Every spec in this program that says "staging" means **this environment** — not local, not production.

## 5. Verification

1. `npm run build` with staging keys → preview deploy serves the full site; outlines/CGPA render from the staging DB.
2. Seed script run twice → identical state (idempotent); admin login works with the seeded account.
3. Migration rehearsal: new migration applied to staging → `npm test` → then prod; documented order in the migration headers.
4. Keepalive runs green for 4 consecutive weeks (check Action log).
5. Keepalive pause test: 8 days idle staging resumes without data loss when pinged.

## 6. Risk

Free projects pause when idle — mitigated by keepalive, but if staging is ever suspended, the runbook says how to restore from the nightly dump (backup spec). Staging drifts from prod if seeds age — the anonymized-dump path refreshes realism quarterly. Two free projects per org means staging and prod cannot both use the Management API freely — acceptable; dashboards are read-only human tools here.
