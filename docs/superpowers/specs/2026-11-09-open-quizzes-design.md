# Open Quizzes Design

Multiple live quizzes at once, listed to players who never see a code, and — the part that is actually new — a game
that runs without a human on the host screen.

The live quiz has always had one engine: the host tab. `AUTO_ADVANCE_MS` (5s) moves a reveal to its leaderboard, a
full lobby counts itself down from 10s, and a question closes when its timer runs out — but all of it is a
`setTimeout` in `HostQuiz.jsx`, and every advance carries an admin token. That is not a bug — a host who can see the
room is the right driver for an event — but it means a 4pm quiz costs a human being an hour, and the 200L who opens
`/play` has nothing to open it for.

This spec turns the clock into a row on the session. The host screen survives as a control panel, not as the engine.

**Status:** draft, awaiting approval. **Date:** 2026-11-09.
**Plan:** to be written.

---

## 1. Scope

### In

| # | Feature | Change |
|---|---|---|
| 1 | **Scheduling** | `quiz_sessions.scheduled_at`. An admin sets 4pm and can close the laptop. |
| 2 | **Open listing** | `quiz_sessions.open_join`, a public `GET /api/quiz?action=open`, and the list on `/play/open`. |
| 3 | **Autopilot** | `quiz_sessions.autopilot`. The server advances lobby → question → reveal → leaderboard → … → finished, with `pg_cron` for quiet rooms and a due-step on every `quiz-state` read for sub-minute precision. |
| 4 | **Late-join policy** | `game_options.late_join` (default `true`). Off = joinable only while the game is in its lobby. |
| 5 | **Expiry** | An open lobby with nobody in it for 15 minutes, or a scheduled game two hours past its start with no players, becomes `finished`. |

### Out

- **Recurring series** ("every Tuesday 4pm"). One-off schedules only. A `quiz_schedules` table can later spawn these
  sessions without changing a single column here.
- **Announcing the schedule.** Home's next-up card, the academic calendar and an email to a segment are all obvious
  sequels, and none of them are what makes the quiz run.
- **Registration / RSVP / waitlist.** `max_players` and `locked` already do the only crowd control that exists.
- **Seed bots.** `addBots` is one button on the host screen for an admin who is there; an autopilot room that starts
  empty is a room that starts empty.
- **The low-data client.** `/play/low` stays code-only. `playLow.test.js` source-scans that page and should keep
  failing if the list is imported into it.
- **A player-facing identity.** Open quizzes still take a nickname and a seat token. No account is created by this.

---

## 2. What exists today, and what it forces

- **Concurrency already works.** `quiz_sessions_active_code` is a partial unique index (`where state <> 'finished'`),
  so two live games with different codes have always been legal. Nothing here needs to change the game engine.
- **Advance is a compare-and-swap.** `quiz-advance` updates with `.eq('state', expected).eq('current_question_index',
  expected)`, and `nextState`/`stepUpdate` in `api/_lib/quiz.js` are pure. A server tick and a present host can therefore
  both try to step, and exactly one wins — the loser gets a 0-row update, not a skipped question.
- **Grading is already server-side and synchronous at answer time.** A room with no host still scores correctly; what
  it lacks is someone to say "next".
- **`quiz_sessions` is readable by `anon`,** code included. A public list is not a new disclosure — but the *title*
  lives in `quizzes`, which anon cannot read, so the list has to be a handler, not a table read.
- **`pg_cron` + `net.http_post` + HMAC is the established scheduler.** `run_calendar_reminders()`
  (`20261009120000_calendar_reminders.sql`) signs a call with `table`/`key` and posts to a deployed route. This spec
  copies that shape rather than inventing one.
- **Nothing records when a state began.** `stepUpdate` writes `question_started_at` only when a question starts, so the
  tick cannot tell a reveal that has been up for 2 seconds from one that has been up for 20 minutes. That is the one
  piece of state that has to be added for a clock.

---

## 3. The model

One migration, `quiz_sessions` grows five columns:

| Column | Meaning |
|---|---|
| `scheduled_at timestamptz` | null = "start when the admin says", today's behaviour. |
| `open_join boolean not null default false` | listed on `/play/open`. |
| `autopilot boolean not null default false` | the server owns the transitions. |
| `state_changed_at timestamptz` | when the current state began. Written by every step. |
| `lobby_start_at timestamptz` | the instant the lobby clock started (see below), so the countdown is a column rather than a `min(joined_at)` aggregate on every phone poll. |

### 3.1 The start rule

```
lobby_start_at = max(scheduled_at, first_join)
start          = lobby_start_at + LOBBY_WAIT_MS   // 60s
```

4:00pm opens the room; the clock cannot start before it; an empty room never starts. A full lobby keeps its existing
10-second countdown, whichever comes first.

Why not strict 4:00: a 4:00:40 arrival loses question 1 over forty seconds, and every late quiz generates that
complaint. Why not "wait for N players": N has to be guessed, and a 4:05 game with N−1 people is worse than one that
started. `LOBBY_WAIT_MS` is the only knob, and setting it to 0 is the literal reading of "begins at 4pm".

`lobby_start_at` is written when the first player joins, and by the tick at `scheduled_at` for a session that somehow
already has players. Players may join before `scheduled_at` — a waiting room, which is useful and costs nothing.

### 3.2 Autopilot is opt-in, and independence is deliberate

`open_join` and `autopilot` are separate columns even though the admin dialog sets both with one "Open quiz" switch.
An open quiz that an admin intends to host from their phone is a legitimate thing, and the host screen can clear
autopilot for one game without delisting it. A game with `autopilot = false` behaves exactly as it does today, including
the full-lobby countdown living client-side.

### 3.3 Late join

`game_options.late_join` (default `true`) joins `streaks`, `powerups`, `comeback` in `sanitizeGameOptions`
(`quizGrading.js`), so it is snapshotted onto the session at creation like the rest of the options. `false` means
`quiz-join` refuses once `state <> 'lobby'` with "This quiz has already started" rather than a silent seat. Default
stays open because a class quiz wants the person who is two minutes late.

### 3.4 Frozen when scheduled

A session is snapshotted by `quiz-create` like every other game, and scheduling does not re-read the quiz later. The
host dialog says so: the questions are frozen when the game is made, so a quiz edited afterwards needs the session
deleted and scheduled again.

This was originally going to refresh at `scheduled_at`. It does not, deliberately: re-reading `question_ids`,
`option_orders`, `theme`, `card`, `characters` and `game_options` means a second copy of `quiz-create`'s sanitiser
sequence, which is exactly how the two get to disagree. Freezing at creation is the rule every hosted game already
follows; making scheduling the one exception is not worth a duplicated snapshot.

---

## 4. The clock

### 4.1 Where the decisions live

`api/_lib/quizSchedule.js` — pure, no `window`, no Supabase, importable by a handler, a page and a test:

- `lobbyStartAt(session, firstJoinAt)` and `startsInMs(session, nowMs)`
- `dueStep(session, { nowMs, questionCount, question })` → `null` or a `nextState` shape, covering start, question
  expiry, reveal hold, leaderboard hold, and expiry
- `isListed(session, nowMs)` and the list ordering

`api/_lib/handlers/quiz-tick.js` reads due sessions, calls `dueStep`, and applies `stepUpdate` with the same CAS as
`quiz-advance`.

### 4.2 The rules

| State | Due when |
|---|---|
| `lobby` | `autopilot` and `now >= lobby_start_at + 60s` and at least one player |
| `question` | `autopilot` and `effectiveElapsedMs > questionLimitMs + ANSWER_GRACE_MS` |
| `reveal` | `autopilot` and `now - state_changed_at > REVEAL_HOLD_MS` |
| `leaderboard` | `autopilot` and `now - state_changed_at > LEADERBOARD_HOLD_MS` |
| `lobby` | no players for 15 minutes, or `scheduled_at` more than 2 hours past with no players → `finished` |

- `effectiveElapsedMs` already subtracts paused time and `questionLimitMs` already adds `time_bonus_ms`, so a host who
  pauses or adds time during an autopilot question is respected by the server without new bookkeeping.
- `ANSWER_GRACE_MS` is included in the expiry test, so the answer that lands a second after the bar empties still
  counts — the same window `quiz-answer` already honours.
- `REVEAL_HOLD_MS` is the server's answer to the client's roll animation; the projector may still show its own
  countdown, but it is no longer the authority.

### 4.3 Three callers, one winner

- **`pg_cron`, every minute**, signed like the calendar reminders, posting to `api/quiz?action=tick`. This is what
  expires empty rooms and finishes a game nobody is watching.
- **Every `quiz-state` read** attempts one due step when the session is autopilot and due, throttled per instance to
  one attempt per second per session. That is where sub-minute precision comes from: phones poll every 4s, so a 5-second
  leaderboard becomes a question within a poll of its deadline rather than up to a minute late.
- **The host screen's `clock` op** (`quiz-host`), asked on the same 2.5s poll that refreshes the projector. It was added
  after a real game stalled: a question ran out, the only player had closed the phone's tab, and nothing advanced until
  they came back — the host screen's own timers deliberately stand down under autopilot, so the room had no engine at
  all. This is a caller of `dueStep`, not a second clock, and it is also what returns `startsInMs` for the lobby
  countdown on the big screen.
- A room that has fallen far behind catches up one step per read. Ten steps take ten polls; nobody is watching a room
  that has been asleep for an hour, and the cron closes the gap anyway.

Because both use CAS, a double-fire is a 0-row update. The tick treats that as "someone else stepped" and moves on; it
must never retry into the next state.

### 4.4 The one behaviour that changes for hosted games

Today the question-close timer, the reveal and leaderboard timers and the full-lobby countdown all run in the host
tab. Under autopilot those effects stand down and the same transitions happen server-side. A human-hosted game
(`autopilot = false`) keeps the old behaviour exactly, because that host may want to add time and the click is the
decision.

### 4.5 `state_changed_at` has to be written everywhere

`stepUpdate` sets it. Every other writer of `quiz_sessions.state` — the hosted bots in `quiz-host.js`, any bracket
settling path that moves a session — must set it too, or the tick will read a stale clock and step early. When this
migration lands, grep every `quiz_sessions` update that touches `state`, not just the handlers named here.

---

## 5. Discovery

`GET /api/quiz?action=open` — public, `Cache-Control: no-store`, no token.

```json
{ "sessions": [ {
    "id": "…", "title": "PHY 201 — Mid-semester", "joinCode": "418203",
    "state": "lobby", "startsAt": "2026-11-09T15:00:00.000Z",
    "startsInMs": 240000, "players": 12, "maxPlayers": 50, "lateJoin": true
} ] }
```

- Listed when `open_join` and not `finished`, and either live or scheduled within the next 24 hours.
- Ordered: live (`question`/`reveal`/`leaderboard`) first, then `lobby`, soonest start first; capped at 12.
- Title joins `quizzes` with the service role. Player names never appear — only a count.
- The code is included on purpose. It is the join path, and it is already anon-readable from the table.

On `/play/open`, a route beside `/play` and `/play/history`:

- **The list is not on `/play`.** That screen answers one question — "what is the code on the projector" — and a room
  list above the keypad made it answer two. `/play` carries a link to the list instead, and nothing else changes there.
- A card shows title, start (or "Live now"), `players / max`, a countdown while in the lobby, and "Full" / "Started"
  states. Tapping goes to `/play?code=…`, so the join path and the seat token are the keypad's own.
- The list polls every 15s while the page is open; it is one small request, not a realtime channel. A failed poll keeps
  the last list, and a page that has never loaded shows a retry rather than an empty page.
- `/play/low` does not import any of it, and neither does `/play`.

---

## 6. Screens

### 6.1 Host dialog (`HostQuizModal`)

A "Start now / Schedule" choice. A schedule takes a local date and time and stores an instant; anything displayed back
is formatted in `Africa/Lagos`, the same discipline the calendar uses. One "Open quiz" switch sets `open_join` and
`autopilot` together; the dialog says what that means ("listed on /play/open and starts by itself").

### 6.2 Host screen (`HostQuiz.jsx`)

- The lobby shows the wait: "Starts in 42s · Runs automatically…", or "Set for 4:00 PM" before anyone has joined and
  there is no clock yet. The number comes from the `clock` op, never from `lobby_start_at + LOBBY_WAIT_MS` computed in
  the browser.
- The player's lobby shows the same number ("Starting in 42s") from `quiz-state`'s `startsInMs`.
- When `autopilot` is on, the client's auto-advance, full-lobby countdown and question-expiry timers stand down, and
  the screen becomes a reader: it asks the server for the clock and shows what came back. Start now / Pause / Add time
  stay, because an admin who *is* there should be able to interfere — but nothing breaks when they are not.
- Opening `/host/:sessionId` after the game has finished shows the final state, not a broken room.

---

## 7. Failure cases

- **Cron not enabled.** Autopilot still works wherever a screen is open — a phone's poll or the host screen's `clock`
  op — but a room nobody is looking at stops at its current step and empty lobbies do not expire. The migration leaves
  the `cron.schedule` call commented, as `20261009120000_calendar_reminders.sql` does, because a tick against an
  undeployed route is a 404 every minute. **This is a required setup step, not an optional one.**
- **Double step.** CAS. No question is skipped by two engines.
- **A pause nobody lifts.** An autopilot question with `paused_at` set never expires. That is correct — a pause is a
  human decision — but the list should show "Paused" and expiry should not reap a session with players in it.
- **The scheduled time passes with the admin gone.** Nothing starts. The room is listed as "Waiting for players",
  then expires.
- **Timezone.** `scheduled_at` is a `timestamptz`, a real instant, so no day-key arithmetic is involved. Only display
  is pinned to Lagos.
- **Codes.** A scheduled session holds its 6-digit code for as long as it is scheduled, which is fine among ~900k
  codes and is freed by deleting the session or by expiry.

---

## 8. Tests

- `api/_lib/quizSchedule.test.js` — start instant before/at/after `scheduled_at` with and without players; `dueStep`
  for every state and every not-due case; pause and `time_bonus_ms`; grace at the question boundary; expiry boundaries;
  late-join cutoff; list filtering and ordering.
- `api/_lib/handlers/quiz-tick.test.js` — signature required; a session stepped once and not twice; autopilot off is
  untouched; an empty lobby expires.
- `api/_lib/handlers/quiz-open.test.js` — public shape, no player names, filters, countdown, late-join flag.
- `quiz-join` — late join refused only when `late_join` is false and the game has left the lobby.
- `src/pages/playOpen.test.js` — the route is registered, `/play` links to it and no longer fetches the list, and a
  pick goes through `/play?code=`.
- `src/pages/playLow.test.js` — still fails if the list is imported.

---

## 9. What cannot be verified here

Whether a hostless 40-minute game paces correctly — reveals that do not overstay, a leaderboard that does not blink,
a question that closes on the last second of a slow phone — needs a Supabase login, a deployed tick and a real room.
The pure rules and the handlers are provable; the clock is not. Scheduled start, expiry and reminder-style timing are
in the same position as the calendar's: **unverified without a real session.**

## 10. Decisions taken

1. Start = `max(scheduled_at, first_join) + 60s`; empty rooms do not start.
2. Late join is a per-quiz `game_options.late_join`, default on.
3. One-off schedules only.
4. The snapshot is frozen when the game is created, scheduling included.
5. `pg_cron` every minute plus a due-step on `quiz-state` reads; CAS keeps them from fighting.
6. The list is public and sits above the code pad when non-empty.
