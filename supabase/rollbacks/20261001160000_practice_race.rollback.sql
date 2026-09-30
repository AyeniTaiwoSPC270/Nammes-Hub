-- Rolls back 20261001160000_practice_race.sql.
alter table public.quiz_practice_runs drop column if exists race_ghosts, drop column if exists race_skill, drop column if exists race_mode;
