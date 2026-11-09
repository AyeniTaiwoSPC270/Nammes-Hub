# Web Vitals and RUM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** See what real students feel — LCP/INP/CLS from production phones, tagged by route, with a p75 regression alert.

**Architecture:** `web-vitals` in a production-only dynamic import reports to Sentry (already installed) with `tracesSampleRate: 0.1`; `beforeSend` strips query strings; a Sentry metric alert fires on p75 LCP regression; results documented.

**Tech Stack:** `web-vitals` (tiny, free), `@sentry/react` (present), Sentry UI.

**Spec:** `docs/superpowers/specs/2026-11-09-web-vitals-rum-design.md`

## Global Constraints

- Production-only (`import.meta.env.PROD`); never in dev (skewed baselines).
- No raw URLs with query strings (matric/uuid leaks); route templates only.
- No new third-party service; Sentry stays the sink.

---

## Task 1: Locate the Sentry init

- [ ] `grep -rn "Sentry.init\|browserTracingIntegration\|@sentry/react" src index.html vite.config.js` — find where Sentry initializes (if it doesn't yet exist in-browser — only DSN in env — add it).
- [ ] Record findings in the PR description.

## Task 2: Reporter module

**Files:** Create `src/lib/vitals.js`

```js
import { onLCP, onINP, onCLS, onTTFB } from 'web-vitals';
export function startVitals() {
  if (!import.meta.env.PROD) return;
  const route = 'unknown'; // template from useLocation — see Layout hook note below
  const send = ({ name, value, rating, id }) => { …Sentry.addBreadcrumb/captureEvent or custom span… };
  onLCP(send); onINP(send); onCLS(send); onTTFB(send);
}
```

- [ ] Route tagging: simplest robust option — tag `window.location.pathname` with dynamic segments replaced client-side (`/outlines/*`, `/cbt/*`) via a small normalizer; do not introduce a router dependency for this.
- [ ] Sentry: `Sentry.init({ …, tracesSampleRate: 0.1, beforeSend(event){ strip event.request?.query_string; return event } })` — apply where init lives.

## Task 3: Wire it

- [ ] `src/main.jsx`: after render (or in `Layout`'s mount effect), call `startVitals()`. Dynamic `import('./lib/vitals.js')` inside the `PROD` guard keeps it out of the main chunk.

## Task 4: Alert + baseline

- [ ] Sentry → Alerts → metric alert: `p75(vitals.LCP) > 3.0s over 10 min` (or the project's metric naming once first events arrive — adapt; document the exact filter in ADMIN.md).
- [ ] After one week: write `docs/perf/web-vitals-baseline-2026-11.md` with p50/p75/p95 per route; link in ADMIN.md.

## Task 5: Verify

- [ ] Local prod build (`npm run build && npx vite preview`) with a test DSN → events visible in Sentry test project.
- [ ] `npm test` unaffected; `npm run lint` for the new module; build size delta recorded (expect < 3 KB gzip).

## Rollback

Remove `startVitals()` call + module; alerts stay (harmless) or get deleted in Sentry UI.
