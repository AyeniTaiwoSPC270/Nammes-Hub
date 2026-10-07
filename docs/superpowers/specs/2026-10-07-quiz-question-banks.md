# Live quiz: question banks (spec)

Status: built. Generalises the draw-and-shuffle rules that CBT exams already use (`2026-10-01-cbt-exam-mode.md`) to the
three modes that have none. Follows `2026-10-01-quiz-battle-mode.md` (built) and `2026-09-30-live-quiz-premium-features.md`.
Section 14 records what differs from the plan.

A quiz's questions become a **bank**. The admin says how many questions a game asks from that bank, and whether the
questions and their answers are shuffled. Today each of the three modes decides this for itself, and none of them asks
the admin.

| Mode | Questions asked today | Admin can change it? |
|---|---|---|
| Live hosted game | Every question, in `position` order | No |
| Battle | Exactly 10, hardcoded, then re-sorted into `position` order | No |
| Practice | Every non-poll question, in `position` order | No |
| CBT exam | A drawn count, both shuffles available | Yes (already built) |

## 1. Principles

- **One bank, one setting, three modes.** A hosted game, a battle and a practice run off the same quiz all obey the same
  rules, so an admin learns it once. CBT exams and community sets are untouched: they already have their own settings and
  their own makers.
- **A game freezes its questions when it starts.** The draw happens once, at the start of a hosted game, a battle or a
  practice run, and the resulting ids and answer orders are written onto that session. Editing the quiz afterwards never
  changes a game already running — the same rule `theme` already follows.
- **The server is the referee.** Drawing, shuffling and answer remapping all happen on the server. A phone is sent the
  options in the order it will show them and never the answer key.
- **Stored answers keep original option positions.** Only the wire format changes. Nothing already stored has to be
  rewritten, and the reveal never depends on reconstructing an order.
- **Old behaviour is the default.** A quiz with no settings asks every question, in order, with answers as typed. Nothing
  changes until an admin asks for it.
- **Reuse, do not copy.** The draw, the shuffle and the order-dependence guard already exist in `api/_lib/cbt.js`. They
  move to a shared module; CBT re-exports them unchanged.

## 2. What an admin sets

A new **Question bank** fieldset in the quiz editor, above the question list:

| Control | Meaning | Default for a new quiz |
|---|---|---|
| **Questions to ask** | How many to draw from the bank. Blank = all of them. | Blank (all) |
| **Shuffle the questions** | Play them in random order rather than in the order written. | On |
| **Shuffle the answers** | Show each question's options in random order. | On |
| **Questions per battle** | Battle length, when it should differ. Blank = the same as *Questions to ask*. | Blank |

A live line reads back what will actually happen: *"This game will ask 15 of 30 questions."* A count larger than the bank
clamps to the bank size, as CBT already does.

Per question, a **Keep answers in this order** checkbox in `QuestionCard.jsx`. The `no_shuffle` column already exists in
the database and is written by CBT; this is simply surfacing it on the main path, because questions whose options only make
sense in a fixed order need an escape hatch the text detection might not catch. `blankQuestion`, `questionFromRow`,
`cleanQuestion` and `saveQuiz`'s row builder all have to carry it, and `QuestionBankModal` should copy it across quizzes.

## 3. Drawing and shuffling

New pure module `api/_lib/quizDraw.js`. `shuffled`, `keepsOptionOrder` and the order-dependence regex move here from
`cbt.js`, which re-exports them so CBT and its tests are untouched.

```js
cleanDrawSettings(source, bankSize)        // -> { drawCount, shuffleQuestions, shuffleOptions }
buildQuestionSet(bank, settings, rand)     // -> { questionIds, optionOrders }
```

`optionOrders[id][i]` is the original position of the answer shown at `i`, exactly as `cbt.js:68` already defines it.
`buildQuestionSet` is `cbt.buildAttempt` with the exam-only fields removed.

Answer order is never shuffled when the question is not a multiple choice, when the row sets `no_shuffle`, or when any
option matches the order-dependent pattern ("All of the above" and friends, `cbt.js:11`).

Battle length resolves as `battle_question_count ?? draw_count`, clamped to 50.

## 4. Data (migration, additive, with rollback)

```sql
alter table public.quizzes
  add column draw_settings jsonb check (draw_settings is null or jsonb_typeof(draw_settings) = 'object'),
  add column battle_question_count integer check (battle_question_count is null or battle_question_count between 1 and 50);

alter table public.quiz_sessions      add column question_ids uuid[], add column option_orders jsonb check (option_orders is null or jsonb_typeof(option_orders) = 'object');
alter table public.quiz_battles       add column option_orders jsonb check (option_orders is null or jsonb_typeof(option_orders) = 'object');
alter table public.quiz_practice_runs add column question_ids uuid[], add column option_orders jsonb check (option_orders is null or jsonb_typeof(option_orders) = 'object');

alter table public.quiz_battles drop constraint quiz_battles_question_ids_check;
alter table public.quiz_battles add constraint quiz_battles_question_ids_check check (cardinality(question_ids) between 1 and 50);
```

`draw_settings` holds `{ draw_count, shuffle_questions, shuffle_options }`. `quizzes.game_options` is left alone: it is
copied onto every session and read by phones on every poll, and question selection has no business in it.

The last two statements widen the battle ceiling, which today reads 12 in the schema, 10 in `BATTLE_MAX_QUESTIONS`, and 10
again as an unrelated literal at `quiz-battle.js:368`. Three numbers for one thing; this makes it one constant.

## 5. Live hosted games

The hard part. A hosted game has no frozen question list: it looks the current question up by
`.eq('position', session.current_question_index)` and re-counts rows to decide when the game ends. It structurally cannot
draw a subset. It also means **editing a quiz mid-game silently changes the number of questions**, which goes away as a
side effect.

`quiz-create.js` builds the set and writes `question_ids` + `option_orders` onto the session, next to the existing `theme`
snapshot.

New `api/_lib/quizSessionQuestions.js`:

```js
sessionQuestionIds(db, session)   // the frozen list, else the quiz's own position order
currentQuestion(db, session)      // one question, by index
sessionQuestions(db, session)     // the rows, in play order
optionOrderFor(session, id)       // null means identity: answers as typed
```

When `question_ids` is null the helper falls back to `position`, which is what keeps sessions created before the migration
working untouched. That path uses the single-position query rather than listing every question, so a phone polling an old
session costs no more than it does today.

Every position-based lookup moves over: `quiz-state.js:53,99,166`, `quiz-answer.js:59`, `quiz-powerup.js:54`,
`quiz-advance.js:47`, `quiz-host.js:140,198,279`, `quizBracketEngine.js:13,37`, `HostQuiz.jsx:948`.

### Answer remapping

- `quiz-state.js` sends `order.map(i => options[i])`, and reports `chosenIndex: order.indexOf(stored)` and
  `reveal.correctIndex: order.indexOf(question.correct_index)`.
- `quiz-answer.js` reuses `cbt.readAnswer` to turn the position the player tapped into the original position, then grades
  with `gradeAnswer` as before.
- The 50/50 power-up stays in original-index space in both handlers, so the option it hides on the phone is the one it
  refuses on submit (`quiz-answer.js:91`). It is mapped into shown positions only when it is sent out.

> ⚠️ **The projector has to apply the same order.** `HostQuiz.jsx` reads questions straight from Supabase rather than
> through `quiz-state`. If it ignores `option_orders`, the phones and the big screen show different buttons for the same
> answers. This is the single easiest mistake in the change, and the test suite cannot see it.

### The admin report

`fetchGameReport` (`src/data/quiz.js:388`) loads **every** question in the quiz ordered by `position`, and
`quizReport.js:82` takes its `questionCount` from that row count. Once a game draws 15 of 30 the report would list 30
questions including 15 nobody was asked, and "hardest question" could pick an unasked one.

`fetchGameReport` reads `session.question_ids` when present and orders by it, falling back to `position` for sessions
created before the migration.

## 6. Battles

`BATTLE_MAX_QUESTIONS` goes to 50. `pickBattleQuestions` delegates to `buildQuestionSet` with a `rand` seeded from the
battle seed, so a rematch gets a fresh mix while both sides still get the same one — the ids are frozen on the battle, so
agreement is free. `quiz-battle.js:368`'s literal `10` is deleted; the picker shows the real count.

`option_orders` is written on the battle and applied in `questionView` and `resultFor`, with `record` mapping the submitted
index back. Polls stay excluded, as they are today.

## 7. Practice

`quiz-practice.js` builds the set in its `start` op (`quiz-practice.js:284`, where the run row is inserted) and writes it
onto `quiz_practice_runs`, then derives its in-memory question array from that. The race and ghost logic at
`quiz-practice.js:80` already walks that array, so it follows for free. Polls stay excluded.

The `info` op, which feeds the intro screen's "N questions" (`quizPractice.test.js:37`), must report the **drawn** count
rather than the bank size.

## 8. The bracket and drawn counts

A bracket needs `ceil(log2(players))` rounds of `length` questions to get from N players down to one, and `bracketRounds`
silently caps at `floor(drawn / length)`. With the whole bank as the count that was generous. With a draw count it is not.

Take 8 players, a game that draws 10 questions, matches of 5: `rounds = min(3, 2) = 2`. The bracket runs 8 → 4 → 2, stops,
and `quizBracketEngine.js:74-76` crowns whoever had the highest total score across the whole game. A knockout bracket that
never produces a winner by elimination. The lobby panel reports "2 rounds (10 of the quiz's 10 questions)" and looks
perfectly healthy.

Two guards exist and neither catches this: `quiz-host.js:199` only refuses a match longer than the whole quiz, and
`BracketParts.jsx:182` only reports when rounds hits zero.

Fix: `BracketPanel` already receives `playerCount` and `questionCount`, and after this change the latter is the drawn count.
The match-length dropdown offers only sizes where the bracket can actually reach one winner, and the toggle is disabled
with a plain explanation when none fit. `quiz-host.js:199` is tightened to the same rule rather than `questionCount < size`.

A side effect worth naming: bracket rounds are now a random slice of the bank rather than the first N questions. That is
fairer — no round is systematically easier — but it means bracket fairness now rests on the draw being uniform.

## 9. The battle ladder

Elo's step size is a fixed `RATING_K = 32`, so a two-question lucky win and a fifty-question dominant win are worth the
same. That was tolerable when every battle was exactly ten questions. It is not, now that length is the admin's choice.

Elo's expected-score maths is **not touched**. A battle's worth becomes a function of two things the server already knows:

```
trust    = sqrt(n / 10)                                  // 10 was the old fixed battle length
decisive = min(1, |gap|) ** 0.5                          // gap = (winner - loser) / pointsAvailable
weight   = trust * (0.25 + 0.75 * decisive)
```

`pointsAvailable` is the sum of `battleQuestionPoints(q, 0)` over the questions asked, available in `finish()`.

The policy and the arithmetic stay in separate functions, so `eloUpdate` remains plain Elo with one extra scalar:

```js
export function battleWeight({ questions, totalA, totalB })            // the policy
export function eloUpdate(ratingA, ratingB, winner, weight = 1)        // Elo, unchanged apart from the scalar
```

`weight` defaults to 1, so `eloUpdate` keeps today's exact behaviour and its existing test passes untouched.

Rating change against an equal-rated opponent, where every one of these is **±16 today**:

| Battle | narrow win | blowout |
|---|---|---|
| 2 questions | ±3 | ±7 |
| 10 questions *(today's length)* | ±8 | ±15 |
| 50 questions | ±17 | ±34 |

A draw between equals stays at 0 in every case, because `weight` only scales `scoreA - expectedA`, which is already 0
there. Three constants, each with an obvious meaning, tunable once real battles come in.

`wins`, `losses` and `draws` are display counters and stay as they are. Bots and self-battles still never count, and
home-made quizzes still never count. Existing ratings stay valid, because a ten-question battle still behaves as it does.

**Known limitation, stated plainly.** `trust` grows with battle length, which is a judgement call rather than a derivation.
In strict Bayesian terms a confident player's step should *shrink* as evidence grows (`1/n`, or a dynamic uncertainty as in
TrueSkill). Growing it instead is what FIDE does for blitz and is defensible for that reason, but it is a tuning decision,
not a theorem. TrueSkill is the principled answer and is deliberately **not** part of this work: it means a per-player
deviation column, its own module, and a decision about the ratings already stored.

## 10. Testing

New unit tests, `quizDraw.test.js`: draw count clamps to the bank, blank means the whole bank, a seeded build is repeatable
and a different seed is not, `no_shuffle` and order-dependent options survive, non-choice questions keep their order, and
the battle weight table above as exact expected values.

New unit tests, `quizSessionQuestions.test.js`: a session with `question_ids` uses it, one without falls back to `position`
order, `optionOrderFor` returns identity for a missing order.

Handler tests with the in-memory database: a created session carries its ids and orders, a phone's submitted index is
stored in original positions, a reveal reports the position it displayed, 50/50 still hides and refuses the same option, a
bracket refuses a length that cannot finish, the report lists only the questions asked, the practice intro counts the
drawn set.

### Tests that pin today's behaviour

Five will fail or need rewriting:

| Test | Pins |
|---|---|
| `quizBattle.test.js:29` | "at most 10" |
| `quizBattle.test.js:33` | chosen questions come back in `position` order |
| `quizPractice.test.js:87` | "walks through **every** playable question" |
| `quizBracket.test.js:239` | "refuses ... a quiz that is too short" |
| `quizBracket.test.js:205` | "a game whose quiz is too short for a bracket just plays normally" |

The two bracket ones still describe correct behaviour, just against the new rule. `quizBattle.test.js:33` stays green only
because existing quizzes have `shuffle_questions` off; it needs a companion case for the shuffled path.

`npm test`, `npm run lint`, `npm run build`.

**Not verifiable here.** A shuffle mismatch between the projector and the phones is invisible to every test above. This
needs a Supabase login and at least one real game with answer shuffling on, before any of it is called done.

## 11. Build order

1. Migration, `quizDraw.js`, `quizSessionQuestions.js` and their tests. No behaviour change.
2. The editor: `BankSettings.jsx`, the per-question checkbox, `saveQuiz` and `duplicateQuiz`.
3. Live hosted games, including the projector and the admin report.
4. Battles, including the ladder.
5. Practice, including the intro count.
6. Bracket guard and lobby panel.
7. Copy, the player manual, this spec.

Phases 3 to 6 are one pull request each. Phases 1 and 2 are safe to land on their own.

## 12. Decisions taken

- **Modes:** live hosted games, battles and practice. CBT exams and community sets keep their own settings.
- **Battle ceiling:** 50.
- **Answer shuffling:** everywhere, including live games.
- **Battle length:** its own setting, defaulting to the quiz's question count.
- **New quiz defaults:** both shuffles on, question count blank (all). Existing quizzes unchanged.
- **Bracket:** only offer match lengths that can finish.
- **Per-question escape hatch:** a "Keep answers in this order" checkbox on the main path.
- **Ladder:** the tuned formula, with TrueSkill as separate later work.

## 13. Copy that has to change together

- `AdminQuizEditor.jsx:185` — "Each battle uses up to 10 of the quiz's questions."
- `scripts/manual/content-quiz.mjs:89` — "Answer a set of up to 10 questions."
- `docs/superpowers/specs/2026-10-01-quiz-battle-mode.md:141-142,153` — records the old 10-question rule as history; leave
  it, it describes what was built.

## 14. As built

All eight phases are implemented. Migration `20261007120000_quiz_question_draw`, with its rollback beside it. Differences
from the plan above, and what they taught:

- **Two opposite defaults for shuffling, on purpose.** `cleanDrawSettings` reads a shuffle as on only when the stored
  value is exactly `true`, so a quiz saved before this feature keeps playing every question in order with its answers as
  written. The editor writes an explicit `true` for a new quiz. CBT's own `cleanCbtSettings` keeps its `!== false`
  default, because exams were always opt-in to shuffling. `BankSettings.test.jsx` has a test named for the failure mode,
  so a later "tidying" of that `=== true` fails loudly instead of silently shuffling every existing quiz overnight.
- **The battle ceiling was one number in three places.** The schema said 12, `BATTLE_MAX_QUESTIONS` said 10, and an
  unrelated literal in the battle handler said 10 again. All three now read from the one constant, and `battleQuestionCount`
  is the single place that resolves a battle's length, which the quiz picker and the battle itself both call.
- **`Number(null)` is 0, and 0 is in range.** The first version of `battleQuestionCount` passed the admin's blank straight
  into `clampInt`, so every battle with no explicit length became one question long. Blanks and nulls are now checked
  before any arithmetic.
- **The bracket needed the question rows, not only their ids.** `settleRound` scores bots on the round's questions, so it
  needs the rows; the first rewrite fetched ids only and would have made every bot lose its matches.
- **`questionCount` was the wrong test for a bracket.** The old guard asked whether there was a match worth having. The
  question is whether the bracket gets down to one player: 8 players drawing 10 questions with matches of 5 runs
  8 → 4 → 2, runs out, and quietly crowns the highest overall scorer. The guard is now `fitsBracketLength`, and the lobby
  only offers lengths that pass it.
- **`cleanDrawSettings(_, 0)` returns 1, not 0.** The public practice list used `count > 0` as its emptiness test, which
  then listed quizzes with nothing to play. The bank length is checked instead.
- **`no_shuffle` is only stored for multiple choice.** It means nothing for the other types, and `keepsOptionOrder`
  already refuses to shuffle them.
- **Five tests pinned the old behaviour** and were rewritten against the new rule rather than loosened:
  `quizBattle.test.js` (the "at most 10" subset), `quizPractice.test.js` ("walks through every playable question"),
  `quizBracket.test.js` (both "too short" cases), and the two ranking assertions in `quizBattleHandler.test.js` that
  expected exactly 1016. Those last two now assert the properties that matter (winner above 1000, loser below, equal
  movement, strictly less than the old flat step) rather than a magic number.
- **Not verifiable without a real game.** A shuffle mismatch between the projector and the phones cannot be seen by any
  test here. `HostQuiz.jsx` applies the same order the API does (`shownQuestion`), and the stored answers are mapped back
  with `shownAnswer`, but only a real game with answer shuffling on confirms it.

Tests: `quizDraw.test.js`, `quizSessionQuestions.test.js`, `quizDrawLive.test.js`, `quizBattleWeight.test.js`,
`quizPracticeDraw.test.js` and `BankSettings.test.jsx` are new; five existing suites were extended. `npm test`,
`npm run lint` and `npm run build` all pass.