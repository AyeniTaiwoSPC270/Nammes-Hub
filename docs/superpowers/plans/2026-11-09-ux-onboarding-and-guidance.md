# UX: Onboarding and First-Run Guidance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A 4-step first-run tour for new students (and a 3-step one for execs), exactly once per account, built on the existing Waitlist of tour bits (`src/components/tour/`), plus action-bearing empty states.

**Architecture:** Extend `SpotlightOverlay`/`WelcomeCarousel` usage — do not rebuild them. One migration adds `profiles.onboarding_step`. The tour mounts in `Layout.jsx` behind `useUser()`; steps live in `src/components/tour/onboardingSteps.js`; empty states gain an optional `action` prop (extends existing `ui/EmptyState.jsx`).

**Tech Stack:** Existing tour components, React Query, one SQL migration + rollback.

**Spec:** `docs/superpowers/specs/2026-11-09-ux-onboarding-and-guidance-design.md`

## Global Constraints

- Never show to anonymous or returning users; never on `/admin` unless the exec path explicitly triggers.
- Skippable at every step; "don't show again" persists to the profile row (not just localStorage — survives device switch).
- Copy ≤ 25 words per step; verb-first; no emoji spam.

---

## Task 1: Migration

- [ ] `supabase/migrations/20261111090000_onboarding_step.sql`: `alter table public.profiles add column if not exists onboarding_step smallint;` + rollback sibling.
- [ ] Apply staging → verify → prod (owner) per migration workflow; `npm test`.

## Task 2: Survey the existing tour

- [ ] Read `src/components/tour/SpotlightOverlay.jsx` and `WelcomeCarousel.jsx`; note props (spotlit selector? steps array? dismiss callback?) and the one place they're used today (grep `WelcomeCarousel` — likely after first signup; confirm).

## Task 3: Step definitions

**Files:** Create `src/components/tour/onboardingSteps.js`

```js
export const studentSteps = [
  { target: '[data-tour="outlines"]', title: 'Find your outlines', body: 'Course outlines by level — the single most-used page on this site.', hint: 'Outlines' },
  { target: '[data-tour="cgpa"]', title: 'Track your CGPA', body: 'Compute your semester and cumulative GPA as you go.', hint: 'CGPA' },
  { target: '[data-tour="quizzes"]', title: 'Practice with quizzes', body: 'Public practice mode — past-question style, timed.', hint: 'Practice' },
  { target: '[data-tour="cbt"]', title: 'Rehearse the real thing', body: 'Timed CBT practice on the same interface your exams will use.', hint: 'CBT' },
];
export const execSteps = [ inbox, banner, quiz-studio equivalents ];
```

- [ ] Add `data-tour` attributes to the four nav items in `Navbar.jsx` (and exec equivalents).

## Task 4: Mount + persist

**Files:** Modify `src/components/Layout.jsx` (or the auth shell), `src/components/tour/OnboardingTour.jsx` (new)

- [ ] `OnboardingTour` reads `useUser()` → if `!u || u.onboarding_step === null` and localStorage `nammes_tour_done` unset → render steps overlay; on finish/skip/complete → `update({ onboarding_step: 0 })` on the profile + set localStorage guard.
- [ ] Exec persona: if the caller is an admin (reuse the admin check pattern from authz — the profile/admins row exists client-side? — verify via an existing hook, e.g. how `/admin` gates; if no client hook exists, gate on an env-tagged admin email list read from `app_config` read of `admin_hint`… **simplest correct route**: query `admins` table for the user id with anon key + existing RLS (admins is readable by owner only? — verify policy in migration `20260929121000_*` or wherever; if unreadable, show student tour only and skip exec steps; note the limitation honestly).

## Task 5: Empty-state actions

**Files:** Modify `src/components/ui/EmptyState.jsx`

- [ ] Add optional `action={{ label, onClick | to }}`; renders existing `Button` (secondary, sm) below description — visual family unchanged (tokens, no new colors).
- [ ] Sweep the top 8 empty-state usages (outlines results, resources, events gallery, quiz library, admin inbox, broadcast drafts, awards, forms) and add actions ("Submit past questions", "Create the first resource", …).

## Task 6: Verify

- [ ] Fresh account on staging: tour appears on first layout mount, 4 steps, both skip and complete paths persist (check `profiles.onboarding_step`); reload → no re-show.
- [ ] Keyboard: Escape dismisses; focus trapped in overlay; screen-reader order sane.
- [ ] `npm test` · `lint` · `build`; route snapshot (if route-registry landed) unchanged.

## Rollback

Delete the mount; leave the migration (additive column, harmless) or rollback file if insisted.
