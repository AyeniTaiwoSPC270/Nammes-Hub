-- Rolls back 20261001200000_quiz_custom_sets.sql. Delete community sets first: delete from public.quizzes where is_custom;
drop function if exists public.quiz_custom_cleanup();
drop index if exists public.quizzes_custom_expiry;
alter table public.quizzes drop column if exists expires_at, drop column if exists owner_hash, drop column if exists custom_code, drop column if exists is_custom;
