# Live Quiz (Kahoot-style) — Design Spec

Date: 2026-09-30
Status: Built and live. Later additions are listed under "Design Studio and characters" at the end.

## Goal

A live, host-driven quiz for NAMMES events. An exco runs a quiz on a projector; students join from their phones with a code, answer timed multiple-choice questions, and compete on a live leaderboard.

## Non-goals (v1)

- Team mode, question-bank CSV import, sound effects, image answers.
- Audiences above ~150 concurrent players (see Capacity).
- Solo/self-paced play. Every game is host-driven.
- Anonymous cheating-proof identity. Players are nicknames only; no account required to play.

## Roles

| Role | Can do |
|------|--------|
| Exco/admin | Create/edit quizzes, host a game, view results |
| Player | Join by code + nickname, answer questions. No login needed |

Admin gating reuses the existing admin roles system. Players never touch Supabase tables directly; they go through server endpoints.

## User flow

1. Admin builds a quiz in Admin: title + questions.
2. Admin clicks **Host**. A game session is created with a 6-digit join code. Host screen shows a lobby: code, QR code, live player list.
3. Players open `/play`, enter the code and a nickname, and land in the lobby.
4. Host clicks **Start**. For each question:
   - Host screen shows the question, options, and countdown.
   - Phones show only the colored answer buttons.
   - When the timer ends (or all players have answered), the host screen shows the answer distribution and the correct answer, and phones show correct/incorrect plus points earned.
   - Host clicks **Next** to show a top-5 leaderboard, then **Next** again for the next question.
5. After the last question: podium (top 3) and full leaderboard. Results are saved.

## Game state machine

`lobby → question → reveal → leaderboard → (question | finished)`

Only the host (via server endpoint) advances state. State lives in `quiz_sessions.state` and `current_question_index`, plus `question_started_at` (server time).

## Data model (Supabase)

- `quizzes`: id, title, created_by, created_at
- `quiz_questions`: id, quiz_id, position, text, options (text[2..4]), correct_index, time_limit_seconds (default 20), points (default 1000)
- `quiz_sessions`: id, quiz_id, join_code (unique among non-finished sessions), state, current_question_index, question_started_at, created_at, finished_at
- `quiz_players`: id, session_id, nickname (unique per session, case-insensitive), joined_at, total_score
- `quiz_player_tokens`: player_id, token_hash. Kept in its own table with no grants so `quiz_players` can be readable by everyone (needed for live updates) without exposing the secret.
- `quiz_answers`: id, session_id, player_id, question_id, chosen_index, answered_at, points_awarded. Unique (player_id, question_id)

### RLS

- `quiz_questions.correct_index` must not be readable by anon or players. Players receive a view/endpoint response that omits it until the question is in `reveal`.
- Players and anon have no direct write access to any quiz table. All writes go through server endpoints using the service role.
- Admin-role users can CRUD `quizzes` and `quiz_questions`, and read all session data.
- `quiz_sessions` state and `quiz_players` (nickname only) are readable via realtime so phones and the host can follow live.

## Server endpoints

Serverless functions on Vercel, using the service-role Supabase client (same pattern as existing admin endpoints).

All five live in one function, `api/quiz.js`, called as `/api/quiz?action=<name>` (Vercel's free plan allows 12 functions).

- `create` (admin): create session, return join code.
- `advance` (any admin): move the state machine forward. The caller sends the state it thinks the game is in and the update only applies if that is still true, so a double click or two host tabs cannot skip a step. Any admin can advance any game (no per-host ownership; changed from the first draft to keep host ids out of a publicly readable table).
- `join`: code + nickname → creates player, returns a secret token.
- `answer`: token + chosen_index. Server rejects if state ≠ `question`, time is over (timer + 1.5s grace), or already answered. Server computes points from its own clock, never a client-supplied time, and the reply never says whether the answer was right.
- `state`: token → what this phone should show now. The correct answer is only included from the reveal step on.

### Scoring

Correct: `points × (1 − (elapsed / time_limit) / 2)`, rounded, so an instant answer earns the full points and a last-second answer earns half. Wrong or no answer: 0. Elapsed uses server time (`now() − question_started_at`).

## Realtime

- Channel per session, subscribed to `quiz_sessions` row changes (state, index) and `quiz_players` inserts.
- Answers are plain HTTPS POSTs, not realtime messages, so only host state changes fan out to phones. This keeps message volume low.
- Phones must resync on reconnect by reading the current session row.

## Security requirements

- Correct answer never sent to phones before `reveal`.
- Rate limit `join` (per IP), `answer` and `state` (per token). Best-effort only: serverless instances do not share memory, so this slows one noisy client but is not a hard guarantee. A hard cap of 150 players per game backs it up.
- Nickname filter: length limit, trimmed, profanity blocklist, unique per session.
- Join codes: 6 digits, random, only valid while the session is not finished; expire after a few hours.
- Consistent with existing hardening in `docs/security/`.

## Pages

- `/admin/quizzes`: list, create, edit questions (fits the existing Admin area).
- `/host/:sessionId`: projector screen (lobby, question, reveal, leaderboard, podium).
- `/play`: join screen (mobile-first), then in-game player view.

UI is designed externally by the user and brought back as code. Build logic and endpoints first, then wire the user's designs. Do not build the visual pages proactively.

## Capacity

- Free Supabase Realtime: about 200 concurrent connections and a per-second message cap. Verify current limits on the pricing page before each event.
- Target for v1: up to 150 players. Above that, upgrade to Pro for the event.
- Load-test with simulated players before a large event.

## Risks

- Venue wifi is the main real-world failure. Test at the venue.
- Host tab closing mid-game: state persists in the DB, so re-opening `/host/:sessionId` resumes.
- Clock skew: irrelevant because scoring uses server time only.

## Build order

1. Tables, RLS, and endpoints (create, join, advance, answer) with tests for scoring and the answer-leak rule.
2. Admin quiz builder.
3. Host and player flows with the state machine, plain UI.
4. Leaderboard, podium, saved results.
5. Apply the user's designs, QR join, animations.
6. Load test.

## Open questions

- Do results get shown publicly on the hub, or only to admins?
- Should a quiz be replayable (multiple sessions per quiz)? Assumed yes.
- Any need for a "no nickname repeats across sessions" or login-linked players? Assumed no.

## Design Studio and characters

- **Design Studio** (`/admin/quizzes/:id/studio`): per quiz, pick a colour scheme, accent colour, faint backdrop pattern, celebration style (maths symbols, stars, petals, none), and an optional event headline and tagline, with a live projector/phone preview. Stored in `quizzes.theme` (jsonb); a game copies it into `quiz_sessions.theme` when it starts, so editing a quiz never restyles a running game. `api/_lib/quizTheme.js` cleans every theme (only `#rrggbb` colours, fixed lists for everything else) on the server and in the studio, so a theme can never put free text into CSS. Phones receive the cleaned theme from `/api/quiz?action=state`.
- **50 unique characters** (`src/data/quizCharacters.js`): each has its own name, body, headpiece, face, outfit, optional floating maths prop, colour, and its own idle move, win move, sad move and hello gesture. A test checks that no two characters share a name, colour, body and headpiece, full look, or idle and win moves. The studio's Characters tab shows all 50 in every mood.
