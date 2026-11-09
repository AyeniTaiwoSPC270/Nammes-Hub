# Data Governance and NDPR Alignment

The hub stores student records (profiles, answers, votes, CGPA) under Nigerian law (NDPR 2019 / NDPA 2023)
but has no written retention schedule, no consent notice audit, and no verified delete pipeline end-to-end.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Data inventory | `docs/privacy/inventory.md` — every table × PII class × purpose × retention × lawful basis |
| Retention schedule | Table above, enforced: `page_views` 13 mo (rollup spec), `quiz_practice_runs` 2 yr, `email_outbox` 6 mo, `audit_log` 5 yr |
| Delete pipeline | Trace `anonymise-user` end-to-end: profile PII scrubbed, quiz/CGPA rows unlinked, votes preserved (aggregate only) — document + test |
| Consent surface | Privacy notice at signup linking NDPR rights (access, rectification, erasure); contact route to exec |
| Log hygiene | Sentry `beforeSend` scrubs emails/tokens in Nammes too (FYpro already does) |
| Export | Student self-export (JSON download of own data) — one admin-triggered endpoint |

### Out

- **Full legal counsel review.** Flag for the association's advisor; this spec is engineering-grade baseline, not legal advice.
- **Consent management platform.** A notice + rights contact is proportionate.

---

## 2. The problem

`/api/anonymise-user` exists (vercel.json rewrite) but coverage is unverified — a half-scrubbed delete leaves PII in `quiz_answers`-adjacent tables. `page_views` stores paths that may embed query strings with tokens. NDPR grants data subjects rights the org currently honors ad hoc.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Basis | Legitimate interest (service operation) + consent (newsletter/marketing) | Standard NDPR framing for student services |
| Anonymisation | Pseudonymise by default (replace name/email/matric with tombstone), hard delete on request within 30 days | Keeps votes/aggregate stats intact, deletes identity |
| Inventory owner | One named exec per session; reviewed each handover | Governance rots without an owner |
| Retention enforcement | Scheduled sweep (pairs with migration-hygiene spec) | Paper schedules don't delete rows |
| Sentry scrub | `beforeSend` regex for emails + `authorization` headers | Logs are the forgotten PII landfill |

## 4. The change

Write the inventory; extend `anonymise-user` handler with a table-coverage test (every PII column asserted scrubbed); `beforeSend` scrub in Sentry init (client + server); privacy notice page + signup link; `api/system?action=export-user` (admin-triggered JSON dump of one student's rows); retention sweep reuses the rollup scheduler.

## 5. Verification

1. Test: anonymise a seeded student → queries confirm no email/matric retrievable anywhere (scripted grep across all tables).
2. Export endpoint returns complete, correct JSON for the seeded student.
3. Sentry test event shows redacted PII.
4. Inventory doc reviewed and signed by one exec; copy filed in ADMIN.md.

## 6. Risk

Vote secrecy vs erasure: award votes are linked to nominees but should be unlinkable to voters post-anonymisation — verify aggregate tallies keep working after scrub (they key on nominee, not voter). Retention deletes must be batched and logged like any admin mutation.
