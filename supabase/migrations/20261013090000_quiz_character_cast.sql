-- A quiz's own cast: up to 12 characters an admin designs, which players can pick alongside or instead of the 50
-- built-ins. avatar_id 0-49 stays a built-in; 50-61 is slot 0-11 of this quiz's cast.
--
-- A slot is allocated once and never reused. A deleted character is scrubbed and retired in place, leaving only its
-- slot reservation so the same avatar_id cannot later point at a different design.
create table public.quiz_characters (
  id         uuid primary key default gen_random_uuid(),
  quiz_id    uuid not null references public.quizzes(id) on delete cascade,
  slot       smallint not null check (slot between 0 and 11),
  name       text not null check (char_length(name) between 1 and 24),
  spec       jsonb not null check (jsonb_typeof(spec) = 'object'),
  moves      jsonb not null check (jsonb_typeof(moves) = 'object'),
  created_at timestamptz not null default now(),
  unique (quiz_id, slot)
);

create index quiz_characters_by_quiz on public.quiz_characters (quiz_id, slot);

alter table public.quizzes
  add column cast_mode text not null default 'builtins'
  check (cast_mode in ('builtins', 'all', 'custom'));

-- A hosted game copies the cast on start, the way it copies the theme. The built-ins are compiled into the bundle.
alter table public.quiz_sessions
  add column characters jsonb not null default '{}'::jsonb
  check (jsonb_typeof(characters) = 'object' and pg_column_size(characters) < 8000);

-- Confirm these generated names against the live schema before applying this migration. The original inline checks use
-- Postgres' `<table>_avatar_id_check` naming convention.
alter table public.quiz_players drop constraint if exists quiz_players_avatar_id_check;
alter table public.quiz_players add constraint quiz_players_avatar_id_check check (avatar_id between 0 and 61);
alter table public.quiz_teams drop constraint if exists quiz_teams_avatar_id_check;
alter table public.quiz_teams add constraint quiz_teams_avatar_id_check check (avatar_id between 0 and 61);
alter table public.quiz_battle_sides drop constraint if exists quiz_battle_sides_avatar_id_check;
alter table public.quiz_battle_sides add constraint quiz_battle_sides_avatar_id_check check (avatar_id between 0 and 61);
alter table public.quiz_battle_ratings drop constraint if exists quiz_battle_ratings_avatar_id_check;
alter table public.quiz_battle_ratings add constraint quiz_battle_ratings_avatar_id_check check (avatar_id between 0 and 61);
alter table public.quiz_practice_runs drop constraint if exists quiz_practice_runs_avatar_id_check;
alter table public.quiz_practice_runs add constraint quiz_practice_runs_avatar_id_check check (avatar_id between 0 and 61);

alter table public.quiz_characters enable row level security;
revoke all on public.quiz_characters from anon, authenticated;
grant select, insert, update, delete on public.quiz_characters to authenticated;
create policy quiz_characters_admin_all on public.quiz_characters
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
