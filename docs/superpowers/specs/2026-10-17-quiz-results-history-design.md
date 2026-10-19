# Quiz Results History Design

A page a student can open on their own phone that lists the games this device has played: final position, score, and
the result card they already share — built from the seat record each game already writes, with no account and no new
table.

**Status:** draft. **Date:** 2026-10-17. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| `/play/history` | A route that works with no game running |
| `src/lib/quizHistory.js` | A pure `summariseSeat(seat, state)` → one row of the list |
| `rememberedSeats({ includeFinished: true })` | The seats the join form deliberately hides are exactly the ones this page wants |
| `src/pages/PlayLow.jsx` | Store `sessionId` with the seat, so a low-client game can build its result card |
| Entry points | A link on the join screen and one on the finished screen |

### Out

- **Cross-device sync.** No account, no `quiz_results` table. See §2.
- **Practice, battle and CBT history.** Practice is anonymous and has no seat; battles and CBT have their own session
  models. Adding them to one list means reconciling three identifiers for one screen.
- **Full leaderboards.** `quiz-state` returns the top 10 for a finished game; that is what the row shows.
- **Deleting a result from the list.** Clearing site data is the deletion mechanism, as it is for seats today.

---

## 2. Why device-local

A live game identifies a player by a token the phone holds; there is no login. Persisting results to the server for an
account that does not exist would mean either a token-keyed table with no owner (one that outlives the phone and
cannot be deleted by anyone) or a new account system. Both are bigger than the problem: a student who wants to see how
they did in the game they just played is holding the device that played it.

The trade-off is stated plainly in the UI, not implied: **results live on this phone**, and clearing site data loses
them. That is the same promise the seat list already makes.

---

## 3. Data already on the device

`quizPlayerStorage` writes one record per game, keyed by join code:

```
nammes-quiz-player:<code> → { token, sessionId, code, nickname, score?, streak?, at, finished? }
```

- `sessionId` is written by the full client (`handleJoined`) and **not** by `/play/low`, whose join writes
  `{ token, code, nickname }`.
- `finished` is set by the seat work of 2026-10-17 when the phone sees the game end.
- `at` is the join time and is the only ordering available.

`rememberedSeats()` currently drops `finished` records, because the join form must not offer them. This page needs the
opposite, so the function grows an option rather than a second storage format:

```js
rememberedSeats({ includeFinished = false, maxAgeMs, now } = {})
```

Default stays `false`; nothing on the join screen changes.

---

## 4. Reading a result

`POST /api/quiz?action=state` with the seat's token already returns everything a result row needs, for a finished
session as well as a live one (`api/_lib/handlers/quiz-state.js:189` adds `top` for `leaderboard` and `finished`):

| Row field | From |
|---|---|
| position | `me.rank` |
| score | `me.score` |
| players | `playerCount` |
| winner | `top[0].nickname`, when present |
| status | `session.state === 'finished' ? 'finished' : 'live'` |
| played | the seat's `at`, formatted as a date |

`low: 1` is sent: the page needs scores, not explanations or backdrops, and the flag is the one the server honours.

A `401` or `404` means the seat is dead (kicked, cleaned up, or a token from another device's game). The row is
dropped and `forgetSeat(code)` removes it — the same rule the join form applies, so the history list cannot fill with
rows that only fail.

### 4.1 The pure part

`src/lib/quizHistory.js`:

```js
export function summariseSeat(seat, state) → {
  code, nickname, playedAt,
  status: 'finished' | 'live' | 'gone',
  rank, score, players, winner,
}
```

- `state` missing/`null` → `gone` (the caller fetched and got nothing usable).
- No `session` in the payload → `gone`.
- Otherwise `finished` or `live` by `session.state`.
- Never throws on a partial payload: a missing `me.rank` is `null`, which the row renders as "—", because a hand-edited
  or half-migrated session must not take the page down.

Sorting is the seat's `at`, newest first — `rememberedSeats` already sorts that way and the page preserves it.

---

## 5. The page

`/play/history` in `src/App.jsx`, lazily imported like the other secondary quiz routes. It needs no token, no query
parameters, and no game.

**Layout**: one card per seat, newest first, each with

- the game code and the date it was joined;
- `#rank · score pts`, `of N players`, and the winner's name when the seat was not the winner;
- a **Download my card** button for a finished game where `seat.sessionId` exists;
- a **Rejoin** link for a live game, pointing at `/play?code=<code>` — the same resume the seat chip would have offered,
  which is a better home for it than the join form;
- nothing at all for `gone` rows, because they are removed as they are discovered.

**Empty state**: "No games on this phone yet." plus a link back to `/play`. If somebody cleared their data, that is the
truth, and inventing an empty table would hide it.

**Failure**: a per-seat error row ("Couldn't load this one") with a Retry that refetches only that seat. One dead
network call must not blank the other results.

**Entry points**

- Below the seat chips on the join form: a text link, "See your past results", rendered only when there is at least
  one seat. It must not push the code box further down than the existing chips already do on a small phone.
- On the finished screen, a secondary button beside "Share my result".

---

## 6. Decisions

| Decision | Choice | Why |
|---|---|---|
| Storage | None; read from seats | Adding a table for data already on the device is the expensive way to lose it |
| Where the page lives | `/play/history` | It is a quiz route, and `/play/low` already sits beside it; a top-level `/results` would compete with awards results |
| Seat visibility | `includeFinished` option on `rememberedSeats` | One storage format, two audiences; a second function would be a second place for the age/stamp rules to drift |
| Card for low-client games | Add `sessionId` to that join's seat write; hide the button for legacy records | `personalCardUrl` needs it, and a reload of an old record cannot invent it |
| Rejoin placement | History page, not the finished list | The join form is for entering a code; a live game the device is already in is history with a door |
| Status for a dead token | Remove the row | A result that cannot be fetched is a button that cannot work — the lesson from the seat chips |
| `low: 1` | Always | The page never needs explanations or images |
| Order | Seat `at`, newest first | The only timestamp written at join time; the session's own `finished_at` is not in the state payload |

---

## 7. Network behaviour

- One `state` call per seat, capped by `rememberedSeats`' six-seat limit, issued in parallel.
- The endpoint's rate limit is 60/min per token hash; six distinct tokens is nowhere near it.
- The page only fetches when opened. Home and the join screen never preload it.
- A seat whose fetch fails with a non-401/404 error stays listed with an error, and the retry is manual — no polling
  loop, because a results page has nothing live to wait for.

---

## 8. Tests

`src/lib/quizHistory.test.js` (the behaviour that matters, without a browser):

1. A finished payload becomes `{ status: 'finished', rank, score, players, winner }` with the winner taken from `top`.
2. A lobby/question payload becomes `status: 'live'`, still with rank and score.
3. `null` / `{}` / `{ me: null }` become `gone` and do not throw.
4. A payload with no `top` leaves `winner` null rather than `undefined`.
5. The result keeps the seat's `code`, `nickname` and `playedAt` — the row cannot describe the wrong game.

Source scans, in the style of `playSeatResume.test.js`:

6. `/play/history` is registered in `App.jsx` and imports the page.
7. The history page calls `rememberedSeats({ includeFinished: true })` and `callQuiz('state'` with `low: 1`.
8. `PlayLow`'s join writes `sessionId` with the seat (one line; without it the card button is dead for every
   low-client game).
9. The join form still uses `rememberedSeats()` without the flag, so finished games stay off it.

---

## 9. Rollout

Ship the page behind no flag: it reads data the device already has, writes nothing, and breaks nothing if it fails.
The one sequencing constraint is that the seat `finished` flag should already be live, or a finished game may appear
as `live` — the status line is honest either way, and the next state fetch settles it.

---

## 10. Open questions

1. **Should a `live` row's "Rejoin" use the chip's code-fill behaviour instead?** This spec resumes directly, because
   the token is already held and `/play?code=…` resumes without a tap on Join. The join form's chip exists for a phone
   that has the seat but not the code.
2. **Do we want a "clear history" button?** It is a `localStorage` walk, and it would also delete the seats the join
   form offers. If it exists, it belongs here and should say so.
3. **Battle and CBT rows** are deliberately out; if they are wanted later, the token models have to become visible to
   this page first.
