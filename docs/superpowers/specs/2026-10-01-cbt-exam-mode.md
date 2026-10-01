# CBT practice exams (spec)

Status: draft for approval. Nothing is built yet.

## 1. What this is

A separate **CBT practice** tool inside NAMMES Hub. It is not a quiz and should not look or feel like one. A student picks a course, takes a timed, exam-style paper in the same way a year-1 CBT works, submits, and sees a score and a review. Anyone can use it, with no account.

Two sources of papers:

1. **Course exams** uploaded by admins, organised by level and course code (e.g. 100 Level, MTH 101).
2. **Personal exams** that any student makes from their own pasted past questions (today's `/make` community sets, upgraded for exam use).

Decisions already made with the owner:

| Question | Decision |
| --- | --- |
| Who can take admin exams | Anyone, no account |
| How papers are built | Question bank with a random draw per attempt (admin can also set a fixed paper, see 4.2) |
| How students find exams | Level, then course code, plus search by course code |
| What students see after | Score and review of wrong answers; history on their device; admin stats per exam. No public leaderboard |

Non-goals: proctoring, anti-cheating beyond server-side grading, accounts, payments, live/hosted exams (those stay in the quiz feature), leaderboards.

## 2. Student experience

### 2.1 Entry points
- New top-menu link **CBT practice** at `/cbt` (beside Quizzes). The `/quiz` hub also gets a card pointing to it.
- `/cbt` shows: search box (course code or title), level tabs (100 / 200 / 300 / 400 / 500 / Other), a list of courses with exam count, and a link **"Make your own practice exam"** (goes to the existing `/make`).
- `/cbt/:examCode` is the exam's start page.

### 2.2 Start page
Shows course code and title, number of questions per attempt, time allowed, pass mark, "answers are shown only after you submit", and the student's previous attempts on this exam from their device (best score, last score). Button **Start exam**. Optional student choice: **Exam mode** (default) or **Study mode** (see 2.5).

### 2.3 The exam screen (CBT-like)
- Calm, plain layout. No game styling, no points, no sounds, no streak.
- Header: course code, a **countdown timer** for the whole paper (turns amber at 10 minutes and red at 1 minute left), and a **Submit** button.
- Question area: question number, text (maths rendered with the existing `MathText`), the options, one selected at a time. Typed and numeric questions show an input.
- **Question navigator**: a grid of numbered buttons. States: not answered, answered, flagged. Tapping jumps to that question. On phones the grid opens as a drawer.
- Buttons: **Previous**, **Next**, **Flag for review**, **Clear answer**.
- Answers can be changed freely until submit. There is no feedback while the exam is running.
- Autosave: the attempt is saved on the server on every answer (debounced), and the attempt token is kept in the browser, so a refresh, lost signal or closed tab resumes with the same questions, answers, and the same clock.
- **Submit** opens a confirmation: "You answered X of N. Y flagged. Z unanswered. Submit now?" with Review / Submit.
- When the timer reaches zero the exam submits itself with whatever is saved.

### 2.4 Results screen
- Score (e.g. 31 / 40, 77.5%), pass or fail against the pass mark, time used.
- Review list: every question with the student's answer, the correct answer, and the admin's optional explanation. Filter: All / Wrong / Unanswered / Flagged.
- Buttons: **Retake** (a fresh random draw if the exam uses a bank), **Back to course**, **Share result** (text only, no names).
- Result is added to the device history.

### 2.5 Study mode (optional, same screen)
Same paper, but the student sees the answer after each question and there is no timer. Study attempts are not counted in admin stats and are labelled in device history. This lets one upload serve both learning and exam practice.

### 2.6 Device history
Kept in `localStorage` under a new key (`nammes-cbt-history`), capped (e.g. last 50 attempts). Per exam: attempts with date, score, time, mode. A "My progress" panel on `/cbt` lists exams taken, best and latest score. Clearing the browser clears it; the page says so.

## 3. Admin experience

New admin page **CBT exams** at `/admin/cbt` (admin-only, same guard and layout as the other admin pages).

- **Courses**: add / edit / delete a course: level, course code, title. Codes are normalised (upper case, single space, e.g. `MTH 101`).
- **Exams** under a course: title (e.g. "2024/25 first-semester CBT"), session label (optional text), published toggle, settings (4.2), and its question bank.
- **Question bank editor**: reuse the existing question editor and the CSV/Excel paste import (`questionsFromCsv`, `cleanQuestion`). Add columns `explanation` (shown in review) and `topic` (optional, for stats). Show a preview and the same row-by-row error messages as today. Bulk limit for one import: 500 rows.
- **Stats** per exam: attempts, average score, pass rate, average time, and a table of questions ordered by how often they are missed (to find wrong keys or ambiguous questions). Stats count Exam-mode attempts only.
- **Unpublish / delete**: unpublished exams disappear from `/cbt`. Deleting an exam deletes its attempts.
- Admin sees but cannot edit personal exams (existing "Community quizzes" list gets a CBT-use column, remove still available).

## 4. Rules and settings

### 4.1 Question types
All four existing types: multiple choice, true/false, numeric (with tolerance), typed answer (accepted answers). Single-answer only in v1.

### 4.2 Per-exam settings (admin)
- `mode`: `bank` (random draw) or `fixed` (all questions, in set order unless shuffled).
- `draw_count`: for `bank`, how many questions per attempt (1 to bank size). For `fixed`, ignored.
- `duration_minutes`: whole-paper time (1 to 240).
- `pass_mark_percent`: default 50.
- `shuffle_questions`, `shuffle_options` (both default on). Option shuffle is skipped for questions whose options reference each other ("all of the above", "both A and B"); the editor warns and offers a per-question "do not shuffle options" flag.
- `show_explanations`: on/off.
- `allow_study_mode`: on/off.

### 4.3 Fairness and integrity
- The correct answers are never sent to the browser while the exam is running. The server draws the questions, hides the key, and grades on submit.
- The server owns the clock: `started_at` and `deadline_at` are set when the attempt is created. Answers saved after `deadline_at` plus a 10-second grace are ignored. The browser timer is only a display.
- One attempt token per attempt (random secret, hash stored, same pattern as battle tokens). Only the holder can save answers or read the result. Results are readable for 24 hours after submit, then the review is gone from the server (the device history keeps the score).
- No promise that this stops cheating. It is a self-test tool.

### 4.4 Personal exams (student-made)
Reuses the community set pipeline (`api/_lib/quizCustom.js`, `/make`, `/set/:code`), with these changes:
- Question limit raised from 30 to **100** per personal exam.
- A maker can choose the exam settings (duration, pass mark, shuffle, draw count) when creating; defaults are 1 minute per question, 50%, shuffle on, all questions.
- Expiry: default 30 days stays, with a choice of **90 days** or **180 days** (the maker's manage token can extend it from `/set/:code`). Rate limit stays 5 creates per hour per IP; total active personal exams cap rises to 1,000.
- `/set/:code` gets a primary button **Take as CBT exam** next to the existing practice and challenge buttons.
- Personal exams never appear in `/cbt` lists or stats; they are found by code or link only.

## 5. Data model

New migration `2026xxxx_cbt_exams.sql` (with a rollback in `supabase/rollbacks/`). All tables have RLS enabled; admin write through `is_admin()`; no direct public access. Students reach everything through the API, which uses the service role.

```
cbt_courses
  id uuid pk, level text check in ('100','200','300','400','500','other'),
  code text not null, title text not null, created_at
  unique (code)

cbt_exams
  id uuid pk, course_id uuid -> cbt_courses on delete cascade,
  title text, session_label text, code text unique,       -- short public code, 6 chars
  published boolean default false,
  mode text check in ('bank','fixed') default 'bank',
  draw_count int, duration_minutes int, pass_mark_percent int default 50,
  shuffle_questions boolean default true, shuffle_options boolean default true,
  show_explanations boolean default true, allow_study_mode boolean default true,
  quiz_id uuid -> quizzes   -- the exam's question bank reuses quizzes/quiz_questions
  created_at, updated_at

cbt_attempts
  id uuid pk, exam_id uuid -> cbt_exams on delete cascade,   -- or quiz_id for personal exams
  quiz_id uuid, token_hash text, mode text check in ('exam','study'),
  question_ids uuid[]  (the draw, in shown order), option_orders jsonb,
  answers jsonb default '{}',
  flagged int[] default '{}',
  started_at, deadline_at, submitted_at,
  score int, total int, results jsonb  -- [{id, correct}] for stats
```

Design notes:
- The question bank reuses `quizzes` and `quiz_questions` (as community sets do), so the existing editor, CSV import, math and sanitising code carry over. `quiz_questions` gains optional `explanation text`, `topic text`, `no_shuffle boolean default false`. `quizzes` gains optional `cbt_settings jsonb` for personal exams.
- Cron-style cleanup: attempts older than 60 days are deleted (opportunistically on create, as with battles) after the result is no longer readable.
- Admin stats are computed from `cbt_attempts.results` with a small RPC (`cbt_exam_stats(exam_id)`), admin-only.

## 6. API

All under the existing single router (`api/quiz.js`, 12-function budget): new `?action=cbt`, handler factory `createCbtHandler(getClient, opts)` in `api/_lib/handlers/quiz-cbt.js`, with the in-memory fake extended in `quizTestKit.js`. Operations:

| op | who | does |
| --- | --- | --- |
| `list` | public | levels, courses, published exams (counts, durations); `q` search by code/title |
| `info` | public | one exam (by code) or personal set (by code): settings, question count per attempt |
| `start` | public | creates an attempt: draws and shuffles, stores order, returns attempt token, questions without answers or keys, `deadline_at` |
| `save` | token | stores answers and flags; returns server time and time left |
| `submit` | token | grades, writes score and results, returns the review (answers, keys, explanations) |
| `result` | token | re-reads the result within 24 hours |
| `study` | token | study mode: returns one answer's correctness and explanation on demand |
| admin ops | admin (Supabase session) | CRUD on courses/exams/questions go direct through RLS from the admin UI (as the other admin pages do); `stats` is an RPC |

Grading reuses the existing answer checker used by the quiz (numeric tolerance, accepted answers, normalisation). Public ops are rate-limited per IP; `start` is limited to 30 per hour per IP to protect the bank from scraping.

## 7. Frontend

New files, all matching existing patterns (Tailwind v4, `lazyRetry` routes, `QuizThemeScope`-style wrapper replaced by a plainer `CbtShell`, no game visuals):

- `src/pages/cbt/CbtHome.jsx` (`/cbt`), `CbtExamStart.jsx` (`/cbt/:code`), `CbtExam.jsx`, `CbtResult.jsx`
- `src/components/cbt/` : `Navigator`, `Timer` (server-time offset, `visibilitychange` resync), `QuestionView`, `ReviewList`
- `src/data/cbt.js` (API client + history helpers), `src/pages/admin/AdminCbt.jsx` (+ question editor reuse)
- Routes in `src/App.jsx`; navbar/footer link **CBT practice**; card on `/quiz`.
- Mobile first: navigator drawer, large tap targets, no horizontal scroll, works at 360px. Reduced motion respected.

## 8. Testing

- Unit: draw and shuffle (deterministic with a seed), option-shuffle exceptions, grading for all four types, deadline and grace handling, token checks, history helpers.
- Handler tests with the fake DB: start hides keys, save after deadline ignored, submit idempotent, result expiry, stats RPC fake, rate limits, unpublished exams hidden.
- Component tests: timer resync, navigator states, submit confirmation counts.
- One scripted production smoke test after merge (create a test exam, take it, check score, delete), as done for battles.

## 9. Rollout

1. Migration applied to production first (additive, safe).
2. Backend and student pages behind a published flag (an exam is invisible until published).
3. Admin page, then personal-exam upgrade, then menu link last.
4. Pilot with one real year-1 course before announcing.

## 10. Open items (defaults chosen, change if you disagree)

- Pass mark default 50%.
- Study-mode attempts excluded from stats.
- Review kept on the server 24 hours; scores kept in device history forever.
- Personal exams default to 30 days with 90/180 choices; admin exams never expire.
- No negative marking in v1 (can be added later as a per-exam setting).
- Multiple-answer (select all that apply) questions: later.
- Optional cover text per course (e.g. instructions) is not in v1.

## 11. Suggested build order

1. Migration, grading and draw logic, `cbt` handler with tests.
2. Student exam flow: start page, exam screen, results, device history.
3. Admin: courses, exams, bank editor (reusing import), stats.
4. Personal exams upgrade (limit 100, settings, expiry choices, "Take as CBT exam").
5. Menu, hub card, polish, mobile pass, smoke test.
