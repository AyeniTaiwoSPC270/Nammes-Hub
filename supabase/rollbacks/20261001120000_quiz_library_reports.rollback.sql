-- Rolls back 20261001120000_quiz_library_reports.sql.
drop view if exists public.quiz_player_stats;
drop view if exists public.quiz_answer_distribution;
drop view if exists public.quiz_question_stats;
alter table public.quizzes drop column if exists archived_at, drop column if exists tags;
