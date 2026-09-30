-- Rolls back 20261001170000_quiz_battles.sql.
drop function if exists public.quiz_battle_cleanup();
drop function if exists public.quiz_battle_record(uuid, text, uuid, integer, text, boolean, integer, integer);
drop table if exists public.quiz_battle_answers;
drop table if exists public.quiz_battle_sides;
drop table if exists public.quiz_battles;
alter table public.quizzes drop column if exists battle_enabled;
