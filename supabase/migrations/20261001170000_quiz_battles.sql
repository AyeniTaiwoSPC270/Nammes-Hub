-- Live quiz battle mode, phases A and B (challenge a friend, live duel). Spec: docs/superpowers/specs/2026-10-01-quiz-battle-mode.md
-- Rollback in supabase/rollbacks/.

-- Battles are opt-in per quiz, like practice.
alter table public.quizzes add column battle_enabled boolean not null default false;

-- One row per battle. A `challenge` is played by each side on their own time; a `duel` is played together, question by
-- question, and the server moves it along (state, current_index, question_started_at) as the two phones ask about it.
create table public.quiz_battles (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  mode text not null check (mode in ('challenge', 'duel')),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  question_ids uuid[] not null check (cardinality(question_ids) between 1 and 12),
  state text not null default 'open' check (state in ('open', 'question', 'reveal', 'finished', 'cancelled')),
  current_index integer not null default 0 check (current_index >= 0),
  question_started_at timestamptz,
  reveal_started_at timestamptz,
  -- set for "duel a bot": the second side is a computer player of this skill
  bot_skill text check (bot_skill in ('beginner', 'average', 'expert', 'mixed')),
  winner_slot text check (winner_slot in ('a', 'b')),
  forfeit boolean not null default false,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index quiz_battles_quiz on public.quiz_battles (quiz_id, created_at desc);
create index quiz_battles_created on public.quiz_battles (created_at);

-- The two seats of a battle. Only the hash of a seat's secret token is stored.
create table public.quiz_battle_sides (
  battle_id uuid not null references public.quiz_battles(id) on delete cascade,
  slot text not null check (slot in ('a', 'b')),
  nickname text not null check (char_length(nickname) between 1 and 20),
  avatar_id smallint not null default 0 check (avatar_id between 0 and 49),
  token_hash text unique,
  tag_hash text,
  bot_skill text check (bot_skill in ('beginner', 'average', 'expert')),
  total_score integer not null default 0,
  current_index integer not null default 0 check (current_index >= 0),
  question_started_at timestamptz,
  finished_at timestamptz,
  last_seen_at timestamptz not null default now(),
  primary key (battle_id, slot)
);

create table public.quiz_battle_answers (
  battle_id uuid not null,
  slot text not null,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  chosen_index smallint,
  answer_text text check (answer_text is null or char_length(answer_text) <= 40),
  correct boolean not null default false,
  points_awarded integer not null default 0,
  elapsed_ms integer,
  answered_at timestamptz not null default now(),
  primary key (battle_id, slot, question_id),
  foreign key (battle_id, slot) references public.quiz_battle_sides(battle_id, slot) on delete cascade
);

-- Phones never read these tables: only the server does (through the API), and admins can look at them in the dashboard.
alter table public.quiz_battles enable row level security;
alter table public.quiz_battle_sides enable row level security;
alter table public.quiz_battle_answers enable row level security;
revoke all on public.quiz_battles, public.quiz_battle_sides, public.quiz_battle_answers from anon, authenticated;
grant all on public.quiz_battles, public.quiz_battle_sides, public.quiz_battle_answers to service_role;
grant select on public.quiz_battles, public.quiz_battle_sides, public.quiz_battle_answers to authenticated;
create policy quiz_battles_admin_read on public.quiz_battles for select to authenticated using ((select public.is_admin()));
create policy quiz_battle_sides_admin_read on public.quiz_battle_sides for select to authenticated using ((select public.is_admin()));
create policy quiz_battle_answers_admin_read on public.quiz_battle_answers for select to authenticated using ((select public.is_admin()));

-- Stores one answer and adds its points in a single step; refuses a second answer to the same question.
create or replace function public.quiz_battle_record(
  p_battle uuid, p_slot text, p_question uuid, p_chosen integer, p_text text, p_correct boolean, p_points integer, p_elapsed integer
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.quiz_battle_answers (battle_id, slot, question_id, chosen_index, answer_text, correct, points_awarded, elapsed_ms)
  values (p_battle, p_slot, p_question, p_chosen, p_text, p_correct, p_points, p_elapsed)
  on conflict (battle_id, slot, question_id) do nothing;
  if not found then return false; end if;
  update public.quiz_battle_sides set total_score = total_score + p_points where battle_id = p_battle and slot = p_slot;
  return true;
end;
$$;
revoke execute on function public.quiz_battle_record(uuid, text, uuid, integer, text, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.quiz_battle_record(uuid, text, uuid, integer, text, boolean, integer, integer) to service_role;

-- Old battles are cleared out: unfinished ones after a day, everything after 90 days.
create or replace function public.quiz_battle_cleanup() returns integer
language sql
security invoker
set search_path = public
as $$
  with gone as (
    delete from public.quiz_battles
     where (state in ('open', 'question', 'reveal') and mode = 'duel' and created_at < now() - interval '1 day')
        or expires_at < now() - interval '83 days'
        or created_at < now() - interval '90 days'
    returning 1
  ) select count(*)::integer from gone;
$$;
revoke execute on function public.quiz_battle_cleanup() from public, anon, authenticated;
grant execute on function public.quiz_battle_cleanup() to service_role;
