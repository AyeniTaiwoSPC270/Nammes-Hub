-- Result cards: per-quiz card design settings, and a share code so a finished practice run keeps a card link.
-- A separate column from `theme`, not a key inside it: theme already has a hard pg_column_size < 4000 check
-- (20260930190000_quiz_theme.sql) and a card background path plus flags would eat that budget.
-- quiz_sessions copies the settings when a game starts, exactly as it copies theme, so editing a quiz never
-- restyles a game that has already been played.

alter table public.quizzes
  add column card jsonb not null default '{}'::jsonb
  check (jsonb_typeof(card) = 'object' and pg_column_size(card) < 4000);

alter table public.quiz_sessions
  add column card jsonb not null default '{}'::jsonb
  check (jsonb_typeof(card) = 'object' and pg_column_size(card) < 4000);

alter table public.quiz_practice_runs
  add column share_code text unique
  check (share_code is null or share_code ~ '^[A-Z0-9]{8}$');

create index quiz_practice_runs_share_code_idx
  on public.quiz_practice_runs (share_code) where share_code is not null;