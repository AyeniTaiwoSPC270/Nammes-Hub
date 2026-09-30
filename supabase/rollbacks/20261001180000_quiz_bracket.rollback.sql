-- Rolls back 20261001180000_quiz_bracket.sql.
drop table if exists public.quiz_bracket_matches;
alter table public.quiz_sessions
  drop column if exists bracket_champion,
  drop column if exists bracket_done,
  drop column if exists bracket_rounds,
  drop column if exists bracket_bot_skill,
  drop column if exists bracket_length,
  drop column if exists bracket_mode;
