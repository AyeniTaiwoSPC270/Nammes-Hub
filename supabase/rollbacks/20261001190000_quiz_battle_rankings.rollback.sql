-- Rolls back 20261001190000_quiz_battle_rankings.sql.
alter table public.quiz_battles drop column if exists rated;
drop table if exists public.quiz_battle_ratings;
