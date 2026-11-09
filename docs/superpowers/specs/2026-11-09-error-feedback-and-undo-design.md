# Error Recovery and Undo for Destructive Admin Actions

Failures surface as dead-ends (generic toasts), and destructive admin mutations have no undo —
both are usability hazards in a volunteer-run admin where mistakes happen at 1 a.m.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Error taxonomy | `ErrorState` variants: offline / forbidden / not-found / server / validation — each with one plain-language sentence + action ("Retry", "Go back", "Tell an admin") |
| Retry wiring | All data-fetching empty/error branches render `ErrorState` with working retry (React Query `refetch`) |
| Undo | Destructive admin actions (delete broadcast, close CBT, reveal awards, remove resource) → 8-second "Undo" toast |
| Optimistic UI | Safe reversible sets toggle instantly with rollback on error (feature flags, notification prefs, theme) |
| Copy system | Adopted strings table in `docs/ux/errors.md`; ban "Something went wrong" as a bare string in src |

### Out

- **Undo for irreversible actions.** Reveal-awards undo = status flip only before reveal is committed publicly; define "commit points" explicitly.
- **A notification service.** Toast suffices; in-app inbox is a separate module.

---

## 2. The problem

Students hitting a transient failure on a timetable page see a blank card or a red toast with no path back — they conclude "the site is broken". Admins who mis-click delete in the content studio have no recovery short of SQL. Both erode trust in the tool the org depends on.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Toast payload | `{ title, body?, action?: { label, onClick }, duration }` | One component, all recovery affordances |
| Undo pattern | Soft-delete + deferred commit where feasible; else action-log inverse | Data loss is the true enemy |
| Retry | Query-level `retry: 2` for idempotent GETs; mutations never auto-retry | Auto-retrying a vote double-counts |
| Commit points | Documented per action in ADMIN.md ("revert window closes at…") | Honest semantics |
| Tests | Toast render + undo callback unit tests; Playwright: delete → undo → row present | The feature that saves mistakes must itself be tested |

## 4. The change

Extend `ToastContext` payload; audit `grep -rn "Something went wrong" src` (hits → taxonomy); wrap React Query root with taxonomy-aware fallback; admin destructive buttons route through `withUndo(action, inverse)` helper; ADMIN.md gains commit-point table.

## 5. Verification

1. Kill network mid-fetch → every screen shows a retry-capable `ErrorState` (manual sweep of 10 routes).
2. Playwright: delete resource → Undo within 8 s → resource visible.
3. `grep -rn "Something went wrong" src` → 0 bare strings.

## 6. Risk

Undo after 8 s timeout must still be recoverable via admin restore (audit_log + soft-delete window 30 days). Optimistic UI on money/vote paths is forbidden — this spec's undo covers content/flags/CBT only.
