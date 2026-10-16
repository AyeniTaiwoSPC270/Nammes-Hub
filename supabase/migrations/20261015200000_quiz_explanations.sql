-- Explanations on the live reveal.
--
-- quiz_questions.explanation has existed since 20261002100000_cbt_exams.sql and is wired end to end for CBT. The live
-- quiz never read it: there was no setting to turn it on, no field to type one, and the reveal state showed the
-- correct answer and no prose.
--
-- Two columns, not one, because the setting is snapshotted onto the game the way game_options, theme and characters
-- are: a host who changes it mid-evening must not restyle a game fifty phones are already holding. quiz-create.js
-- copies it at session creation; the backfill below covers games hosted before this migration ran.

alter table public.quizzes
  add column if not exists show_explanations boolean not null default true;

alter table public.quiz_sessions
  add column if not exists show_explanations boolean not null default true;

comment on column public.quizzes.show_explanations is
  'Show each question''s explanation on the reveal. Default on: a quiz with no explanations behaves exactly as it did before.';

comment on column public.quiz_sessions.show_explanations is
  'Frozen from quizzes.show_explanations when the game was created, so editing the quiz cannot change a running game.';

-- Sessions that already exist keep their host's setting rather than inheriting the new default of true, which would
-- switch explanations on for a game that is halfway through without the host asking.
update public.quiz_sessions s
   set show_explanations = q.show_explanations
  from public.quizzes q
 where q.id = s.quiz_id;