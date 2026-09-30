-- Rolls back 20261001140000_quiz_auto_team.sql.
drop function if exists public.quiz_assign_auto_team(uuid, uuid);
