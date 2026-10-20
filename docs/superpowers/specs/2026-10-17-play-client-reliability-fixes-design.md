# Play Client Reliability Fixes Design

Three defects found by using the deployed app on 2026-10-17: join chips offering games that had finished, a light
client whose error handling threw instead of reporting, and a lint configuration that did not notice an undefined
identifier. This is the design record for the fixes and the decisions behind them.

**Status:** implemented — `88243e8`, `c35747a`, `97cef3c`. **Date:** 2026-10-17.

---

## 1. What was wrong

### 1.1 "Back into game" listed finished games

A seat is written to `localStorage` when a phone joins (`quizPlayerStorage.writeStore`). Nothing wrote back when the
game ended, and `rememberedSeats()` is local-only, so every seat was offered for 24 hours. `quiz-join` refuses
`state = 'finished'` (`api/_lib/handlers/quiz-join.js:82`), so each chip could only answer "No game found with that
code" — a list of buttons that cannot work, which is the failure `quizPlayerStorage`'s own comment was written to
avoid.

### 1.2 `/play/low` threw its own error

`PlayLow` called `setError(e.message)` in `join()` and `answer()`. The error value came from its `useSession` hook,
which returned `{ state, error, refresh }` — no setter. Every failed request therefore produced
`Uncaught (in promise) ReferenceError: setError is not defined` inside the catch, and the student saw a Join button
that did nothing. The console also showed a `400` from `/api/quiz?action=join`, because the code box accepted
`281·479` verbatim while `isJoinCode` requires six digits.

### 1.3 Lint could not see it

`.oxlintrc.json` configured two React rules and nothing else. `no-undef` was off, so `setError` passed lint, the
build, and every source-scan test — the tests assert the page contains strings, not that the strings resolve.

---

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Finished seats | Flag the record (`finishSeat`), keep the token | The token is what repaints the final result (and the result card) after a reload. Deleting it would take a screen away to remove a button |
| Where the flag is written | Both clients, on seeing `session.state === 'finished'` | The phone is the only party that knows this device saw the end. One ref guard keeps it to one `localStorage` write per game |
| "Play again" | Forget the seat and drop `?code=` from the URL | A finished game cannot be re-entered; leaving the code in the box pointed the next Join at a dead room |
| Legacy and abandoned seats | Verify against the server on the join form | `finishSeat` only helps for a game the phone watched end. A seat written before the flag existed, or a game the host ended after the tab closed, needs a fact the device does not have |
| The check | One `select join_code, state` on `quiz_sessions` for all seats | The table is public to anon for pre-join questions (`20260930150000_live_quiz.sql:85-86`), and the rule is exactly `quiz-join`'s: not `finished` |
| Before the check returns | Render **no** chips | A dead seat painted for 300 ms is still the screenshot a student sends. The list is empty only while a single query is in flight |
| Check failure | Offer the list unchanged | Offline is not evidence of a dead room; a tap settles it |
| Could `cast` have answered "is it open"? | No | Making the roster-by-code lookup refuse finished sessions would break the finished screen's character, which reads the same query |
| Code box | Strip non-digits, cap at six, disable Join below six | The projector prints codes formatted; the full client already worked this way. The low client was the one that disagreed |
| Lint | `no-undef: error`, with `browser`/`node`/`es2022` globals | The missing binding is a whole class of defect, and the rule reports exactly the two `setError` lines against the previous file |

---

## 3. Changes

| File | Change |
|---|---|
| `src/lib/quizPlayerStorage.js` | `finishSeat(code)`; `rememberedSeats()` skips `finished: true`; the 24-hour cutoff stays as the backstop |
| `src/pages/PlayQuiz.jsx` | Flag on finished (ref-guarded); join form verifies seats in one query, forgets the dead ones, renders only verified ones; `leave()` forgets the seat and clears the URL |
| `src/pages/PlayLow.jsx` | Flag on finished; `useSession` returns `setError`; both catches report; code input sanitised in the box and from `?code=` |
| `.oxlintrc.json` | `no-undef` as an error, with globals declared |
| `src/lib/quizPlayerStorage.test.js` | Finished flag, flag-not-delete, no-op for an unknown code, day cutoff renamed to say what it actually tests |
| `src/pages/playSeatResume.test.js` | Both clients flag the end; Play again drops the seat; the join form checks before offering |
| `src/pages/playLow.test.js` | The error setter is returned and consumed; the code box strips non-digits |

---

## 4. Verification

- `npx oxlint -D no-undef` against the previous `PlayLow.jsx` reports exactly two `'setError' is not defined`; against
  the fixed file, zero. The same rule with browser and node globals is clean across `src`, `api` and `scripts`.
- `playLow` 9, `playSeatResume` 10, `quizPlayerStorage` 21, `quizTypeRenderers` 16 — pass.
- `npm run lint` exit 0; `npm run build` exit 0.
- **Not verified in a live game.** The seat disappearing at the final whistle, and the error banner replacing the
  throw, both need a Supabase login and a hosted session. No test in this repository can stand in for that, and the
  design does not claim otherwise.

---

## 5. Known gaps

1. **The join screen reads `quiz_sessions` directly.** It depends on an anon select policy that exists for the
   pre-join cast query. A future tightening of that policy would silently stop the seat check, and the chips would
   come back. A purpose-built `action=seat` (code + token → open/finished/gone) removes the dependency; it is not in
   this change because it adds an endpoint to fix a list.
2. **Low-client seats predate `sessionId`.** Records written by `/play/low` before this work have `{ token, code,
   nickname }`, so a future results page cannot build their card. New records are corrected in the results-history
   spec, which needs it.
3. **A seat for a game the phone left before the host ended it** still shows until the next join-screen load, the
   next tap, or the 24-hour cutoff. With the server check in place that load removes it; there is no background
   reconciler, and there should not be one.
