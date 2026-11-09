# Error Feedback, Undo and Empty States — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Every mutation failure says something actionable; every delete/undo-able action has one undo path within 8 seconds; empty states become next-step invitations; nav failures degrade to friendly offline-ish messaging; the 500 page never looks like a white void.

**Architecture:** Extend `ErrorState` (retry + cause), add `UndoToast` support via the **existing** `useToast().info(msg, { actionLabel, onAction, sticky })` API (Toast already renders the action button — verified), teach `EmptyState` an optional `action`, add a nav-aware `OfflineBanner`, and wire global mutation-error toasts in `App.jsx`'s QueryClient `defaultOptions.mutations.onError`.

**Tech Stack:** Existing `ToastContext.jsx`, `@tanstack/react-query` mutation onError, `ErrorBoundary.jsx` (exists).

**Spec:** `docs/superpowers/specs/2026-11-09-error-feedback-and-undo-design.md`

## Global Constraints

- Never promise undo for irreversible actions (user deletion, anonymise, broadcast send, quiz lock) — those keep typed-confirm patterns.
- Error messages: plain language, action-first, never a raw Supabase body. Map known `23505` unique-violations to "already exists" where we can.
- Undo window = 8 s; after expiry, the button disappears (toast still dismisses normally).

---

## Task 1: QueryClient global mutation error

- [ ] `src/lib/queryClient.js`: add `defaultOptions.mutations.onError(err)` → `toastError(friendly(err))` via a module-level helper (queryClient has no React access — use a lazy-registered reporter: `registerErrorReporter(fn)` called inside a small effect in `ToastProvider`).
- [ ] `friendly(err)` map: payload 400/401/403/404/409/429/500 + PostgREST codes (23505/23503) → curated sentence; unknown → "That didn't work. Try again in a moment." Log full error to console in dev.
- [ ] Unit tests for the map (10 cases).

## Task 2: Undo pattern

- [ ] Helper `src/lib/undoable.js`: `runUndoable({ toast, message, perform, undo, timeoutMs = 8000 })` — runs `perform()`, then shows `info(message, { actionLabel: 'Undo', sticky: true, onAction: async () => { await undo(); toast.success('Restored.') } })`; schedules a timer to dismiss the sticky toast at timeout (whichever comes first).
- [ ] Adopt for the 3–5 eligible deletes found by `grep -rn "delete()" src src/data src/features | grep -v test` that are soft/recoverable: bookmark removal, event delete, news draft delete, admin pin/unpin, award card removal (confirm soft-delete support; hard deletes keep confirm-typed).
- [ ] Each adoption = own commit + record in the new file `docs/perf/undo-adoptions.md`.

## Task 3: ErrorState upgrade

**Files:** Modify `src/components/ui/ErrorState.jsx`

- [ ] Add optional `onRetry` (already supported — verify layout), new optional `action` (`{label, onClick|to}`) and `detail` (one-line raw message shown collapsible). Keep `className` passthrough. Buttons reuse `ui/Button`.

## Task 4: EmptyState action

- [ ] Extend `EmptyState({ icon, title, description, action, className })` — `action` renders the same small secondary button. Sweep top 8 sites (outlines, resources, events, gallery, quiz library, awards, forms, admin inbox) — coordinate with the onboarding plan's Task 5 (single pass).

## Task 5: Offline-aware nav errors

**Files:** Create `src/components/OfflineBanner.jsx`

- [ ] Listen to `window` `online`/`offline` events + `useSyncExternalStore`; fixed top banner (below navbar): "You're offline — reading is fine, saving needs network." with retry on reconnect.
- [ ] Mount in `Layout.jsx` above `<Outlet/>`.
- [ ] Verify toggling DevTools network → banner appears ≤ 500 ms; actions that need network show the existing friendly error (no infinite spinners).

## Task 6: NotFound + ErrorBoundary

- [ ] 404 page (find the `*` route's NotFound or App.jsx inline): brand-consistent, links to `/outlines` and `/`, "Report this link" → mailto owner with path prefilled.
- [ ] `ErrorBoundary.jsx`: ensure "Something broke" + reload button + copy-diagnostics button (copies route, timestamp, digest) — no stack trace for users.

## Task 7: Verify

- [ ] `npm test`/`lint`/`build`; Playwright smoke (if landed) still green; manual pass: kill network, reload `/outlines`, trigger a failing mutation via devtools offline → toast text checked.

## Rollback

All helpers additive; un-adopt undoables per call site; revert App-level reporter wiring last.
