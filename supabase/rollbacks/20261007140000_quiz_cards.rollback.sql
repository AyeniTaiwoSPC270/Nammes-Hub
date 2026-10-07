-- Rolls back 20261007140000_quiz_cards.sql.
--
-- The unique constraint on share_code goes before the column, or Postgres refuses the drop while the index it
-- owns still references the column.
alter table public.quiz_practice_runs drop constraint if exists quiz_practice_runs_share_code_key;
alter table public.quiz_practice_runs drop column if exists share_code;

-- Games and quizzes drop back to having no card settings. Every card endpoint reads the column, so run this only
-- with the card routes removed; a card fetched afterwards fails rather than rendering a default.
alter table public.quiz_sessions drop column if exists card;
alter table public.quizzes drop column if exists card;