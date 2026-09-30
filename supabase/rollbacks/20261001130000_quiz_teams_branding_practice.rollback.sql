-- Rolls back 20261001130000_quiz_teams_branding_practice.sql.
alter publication supabase_realtime drop table public.quiz_teams;

drop function if exists public.quiz_practice_cleanup();
drop function if exists public.quiz_practice_record(uuid, uuid, integer, text, boolean, integer);
drop table if exists public.quiz_practice_answers;
drop table if exists public.quiz_practice_runs;
alter table public.quizzes drop column if exists practice_enabled;

-- The quiz-branding bucket is left in place: Supabase does not allow deleting storage rows with SQL.
drop policy if exists quiz_branding_admin_delete on storage.objects;
drop policy if exists quiz_branding_admin_update on storage.objects;
drop policy if exists quiz_branding_admin_insert on storage.objects;

drop index if exists public.quiz_players_team;
alter table public.quiz_players drop column if exists team_id;
drop table if exists public.quiz_teams;
alter table public.quiz_sessions drop column if exists team_scoring, drop column if exists team_mode;
alter table public.quizzes drop column if exists team_presets, drop column if exists team_scoring, drop column if exists team_mode;
