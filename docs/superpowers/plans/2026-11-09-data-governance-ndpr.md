# Data Governance and NDPR Alignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A written data inventory with lawful bases and retention limits, a verified end-to-end erasure/export pipeline, consent signage at the authenticated boundary, and Sentry log hygiene — NDPR/NDPA engineering-grade baseline.

**Architecture:** Docs-first (`docs/privacy/inventory.md`), then code-path fixes: Sentry `beforeSend`, signup consent notice, admin-triggered `export-user` endpoint (multiplexed via `api/account.js`), and an erasure-receipt test against the real `anonymise-user` action. Retention enforcement uses the sweep from the migration-hygiene plan.

**Tech Stack:** Existing `anonymise-user` action in `api/account.js`, Sentry, SQL migrations, markdown docs.

**Spec:** `docs/superpowers/specs/2026-11-09-data-governance-ndpr-design.md`

## Global Constraints

- Engineering baseline, not legal advice — ADMIN.md says so explicitly and points to the association advisor.
- Erasure means cryptographic overwriting of personal fields and unlinking, never deleting exam/CBT integrity records.
- Export is admin-triggered (not self-serve) this round; decision recorded with rationale (auth UX risk of a new public endpoint vs. volume of requests).

---

## Task 1: Inventory

**Files:** Create `docs/privacy/inventory.md`

- [ ] Query the schema: `grep -E 'create table (public\.)?' supabase/migrations/*.sql | awk '{print $NF}' | sort` → every table. For each: PII class (none/indirect/direct), purpose (feature), retention, lawful basis (contract / legitimate interests / consent).
- [ ] Expected classes to fill: profiles (direct — contract), page_views/funnel_events (indirect session — legitimate interests), quiz_answers/quiz_submissions (indirect — legitimate interests, exam integrity), award votes (indirect aggregate — consent), email_outbox (direct — contract), audit_log (direct — legitimate interests, accountability), calendar/forms submissions (direct — consent), CGPA (direct — contract/legitimate).
- [ ] Retention table copied from the spec; mark which are enforced by code today vs. migration-hygiene sweep.
- [ ] Commit.

## Task 2: Sentry scrub

**Files:** Modify the Sentry init (`src/main.jsx` or wherever `Sentry.init` lives — locate with grep)

- [ ] `beforeSend(event)`: delete `event.request.headers.cookie/authorization`, scrub `event.request.query_string`, redact any string matching email regex in `event.message` and breadcrumbs (`replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '<email>')`). Unit-test the scrubber (pure function in `src/lib/sentryScrub.js`).
- [ ] Apply the same to server side if Sentry is initialized in `api/` (currently `@sentry/react` only — confirm; note "no server SDK" in the inventory).

## Task 3: Consent signage

- [ ] Signup form (`src/components/AuthCard.jsx` or signup page): one calm line — "By joining NAMMES Hub you agree to the Privacy Notice (link) and the Terms of Use." with link to `/privacy` (create a static page `src/pages/Privacy.jsx` if absent — check `App.jsx`; if a privacy page exists, link it instead).
- [ ] Add the same link in the Footer.
- [ ] Privacy page content: what we collect, why, retention, your rights (access/rectify/erase), how to request (contact current exec; response within 30 days) — plain English, no legalese.

## Task 4: Export endpoint

**Files:** Modify `api/account.js` (or `api/system.js` ACTIONS — choose where account actions live; they were verified in `api/account.js` for disable/delete/anonymise)

- [ ] New action `'export-user'`: admin/owner-gated via the existing `getCaller` + `isOwner` check used by anonymise; assembles a zipped JSON? No — plain JSON: `{ profile, cgpa, quiz_plays, cbt_attempts, awards_votes, forms }` (drop `email` if absent in schema — verify the actual `profiles` columns first: `sed -n '1,40p' supabase/migrations/*profiles*`).
- [ ] Respond with `Content-Disposition: attachment; filename="nammes-export-<id>.json"`? — serverless streaming is fine with `res.setHeader` + `res.send(JSON.stringify(...))`.
- [ ] ADMIN.md: when to export (lawful request), who may request (the student, in writing), where the receipt goes (audit_log row `entity='export-user'`).

## Task 5: Erasure receipt test

**Files:** Create `supabase/erasure-verify.sql` (manual script, not a vitest)

- [ ] Step-by-step against staging: create fixture user → exercise features (join quiz, submit CGPA) → run `anonymise-user` → assert profile PII nulled, quiz rows unlinked or marked, votes retained in aggregate only → stop. Print a receipt (counts) that goes in `docs/privacy/erasure-drills.md` (dated).

## Task 6: Sign-off

- [ ] ADMIN.md "Privacy" section links: inventory, notice, export runbook, retention sweep, erasure drills log.
- [ ] Owner read-through (30 min) — record date. This is the one step that cannot be automated.

## Rollback

Notice/link/export are additive. The Privacy page and footer link revert in one commit each.
