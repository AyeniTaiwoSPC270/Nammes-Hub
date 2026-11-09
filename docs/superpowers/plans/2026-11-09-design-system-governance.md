# Design System Governance and Contrast Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make DESIGN_SYSTEM.md enforceable: raw-token drift report, a WCAG-AA contrast test over the token file, a component inventory, and a deprecation path — all free.

**Architecture:** `scripts/token-drift.mjs` (regex audit), a vitest contrast test (`src/styles/tokens.test.js` or inside `src/lib/`), a generated `docs/design/components.md`, and a `DEPRECATED.md` convention. CI runs the contrast test; drift report is weekly artifact.

**Tech Stack:** Node + regex for drift report, vitest for contrast math (relative luminance), existing tokens (`src/index.css` v4 `@theme`).

**Spec:** `docs/superpowers/specs/2026-11-09-design-system-governance-design.md`

## Global Constraints

- No visual redesign: changes only bring code to the system we have.
- The contrast gate asserts on **token pairs**, not computed pixel styles — simple, fast, honest.
- Drift report lists offending files with counts — fixing is a separate pass, scoped to one PR per area.

---

## Task 1: Drift audit script

**Files:** Create `scripts/token-drift.mjs`

- [ ] Walk `src/**/*.{jsx,js,css}` (exclude tests): flag hex colors (`#[0-9a-fA-F]{3,8}`) and px font sizes not inside `src/index.css`/`tailwind.config*`.
- [ ] Write report to stdout: file → matches → suggested token (hex→nearest palette entry by simple distance — or just flag, no guessing).
- [ ] `npm run drift` script; CI job uploads `drift-report.txt` artifact (non-blocking); blocking only when a **new** hex appears in a PR (compare against base? — keep non-blocking this round; note follow-up).

## Task 2: Contrast test

**Files:** Create `src/styles/tokens.test.js` (locate tokens file first: `grep -rn "@theme" src/index.css src/styles 2>/dev/null`)

- [ ] Parse the token definitions (they may be raw CSS vars — extract with regex; do NOT import a CSS parser dependency).
- [ ] Implement WCAG relative luminance + ratio; assert every foreground token × background token pair marked as "text on" pairs (maintain the pair list in the test — start with: ink-900/surface, ink-muted/surface, ink-muted/surface-low, danger/surface, brand/surface, brand-contrast/brand, white/brand, white/danger) ≥ 4.5 (3.0 for ≥ 18 pt/bold).
- [ ] `npm test` green; on failure, nudge token one step in the same hue family and update DESIGN_SYSTEM.md in the same commit.

## Task 3: Component inventory

**Files:** Create `docs/design/components.md`

- [ ] Table: component (`ui/Button`, `ui/EmptyState`, `ui/ErrorState`, `ui/Card`, `ui/FormField`, … — `ls src/components/ui/`) | variants/props | used-by count (`grep -rl "ui/Button" src | wc -l`) | screenshot? (skip screenshots — text variant list is enough this round).

## Task 4: Deprecation convention

**Files:** Create `docs/design/DEPRECATED.md`; add `scripts/codemod-deprecated.mjs` stub

- [ ] Format: `- Component.jsx — deprecated <date> — replacement <Component> — removal after <date> — codemod: <command>`.
- [ ] Seed with any one-off banner/button if one exists (grep for duplicated ad-hoc buttons — fix nothing yet, just register).
- [ ] AGENTS.md/DESIGN_SYSTEM.md link the convention.

## Task 5: Dead styles

- [ ] `npx knip` output (from the e2e-and-dead-code plan) cross-referenced for CSS files; delete unused `styles/*.css` only if verified unreferenced (`grep -r <name> src`).

## Task 6: Verify

- [ ] `npm test` (contrast test included) · `lint` · `build`; report committed; ADMIN.md "Design system" pointer added.

## Rollback

Scripts and test are additive; token nudges revert with their commits.
