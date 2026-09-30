-- Rolls back 20260930190000_quiz_theme.sql.
alter table public.quiz_sessions drop column if exists theme;
alter table public.quizzes drop column if exists theme;
