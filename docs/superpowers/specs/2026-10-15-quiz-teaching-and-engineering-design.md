# Quiz Teaching, Spread and Engineering Types Design

Four changes to the same subsystem, in one spec because they share a payload and a type list.

A live quiz ends with a leaderboard. The question was wrong, the leaderboard moved on, and the student learned
exactly one thing: they were slow. Meanwhile the questions that would actually teach them are locked in an exam a
few weeks away, and the best way to reach a 200L group is still a man copying a code off a projector.

This spec adds the three things that turn a game into a lesson — an explanation on the reveal, a link that survives
being pasted into a WhatsApp group, and question types that an engineering department can actually use — plus the
thing that makes any of it usable on a Nigerian campus network: a low-data phone view.

**Status:** approved. **Date:** 2026-10-15.
**Plan:** `docs/superpowers/plans/2026-10-15-quiz-teaching-and-engineering.md`

---

## 1. Scope

### In

| # | Feature | Change |
|---|---|---|
| 6 | **Explanations on the reveal** | `quiz_questions.explanation` (already there, 500 chars) reaches the live quiz for the first time, on the projector and on every phone, behind a per-quiz toggle. Plus the editor field that has never existed |
| 4 | **WhatsApp-first sharing** | Server-rendered OG meta so a pasted join link or result link previews as itself, and a `wa.me` fallback because `navigator.share` is close to absent on Android |
| 2 | **Low-data mode** | An in-game toggle, a `/play/low` text-only route, durable rejoin after a dropped connection, and backoff |
| 5 | **Engineering question types** | `order` (put steps in order, partial credit), `diagram` (tap the point on a stress-strain curve), and units on `numeric` |

### Out

- **The quiz-to-revision loop** (a one-tap CBT session on the player's weak topics). It is the natural sequel and
  nothing here blocks it, but it needs per-student answer history, and **there is none** — no quiz table anywhere
  carries a `user_id` (§3.1). That is a separate design.
- **A season league.** Teams score per game today (`rankTeams`, `quizTeams.js:66-91`) and nothing carries across
  games. A cross-event table needs a durable player identity for the same reason.
- **Explanations on the result card.** `quizCardRender.js` draws a static PNG; there is no surface to put prose in.
- **`explanation` unifying the two CBT per-exam flags.** The live quiz gets a quiz-level flag, CBT keeps
  `cbt_exams.show_explanations`. Two settings in two domains, not one overriding the other (§2).
- **A service worker.** Low-data mode reduces and stops; it does not make the app installable. §7.5 explains why
  that is the right boundary here.
- **SVG uploads.** `quiz-images` is raster-only, 2 MB, webp/jpeg/png (`20261001100000:54-56`). A phase diagram may
  want vector; it can have a raster one.
- **Cross-device identity for quiz players.** Every quiz table is deliberately anonymous (nickname + token hash),
  and `quiz_battle_ratings.sql:4-5` states the position outright: *"This is not an account: clearing the browser
  starts a new record."* Rejoin below extends that model to survive a reload. It does not turn it into an account.

---

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Explanation surfaces | **Projector and phone** | A projector explanation teaches the room and is over in ten seconds. A phone explanation is the one the student screenshots into the class group. They are different audiences and both are cheap (§5.3) |
| Explanation toggle | **`quizzes.show_explanations`, default `true`**, snapshotted onto the session | Asked for. Snapshotted for the same reason `theme` and `characters` are: editing a quiz must never restyle a game already running (AGENTS.md). Default on because the column has existed for a month, CBT already honours a per-exam toggle, and a quiz with no explanations behaves exactly as it does today |
| Editor field | **Yes**, a textarea beside the alt-text field | `explanation` is a CSV column today (`quizCsv.js:12`) and nothing else. An explanation nobody can type is an explanation nobody writes. Mirrors the alt-text field's `{n}/200` counter at `{n}/500` |
| OG meta route | **`/api/system?action=og`**, no new function | 12 functions exist against a limit of 13. `api/system.js:9-15` already dispatches five handlers off one function via `?action=`, and `vercel.json:31-34` is the rewrite that makes it cost one slot. This is merging, in the shape the repo already uses. See the cold-start caveat in §6.5 |
| Join-link preview | **Generic** — "A live quiz is waiting" | A join code exists only while a session is live. Resolving it server-side for a preview turns the code into a public lookup. The code stays the secret; the preview is the invitation |
| Token expiry | **No expiry column.** Add the missing `quiz_session_cleanup()` at 90 days | §2.1 |
| Low-data scope | **Both** an in-game toggle and a `/play/low` route | They fix two different problems. The toggle fixes play; only a separate route fixes the *first load*, because a toggle cannot un-download the webfonts already fetched. §7 |
| Rejoin durability | **`localStorage` + a partial unique index** | The index is what makes it work. `quiz_players_nickname` covers `(session_id, lower(nickname))` unconditionally (`:47`), so a student who reloads is locked out by their own row. §7.3 |
| Rejoin on tap | **Resume the existing player**, not error | A `409` with a matching token means "this is you, come back", not "name taken". Otherwise durable storage buys nothing |
| Diagram grading | **Multiple acceptable regions**, each a normalised `{x, y, r}` | A phase diagram has more than one valid answer, and one region per correct answer means the author duplicates the question. Coordinates normalised, not pixels — §8.3 |
| Diagram source | **The question's existing `image_path`** | The whole upload pipeline already exists and is enforced (2 MB, canvas re-encode, mandatory alt text). A second image column means a second upload, a second storage slot and a second thing to fail to load on a slow phone |
| Diagram on `/play/low` | **Yes, included** | The tap is an `<img>`, one `onClick` and one `getBoundingClientRect()`. Excluding it would leave a student on the low route stuck on a question they cannot answer. §7.4 |
| Numeric units | **Per-unit alias list**, no unit conversion | §2.2 |
| Ordering grading | **Partial credit per position** | Six steps with one wrong is not zero. This needs a `credit` column the reveal can print, which points cannot supply — §8.2 |

### 2.1 Why no token expiry, restated

Three findings, in the order they changed the answer:

1. **There is no disclosure to prevent.** `quiz_sessions` and `quiz_players` are world-readable —
   `grant select ... to anon, authenticated` with `using (true)` (`20260930150000:85-87`). A leaked token reveals a
   finished leaderboard any anonymous client can already read.
2. **`localStorage` shrinks the problem.** Today a reload mints a new player, a new token and a fresh set of
   `quiz_answers`; `PlayQuiz.jsx:43` documents the consequence in a comment. Fixing rejoin stops that cycle. The
   feature being asked about is the fix for the growth.
3. **The actual gap is a missing function.** `quiz_practice_cleanup()`, `quiz_battle_cleanup()` and
   `quiz_custom_cleanup()` all exist. Hosted sessions do not, and `quiz_sessions` is the root of the whole tree.

So: delete finished sessions older than 90 days and let cascade do the rest. `quiz_players` cascades from
`quiz_sessions` (`:42`), `quiz_player_tokens` from `quiz_players` (`:51`), `quiz_answers` from both (`:57-59`),
`quiz_powerup_uses` from `quiz_players` (`:64`). One `delete` clears everything. 90 days matches the two existing
quiz cleanups; a shorter window would break `HostQuiz.jsx:836`'s CSV export and `AdminQuizReport.jsx` for an admin
asking for last month's numbers.

An expiry column would add a code path that can only fire wrongly — a game that runs past a boundary, a clock skew —
to defend nothing, and would contradict a decision the codebase already made on purpose.

### 2.2 Units, and why `2500 N` is wrong against `2.5 kN`

`numeric_answer` stays a bare number and `numeric_tolerance` keeps its meaning; the unit is a separate field with a
list of accepted spellings. **No unit conversion.**

A student who writes `2500 N` for a question whose answer is `2.5 kN` has made a mistake worth three orders of
magnitude, and a quiz that quietly accepts it is a quiz that teaches the mistake. The unit is part of the answer.
An author who wants both spellings correct lists both, and can widen the value with `numeric_tolerance`.

When a question declares no unit, a unit in the student's answer is **ignored** and only the number is graded. A
trailing unit cannot smuggle a wrong number through, and a forgiving parse costs nothing.

---

## 3. The gap this fills

### 3.1 Explanations exist; the live quiz cannot see them

`quiz_questions.explanation` is `text` with `check (char_length <= 500)`
(`20261002100000_cbt_exams.sql:12-16`). It is wired end to end for CBT — the per-exam flag at `cbt_exams.sql:63`,
cleaned at `cbt.js:30`, stripped from the running paper at `cbt.js:59-67`, released only through `reviewQuestion()`
(`cbt.js:133`) and study mode's `feedbackFor()` (`quiz-cbt.js:245-248`), rendered at `ReviewList.jsx:80-82` and
`QuestionView.jsx:73-79`.

The live quiz reads none of it. Grepping `explanation` across `PlayQuiz.jsx`, `HostQuiz.jsx`, `PlayPractice.jsx`,
`PlayBattle.jsx`, `QuestionCard.jsx` and `src/data/quiz.js` returns nothing. The reveal — a first-class state in the
machine (`quiz.js:108-126`), not an interstitial — shows the correct answer and no prose: `PlayQuiz.jsx:710-744` and
`HostQuiz.jsx:449-592`.

The gap is one `if`. The server already withholds `correctIndex` while the game is in the `question` state
(`quiz-state.js:151`); the explanation belongs in exactly that block or nowhere.

There is also no way to write one. `explanation` is imported and exported by the CSV layer (`quizCsv.js:12,111,170`)
and carried into custom sets (`quizCustom.js:124-128`), and `ExamEditor.jsx:172` shows a bank row as having one —
but `QuestionCard.jsx` has no field, so authoring means a spreadsheet.

### 3.2 Every shared link previews as "NAMMES Hub"

`index.html` has a title and one description. No `og:`, no `twitter:`, no canonical. `vercel.json:35-38` sends
`/((?!api/).*)` to the same static shell, so a link cannot render differently from any other.

Sharing today is a **PNG file** through the Web Share API (`shareCard.js`, `ResultCardModal.jsx`), which works on a
tablet and fails on the thing this needs to work on. `navigator.canShare({ files })` is not the problem; Android's
Web Share implementation largely is. The join link is **QR-only** on the projector (`HostQuiz.jsx:154-169`).

### 3.3 The phone downloads 263 KB to show a code

`/play` pulls `index` 311 KB + `react` 118 + `supabaseClient` 200 + `index.css` 92 + `useQuery` 23, plus
`PlayQuiz` 28, `QuizParts` 26, the shared `quiz-*` chunks 74, `BracketParts` 9, `ResultCardModal` 3 and
`quizAudioStore` 6 — roughly 867 KB raw, 263 KB gzipped, plus Public Sans and a Material Symbols subset. Then during
the game it re-fetches every 4 seconds (`PlayQuiz.jsx:27,353`) and redraws a backdrop and up to 62 SVG characters.

The realtime subscription is decorative anyway: it reads no payload and only schedules a `refresh()`
(`PlayQuiz.jsx:358-372`). The websocket pokes the poll.

And a dropped connection is not handled, only narrated — `PlayQuiz.jsx:328-348` sets "Connection problem. Trying
again…" and re-fires at a flat 4 s with no backoff, no queue and no persistence. A reload loses the game outright,
because the token is in `sessionStorage` (`:26,38-45`) and the tab took it with it.

### 3.4 An engineering question cannot be asked

Five types (`quizGrading.js:5`): `multiple`, `truefalse`, `numeric`, `text`, `poll`. A stress-strain curve needs a
tap on a picture; a titration procedure needs an order; a load needs a unit.

The image pipeline is **already there** and is not the blocker: the `quiz-images` bucket (`20261001100000:54-56`),
browser-side canvas resize and WebP re-encode (`src/lib/quizImage.js:27-51`), a strict path validator
(`api/_lib/quizImage.js:10-18`), and mandatory alt text (`quizQuestions.js:131-134`). What is missing is any
coordinate, and `IMAGE_MAX_EDGE = 1280` (`src/lib/quizImage.js:6,36`) means coordinates cannot be pixels.

---

## 4. Data model

Six migrations. Each is additive; none drops a column, so each is reversible by hand.

### 4.1 Explanations

```sql
alter table public.quizzes      add column show_explanations boolean not null default true;
alter table public.quiz_sessions add column show_explanations boolean not null default true;
```

The session copy is not redundant. `game_options` is snapshotted the same way (`20261001110000:58-59`), and a host
who decides mid-evening that explanations are spoiling the next question must not be able to change a game that
fifty phones are already holding.

### 4.2 Rejoin

```sql
alter table public.quiz_players add column left_at timestamptz;
drop index public.quiz_players_nickname;
create unique index quiz_players_nickname on public.quiz_players (session_id, lower(nickname))
  where left_at is null;
```

The partial index is the codebase's own pattern, not an invention: `quiz_sessions_active_code` at
`20260930150000:38` is `unique (join_code) where state <> 'finished'`, commented *"A join code only has to be unique
while its game is still running."* A nickname only has to be unique while that player is still playing.

`quiz_answers` already dedupes on `unique (player_id, question_id)` (`:63`), so a re-sent answer is refused
server-side and a rejoin cannot double-count a score.

### 4.3 Session cleanup

```sql
create or replace function public.quiz_session_cleanup(p_days integer default 90) returns integer
```

`delete from quiz_sessions where state = 'finished' and finished_at < now() - make_interval(days => p_days)`.
Returns the row count so a dry run is the same call with the delete removed. Scheduled on pg_cron alongside
`purge-old-data` (`20260929170000:37`), deliberately **not** on the hour — `20261009120000:53` records that every
other job in this database already shares the top of the hour.

### 4.4 Units

```sql
alter table public.quiz_questions
  add column numeric_unit         text check (numeric_unit is null or char_length(numeric_unit) between 1 and 12),
  add column numeric_unit_aliases text[] not null default '{}';
```

`numeric_answer` and `numeric_tolerance` are untouched. A unit question is a numeric question with a unit; keeping
the number bare is what lets the existing tolerance code work unchanged.

### 4.5 Ordering — no new answer column on the question

An `order` question reuses `options text[]` for its steps and needs **no `correct_order`**.

The authored order of `options` *is* the answer. At draw time the steps are presented shuffled through the existing
`optionOrder` mechanism that `shownOptions()` already uses everywhere (`quiz-state.js:126`), and the student's answer
is the sequence of **canonical** indices they tapped. Grade by counting positions where `answer[i] === i`.

This is better than a `correct_order` column for one reason: it cannot drift from `options`. A column holding a
permutation duplicates state that already exists and can disagree with it. If a future question needs a canonical
answer that differs from authored order, the author reorders their own list — and if some future need genuinely
requires the column, that is the day to add it.

### 4.6 Diagram

```sql
alter table public.quiz_questions
  add column diagram_targets jsonb not null default '[]'::jsonb
    check (jsonb_typeof(diagram_targets) = 'array');

alter table public.quiz_questions drop constraint quiz_questions_shape;
alter table public.quiz_questions
  add constraint quiz_questions_shape check (
    (type = 'multiple' and array_length(options, 1) between 2 and 4 and correct_index is not null and correct_index < array_length(options, 1))
    or (type = 'truefalse' and array_length(options, 1) = 2 and correct_index is not null and correct_index < 2)
    or (type = 'poll' and array_length(options, 1) between 2 and 4)
    or (type = 'numeric' and numeric_answer is not null)
    or (type = 'text' and coalesce(array_length(accepted_answers, 1), 0) between 1 and 8)
    or (type = 'order' and coalesce(array_length(options, 1), 0) between 2 and 12)
    or (type = 'diagram' and image_path is not null and jsonb_array_length(diagram_targets) between 1 and 12)
  );
```

Each entry is `{x, y, r}` with `x, y ∈ [0,1]` measured against **the image's own box** and `r` a fraction of
`min(width, height)`, so a radius stays circular on any display. 1–12 regions: enough for a phase diagram, capped
so one question cannot become an expensive scatter.

### 4.7 Answers — two new columns, three tables

`chosen_index` is already nullable (`20261001110000:40`), so there is no `NOT NULL` fight. What does not fit in a
`smallint` is a permutation or a coordinate:

```sql
alter table public.quiz_answers          add column order_answer smallint[],
                                           add column credit numeric;
alter table public.quiz_practice_answers add column order_answer smallint[],
                                           add column credit numeric;
alter table public.quiz_battle_answers   add column order_answer smallint[],
                                           add column credit numeric;
```

**`credit` is not optional.** The reveal has to print *"4 of 6 steps in the right place"*, and it cannot derive that
from `points_awarded`, because the speed scaling (`quiz.js:68-74`), the streak bonus (`quizGrading.js:84-86`), the
comeback boost (`:90-96`) and the 2× multiplier (`:105`) all mutate it. Storing the fraction once at grading time is
cheaper and more honest than reconstructing it later from four interacting multipliers.

CBT needs **no DDL**: `cbt_attempts.answers` is a jsonb blob keyed by question (`cbt_exams.sql:106-107`), so
`order` and a unit string are one more key in the same object.

### 4.8 Recording — three signature changes

`quiz_record_answer` (`20261001110000:77-82`) takes 12 parameters. It needs two more: `p_order smallint[]` and
`p_credit numeric`. Same for `quiz_practice_record` and `quiz_battle_record`.

Each is a `drop function if exists` + recreate, because Postgres will not replace an existing signature — the
migration at `:76` already does exactly this for the 6-argument version.

---

## 5. Explanations on the reveal

### 5.1 Server

`api/_lib/handlers/quiz-state.js` gains one field inside the existing gate:

```js
if (session.state !== 'question') {
  out.reveal = {
    correctIndex: /* unchanged */,
    correctText: correctText(question),
    chosenIndex: /* unchanged */,
    answerText: /* unchanged */,
    correct: /* unchanged */,
    pointsAwarded: /* unchanged */,
    bonusPoints: /* unchanged */,
    // Only while the answer is already public, and only if the host wants a room to read it.
    explanation: session.show_explanations ? question.explanation || null : null,
  }
}
```

The `:151` gate is the security property. It is the same gate that keeps `correctIndex` off the wire while the
question is live, and the explanation must not be the field that slipped past it.

### 5.2 Projector and phone

`HostQuiz.jsx` reads `quiz_sessions` directly (`:959`), so `show_explanations` is available without a second request.
The block goes under the stat tiles in `RevealScreen` (`:577-589`), inside the same element, below the choice or
typed branch, so it reads as a footnote to the answer rather than a second panel competing with it.

On the phone it goes in `ResultScreen` (`PlayQuiz.jsx:70-80`), under the correct answer at `:730-735`. The reveal
screen is small and auto-advancing, so this is the one place a phone explanation has to be short — which is what the
500-character cap is for.

Practice and battle get the equivalent treatment at their own reveal points (`PlayPractice.jsx:382`,
`PlayBattle.jsx:680-712`). Battle already reads the question row; it needs the same conditional.

### 5.3 Payload cost

At most 500 characters, only during the reveal, only to phones that ask. A ten-second reveal at a 4-second poll is
two or three fetches, so roughly 1.5 KB per student for the whole question. It is not worth optimising away — which
is why §7's low-data mode drops it by choice rather than by budget.

An empty or absent `explanation` renders nothing. A quiz with no explanations behaves exactly as it does today,
which is what makes `default true` safe.

### 5.4 Admin

The textarea goes in `QuestionCard.jsx` beside the alt-text field (`:65-71`), same shape: a label, the live `{n}/500`
counter, and the 500-char cap enforced in `validateQuestion()` (`:131-134`) as well as by the column's own `check`.

The per-quiz toggle goes into `GAME_OPTION_ROWS` at `AdminQuizEditor.jsx:32-37`, beside Streak bonus, Power-ups and
Comeback boost — it is the same shape of setting, in the same place, with the same hint string.

The CSV round trip is already there and needs a test, not a rewrite (`quizCsv.js:12,111,170`). The CSV column
header stays `explanation` so existing files keep working.

---

## 6. WhatsApp-first sharing

### 6.1 The handler

`api/_lib/handlers/og.js` returns **`text/html`**, not JSON. No auth. It dispatches on the path it was rewritten
from:

| Rewritten path | Preview | `og:image` |
|---|---|---|
| `/api/og?type=join` | "A live quiz is waiting" | static branded card |
| `/api/og?type=result&session=<uuid>` | that session's finished board | `/api/quiz-card` board render |
| `/api/og?type=battle&code=XXXXXX` | "A 7-day battle challenge is waiting" | static |
| anything else | falls through to `index.html` | — |

Registered as `'og'` in the `ACTIONS` map (`api/system.js:9-15`) and reachable via a `vercel.json` rewrite beside
the other `/api/` rewrites. The SPA catch-all `/((?!api/).*)` (`:35-38`) already excludes `/api/`, so no ordering
concern.

### 6.2 Two things that go wrong if they are skipped

**Escaping.** A quiz title is admin-authored and lands inside `<meta content="…">`. Unescaped, `/api/og` is a
reflected-XSS sink with a public URL. The handler escapes `&`, `<`, `>`, `"` and `'` in every interpolated field,
and the test asserts it with a title containing `<script>`.

**Caching.** WhatsApp refetches aggressively. `Cache-Control: public, max-age=300` or every preview cold-starts a
serverless handler, which is how a share feature becomes the reason a game feels slow.

### 6.3 Why the join preview is generic

A join code lives in `quiz_sessions.join_code`, a column anon can already select (`:85-86`), so resolving it is
technically trivial and it is still the wrong call: the code is the only thing standing between "someone has my
quiz" and "the whole lecture hall is in my quiz". A preview is generated from a URL that is by definition already in
someone's hands, so it needs to disclose nothing. The invite is the code; the preview says a quiz exists.

Result links are different. A finished board is what the player is already sharing as a PNG, and the player chooses
to share it.

### 6.4 Client

`src/lib/shareCard.js` gains `shareUrl()`. The WhatsApp-first part is the **fallback**: `navigator.share` is absent
on most Android browsers in practice, so when it is missing the share target is
`https://wa.me/?text=<encoded url + title>`. The card modal keeps its file share for tablets; the link share is the
one that reaches a phone.

- `HostQuiz.jsx:154-169` — a Share button beside the QR, copying the same `?code=` URL.
- `ResultCardModal.jsx` — "Share link" beside Share and Save.
- `src/lib/quizCard.js:6-20` — a URL builder alongside the existing image builders.
- `index.html` — baseline `og:` and `twitter:` tags, so every *non-quiz* link stops previewing as bare
  "NAMMES Hub". This is a two-line change with more reach than the rest of the feature.

### 6.5 The cold-start tradeoff

`vercel.json:88` gives `api/system.js` `includeFiles` covering `scripts/manual/**` and `api/_lib/fonts/**`, so every
preview request pays a bundle built for the handbook PDF. That is exactly what `calendar-reminders` already pays, so
this is not a new cost — it is the established one.

The spare 13th slot is deliberately left spare. If previews come back measurably slow, moving `og` to a dedicated
20-line function is a one-entry change that costs nothing else. Recorded here so the decision is a measurement
rather than a second guess.

---

## 7. Low-data mode

### 7.1 Two problems, two fixes

**(a) First load.** 263 KB gzipped before the join code appears. Only a separate route fixes this — a toggle cannot
un-download fonts that have already arrived.

**(b) During play.** A 4-second poll re-downloading the state payload, and a backdrop plus up to 62 SVG characters
redrawn each time. A toggle fixes this on every device, including the ones already on the fast route.

### 7.2 The toggle

`src/data/lowData.js`, persisted under `nammes-low-data`.

- Poll 4000 → 8000 ms (`PlayQuiz.jsx:27,353`); host answer poll 1500 → 2500 (`HostQuiz.jsx:1035-1054`).
- Skip `QuizBackdrop` and `Character` for a flat surface. This is what takes `quizCharacterArt.js` (1201 lines of
  SVG strings) and `QuizParts` (26 KB) off the critical path.
- Send `low: 1` on the existing `state` POST; the server omits `explanation` (§5.3) and can trim `nextImageUrl`
  (`:174`) if the next question has no picture.

### 7.3 Rejoin

Token moves from `sessionStorage` to `localStorage`, keyed per session so finished games can be pruned from the
client too.

The schema half is the partial index (§4.2). The handler half is in `quiz-join.js:74-83`: a `409` must attempt
**resume** — if the submitted token hashes to the existing row's `token_hash`, return that player's id, score and
streak — and only error when the token does not match. Otherwise durable storage is bought and never spent.

The try/catch at `PlayQuiz.jsx:43` stays, but note the risk window widens: in private mode a `localStorage` write
can throw, and it now has to survive longer to do any good.

`PlayQuiz.jsx:328-348` gains exponential backoff to 30 s and re-arms the realtime channel on `online`.
`src/lib/useOnlineStatus.js` (129 lines) already exists and is only used by `ErrorBoundary.jsx:5,73`; the quiz gets
its first real consumer.

Fixing in passing: `PlayQuiz.jsx:758` passes a `scoring` prop that `TeamList` (`:264`) never destructures, so the
average-vs-total label is silently dropped on phones today.

### 7.4 `/play/low`

`src/pages/PlayLow.jsx` — no Router chrome, no backdrop, no characters, no look system, no webfonts beyond the
system stack. It calls the same `callQuiz` API, so it works against any session regardless of the quiz's look.

**Target under 60 KB gzipped, against `/play`'s 263 KB. Measure it; do not assume it.**

It supports `text`, `numeric` (with units), `truefalse`, `order` **and `diagram`**. I had recommended excluding
diagrams and that was wrong: the tap is an `<img>`, one `onClick` and one `getBoundingClientRect()`, and the
expensive parts it would have dragged along — the fullscreen zoom overlay (`PlayQuiz.jsx:701-704`), the backdrop,
the characters — are already skipped for unrelated reasons. Excluding it would leave a student who needs to save
data stuck on a question they cannot answer, and there is no graceful fallback for "this question needs an image".

What actually costs on a low route is **bytes, not JavaScript**, and that is §8.4.

### 7.5 Why no service worker

A service worker needs a cache manifest, a version strategy, an eviction story and a first-load story — and its
first-load story is the one that does not help here, because the first load is exactly what §7.4 attacks with a
route instead. A half-built service worker on a bad network is worse than none: it serves a stale bundle and
produces a bug nobody can reproduce. If low-data mode proves out, that is the next spec.

---

## 8. Engineering question types

### 8.0 The type list, first

Five copies of the question-type list exist today and a sixth field would be added to all five by hand:

| File | Line |
|---|---|
| `api/_lib/quizGrading.js` | `:5` |
| `api/_lib/quizCustom.js` | `:23` (4 of 5 — no `poll`) |
| `src/data/quizQuestions.js` | `:28-34` |
| `src/components/admin/cbt/ExamEditor.jsx` | `:16` (4 — no `poll`) |
| `src/data/quizCsv.js` | `:71-77` (import aliases) |

Three new types across five hand-synced lists is where a type ends up supported on the projector and silently
dropped for a community set. This phase creates `api/_lib/quizTypes.js` as the single pure source, has all five
read it, and adds a test asserting they agree — the same shape as the `STYLES`/`THEME_MUSIC` pair that
`quizSound.test.js` already keeps in step.

It is pure, so it obeys the `api/_lib` rule: no `window`, no Supabase client, no Node built-ins, importable from
both the serverless handlers and the browser pages.

### 8.1 Units

Parsing and normalisation are pure functions in `quizGrading.js`:

- Normalise a typed unit: lowercase, strip spaces, hyphens, underscores and dots, map `μ` → `u`, `µ` → `u`,
  `³` → `3`, `²` → `2`, `−` → `-`.
- Compare against the normalised canonical unit plus every normalised alias.
- If the question declares no `numeric_unit`, ignore whatever unit was typed and grade the number.

`N` must never match `kN`. That is the single most important assertion in the unit tests, and it is the reason the
alias list is per-question rather than a global unit registry: a global registry is where `N` and `kN` eventually
merge, and §2.2 is the reason that would be a bug.

### 8.2 Ordering

- `options text[]` holds the steps in authored order. Presented shuffled via the existing `optionOrder`
  (`quiz-state.js:126`).
- The phone sends the sequence of canonical indices tapped: `[2, 0, 3, 1]`.
- `credit = (positions where answer[i] === i) / n`. `correct` stays `credit === 1`.
- Points scale by `credit` **before** the existing machinery runs, so `computeAward()` (`quizGrading.js:99-107`)
  still applies speed, streak, comeback and multiplier to the awarded figure.
- `points_multiplier` is `check (in (1, 2))` (`20261001110000:11`) and `points_awarded` is `integer`. A third of a
  question at 2× does not divide evenly, so `computeAward` rounds **explicitly** and the test asserts the
  rounding rather than tolerating whatever it produces.
- The reveal gets its own branch in `out.reveal` — it has to say *"4 of 6 steps in the right place"*, which is what
  `credit` is for.

### 8.3 Diagram

- `diagram_targets` is `[{x, y, r}]`, normalised against the image's own box, `r` as a fraction of
  `min(width, height)`.
- **Normalised, not pixels.** `processQuizImage` downscales to `IMAGE_MAX_EDGE = 1280` (`src/lib/quizImage.js:6,36`),
  so a stored pixel coordinate does not survive the admin re-uploading the same picture at a different size.
  0..1 survives it.
- **The letterbox is the trap.** The phone renders the picture at `max-h-40` (`PlayQuiz.jsx:621-624`) inside a zoom
  overlay (`:701-704`), so the rendered box is not the image box. A tap must map through the `object-contain`
  letterbox on both the authoring surface and the phone, or a marker grades wrong on every handset while looking
  perfectly placed in the editor.
- Authoring: marker placement inside the existing `ImagePicker` (`QuestionCard.jsx:21-98`, which already handles
  file, drag-drop and paste). Click to place, drag to size.
- Grading: distance from the tap to any target, within that target's `r`. Correct if any matches.

### 8.4 The image-size derivative

The low route's real cost is a 2 MB webp on a 2 G connection. Two ways to fix it:

- **Supabase's storage image transform** (`?width=640` on the public object URL). Elegant, but it depends on the
  project's plan tier, which is not verifiable from the repo.
- **An upload-time derivative.** `processQuizImage` (`src/lib/quizImage.js:27-51`) already has a canvas and a
  re-encode loop, so a second 640 px webp is close to free.

Recommend the **derivative**, for the one reason that matters: no plan dependency, so it works whatever the tier
turns out to be.

It is not free. `api/_lib/quizImage.js:10`'s `PATH` regex and the DB CHECK at `20261001100000:49-51` both reject
`-sm.webp` today, and `isQuizImagePath` is a shared security validator that three buckets and the quiz look presets
depend on. Regex, constraint and both rollback files move together or not at all.

It is sequenced **after** the tap works. A student on a slow connection can see a large diagram and tap it; they
wait longer. They cannot tap a diagram that never arrived.

### 8.5 CBT

`order` and units work in CBT and are included — `QuestionView.jsx` already has a typed-input branch (`:49-71`).

**`diagram` is excluded from CBT**, mirroring the existing `poll` exclusion (`cbt.js:52`, `quiz-cbt.js:57`),
because CBT's question view renders no images at all. Adding images to the exam engine is scope creep, and the
exclusion is a filter the codebase already knows how to write.

CBT needs no DDL: `cbt_attempts.answers` is jsonb (`cbt_exams.sql:106-107`), so `order` and a unit string are one
more key.

### 8.6 Surfaces to update

| Surface | Lines | Branch |
|---|---|---|
| `src/pages/HostQuiz.jsx` | `:407-430` | projector choice vs typed — needs an order panel and a diagram panel |
| `src/pages/PlayQuiz.jsx` | `:652-699` | phone choice vs typed |
| `src/pages/PlayPractice.jsx` | `:413,456` | practice |
| `src/pages/PlayBattle.jsx` | `:333,368` | battle |
| `src/components/cbt/QuestionView.jsx` | `:9` | CBT, order + units only |

`MathText` already exists and is what renders a technical stem, so nothing new is needed for notation.

---

## 9. Tests

| Test | Asserts |
|---|---|
| `api/_lib/quizTypes.test.js` (new) | **all five type lists agree**, and every type has a label, a hint and a CSV alias |
| `api/_lib/quizGrading.test.js` | `kN` matches `kN`, `KN`, `kiloNewton`, `kilo-newton`; **`N` does not match `kN`**; a unitless question ignores a typed unit; `2500 N` is wrong against `2.5 kN` |
| `api/_lib/quizGrading.test.js` | order partial credit: 6 steps with 1 wrong scores 5/6 and is `correct: false`; 2× on an odd fraction rounds the documented way |
| `api/_lib/quizGrading.test.js` | diagram: inside the radius is correct, outside every radius is not; the letterbox mapping round-trips through the authoring box and the phone box |
| `api/_lib/handlers/quiz-state.test.js` | `explanation` is **absent** while `state === 'question'`, **absent** when `show_explanations` is false, present otherwise |
| `api/_lib/handlers/quiz-state.test.js` | `low: 1` omits `explanation`; `diagram_targets` reaches a phone only for `type = 'diagram'` |
| `api/_lib/og.test.js` (new) | HTML escaping of a title containing `<script>`; `text/html` not JSON; unknown types fall through to `index.html`; `Cache-Control` present; no auth path |
| `api/_lib/quizImage.test.js` (updated) | the derivative path passes `isQuizImagePath`, and a path that does not still fails it |
| `src/components/admin/quizEditor/QuestionCard.test.jsx` (updated) | the explanation field saves, is capped at 500 and survives a type change |
| `src/data/quizQuestions.test.js` (updated) | `explanation` and the two new numeric columns round-trip, **including a CSV export/import round trip** |
| `src/lib/quizClient.test.js` (new) | a token in `localStorage` is resumed on reload and pruned once the game is finished |
| source scan (new) | every type in `quizTypes.js` appears in the reveal renderer, the phone renderer **and** the CBT allow-list — the `index.css` keyframe scan's sibling |

Two assertions will **fail on the first run** and are updated rather than avoided: the exact-shape assertions on the
question row and the type-list agreement test. That is the correct outcome — the shape is what is changing.

---

## 10. Risks

- **Unverified without a real session, and that covers most of this.** Whether an explanation reads well in ten
  seconds on a projector, whether a WhatsApp preview survives a cold start, whether `/play/low` loads in a sane time
  on 2 G, and whether a tap on a stress-strain curve lands where the editor said it would, all need a Supabase
  login, two physical phones and a metered connection. Tests prove the code path; they cannot prove a projector or
  a network. Per AGENTS.md this will be stated plainly rather than implied away.
- **The letterbox is a silent grading bug.** Get §8.3 wrong and every diagram question grades wrong on every phone
  while looking correct in the editor. There is no user report for this, only a quietly wrong score. The
  round-trip test is the mitigation and it has to actually exercise both boxes.
- **`order` is the first type whose score is not 0 or full.** It touches `computeAward`, the three record RPCs and
  every reveal that assumed a single correct answer. The `credit` column is what keeps that contained, but it is
  the widest blast radius in this spec.
- **Adding three types to five hand-synced lists is the obvious way to break something quietly** — a type supported
  on the projector and dropped for a community set. §8.0 is not optional groundwork; the agreement test is what
  makes the next type safe.
- **Deleting sessions is the one irreversible thing here.** 90 days is chosen so the CSV export and the admin report
  still work. Ship the dry-run count first and look at it.
- **`localStorage` widens the private-mode failure window.** `PlayQuiz.jsx:43` already catches a `sessionStorage`
  write failing; a `localStorage` one has to survive longer to be worth anything. The catch stays, but low-data mode
  on a private-mode browser is a path with no test.
- **`/play/low` is a second player client.** Every fix to the game state machine, every question type and every
  server payload change now has two consumers. This is the ongoing cost of the biggest single win in the spec, and
  it is a cost that recurs forever rather than once.

---

## 11. Delivery order

Each step leaves `npm test` green.

1. **`api/_lib/quizTypes.js`** + the agreement test. Nothing else can safely add a type first. §8.0
2. **Explanations** — migration, `quiz-state.js` gate, `HostQuiz.jsx`, `PlayQuiz.jsx`, practice, battle,
   `QuestionCard.jsx` textarea, `AdminQuizEditor.jsx` toggle, CSV round-trip test. §5
3. **Sharing** — `api/_lib/handlers/og.js`, the `ACTIONS` entry, the `vercel.json` rewrite, `shareUrl()`, the two
   Share buttons, baseline tags in `index.html`, `og.test.js`. §6
4. **Rejoin** — migration, `quiz-join.js` resume, `localStorage`, backoff, and `quiz_session_cleanup()` with its
   dry-run count. §7.3 and §4.3
5. **Low-data toggle** — `lowData.js`, the poll changes, the visual skips, the `low` payload flag. §7.2
6. **Engineering types** — units, then `order`, then `diagram`. Units first because they are additive to an existing
   type; `order` is the widest and goes when everything else is proven. §8
7. **`/play/low`** — after 6, so it is written once against the final type set rather than twice. §7.4
8. **AGENTS.md** — the `api/_lib` server-only list if it changes, the rejoin note, and the type-list rule that
   makes §8.0's test the reason it exists.
