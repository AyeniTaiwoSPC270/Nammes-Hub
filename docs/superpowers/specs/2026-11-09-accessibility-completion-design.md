# Accessibility Completion Pass (WCAG 2.1 AA)

ARIA usage is strong (260 aria-labels) but focus management, skip links, contrast, and keyboard-only quiz
play are unverified — and AA is the honest bar for a public student service.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Focus management | Trap + restore in all modals (verify `aria-modal` sites); focus moves to `h1` on route change |
| Skip links | "Skip to content" link as first focusable element, visible on focus |
| Keyboard gameplay | Answer selection via 1–4 / arrows + Enter in `PlayQuiz`/`PlayBattle`/`CbtExam` |
| Contrast audit | Token-level contrast check (buttons, muted text); fix failures; CI lint rule |
| Screen-reader pass | VoiceOver/NVDA walkthrough of: home, outlines, quiz join, CBT start, admin login |
| `prefers-reduced-motion` | Honor it in quiz animations/`motion` props that ignore it |

### Out

- **WCAG AAA.** AA is the target; note AAA aspirations where free.
- **Redesigning for a11y.** Fix, don't re-skin.

---

## 2. The problem

Half of Nigerian undergrads use phones; a meaningful minority use assistive tech or keyboard-only flows. Unlabeled icon-buttons and unwrapped modals turn the awards-voting moment into exclusion. The aria attributes prove intent; behavior is what's missing.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Modal contract | One `<Modal>` primitive owns trap/restore/escape; all call-sites migrated | One fix, not forty |
| Route focus | `RouteAnnouncer` sets focus to `main h1[tabindex=-1]` on pathname change | Screen reader users hear where they are |
| Quiz keys | 1–4 select, Enter submits, `R` repeats audio | Documented in `/how-to-play` |
| Contrast gate | `eslint-plugin-jsx-a11y` + a tokens test asserting AA ratios for used pairs | Prevents regression |
| Audit record | `docs/a11y/audit-2026-11.md` with pass/fail + fixes | Evidence for future auditors |

## 4. The change

Refactor modals to the primitive (grep `role="dialog"` to find sites); add `SkipLink` in `App.jsx` layout; keyboard handlers in quiz play views (guarded `e.target` to not hijack inputs); `eslint-plugin-jsx-a11y` recommended set (errors on missing labels); contrast tokens test in `src/styles/`.

## 5. Verification

1. `eslint` jsx-a11y clean (new errors = real bugs found).
2. Playwright: keyboard-only run completes a practice quiz answer submission.
3. axe-core (Playwright `@axe-core/playwright`) on 6 key routes → 0 serious/critical violations.
4. Screen-reader checklist signed by owner in the audit doc.

## 6. Risk

Retro-fixing focus in the quiz engine can double-fire handlers — scope key handlers to the quiz route components and test with inputs focused (answer text fields exist in forms). Contrast changes on brand colors may need design sign-off.
