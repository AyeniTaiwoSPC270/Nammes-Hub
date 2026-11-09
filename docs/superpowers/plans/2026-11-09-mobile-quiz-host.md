# Mobile Quiz Hosting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A host can run a full quiz battle from a phone: question display scales, big-tap answer reveal, join QR visible without scrolling, battle phone mode.

**Architecture:** `useResponsiveVariant()` hook (viewport width tiers), a `HostQuizMobile` layout branch inside the existing host page (not a separate route), `touch-target` utility (min 44 px), portrait-only hint. No new pages, no API changes.

**Tech Stack:** Tailwind v4 breakpoints, `useMediaQuery`-style hook implemented locally, existing `HostQuiz.jsx`.

**Spec:** `docs/superpowers/specs/2026-11-09-mobile-quiz-host-design.md`

## Global Constraints

- Desktop layout untouched — all changes gated behind width (< lg).
- No hover-only interactions on host critical path (reveal, next, end, reveal-answer).
- Keep every live-quiz control ≥ 44×44 px and text ≥ 16 px on phones.

---

## Task 1: The hook

**Files:** Create `src/lib/useMediaQuery.js` (if absent — check: `grep -rn useMediaQuery src`)

```js
export function useMediaQuery(query) { const [m, setM] = useState(() => window.matchMedia(query).matches); useEffect(() => { const mq = window.matchMedia(query); const fn = () => setM(mq.matches); mq.addEventListener('change', fn); return () => mq.removeEventListener('change', fn); }, [query]); return m; }
export const usePhoneLayout = () => useMediaQuery('(max-width: 1023px)');
```

- [ ] Unit-test the hook logic with a matchMedia mock (or skip tests if none exist — acceptable in this JS codebase).

## Task 2: Host page mobile branch

**Files:** Modify `src/pages/HostQuiz.jsx` (or its post-migration location)

- [ ] When `usePhoneLayout()`: stack the layout; QR + join code fixed at top (sticky, compact); question text `text-2xl` minimum; answer options become 2×2 tap grid or full-width buttons ≥ 56 px; "Reveal / Next / End" full-width bottom bar (thumb zone).
- [ ] Session metadata pill (players total, question i/N) shrinks to a single row.
- [ ] Body scroll locked behind sticky bar? — verify no CTA is clipped at iPhone SE height (568 px); allow scroll, bar sticky.

## Task 3: Battle phone mode

- [ ] `src/pages/PlayBattle.jsx` (and the host-side battle panel): below lg, the battle grid (two players side by side) becomes vertical stack; score bars full-width; giant answer buttons remain; haptics via `navigator.vibrate?.(50)` on reveal (guarded).

## Task 4: Touch-target sweep

- [ ] `grep -rn "hover:" src/features/quiz src/pages | grep -v "focus-visible"` — add explicit focus/tap styles; ensure tap targets (icon buttons) carry `min-h-11 min-w-11`.
- [ ] OS zoom < 200% never breaks layout (spot check at 320 px width).

## Task 5: Verify

- [ ] DevTools device lab: iPhone SE/8, 13 mini portrait+landscape
- [ ] Playwright optional: one 390×844 host-join assertion (join QR visible); real phone if available on local network via `npm run dev -- --host`.
- [ ] `npm test`/`lint`/`build`.

## Rollback

Phone branch is additive behind a width guard; deleting the hook usage restores prior desktop-only behavior.
