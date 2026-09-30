-- Rolls back 20260930170000_quiz_avatars.sql.
alter table public.quiz_players drop column if exists avatar_id;
