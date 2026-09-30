-- Live quiz (Kahoot-style). See docs/superpowers/specs/2026-09-30-live-quiz-design.md.
-- Admins build quizzes and host sessions. Players are anonymous (nickname + secret token) and never
-- touch these tables directly: every player write goes through /api/quiz using the service role.
-- A rollback script sits in supabase/rollbacks/.

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position integer not null check (position >= 0),
  text text not null check (char_length(btrim(text)) between 1 and 300),
  options text[] not null check (array_length(options, 1) between 2 and 4),
  correct_index smallint not null check (correct_index >= 0),
  time_limit_seconds integer not null default 20 check (time_limit_seconds between 5 and 120),
  points integer not null default 1000 check (points between 100 and 2000),
  -- Deferred so the editor can save a reordered list of questions in one statement.
  unique (quiz_id, position) deferrable initially deferred,
  check (correct_index < array_length(options, 1))
);

create table public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  join_code text not null check (join_code ~ '^[0-9]{6}$'),
  state text not null default 'lobby' check (state in ('lobby', 'question', 'reveal', 'leaderboard', 'finished')),
  current_question_index integer not null default -1,
  question_started_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
-- A join code only has to be unique while its game is still running.
create unique index quiz_sessions_active_code on public.quiz_sessions (join_code) where state <> 'finished';

create table public.quiz_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  total_score integer not null default 0,
  joined_at timestamptz not null default now()
);
create unique index quiz_players_nickname on public.quiz_players (session_id, lower(nickname));

-- The secret half of a player's identity lives apart from quiz_players so that table can be read by everyone.
create table public.quiz_player_tokens (
  player_id uuid primary key references public.quiz_players(id) on delete cascade,
  token_hash text not null unique
);

create table public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  player_id uuid not null references public.quiz_players(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  chosen_index smallint not null check (chosen_index between 0 and 3),
  points_awarded integer not null default 0,
  answered_at timestamptz not null default now(),
  unique (player_id, question_id)
);
create index quiz_answers_session_question on public.quiz_answers (session_id, question_id);

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_players enable row level security;
alter table public.quiz_player_tokens enable row level security;
alter table public.quiz_answers enable row level security;

revoke all on public.quizzes, public.quiz_questions, public.quiz_sessions, public.quiz_players,
  public.quiz_player_tokens, public.quiz_answers from anon, authenticated;

-- Admins manage quizzes and their questions (the correct answer lives in quiz_questions, so players never get select).
grant select, insert, update, delete on public.quizzes, public.quiz_questions to authenticated;
create policy quizzes_admin_all on public.quizzes for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy quiz_questions_admin_all on public.quiz_questions for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Everyone can watch a game's state and player list (realtime needs select). Only the server writes.
grant select on public.quiz_sessions, public.quiz_players to anon, authenticated;
create policy quiz_sessions_read on public.quiz_sessions for select to anon, authenticated using (true);
create policy quiz_players_read on public.quiz_players for select to anon, authenticated using (true);
-- Admins can also clean up finished games.
grant delete on public.quiz_sessions to authenticated;
create policy quiz_sessions_admin_delete on public.quiz_sessions for delete to authenticated
  using ((select public.is_admin()));

-- Answers: admins read them (host screen shows the answer spread). Nobody else, and nobody writes directly.
grant select on public.quiz_answers to authenticated;
create policy quiz_answers_admin_read on public.quiz_answers for select to authenticated
  using ((select public.is_admin()));
-- quiz_player_tokens: no grants and no policies, so only the service role can touch it.

-- Records one answer and adds its points in a single step. Refuses a second answer from the same player
-- and refuses an answer if the game has moved on from that question. Server only (service role).
create or replace function public.quiz_record_answer(
  p_session uuid, p_player uuid, p_question uuid, p_index integer, p_chosen integer, p_points integer
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform 1 from public.quiz_sessions
   where id = p_session and state = 'question' and current_question_index = p_index
   for share;
  if not found then return false; end if;

  insert into public.quiz_answers (session_id, player_id, question_id, chosen_index, points_awarded)
  values (p_session, p_player, p_question, p_chosen, p_points)
  on conflict (player_id, question_id) do nothing;
  if not found then return false; end if;

  update public.quiz_players set total_score = total_score + p_points where id = p_player;
  return true;
end;
$$;
revoke execute on function public.quiz_record_answer(uuid, uuid, uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.quiz_record_answer(uuid, uuid, uuid, integer, integer, integer) to service_role;

grant all on public.quizzes, public.quiz_questions, public.quiz_sessions, public.quiz_players,
  public.quiz_player_tokens, public.quiz_answers to service_role;

-- Live updates for the host screen and player phones.
alter publication supabase_realtime add table public.quiz_sessions, public.quiz_players;
