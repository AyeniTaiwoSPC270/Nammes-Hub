# Load Testing the Live Quiz Path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Measure the worst realistic concurrent scenario — 300 students joining and answering one live quiz — and get a pass/fail number instead of a hope.

**Architecture:** k6 script driving the real HTTP endpoints (join → answer loop → leaderboard) against **staging** (free project + seeded 20-question quiz). Progressive ladder 100 → 300 → 600 VUs. Pass: p95 join < 1.5 s, answer success ≥ 99.5%, zero pool exhaustion errors.

**Tech Stack:** k6 (one binary, free), staging (see staging-environment plan), seeded quiz, Sentry for error correlation.

**Spec:** `docs/superpowers/specs/2026-11-09-load-testing-live-quiz-design.md`

## Global Constraints

- NEVER against production. The target is always `STAGING_URL`.
- The seeded fixture quiz is reused; do not hand-craft a parallel one.
- If it fails at 300 VUs: record, fix in order (pool → cache → indexes), re-run — do not loosen thresholds.

---

## Task 1: Install + seed check

- [ ] Install k6 (`brew install k6` / download from k6.io). `k6 version`.
- [ ] Staging seed ran: `select count(*) from quiz_questions` → 20; capture the quiz code into `load/.quiz-code` (gitignored) — or parameterize via env `-e QUIZ_CODE=`.
- [ ] Capture an anon join token flow: read `api/_lib/handlers/quiz-join.js` response shape; note exactly how answers are submitted (endpoint + payload) — the script must match reality, not the spec's sketch.

## Task 2: The script

**Files:** Create `load/quiz-live.js`

```js
import { check, sleep } from 'k6';
import http from 'k6/http';
export const options = {
  stages: [
    { duration: '90s', target: 100 },
    { duration: '10m', target: 100 },   // ladder 1
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    checks: ['rate>0.995'],
    'http_req_failed': ['rate<0.005'],
  },
};
const BASE = __ENV.STAGING_URL; const CODE = __ENV.QUIZ_CODE;
export default function () {
  const join = http.post(`${BASE}/api/quiz?action=join`, JSON.stringify({ code: CODE, nickname: `load-${__VU}-${__ITER}` }), { headers: { 'content-type': 'application/json' } });
  check(join, { 'join 2xx': (r) => r.status < 300 });
  const token = join.json('playerToken'); // adapt to real field
  for (let q = 0; q < 20; q++) {
    sleep(1 + Math.random() * 3);
    const ans = http.post(`${BASE}/api/quiz?action=answer`, JSON.stringify({ playerToken: token, questionIndex: q, optionIndex: Math.floor(Math.random() * 4) }), { headers: { 'content-type': 'application/json' } });
    check(ans, { 'answer 2xx': (r) => r.status < 300 });
  }
  http.get(`${BASE}/api/quiz?action=leaderboard&code=${CODE}`);
}
```

- [ ] Dry run with 5 VUs for 30 s: `k6 run --vus 5 --duration 30s -e STAGING_URL=… -e QUIZ_CODE=… load/quiz-live.js` — fix field mappings until checks are green.

## Task 3: The ladder

- [ ] Ladder 1: 100 VUs (as above) — record results.
- [ ] Ladder 2: same with `target: 300` — record; watch Supabase dashboard (DB connections, CPU) during the run; write up and screenshot into the new file `docs/load/2026-11-quiz-300vu.md`.
- [ ] Ladder 3: `target: 600` — record; this is the knee-discovery run.
- [ ] Pass criteria checked; if fail, open an issue per failure mode (pool exhaustion → confirm Task-1 pooler wiring from cache-pooling plan; slow join → index/plan review; high 5xx → Sentry events).

## Task 4: Report

- [ ] **Create** `docs/load/2026-11-quiz.md`: environment (staging hw), ladder table (VU / join p95 / answer success / error rate / DB cpu), bottleneck verdict, recommendations linked to specs. Commit.

## Rollback

It's a test; disable by deleting the environment. Staging may hold fixture rows — seed script resets them deterministically.
