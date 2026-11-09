# Accessibility Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the known gaps between "built with a11y intent" and "usable with a keyboard and a screen reader": named dialogs, live regions, focus rings, skip link, reduced-motion polish, contrast-checked tokens — with a script that audits most of it automatically.

**Architecture:** Fix the identified components (Modal primitives, Toast, quiz buzzer, admin drawers), add a global skip link + focus-visible styles, then run an axe-core audit script across 25 routes and triage violations. No framework changes.

**Tech Stack:** `@axe-core/cli` (dev), existing Tailwind tokens (DESIGN_SYSTEM.md), React.

**Spec:** `docs/superpowers/specs/2026-11-09-accessibility-completion-design.md`

## Global Constraints

- Visual identity stays — fixes add semantics and focus visibility, they don't redesign.
- Every interactive element reachable by keyboard; visible focus indicator in brand color (`:focus-visible` with the existing ring token).
- `prefers-reduced-motion` already respected in Layout (`useReducedMotion`) — extend, don't duplicate.

---

## Task 1: Modal primitives (the big one)

**Files:** Create `src/components/ui/Modal.jsx`; modify existing modal call sites to consume it

- [ ] `Modal.jsx`: `role="dialog" aria-modal="true" aria-labelledby="{id}-title"`, focus trap (first focusable → Escape closes → return focus to opener), scrim `aria-hidden`.
- [ ] Migrate the modal components (FeedbackModal, HostQuizModal, EmailStudioModal, FormDesignModal, QuizModal family, GalleryLightbox) to either wrap Modal or mirror its semantics — check each for `role="dialog"` today with `grep -l 'role="dialog"' src -r`; add `aria-labelledby` pointing at its title element id.
- [ ] Commit per modal group.

## Task 2: Live regions + toasts

- [ ] Toast container: `role="status"` (polite); error toasts `role="alert"`. (Inspect `src/lib/ToastContext.jsx`.)
- [ ] Quiz answer feedback / buzzer result / countdown: `aria-live="assertive"` region in the play screens.
- [ ] Form submit success/error: existing ErrorState/success banners get `role="alert"`.

## Task 3: Skip link + focus rings

- [ ] `src/components/Layout.jsx`: first child `<a href="#main" className="skip-link">Skip to content</a>`; wrap `<Outlet/>` in `<main id="main">`.
- [ ] `src/index.css`: `.skip-link { sr-only until focus-visible; then brand styles }` (use Tailwind `@apply` or raw CSS with v4 tokens); global `:focus-visible { outline: 2px solid var(--color-brand?) ; outline-offset: 2px }` matching DESIGN_SYSTEM ring token.

## Task 4: Reduced motion pass

- [ ] `grep -rn "motion\.\|AnimatePresence\|animate-" src --include='*.jsx' | grep -v reducedMotion | grep -v test` — for each animated component without a reduced-motion guard, wrap with `useReducedMotion() ? staticProps : animatedProps` (the motion/react pattern Layout already uses).
- [ ] Carousels/slideshows (SlideshowLayer, WelcomeCarousel): pause on `prefers-reduced-motion`.

## Task 5: Color contrast

- [ ] Pick the 6 most-used text/background token pairs from DESIGN_SYSTEM.md; verify ratios (WebAIM contrast checker or `npx` contrast script); where a pair fails AA (4.5 normal / 3 large), nudge token within the same hue family — DESIGN_SYSTEM.md updated in the same commit.

## Task 6: Automated sweep

**Files:** Create `scripts/a11y-audit.mjs` (Playwright-less: `axe-core` + `fetch` is not enough — use `npx @axe-core/cli` against `vite preview` for the route list)

- [ ] Routes: all 25 in the spec. Expect violations left ONLY as documented exceptions (third-party embeds).
- [ ] Keyboard spot-checks documented per flow: signup, outlines search, CBT start, quiz buzz, admin login + MFA.
- [ ] ci.yml: add an `a11y` step only if it passes reliably locally; otherwise keep as manual quarterly check (note the choice in the audit doc).

## Rollback

Semantic attributes are additive; skip link removable in one commit; token nudges revert cleanly.
