-- Live quiz battle mode, phase D: rankings. Spec: docs/superpowers/specs/2026-10-01-quiz-battle-mode.md
-- Rollback in supabase/rollbacks/.

-- One row per player tag (a random id kept on the player's device, stored only as a hash). This is not an account:
-- clearing the browser starts a new record. Bots never appear here.
create table public.quiz_battle_ratings (
  tag_hash text primary key,
  nickname text not null check (char_length(nickname) between 1 and 20),
  avatar_id smallint not null default 0 check (avatar_id between 0 and 49),
  rating integer not null default 1000,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  updated_at timestamptz not null default now()
);
create index quiz_battle_ratings_top on public.quiz_battle_ratings (rating desc);

-- A finished battle counts towards the ranking once.
alter table public.quiz_battles add column rated boolean not null default false;

-- Phones never read this table (the API serves the champions list); admins can look at it and clear entries.
alter table public.quiz_battle_ratings enable row level security;
revoke all on public.quiz_battle_ratings from anon, authenticated;
grant all on public.quiz_battle_ratings to service_role;
grant select, delete on public.quiz_battle_ratings to authenticated;
create policy quiz_battle_ratings_admin_read on public.quiz_battle_ratings for select to authenticated using ((select public.is_admin()));
create policy quiz_battle_ratings_admin_delete on public.quiz_battle_ratings for delete to authenticated using ((select public.is_admin()));
