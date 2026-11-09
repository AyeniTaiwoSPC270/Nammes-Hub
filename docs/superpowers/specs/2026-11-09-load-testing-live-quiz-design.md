# Load Testing the Live Quiz Path

The highest-concurrency feature — a departmental live quiz with hundreds of concurrent players — has
never been load-tested; the ceiling is unknown and will be found in production, live, in front of students.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Scenario | k6 script: 300 VUs join one session, answer 20 questions over 10 minutes, fetch leaderboard |
| Target | The staging free project (`2026-11-09-staging-environment-design.md`) seeded via `scripts/seed-staging.mjs`, never production | Rehearse safely at zero cost |
| Metrics | Join latency, answer-write rate, error rate, connection count, DB CPU |
| Pass criteria | p95 join < 1.5 s; answer success ≥ 99.5%; zero pooler exhaustion errors |
| Report | Numbers committed to `docs/load/2026-11-quiz.md`; re-run before any ticketed live event |

### Out

- **Production load testing.** Never; staging replica only.
- **Fixing whatever it finds.** This spec measures; fallout gets its own specs.

---

## 2. The problem

`quiz_players`, `quiz_answers`, `quiz_sessions` are write-hot during a live game: 300 players × 1 answer / 5 s ≈ 60 writes/s plus poll/realtime read amplification. Serverless cold starts + Postgres pool limits make the knee of that curve invisible until it collapses. The `quiz-tick`/`quiz-state` handlers poll Postgres heavily.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Tool | k6 (JavaScript, CI-friendly, HTTP+WS) | Matches the JS shop; no new language |
| Shape | Ramp 0→300 VUs over 90 s, hold 10 min, ramp down 30 s | Mirrors real join-storm behavior |
| Assertions | Thresholds in the script (above) — CI fails if exceeded | A test that can't fail is a demo |
| DB observability | Supabase dashboard pool/CPU screenshots during run | Correlate app latency with DB saturation |
| Scale ladder | 100 → 300 → 600 VUs in separate runs | Find the knee, don't just survive one number |

## 4. The change

`load/quiz-live.js` k6 script (join → auth token → answer loop with think-time → final leaderboard fetch). Staging seeded with a real 20-question quiz via service role. Run manually: `k6 run -e BASE_URL=… -e SESSION=… load/quiz-live.js`. Results table pasted into the doc.

## 5. Verification

1. Script runs green end-to-end on 100 VUs.
2. 300-VU run meets thresholds; if not, the failure mode is documented (pool, CPU, cold starts).
3. `/api/health` p95 and Sentry error rate observed during the run; report attached.

## 6. Risk

Staging data ≠ production shape (indexes on production already verified good). Mitigate by restoring the newest free nightly dump into the staging/scratch free project (backup spec does this quarterly — time the drill with the load test) for the final number. Quiz state polling may need the Redis cache from the cache-pooling spec to pass 300 VUs — treat that as the experiment, not an assumption. All of this runs on free tiers; if the staging project has been paused, the keepalive workflow in the staging spec is the first thing to check.
