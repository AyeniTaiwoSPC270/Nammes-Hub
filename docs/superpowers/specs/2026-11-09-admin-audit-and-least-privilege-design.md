# Admin Audit Completeness and Service-Role Least Privilege

`audit_log` exists but coverage is not guaranteed for every admin mutation, and the service-role client
is used from more than the narrow `_lib` core — both violate least-privilege with real blast radius.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Coverage audit | Enumerate every admin mutation handler; each must write `audit_log` (actor, action, target, before/after) |
| Wrapper | `withAdminAudit(handler, action)` helper in `authz.js`; routes opt in |
| Service-role scan | `grep -rn SUPABASE_SERVICE_ROLE_KEY` — keep usage inside `api/_lib/supabaseAdmin.js` only |
| Secrets rotation | Document rotation for `TURNSTILE_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `authz` MFA | Verify every admin path enforces AAL2 (it does in `authz.js`); add a test asserting no bypass flag exists |

### Out

- **Replacing `audit_log`.** It is the right ledger; this spec guarantees its completeness.
- **SSO/SCIM.** Out of scope for a student-org admin set.

---

## 2. The problem

Admin actions — broadcast sends, banner edits, CBT close, awards reveal, user disable — mutate shared student state. If one handler skips the ledger, the forensic trail has a hole exactly where trust matters. Service-role keys bypass RLS; stray usage in route files widens that beyond review.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Ledger completeness | 100% of admin mutations write `audit_log`; test greps route files for service-role import outside `_lib` | Two mechanical guards, no judgment calls |
| Diff format | `before`/`after` JSONB of changed fields only (not full rows) | Readable trail; small rows |
| Rotation | 90-day reminders in calendar + runbook `docs/runbooks/secrets-rotation.md` | Keys leak silently; calendar is the fix |
| Read access | `audit_log` readable by owner-admins only (RLS exists — verify policy) | The ledger must not become student-visible |

## 4. The change

`authz.js` exports `withAdminAudit(action)`; admin handlers wrap mutations (`disable-user`, `award-reveal`, `cbt-close`, broadcast, banner/content edits, feature-flag flips). `scripts/check-service-role.mjs` fails CI if `SUPABASE_SERVICE_ROLE_KEY` appears outside `api/_lib/supabaseAdmin.js` and tests. Rotation runbook written.

## 5. Verification

1. Script green; list of wrapped actions enumerated in the PR description.
2. Trigger one admin action per wrapped handler in staging → matching `audit_log` rows with before/after.
3. `authz` test additions: no code path reaches admin handler with `aal1` (exists today — keep green).

## 6. Risk

Audit rows on very high-frequency student reads would bloat the ledger — wrap **mutations only**, never reads. Before/after diffs may capture personal data (e.g., a disabled user's row) — store id + changed fields, not whole PII payloads.
