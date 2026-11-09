# Design System Governance and Contrast Gate

DESIGN_SYSTEM.md (25 KB) defines tokens and components but nothing enforces them — drift is unchecked,
and accessibility contrast of the palette is not asserted anywhere in CI.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Token audit | Script listing raw hex/px in `src/` outside `styles/`; violations to a report or fixed |
| Contrast gate | Test asserting every foreground/background token pair used in components meets WCAG AA (4.5:1 text, 3:1 large) |
| Unused styles | Find dead CSS/Tailwind classes via `knip`/purgecss against markup |
| Component inventory | `docs/design/components.md` — every `ui/` component, its variants, one screenshot |
| Deprecation | `DEPRECATED` comment + codemod path for retired components (e.g., one-off banners) |

### Out

- **Visual regression CI.** Noted as follow-up; not this spec.
- **Brand redesign.** Governance only.

---

## 2. The problem

155 components + theming (`quizTheme`, contentLooks) mean color/spacing forks are inevitable without enforcement. Low-contrast muted text on the sand/gold palette is likely failing AA in places exactly where students squint (outlines, tables).

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Enforcement | `scripts/check-tokens.mjs` + `tokens.contrast.test.js` — CI-blocking | Rules beat intentions |
| Palette fix | Adjust failing token values minimally (one step darker) — owner signs off | AA is non-negotiable for body text |
| Inventory | Generated list with 1-line purpose each; orphan components deleted or adopted | Visibility first |
| Theme safety | Verify `theme-init.js` and dark mode respect the same tokens | Parity, not parallel universes |

## 4. The change

Write the audit scripts; fix token violations in batches (tokens first, then 3 worst components); generate inventory; add tests; link inventory from DESIGN_SYSTEM.md.

## 5. Verification

1. Contrast test fails on a planted 3.0:1 pair; passes on the fixed palette.
2. Token script reports 0 raw hex outside `styles/` (or an explicit allowlist with reasons).
3. axe-core spot-checks on two pages confirm contrast pass (pairs with a11y spec).

## 6. Risk

Token moves ripple through the quiz theming engine (snapshot tests exist — good safety net). Some raw hex may be intentional art (quiz character palettes) — allowlist explicitly rather than weaken the rule.
