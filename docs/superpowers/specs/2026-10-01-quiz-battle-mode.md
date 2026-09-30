# Live quiz: battle mode (spec)

Status: proposed. Follows `2026-09-30-live-quiz-premium-features.md` (practice mode, test bots, team mode are built).

Battle mode lets players challenge each other. There are three ways to do it, and all three ship, in phases. They share one
foundation, so each phase is small once the first is done.

| Phase | Name | Who plays | Host needed? | When |
|---|---|---|---|---|
| A | Challenge a friend | Two people, at different times | No | After a practice-style run |
| B | Live duel | Two people, at the same moment | No | Code or link, like a mini game |
| C | Bracket (knockout) | Everyone in a hosted game, paired off | Yes | A hosted event |
| D | Rankings | Everyone | No | Wins, losses, champions |

## 1. Principles (same as the rest of the quiz)

- **The server is the referee.** Grading, scoring and timing happen on the server, with the server's clock. Phones never
  receive a correct answer early and never decide a score.
- **No accounts.** A player is a nickname, a character and a secret token kept on their device (only its hash is stored),
  exactly like live games and practice.
- **One serverless function.** New routes are `?action=` values in `api/quiz.js` (the project is at the 12-function limit).
- **Reuse, do not copy.** Grading (`quizGrading.js`), speed scoring (`scoreAnswer`), difficulty and bot answers
  (`quizBots.js`), rate limiting and the practice question-by-question flow are reused as they are.
- **Fair by construction.** In a duel both players are given the same question at the same server time; a player's answer
  is never visible to the other until the question closes.
- **Admins stay in charge.** Battles are opt-in per quiz (`battle_enabled`, like `practice_enabled`). Admins see battle
  activity in the reports and can switch it off at any time.

## 2. Shared foundation

### Data (migration, additive, with rollback)

- `quizzes.battle_enabled boolean default false`.
- `quiz_battles`: `id`, `quiz_id`, `mode` (`challenge` | `duel`), `code` (short, unique among open battles),
  `question_ids uuid[]` (the fixed set and order, 3 to 12 questions, polls excluded), `status` (`open` | `running` |
  `finished` | `cancelled`), `created_at`, `started_at`, `finished_at`, `winner_slot` (`a` | `b` | null for a draw).
- `quiz_battle_sides`: one row per participant: `battle_id`, `slot` (`a` | `b`), `nickname`, `avatar_id`, `token_hash`,
  `total_score`, `current_index`, `finished_at`, `last_seen_at`.
- `quiz_battle_answers`: `battle_id`, `slot`, `question_id`, `chosen_index`, `answer_text`, `correct`, `points_awarded`,
  `elapsed_ms`, primary key (`battle_id`, `slot`, `question_id`).
- An RPC `quiz_battle_record` (one atomic step: store the answer, add the points, refuse a second answer), like
  `quiz_practice_record`.
- Row level security on, no table grants for phones: only the server reads and writes. Phones get what they need through
  the API, never the table.
- Cleanup: unfinished battles after a day and finished ones after 90 days (extends `quiz_practice_cleanup`).

### Server module

`api/_lib/quizBattle.js` (pure): picking the question set (seeded, so both sides get the same one), scoring a question for
both sides, deciding the winner (higher total; a tie goes to the faster total answer time; otherwise a draw), and the head-
to-head summary. Fully unit tested. Handlers are factories with injected dependencies, like the other quiz handlers.

### Client

`src/pages/PlayBattle.jsx` (route `/battle/:code`), a `BattleBoard` component for the head-to-head screen, and a small
"Battle" entry on the practice finish screen and on the join page.

## 3. Phase A: challenge a friend

1. A player finishes a practice run. The finish screen offers **Challenge a friend**.
2. The server turns that run into a battle (`mode = challenge`, the same questions in the same order) and returns a link,
   `/battle/<code>`, which is easy to paste into a chat. The challenger's answers are saved as side A.
3. The friend opens the link, sees the challenger's nickname, character and **final score only** (never the answers),
   picks a nickname and plays the same questions at their own pace, exactly like practice.
4. When the friend finishes, both see the **head-to-head**: the score of each, who won each question, and the winner.
   The challenger can come back to the same link to see the result later.
5. A challenge can be accepted once. A rematch button creates a new challenge.

Notes: a challenge expires after 7 days. A friend who opens a link that is already taken sees who won. The challenger's
per-question results stay hidden until the friend has finished, so nothing is given away.

## 4. Phase B: live duel

1. **Create or join.** One player taps **Start a duel** and gets a short code and a link; the other enters the code or opens
   the link. There is also **Duel a bot** (skill choice, reusing `quizBots.js`), so nobody waits for an opponent.
2. **Lobby.** Both characters appear with a short "ready" step. The duel starts 3 seconds after both are ready.
3. **Play.** The question opens at the same server time for both. Each sees a live bar with both scores. A player sees that
   the other has answered, but not what they answered. The question closes when both have answered or time runs out.
4. **Reveal.** After each question both see the right answer, who got it, points gained, and the running score, with the
   characters reacting (dance or sad, reusing the moods).
5. **Result.** Winner, final scores, per-question comparison, and **Rematch**.
6. **Drop-outs.** Each phone sends a heartbeat; if a player is silent for 20 seconds the other is asked to wait, and after
   45 seconds the duel is won by forfeit. A player who comes back in time carries on.
7. **Fair time.** Both sides are timed from the same server start. Answers arriving after the limit plus a short grace are
   refused, exactly as in live games.

Polling (about one request per second per phone) is used, as in live games, which keeps the function model unchanged.

## 5. Phase C: bracket (knockout) in a hosted game

1. **Host setup.** On the lobby, the host chooses **Battle bracket** as the game type (new option next to team mode).
2. **Pairing.** When the game starts, players are paired at random (or by seed order once rankings exist). An odd player gets
   a **bot opponent** (skill chosen by the host), so nobody sits out a round.
3. **Rounds.** All matches in a round play at the same time, using the hosted game's own question flow: every pair sees the
   same question together, and each pair is scored only against each other. A match is the best of 3 questions (host can set
   1, 3 or 5). A tied match goes to a sudden-death question.
4. **Projector.** A bracket that fills in live: each match shows both characters, the running match score, and moves the
   winner to the next round with the existing leaderboard animation.
5. **Finish.** The last match is the final; the podium is the champion, the runner-up and the two semi-finalists.
6. **Reports.** The hosted game report gains a bracket view (who beat whom, and the scores).

Host controls (pause, extend, skip, kick) keep working. Kicking a player in a running bracket gives their opponent the win.

## 6. Phase D: rankings

- **Battle record** per player tag: wins, losses, draws and a rating (simple Elo, start 1000).
- A **player tag** is the device token already used for joining. It is not an account: clearing the browser starts a new
  record, and this is said plainly on the screen. Nicknames are not unique, so rankings key on the tag.
- **Champions list** on the battle page and the admin dashboard: top 10 this week and all time, with character and
  nickname only.
- Admins can reset the ranking or remove an entry. Bots never enter rankings.
- **Privacy:** only nickname, character and record are stored; no email, no name, no location.

## 7. Abuse and limits

- Creating battles: 10 per hour per connection; joining: 15 per minute (the existing join limiter).
- Nicknames use the same blocked-word check as live games.
- A battle link is unguessable enough to be safe to share but is not secret (anyone with it can take the open seat); a
  duel code is 6 characters and lives only while the duel is open.
- Only the two seats can answer; a third opener sees "this battle is full".
- Test bots in duels are flagged like hosted-game bots.

## 8. Testing

- Unit: question-set picking, tie-breaks, forfeit rules, bracket pairing with odd counts, Elo arithmetic.
- Handler tests with the in-memory database (as for practice and bots): creation, taking the seat, simultaneous answers,
  late answers, double answers, forfeit, tokens not leaking, other side's answer hidden before close.
- Live checks with scripted players against production, as with the hosted games.

## 9. Build order

1. Migration A, shared module, challenge a friend (phase A), switch in the quiz editor.
2. Live duel and duel-a-bot (phase B).
3. Bracket in hosted games (phase C).
4. Rankings (phase D).

Each phase is one pull request, merged on its own, so the site keeps working the whole way.

## 10. Open choices (defaults in brackets)

- Questions per duel or challenge: all of the quiz, or a chosen number? [default: up to 10, random subset of the quiz's
  questions so a rematch feels new]
- Ranking: on from the start or later? [later, phase D]
- Battle entry point for players: from the practice finish screen and a "Battle" button on the join page [both]
