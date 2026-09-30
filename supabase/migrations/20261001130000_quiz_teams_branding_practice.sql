-- Live quiz premium features D: team mode, logo and sponsor branding, and solo practice mode. Features 4, 9 and 10 of
-- docs/superpowers/specs/2026-09-30-live-quiz-premium-features.md. Rollback in supabase/rollbacks/.

-- ---- Team mode ----
alter table public.quizzes
  add column team_mode boolean not null default false,
  add column team_scoring text not null default 'average' check (team_scoring in ('average', 'total')),
  add column team_presets jsonb not null default '[]'::jsonb
    check (jsonb_typeof(team_presets) = 'array' and pg_column_size(team_presets) < 4000);

alter table public.quiz_sessions
  add column team_mode boolean not null default false,
  add column team_scoring text not null default 'average' check (team_scoring in ('average', 'total'));

-- A game's teams are copied here when it starts. Everyone can read them (phones and the projector); only the server writes.
create table public.quiz_teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  color text not null check (color in ('red', 'blue', 'green', 'amber', 'purple', 'teal', 'pink', 'slate')),
  avatar_id smallint not null default 0 check (avatar_id between 0 and 49),
  position smallint not null check (position between 0 and 7),
  unique (session_id, position)
);
alter table public.quiz_teams enable row level security;
revoke all on public.quiz_teams from anon, authenticated;
grant select on public.quiz_teams to anon, authenticated;
create policy quiz_teams_read on public.quiz_teams for select to anon, authenticated using (true);
grant all on public.quiz_teams to service_role;

alter table public.quiz_players add column team_id uuid references public.quiz_teams(id) on delete set null;
create index quiz_players_team on public.quiz_players (team_id);

-- ---- Logo and sponsor pictures ----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quiz-branding', 'quiz-branding', true, 524288, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy quiz_branding_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'quiz-branding' and (select public.is_admin()));
create policy quiz_branding_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'quiz-branding' and (select public.is_admin()))
  with check (bucket_id = 'quiz-branding' and (select public.is_admin()));
create policy quiz_branding_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'quiz-branding' and (select public.is_admin()));

-- ---- Practice mode (solo play, no host) ----
alter table public.quizzes add column practice_enabled boolean not null default false;

-- One row per attempt. Only the server touches these (no grants, no policies).
create table public.quiz_practice_runs (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  avatar_id smallint not null default 0 check (avatar_id between 0 and 49),
  token_hash text not null unique,
  current_index integer not null default 0 check (current_index >= 0),
  question_started_at timestamptz not null default now(),
  total_score integer not null default 0,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index quiz_practice_runs_top on public.quiz_practice_runs (quiz_id, total_score desc) where finished_at is not null;
create index quiz_practice_runs_created on public.quiz_practice_runs (created_at);

create table public.quiz_practice_answers (
  run_id uuid not null references public.quiz_practice_runs(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  chosen_index smallint,
  answer_text text check (answer_text is null or char_length(answer_text) <= 40),
  correct boolean not null default false,
  points_awarded integer not null default 0,
  answered_at timestamptz not null default now(),
  primary key (run_id, question_id)
);

alter table public.quiz_practice_runs enable row level security;
alter table public.quiz_practice_answers enable row level security;
revoke all on public.quiz_practice_runs, public.quiz_practice_answers from anon, authenticated;
grant all on public.quiz_practice_runs, public.quiz_practice_answers to service_role;

-- Records one practice answer and adds its points in a single step; refuses a second answer to the same question.
create or replace function public.quiz_practice_record(
  p_run uuid, p_question uuid, p_chosen integer, p_text text, p_correct boolean, p_points integer
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.quiz_practice_answers (run_id, question_id, chosen_index, answer_text, correct, points_awarded)
  values (p_run, p_question, p_chosen, p_text, p_correct, p_points)
  on conflict (run_id, question_id) do nothing;
  if not found then return false; end if;
  update public.quiz_practice_runs set total_score = total_score + p_points where id = p_run;
  return true;
end;
$$;
revoke execute on function public.quiz_practice_record(uuid, uuid, integer, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.quiz_practice_record(uuid, uuid, integer, text, boolean, integer) to service_role;

-- Old attempts are cleared out: unfinished ones after a day, finished ones after 90 days.
-- (Run by pg_cron if it is enabled for the project; otherwise call it from the Supabase dashboard now and then.)
create or replace function public.quiz_practice_cleanup() returns integer
language sql
security invoker
set search_path = public
as $$
  with gone as (
    delete from public.quiz_practice_runs
     where (finished_at is null and created_at < now() - interval '1 day')
        or created_at < now() - interval '90 days'
    returning 1
  ) select count(*)::integer from gone;
$$;
revoke execute on function public.quiz_practice_cleanup() from public, anon, authenticated;
grant execute on function public.quiz_practice_cleanup() to service_role;

alter publication supabase_realtime add table public.quiz_teams;
