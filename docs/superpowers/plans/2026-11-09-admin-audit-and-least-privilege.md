# Admin Audit Completeness and Least Privilege — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Every admin mutation writes an `audit_log` row (actor, action, entity, before/after), and the service-role key is provably confined to `api/_lib/`.

**Architecture:** A `withAdminAudit(action, handler)` wrapper in `authz.js` records before/after for mutations; a CI script fails the build if `SUPABASE_SERVICE_ROLE_KEY` appears outside `api/_lib/`; a rotation runbook documents key hygiene.

**Tech Stack:** Existing `authz.js` (`getCaller` + AAL2), `audit_log` table (20260929120000_audit_log.sql: `at, actor, action, entity, entity_id, before?, after?`), vitest, bash.

**Spec:** `docs/superpowers/specs/2026-11-09-admin-audit-and-least-privilege-design.md`

## Global Constraints

- Wrap **mutations only** — instrumenting reads would bloat `audit_log` and leak nothing extra.
- Before/after store **changed fields only** (diff), not full rows (PII minimization).
- Fail the audit write loud but not the request: log the failure to `console.error` + Sentry, still let the mutation complete (an admin action must not 500 because the ledger hiccuped — but the failure must be visible).
- Verify actual `audit_log` columns before coding: `sed -n '1,20p' supabase/migrations/20260929120000_audit_log.sql` (expect: id, at, actor, action, entity, entity_id, details?). Map `before/after` into the existing jsonb/text column — if there is no before/after column, store `details: { before, after }` in it.

---

## Task 1: Map every admin mutation (pass 1)

- [ ] `grep -rn "is_admin\|isAlAdmin\|getCaller\|requireAdmin" api --include='*.js' | grep -v test | sort` — build the full inventory. Expected sites: `api/account.js` (disable-user/delete-user/anonymise-user), `api/system.js` handlers (banner, feature flags, handbook-build, email-worker?), `api/send-broadcast.js`, `api/_lib/handlers/*` admin actions, `api/award-card.js` (admin reveal path), quiz admin actions (close/open session, delete question bank).
- [ ] Dump the list into the new file `docs/security/admin-mutations-inventory.md` with columns: file, action, entity, wrapped? (Y/N — all start N).
- [ ] Commit the inventory.

## Task 2: The wrapper

**Files:** Modify `api/_lib/authz.js`; **Create** `api/_lib/audit.js` and `api/_lib/audit.test.js`

```js
// api/_lib/audit.js
export function diffFields(before, after) { /* shallow diff; JSON-comparable */ }
export async function writeAudit(supabaseAdmin, { actor, action, entity, entityId, before = null, after = null }) {
  const { error } = await supabaseAdmin.from('audit_log').insert({
    actor, action, entity, entity_id: entityId == null ? null : String(entityId),
    details: { before: before == null ? null : diffFields(before, after) ? before && trimToChanges(before, after) : null, after: trimToChanges(after, before) },
  });
  if (error) console.error('[audit] write failed', error.message); // never throw
}
export const withAdminAudit = (supabaseAdmin, action, entity, readBefore) => async (req, res, body) => { … }
```

- [ ] `readBefore(req)` hook: each call site supplies a `select` for the target row (or `null` for creates). The wrapper loads before, runs the mutation, then logs with both.
- [ ] Unit tests: no-op when `audit_log` insert fails (mutation still returned), diff correctness (added/removed/changed keys), entity_id stringified.

## Task 3: Wrap the mutations

- [ ] One commit per domain: account → system handlers → send-broadcast → awards reveal → quiz admin → forms admin.
- [ ] Pattern per site: replace `await handler(req, res)` with `await withAdminAudit(supabaseAdminRef, 'disable-user', 'profile', read)(…)`.
- [ ] Re-verify inventory: flip every `wrapped` to Y; commit.

## Task 4: Service-role confinement check

**Files:** Create `scripts/check-service-role.mjs`

- [ ] Script: walk `api/` excluding `_lib/` (everything above `api/_lib/`), assert no match for `SUPABASE_SERVICE_ROLE_KEY` in code (comments allowed if tagged `service-role:ok`). Exit 1 on hit with file list.
- [ ] Wire into `ci.yml` as a step after lint. Commit.

## Task 5: Rotation runbook

**Files:** Create `docs/runbooks/secrets-rotation.md`

- [ ] 90-day cadence for `TURNSTILE_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_*`: where each is set (Vercel/Supabase/Cloudflare/Upstash dashboards), rotation order (create new → deploy → revoke old → verify health), rollback line, and "who may hold the current value" (owner).
- [ ] ADMIN.md gains "Key rotation" pointer + last-rotated dates table.

## Rollback

Unwrap commits one by one (they are independent). `check-service-role.mjs` can stay — it is an assertion, not a behavior.
