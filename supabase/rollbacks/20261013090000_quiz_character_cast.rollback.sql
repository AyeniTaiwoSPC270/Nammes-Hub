drop policy if exists quiz_characters_admin_all on public.quiz_characters;
revoke all on public.quiz_characters from anon, authenticated;
drop table if exists public.quiz_characters;

alter table public.quiz_practice_runs drop constraint if exists quiz_practice_runs_avatar_id_check;
alter table public.quiz_practice_runs add constraint quiz_practice_runs_avatar_id_check check (avatar_id between 0 and 49);
alter table public.quiz_battle_ratings drop constraint if exists quiz_battle_ratings_avatar_id_check;
alter table public.quiz_battle_ratings add constraint quiz_battle_ratings_avatar_id_check check (avatar_id between 0 and 49);
alter table public.quiz_battle_sides drop constraint if exists quiz_battle_sides_avatar_id_check;
alter table public.quiz_battle_sides add constraint quiz_battle_sides_avatar_id_check check (avatar_id between 0 and 49);
alter table public.quiz_teams drop constraint if exists quiz_teams_avatar_id_check;
alter table public.quiz_teams add constraint quiz_teams_avatar_id_check check (avatar_id between 0 and 49);
alter table public.quiz_players drop constraint if exists quiz_players_avatar_id_check;
alter table public.quiz_players add constraint quiz_players_avatar_id_check check (avatar_id between 0 and 49);

alter table public.quiz_sessions drop column if exists characters;
alter table public.quizzes drop column if exists cast_mode;
