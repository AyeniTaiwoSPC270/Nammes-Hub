# Live Quiz: premium features (spec)

Date: 2026-09-30
Status: Proposed. Nothing here is built. Builds on `2026-09-30-live-quiz-design.md` (the game, the 50 characters and the Design Studio are live).

## 1. Purpose

The live quiz works end to end. These ten additions take it from "works" to "feels like a product": they make events livelier (sound, streaks, teams), make questions richer (images, new question types), save admins time (library, host controls), and give the department something to show for it (reports, sponsor branding, practice mode).

Each feature is written so it can be built and shipped on its own. Section 13 gives the order.

## 2. Ground rules every feature must follow

These come from how the quiz is already built. A feature that breaks one of them is wrong even if it works.

1. **One serverless function.** The Vercel free plan allows 12 functions and the project is at the limit. All new server actions are new `?action=` values on the existing router `api/quiz.js`, each with its own handler file in `api/_lib/handlers/` built as a factory (`createXHandler(getClient, opts)`) so it can be tested with the in-memory fake database. No new files in `api/` itself.
2. **The server is the referee.** Scoring, grading, timing and "who is allowed to do what" happen on the server. The host's browser and players' phones only ask. (This is already true of `advance` and `answer`.)
3. **The correct answer never reaches a phone before the reveal.** Any new question type or power-up that could leak it is checked by a test in the style of the existing "does not send the correct answer" tests.
4. **Players have no accounts.** A player is a secret token in their browser; only its hash is stored. New features must not add any personal data (no emails, no real names, no device fingerprints).
5. **Everything an admin can design is cleaned on the server.** Follow `api/_lib/quizTheme.js`: fixed lists, `#rrggbb` only, bounded lengths, storage paths matched against a strict pattern. Free text is always rendered as text, never as HTML.
6. **Migrations are additive and have a rollback file** in `supabase/rollbacks/` (same naming as today). Existing rows and running games keep working with no backfill. New columns have defaults.
7. **Games are snapshots.** A game copies what it needs from its quiz when it starts (as `max_players` and `theme` already do), so editing a quiz never changes a running game.
8. **Phones are small and on bad Wi-Fi.** Every phone-facing addition must work on a 360 px wide screen, stay light on data, and fall back gracefully when a file or a connection is missing.
9. **Accessibility.** Nothing is communicated by sound alone or colour alone; motion respects `prefers-reduced-motion`; touch targets are at least 44 px.
10. **Tests.** Pure rules get unit tests; handlers get fake-database tests including the abuse cases listed in each feature; the full suite and build stay green.

## 3. Feature 1: Sound

### Goal
Make the room feel like a game show: lobby music, a ticking clock, cheerful and sad stings, a fanfare on the podium. The host controls it; phones get an optional, quieter set of effects and a short vibration.

### Experience
- **Projector.** On the lobby screen a banner asks the host to click "Turn on sound" (browsers block audio until the page is clicked once; the existing Start button counts as that click for later screens). The choice is remembered on that computer.
- Sounds: lobby loop, question loop, countdown tick for the last 5 seconds (faster in the last 2), "time's up" horn, reveal sting (one for "most people got it", one for "hardly anyone did"), leaderboard whoosh per row move, podium fanfare.
- A speaker button in the top bar mutes everything instantly. A volume slider sits next to it.
- **Phones.** Off by default. A small speaker toggle on the phone lobby turns on effects only (tap, locked-in, right, wrong). Vibration on right/wrong where the browser supports it (`navigator.vibrate`).
- **Studio.** A new "Sound" section: music style (Off, Chill, Hype), sound effects on/off. Stored in the theme as `sound: { music: 'off' | 'chill' | 'hype', effects: boolean }`.

### Design
- Effects are **synthesised with the Web Audio API** (short oscillator envelopes), so there are no files to license, host or download, and they work offline once loaded. A `src/lib/quizSound.js` module exposes `play(name)`, `startMusic(style)`, `stopMusic()`, `setMuted()`, `setVolume()`.
- Music is the only real audio asset: two looping tracks of 60 to 90 seconds, encoded at about 96 kbps (roughly 1 MB each), served from `public/quiz-sounds/` and loaded only when music is on. Tracks must be CC0 or commissioned; the licence is recorded in `public/quiz-sounds/LICENSES.md` before merge.
- Theme sanitiser gains `sound` (both fields from fixed lists). Default is `{ music: 'off', effects: true }`, so existing quizzes stay quiet until an admin opts in.
- Sound is driven by the same state changes that already drive the screens (state entered, seconds left), so no new server traffic.

### Data and API
No database change beyond the theme shape (theme is already `jsonb`). No new action. The state action already returns the sanitised theme.

### Edge cases
- Audio blocked or unsupported: everything silently no-ops; the game is identical.
- Tab in the background: the browser may throttle timers; the tick sound is tied to the on-screen countdown so it stays in step.
- Two hosts' laptops on the same game: each has its own mute setting.

### Tests
Sanitiser (unknown values dropped, default applied); a pure function mapping (state, secondsLeft, stats) to the sound to play; a test that every sound name used in screens exists in the module.

### Size: M. Risk: low. Depends on: nothing.

## 4. Feature 2: Images on questions

### Goal
A question can carry a picture: a diagram, a graph, a photo, a screenshot of an equation.

### Experience
- **Editor.** Each question card gets "Add image" (file picker, drag and drop, or paste). A preview appears with an "Alt text" box (required before saving, with a hint: "Describe it for someone who cannot see it") and a Remove button.
- **Projector.** The image sits beside or above the question text, scaled to fit without cropping, with a soft frame.
- **Phones.** A smaller version above the answer tiles, tap to enlarge. It is loaded ahead of time (see below) so the question does not wait on it.
- **Reveal.** The image stays.

### Design
- New column `quiz_questions.image_path text` (null when none) and `image_alt text` (max 200 characters).
- New Supabase Storage bucket `quiz-images`, **public read, admin-only write** (storage policies use `public.is_admin()`). Path pattern `<quiz_id>/<question_id>.<ext>`; extension from `jpg | png | webp`. The state API builds the public URL server-side from the stored path, never from client input.
- **Client-side processing before upload:** decode, downscale to at most 1280 px on the long edge, re-encode as WebP (JPEG fallback), target under 300 KB, hard cap 2 MB. Re-encoding through a canvas also strips metadata (location data in photos).
- No SVG uploads (scripts can hide in them).
- **Preloading.** When the state says the next question is coming (leaderboard state), phones prefetch its image URL so it is cached by the time the question opens. The state response includes `nextImageUrl` only when the state is `leaderboard`, and never the next question's text or options.
- Deleting a question or quiz deletes its image through a small admin-side cleanup in the delete helpers; a monthly check (Section 12) lists orphans.

### Maths text (small add-on)
Questions and options may contain `$...$` for inline maths, rendered with KaTeX (bundled, loaded lazily only on screens that contain `$`). Rendering is done by KaTeX into text nodes with `trust: false`, so it cannot inject HTML. The editor shows a live preview.

### Edge cases
- Image fails to load on a phone: show the alt text in a box instead; the game continues.
- Slow connection: show the question text and answer tiles immediately; the image fades in when ready.
- Question with an image but the admin later removes the file from storage: the URL 404s and the alt-text fallback shows.

### Tests
Path pattern validator (rejects `../`, wrong extension, wrong shape); state handler returns `imageUrl` and `imageAlt` for the current question only and never for the next question's content; the resize helper's size and type rules.

### Size: M. Risk: low to medium (storage policies, upload flow). Depends on: nothing.

## 5. Feature 3: Streaks and power-ups

### Goal
Reward consistency and give trailing players a reason to keep trying, without making the game feel random.

### Rules (all on the server)
- **Streak bonus.** Each consecutive correct answer adds a bonus on top of the normal points: 2nd in a row +50, 3rd +100, 4th +150, 5th and beyond +200. A wrong answer or no answer resets the streak to 0. The bonus is not reduced by answer speed. Bonus values live in one constants block so they are easy to tune.
- **Double-points round.** An admin can mark any question "Double points". All points for that question, including the streak bonus, are doubled. The projector shows a clear "DOUBLE POINTS" banner as the question opens.
- **Power-ups (one of each per game per player):**
  - **Double down.** Tapped before answering. A correct answer earns 2x points; a wrong answer earns 0 (it is already 0, so this is pure upside). It cannot be used on a double-points question.
  - **50/50.** Tapped before answering. The server hides two wrong options for that player only. Which two is chosen by a hash of (player id, question id), so reloading cannot reroll it.
- **Comeback boost (automatic).** Players in the bottom quarter of the leaderboard when a question opens earn 15% extra on a correct answer. This is shown as a small "Comeback +15%" chip on their phone, so it never feels like a secret handicap for the leaders.
- All three can be switched on or off per quiz in the editor ("Game options"), so a serious quiz can stay plain.

### Data
- `quizzes.game_options jsonb default '{}'` and `quiz_sessions.game_options jsonb default '{}'` (copied at start). Shape: `{ streaks: bool, powerups: bool, comeback: bool }`, sanitised like the theme.
- `quiz_questions.points_multiplier smallint default 1 check (points_multiplier in (1,2))`.
- `quiz_players.streak int default 0`, `quiz_players.powerups_used text[] default '{}'`.
- `quiz_answers.powerup text` (null, `double`, or `fifty`), `quiz_answers.bonus_points int default 0`.
- New `quiz_sessions.rank_snapshot` is **not** needed: the comeback check reads the players' current totals when the answer arrives, ranking by score (cheap at 150 players).
- `quiz_record_answer` is replaced (new migration, old version kept in the rollback) to apply the multiplier, streak, power-up and comeback rules in one transaction with the score update, so two answers cannot race past them.

### API
- New action `powerup` (`{ token, kind }`): validates the game is in `question` state, the player has not answered, the power-up is enabled and unused, then records the intent on a small `quiz_powerup_uses` row (`player_id`, `question_id`, `kind`; unique on `(player_id, question_id)`). For `fifty` it returns `{ hidden: [i, j] }`.
- `answer` reads the use row, passes the power-up to the RPC, and still returns only `{ accepted: true }`.
- `state` adds, for the current player only: `streak`, `powerupsLeft: ['double','fifty']`, `hidden` (when 50/50 is active), and `multiplier` for the current question. Never the answer.

### Experience
- Phone: a flame icon with the streak count beside the score; two power-up buttons above the tiles while a question is open; the reveal screen itemises "400 + 100 streak + 15% comeback".
- Projector: "DOUBLE POINTS" banner; leaderboard rows show a flame for streaks of 3 or more.

### Edge cases
- Player uses Double down then does not answer: the use is spent (a clear note on the button: "Use it only when you are sure").
- Power-up tapped twice quickly: the unique index makes the second a no-op.
- Question with only 2 options: 50/50 is hidden (it would leave one option, which gives the answer away).
- Late answers inside the existing 1.5 s grace count as normal for streaks.

### Tests
Pure scoring function covering every combination (streak levels, multiplier, power-up, comeback, rounding); RPC fake tests that a streak resets, that power-ups cannot be reused, cannot be used on a closed question, and that 50/50 never hides the correct option and is stable across reloads.

### Size: L. Risk: medium (touches scoring). Depends on: nothing, but do Feature 5 first or together if question types are also changing grading.

## 6. Feature 4: Team mode

### Goal
Run events as class against class (100L vs 200L), hostel against hostel, or any custom split.

### Experience
- **Editor / host dialog.** "Play in teams" switch. Admin picks a preset (Levels: 100L to 500L; Colours: Red, Blue, Green, Gold) or types 2 to 8 custom team names. Each team gets a colour and one of the 50 characters as its mascot.
- **Join.** After the nickname and character, a player picks a team (big coloured buttons showing member counts) or taps "Put me anywhere" for auto-balance. Teams are locked once joined.
- **Lobby (projector).** Players are grouped by team colour.
- **Leaderboard.** Two lists: teams on top with an animated score bar, then top individual players. **Team score is the average of its members' scores**, so a big class does not beat a small one just by headcount. A "Total score" option exists for events where that is wanted.
- **Finish.** Team podium first, then the individual podium, each with confetti.

### Data
- `quiz_sessions.team_mode boolean default false`, `team_scoring text default 'average' check in ('average','total')`.
- `quiz_teams (id uuid pk, session_id uuid references quiz_sessions on delete cascade, name text, color text, avatar_id smallint, position smallint)`. Unique `(session_id, position)`. Public select (same as players); writes by service role only.
- `quiz_players.team_id uuid references quiz_teams on delete set null`.
- `quizzes.team_presets jsonb` holds the admin's saved team list, copied into `quiz_teams` rows when a game starts.

### API
- `create` accepts `teams` (validated: 2 to 8, names 1 to 24 characters, cleaned like nicknames, colours from a fixed list).
- `join` accepts `teamId` or `teamId: 'auto'`. Auto picks the team with the fewest players at that moment, with the same re-check-after-insert pattern the player cap uses so a rush of joins stays balanced.
- `state` adds `team: { id, name, color }` for the player and `teams: [{ id, name, color, avatarId, score, rank, members }]` on leaderboard and finished states.

### Edge cases
- Team with no players: hidden from standings; with average scoring it never divides by zero.
- Player joins after the game started: not allowed today (lobby only), so teams cannot shift mid-game.
- Kick (Feature 8) removes a player from the team average immediately.
- Max-players cap still applies to the whole game.

### Tests
Average vs total scoring with uneven teams; auto-balance under concurrent joins; a player cannot pick a team from another game; state never lists another game's teams.

### Size: L. Risk: medium (touches join, state, leaderboard and finish screens). Depends on: nothing.

## 7. Feature 5: More question types

### Goal
Beyond four-option multiple choice: true/false, type-the-answer numbers and short text, and unscored polls.

### Types
| Type | Answer tiles | Correct answer | Scored |
| --- | --- | --- | --- |
| `multiple` (today) | 2 to 4 shapes | one option | yes |
| `truefalse` | two big tiles, True and False | one of the two | yes |
| `numeric` | number keypad input | a number with tolerance | yes |
| `text` | short text input (max 40 chars) | list of accepted answers | yes |
| `poll` | 2 to 4 shapes | none | no |

### Data
- `quiz_questions.type text not null default 'multiple' check in ('multiple','truefalse','numeric','text','poll')`.
- `numeric_answer numeric`, `numeric_tolerance numeric default 0` (absolute), `accepted_answers text[]` (max 8 entries, each max 40).
- `correct_index` becomes nullable (null for numeric, text and poll). A check constraint ties the right columns to each type.
- `quiz_answers.chosen_index` becomes nullable; new `answer_text text` (max 40) holds what was typed, and `correct boolean` records the grade so reports do not re-grade.

### Grading (server only, pure function `gradeAnswer(question, submission)`)
- Numeric: parse with a strict parser (accepts `3.14`, `-2`, `1/2`, `1e3`; rejects everything else), compare `abs(a - b) <= tolerance`.
- Text: lowercase, trim, collapse spaces, strip punctuation and accents, then exact match against the normalised accepted list. No fuzzy matching in v1 (it causes arguments).
- Multiple, true/false: as today.
- Poll: always "not graded"; points 0.

### API
- `answer` accepts `{ chosenIndex }` or `{ answerText }` depending on the question type, and rejects the wrong shape (400). Typed input is length-limited and control characters are stripped.
- `state` includes `question.type` and what the phone needs to draw the right input; the accepted answers and numeric answer stay server-side until the reveal, then `reveal` includes `correctText` (the first accepted answer or the number).

### Experience
- **Editor.** A type dropdown at the top of each question card; the card shows the fields that type needs. True/false pre-fills the options.
- **Projector.** Numeric and text show a live "answers in" counter. Reveal shows the correct answer big; for text, the most common wrong answers as a short list (grouped after normalisation); for polls, the bar chart of votes with no "correct" colouring.
- **Phone.** A big input with the right keyboard (`inputMode="decimal"` for numbers), a Submit button, and the same locked-in screen.

### Edge cases
- Numeric answer with units ("5 m"): not accepted; the editor warns admins to put units in the question.
- Text answers that differ only by case, spacing or punctuation are equal; the editor shows the normalised form so admins can see what will match.
- A correct answer missing from the accepted list is the admin's to fix: the reveal screen has a host-only "Mark this answer correct" action that re-grades that one normalised answer and re-runs the scores for that question in one transaction (logged on the game row).

### Tests
`gradeAnswer` table tests for every type and every odd input; the answer-leak test extended to new types; handler tests for wrong-shape submissions; a poll question adds no points and does not break streaks (a poll neither extends nor resets a streak).

### Size: L. Risk: medium (touches editor, answer, state, host reveal). Depends on: nothing. Do before Feature 3 if both are planned.

## 8. Feature 6: Reusable quiz library

### Goal
Stop rebuilding quizzes. Duplicate, import, export, tag and search.

### Experience
- **Quiz list.** Search box, tag filter chips, "Archived" toggle. Each card gets Duplicate and Archive.
- **Duplicate.** Creates "Copy of ..." with new ids for the quiz and every question (and copies images within storage).
- **Import.** A dialog accepting a `.csv` file or text pasted straight from a spreadsheet (tab-separated). A preview table shows each parsed question with problems highlighted; nothing is saved until the admin confirms.
- **Export.** Download a quiz as CSV (handy as a backup and to edit in Excel).
- **Question bank.** In the editor, "Add from another quiz" opens a searchable list of all questions across quizzes; ticking some copies them into the current quiz.

### CSV format
Header row, one question per row:
`type,question,option_a,option_b,option_c,option_d,correct,seconds,points`
- `correct` is a letter (A to D), or for numeric `3.14|0.01` (answer and tolerance), or for text `ada|ada lovelace` (accepted list separated by `|`).
- `type` defaults to `multiple` if the column is missing or empty, so a simple four-option sheet imports with no header changes.
- UTF-8, with or without BOM; Excel-style quoting.

### Data
- `quizzes.tags text[] default '{}'` (max 8 tags, each max 24 characters), `quizzes.archived_at timestamptz`.
- No new tables. Everything runs through the admin's own authenticated client under the existing admin-only policies, so there is **no new serverless action**.

### Rules
- Import limits: 200 questions per quiz, file under 1 MB, every cell trimmed, the same validation as the editor (lengths, at least two options, a valid correct answer). Formulas are not executed (cells starting with `=`, `+`, `-`, `@` are kept as text on export by prefixing `'`, to prevent spreadsheet injection when the CSV is reopened).
- Duplicate and import insert in one batch (upsert with client-made uuids, as saving does today) so a failure leaves nothing half-made; on error the new quiz is deleted.

### Tests
CSV parser (quotes, commas, newlines in cells, BOM, tab-separated, bad rows reported by line number); export then import round-trips; spreadsheet-injection prefixing; duplicate gives fresh ids.

### Size: M. Risk: low. Depends on: Feature 5 for the non-multiple types in CSV (works for multiple choice without it).

## 9. Feature 7: Results and reports

### Goal
After an event, show what happened: how many came, which questions were hard, who did well. Something the department can present or keep.

### Experience
- **Games list.** Each quiz gets a "Games" page listing its finished games (date, players, average score, completion rate).
- **Report page** `/admin/quizzes/:id/games/:sessionId`:
  - Header cards: players, average score, average accuracy, average response time, completion rate (players who answered the last question).
  - **Per question:** accuracy %, average seconds to answer, number who answered, and the answer distribution. Hardest and easiest three are called out.
  - **Players table:** rank, nickname, score, correct count, average time. Sortable.
  - Team results (if Feature 4 is on).
  - **Export CSV** (players and per-question) and **Print / Save as PDF** using a print stylesheet so the report fits A4.
- Participation over time: on the quiz list, a small "games played / total players" line per quiz.

### Design
- Every number is derived from `quiz_answers` and `quiz_players`, which are already stored, so **no new tables**. A SQL view `quiz_question_stats` (created `with (security_invoker = true)` so admin-only RLS still applies) returns per question: answered count, correct count, average elapsed ms. The player table is a plain join.
- Because Feature 5 records `correct` on each answer, add `correct` and `elapsed_ms` if missing (additive migration with a backfill from existing rows for `correct`).
- Loaded on demand with pagination-safe queries (a game has at most 150 players by 100 questions = 15,000 answer rows; the page fetches aggregates, not raw rows, except for the players table).

### Privacy
Nicknames on the report are what players typed; they are cleared when the game is deleted. Admins can delete a game from the report. The report is admin-only (the view inherits admin-only access); there is no public results link in v1.

### Edge cases
- Game abandoned half-way: report shows "unfinished" and uses the questions that were played.
- Ties: the same rank rule as the live leaderboard.

### Tests
View results against a fixture game (accuracy, averages); CSV export; ranking matches the live rule; a non-admin cannot read the view.

### Size: M. Risk: low. Depends on: nothing (nicer with Features 4 and 5).

## 10. Feature 8: Host controls

### Goal
Give the host control of the room when things go wrong: a disruptive nickname, a late crowd, a bad question, a fire drill.

### Controls
| Control | Where | What it does |
| --- | --- | --- |
| **Kick player** | Lobby and player list | Removes the player and their token; their phone shows "You were removed from this game". Optional "Block this nickname" stops an immediate rejoin under the same name. |
| **Lock lobby** | Lobby | Stops new joins without starting the game. A padlock toggle; phones trying to join see "This game is locked". |
| **Pause / resume** | Question | Freezes the clock on every screen. Scoring uses the time actually played, not the pause. |
| **Add 10 seconds** | Question | Extends the running question once or more (each press +10 s, max +60 s per question). |
| **End question now** | Question | Exists today ("End question"). Kept. |
| **Skip question** | Question | Discards it: no points, no streak change, moves to the next. |
| **Rename player** | Lobby | Replaces an unsuitable nickname with "Player 17" style text. |
| **Keyboard shortcuts** | Projector | Space = next, P = pause, L = lock, + = add time, M = mute. A small "?" overlay lists them. |

### Design
- `quiz_sessions.locked boolean default false`, `blocked_nicknames text[] default '{}'`, `time_bonus_ms int default 0`, `paused_at timestamptz`, `paused_total_ms int default 0`.
- **Server-side timing model.** The deadline is `question_started_at + limit + time_bonus_ms + paused_total_ms`. Pause sets `paused_at`; resume adds `now - paused_at` to `paused_total_ms` and clears `paused_at`. The scoring function's elapsed time becomes `now - question_started_at - paused_total_ms` (if paused at the moment of answering, the answer is refused with "Game is paused"). The state action returns `deadlineMs` and `paused` so phones and the projector draw the same countdown, and everyone still corrects for their own clock using `serverNow`.
- New action `host` with `{ sessionId, op, ... }` and `op` one of `kick`, `lock`, `unlock`, `pause`, `resume`, `extend`, `skip`, `rename`. Admin-only, with the same compare-and-swap habit as `advance` (`expectedState`, `expectedIndex`) for ops that depend on the current step, so a stale double-click never hits the wrong question.
- Kick deletes the player row (cascade removes their token and answers); `blocked_nicknames` is compared case-insensitively by `join`.

### Edge cases
- Pause during the last second: the countdown resumes with exactly the time left.
- Extend after the question already closed: refused (409).
- Kick during the full-lobby 10 second countdown: the lobby is no longer full, so the countdown is cancelled (`full_at` cleared when the count drops below the cap, which also fixes a stale-countdown case).
- Skipping the last question: the game moves to the final leaderboard.
- All ops are logged to a `quiz_host_log` table (session, op, time) for dispute handling; admin-read only.

### Tests
Timing table tests for pause, resume and extension combined with `scoreAnswer`; handler tests that non-admins cannot call any op, that stale CAS is rejected, that a blocked nickname cannot rejoin, that kicked players get a 401 on their next call.

### Size: M to L. Risk: medium (timing). Depends on: nothing. Recommended first, because it reduces the risk of every real event.

## 11. Feature 9: Logo and sponsor strip

### Goal
Branding for events the department runs with partners, and a cleaner look when an event is not "NAMMES" themed.

### Experience
- **Studio, "Branding" section.** Upload an event logo (replaces the NAMMES mark in the top bar, optionally) and up to 6 sponsor logos, each with a name. A toggle: "Show sponsors on the lobby" and "Show sponsors on the final leaderboard".
- **Projector.** A quiet "Presented with" strip at the bottom of the lobby and final screens, logos at equal height in greyscale that turn to colour on hover (projector-friendly: plain, not animated). With more than 4 sponsors the strip gently rotates in groups of 4 every 6 seconds.
- **Phones.** Event logo in the top bar only. **No sponsor ads on phones**, so students are not shown adverts during play.

### Design
- Theme extended (still cleaned by `sanitizeTheme`): `logo: string | null` (storage path), `sponsors: [{ name, path }]` (max 6), `showSponsors: { lobby: boolean, finish: boolean }`.
- Storage bucket `quiz-branding`, public read, admin-only write, path pattern `<quiz_id>/<uuid>.<png|jpg|webp>`; 500 KB cap per file after client-side resize (max 600 px wide); no SVG. The sanitiser accepts a path only if it matches the pattern and belongs to that quiz id (checked on save in the studio and again when a game copies the theme), so a theme can never point at an arbitrary URL.
- The theme size check (`pg_column_size < 4000`) still holds: only short paths and names are stored.
- Sponsor names shown as `alt` text and as a caption for screen readers.

### Edge cases
- Logo missing in storage: the NAMMES mark is used instead.
- Transparent logos on dark and light: each logo is shown on a neutral rounded chip so both themes work.
- Removing a sponsor deletes its file.

### Tests
Sanitiser rejects foreign paths, wrong quiz id, too many sponsors, long names; studio preview renders the strip; state handler returns only cleaned branding.

### Size: M. Risk: low. Depends on: the image upload helper from Feature 2 (reuse it).

## 12. Feature 10: Practice mode (solo play)

### Goal
Let students replay a quiz on their own phone after the event (revision), without a host.

### Experience
- An admin marks a quiz "Open for practice" and gets a link `/practice/<quizId>` and a QR code.
- The student enters a nickname and picks a character, then answers the questions one at a time at their own pace. After each answer they see right or wrong, the correct answer and their points straight away (unlike live play, where the reveal waits for the host).
- End screen: score, accuracy, a "Try again" button, and the quiz's **practice top 10** (best runs, nickname and character only).
- No timer pressure beyond each question's time limit; the same speed-based scoring applies.

### Design
- `quizzes.practice_enabled boolean default false`.
- `quiz_practice_runs (id, quiz_id references quizzes on delete cascade, nickname, avatar_id, token_hash, started_at, finished_at, total_score, current_index)` and `quiz_practice_answers (run_id, question_id, chosen_index, answer_text, points_awarded, answered_at, unique (run_id, question_id))`. No public select; everything goes through the API. The practice leaderboard is served by the API from `total_score` of finished runs.
- New actions on the same router: `practice-start`, `practice-answer`, `practice-state` (and `practice-top` for the leaderboard). Questions are served **one at a time**, so the student never receives later questions or any answer in advance. The server keeps the question-open time on the run row so scoring uses the server clock exactly as live play does, by reusing the pure scoring and grading functions.
- Runs expire: a scheduled cleanup removes runs older than 90 days and unfinished runs older than 24 hours.

### Abuse and honesty
- Because feedback is immediate, a student can replay to learn the answers, so the practice leaderboard is explicitly labelled "for fun" and is separate from live results.
- Rate limits (best effort, in-memory like the existing ones): 5 runs per IP per hour, answer calls per token, nickname validation the same as live play.
- Only quizzes with `practice_enabled` respond; everything else returns 404. Admins can switch it off at any time, which ends access immediately.
- Still no accounts and no personal data.

### Edge cases
- Student closes the tab mid-run: the token in `sessionStorage` lets them resume while the tab lives; otherwise they start a new run.
- Quiz edited while a run is in progress: the run reads questions by position at the time each is served; the editor warns that changes affect open practice runs.
- Live-only question types (polls) are skipped in practice.

### Tests
One-at-a-time serving (no later question leaks), scoring parity with live play, answer twice refused, leaderboard only counts finished runs, expiry cleanup, rate limit, disabled quiz returns 404.

### Size: L. Risk: medium. Depends on: Features 5 and 7 helpers (grading, stats) are nice to have, not required.

## 13. Order of work and effort

| Phase | Features | Why this order | Rough size |
| --- | --- | --- | --- |
| A: make real events safer | 8 Host controls, 2 Images | Kick, lock and pause remove the biggest event risks; images unlock better questions | 2 medium builds |
| B: richer questions and fun | 5 Question types, 3 Streaks and power-ups, 1 Sound | Types first because grading changes; streaks reuse the new grading; sound is the big "feel" upgrade and is independent | 2 large, 1 medium |
| C: admin time savers | 6 Library, 7 Reports | Both are mostly client-side and low risk; reports are best once types are in | 2 medium |
| D: growth | 4 Teams, 9 Branding, 10 Practice | Bigger, optional, and each stands alone | 2 large, 1 medium |

Each feature ships as its own branch and pull request with its migration applied and verified before merge (the current habit), so any one can be reverted on its own using its rollback file.

## 14. Shared technical notes

- **Migrations** are numbered in the existing `YYYYMMDDHHMMSS_name.sql` style with matching `supabase/rollbacks/*.rollback.sql`.
- **Serverless budget.** Net new server code is new handlers behind `api/quiz.js`; the function count stays at 12. If a feature ever needs a scheduled job (cleanup of orphan images, expired practice runs), use a Supabase `pg_cron` job rather than a new Vercel function.
- **Icons.** Any new Material Symbol must be added to the sorted `icon_names` list in `index.html` (the guard test in `src/lib/iconFont.test.js` fails otherwise).
- **Theme and options are data, not code.** New per-quiz settings (`sound`, `game_options`, branding) follow the same pattern: stored on the quiz, sanitised, copied to the game at start.
- **Observability.** New handlers log failures through `logError`, like the existing ones.

## 15. Open questions for the department

1. **Music.** Commission or find CC0 tracks, or ship effects-only first? (Recommendation: effects-only first, music in a follow-up.)
2. **Team scoring default.** Average (fair for different class sizes) or total? (Recommendation: average, with a switch.)
3. **Practice leaderboard.** Show one at all, or keep practice purely personal? (Recommendation: show a top 10 labelled "for fun".)
4. **Sponsors.** Who approves sponsor logos before they appear on a projector in front of the whole department?
5. **Report sharing.** Should results ever be shareable with lecturers or the dean by link, or always handed over as a downloaded PDF? (Recommendation for v1: PDF only, no public links.)
6. **Data retention.** How long should finished games and player nicknames be kept? (Recommendation: 12 months, then delete, with a one-click "Delete all old games" action.)
