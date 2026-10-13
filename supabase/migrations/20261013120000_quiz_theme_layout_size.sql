-- Room for a backdrop prop arrangement.
--
-- `theme` is the one place a quiz's whole look lives, and an admin who arranges the maths symbols by hand has to be able
-- to keep that arrangement. A layout is roughly 36 characters per untouched prop and has optional per-prop colours and
-- hidden flags, so the measured worst-case fixture in quizTheme.test.js—not a back-of-the-envelope estimate—sets the cap.
--
-- The check moves on `quiz_sessions` as well as `quizzes` for the obvious reason: a session's theme is a copy of the
-- quiz's, so a row the quizzes table accepts would otherwise be rejected the moment a game started.
--
-- The ceiling is not advisory. `cleanLayout` in api/_lib/quizTheme.js caps a pattern at 60 props and every pattern
-- together at 150, so the app cannot write a row that this check turns away — and quizTheme.test.js builds the true worst
-- case and measures it, which is what makes 16000 a number rather than a guess.
alter table public.quizzes
  drop constraint if exists quizzes_theme_check;

alter table public.quizzes
  add constraint quizzes_theme_check check (jsonb_typeof(theme) = 'object' and pg_column_size(theme) < 16000);

alter table public.quiz_sessions
  drop constraint if exists quiz_sessions_theme_check;

alter table public.quiz_sessions
  add constraint quiz_sessions_theme_check check (jsonb_typeof(theme) = 'object' and pg_column_size(theme) < 16000);
