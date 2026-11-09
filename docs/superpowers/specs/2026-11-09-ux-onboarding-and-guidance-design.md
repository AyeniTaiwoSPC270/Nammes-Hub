# UX: Onboarding and First-Run Guidance

A student who lands on NAMMES Hub cold faces 15+ nav destinations with no guided path — the platform
hides its best tools (outlines, CGPA, CBT practice) behind discovery.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| First-run tour | Extend `src/components/tour/` — 4-step spotlight: outlines → CGPA → quiz → CBT, once per user (localStorage + profile flag) |
| Empty-state CTAs | Every `EmptyState` names the next action (e.g., "No past questions yet — submit one") |
| Role-aware home | Returning `isExecutor` sees admin shortcuts module; new students see "start here" checklist |
| Copy pass | Home hero + 3 key pages rewritten for skim-readability (short, verb-first) |
| Measure | Track tour completion via `page_views` props; iterate copy |

### Out

- **Intercom-style assistant.** No chatbot; the hub is fast and literal.
- **Personalization engine.** Rules, not ML.

---

## 2. The problem

`src/components/tour/` exists but is unverified as first-run guidance. Primary nav is broad (Academics, Community, Awards, Forms…). Every feature marketed elsewhere is underused because nothing sequences it for the 100-level student who needs it most — the outlines + CGPA journey.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Trigger | First authenticated visit, skippable, "don't show again" | Respect attention; never block |
| Steps | 4 max; each ≤ 25 words + one action | Tour abandonment scales inversely with length |
| Storage | `profiles.onboarding_step` (nullable) + localStorage cache | Survives device switch; RLS-safe |
| Analytics | `hub_tour:{step}:{completed|skipped}` in page_views | Learn where students bail |
| Exec path | Same mechanism, different 3 steps (inbox → banner → quiz studio) | Two personas, one system |

## 4. The change

Migration: `alter table profiles add column if not exists onboarding_step smallint;`. `TourProvider` mounts in `App.jsx` behind `useUser()`; steps per persona; `EmptyState.jsx` API gains optional `action={{ label, to }}`; copy edits in `Home.jsx`, `Outlines.jsx` CTA, `Cgpa.jsx` entry.

## 5. Verification

1. New account → tour runs once; skip → never again; completion recorded in `profiles`.
2. `page_views` shows tour events; admin analytics panel gains a small "onboarding funnel" card (pairs with rollup spec).
3. Keyboard + screen-reader pass on the tour overlay (focus trapped, Escape dismisses).

## 6. Risk

Tour fatigue on shared devices — the profile flag prevents repeats per account; add a "replay tour" link in settings to re-opt-in deliberately.
