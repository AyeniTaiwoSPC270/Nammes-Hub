-- Rolls back 20260930180000_quiz_max_players.sql.
alter table public.quiz_sessions drop column if exists full_at, drop column if exists max_players;
alter table public.quizzes drop column if exists max_players;
