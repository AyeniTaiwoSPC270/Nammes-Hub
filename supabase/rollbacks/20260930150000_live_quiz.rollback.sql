-- Rolls back 20260930150000_live_quiz.sql. Deletes all quizzes, games and results.
alter publication supabase_realtime drop table public.quiz_sessions, public.quiz_players;
drop function if exists public.quiz_record_answer(uuid, uuid, uuid, integer, integer, integer);
drop table if exists public.quiz_answers;
drop table if exists public.quiz_player_tokens;
drop table if exists public.quiz_players;
drop table if exists public.quiz_sessions;
drop table if exists public.quiz_questions;
drop table if exists public.quizzes;
