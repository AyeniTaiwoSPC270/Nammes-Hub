-- Live quiz premium features B: more question types (true/false, typed number, typed text, poll) and streaks,
-- power-ups, double-points rounds and the comeback boost. Features 5 and 3 of
-- docs/superpowers/specs/2026-09-30-live-quiz-premium-features.md. Rollback in supabase/rollbacks/.

-- ---- Question types ----
alter table public.quiz_questions
  add column type text not null default 'multiple' check (type in ('multiple', 'truefalse', 'numeric', 'text', 'poll')),
  add column numeric_answer numeric,
  add column numeric_tolerance numeric not null default 0 check (numeric_tolerance >= 0),
  add column accepted_answers text[] not null default '{}',
  add column points_multiplier smallint not null default 1 check (points_multiplier in (1, 2));

alter table public.quiz_questions alter column correct_index drop not null;

-- The old shape rules assumed every question has 2 to 4 options and a correct one; replace them with rules per type.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.quiz_questions'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%array_length(options%'
  loop
    execute format('alter table public.quiz_questions drop constraint %I', c);
  end loop;
end $$;

alter table public.quiz_questions
  add constraint quiz_questions_shape check (
    (type = 'multiple' and array_length(options, 1) between 2 and 4 and correct_index is not null and correct_index < array_length(options, 1))
    or (type = 'truefalse' and array_length(options, 1) = 2 and correct_index is not null and correct_index < 2)
    or (type = 'poll' and array_length(options, 1) between 2 and 4)
    or (type = 'numeric' and numeric_answer is not null)
    or (type = 'text' and coalesce(array_length(accepted_answers, 1), 0) between 1 and 8)
  );

-- ---- What was answered ----
alter table public.quiz_answers alter column chosen_index drop not null;
alter table public.quiz_answers
  add column answer_text text check (answer_text is null or char_length(answer_text) <= 40),
  add column correct boolean,
  add column bonus_points integer not null default 0,
  add column powerup text check (powerup is null or powerup in ('double', 'fifty')),
  add column elapsed_ms integer;

-- Backfill: old answers were all multiple choice, so whether they were right follows from the points.
update public.quiz_answers set correct = (points_awarded > 0) where correct is null;

-- ---- Streaks and power-ups ----
alter table public.quiz_players
  add column streak integer not null default 0 check (streak >= 0),
  add column powerups_used text[] not null default '{}';

alter table public.quizzes
  add column game_options jsonb not null default '{}'::jsonb check (jsonb_typeof(game_options) = 'object');
alter table public.quiz_sessions
  add column game_options jsonb not null default '{}'::jsonb check (jsonb_typeof(game_options) = 'object');

-- One power-up per player per question. Server only (no grants, no policies).
create table public.quiz_powerup_uses (
  player_id uuid not null references public.quiz_players(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  kind text not null check (kind in ('double', 'fifty')),
  created_at timestamptz not null default now(),
  primary key (player_id, question_id)
);
alter table public.quiz_powerup_uses enable row level security;
revoke all on public.quiz_powerup_uses from anon, authenticated;
grant all on public.quiz_powerup_uses to service_role;

-- ---- Recording an answer ----
-- The server works out the points, the bonus and the new streak; this only writes them in one step. It still refuses
-- a second answer and an answer to a question the game has moved on from.
drop function if exists public.quiz_record_answer(uuid, uuid, uuid, integer, integer, integer);
create or replace function public.quiz_record_answer(
  p_session uuid, p_player uuid, p_question uuid, p_index integer, p_chosen integer, p_points integer,
  p_bonus integer, p_correct boolean, p_text text, p_powerup text, p_streak integer, p_elapsed integer
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

  insert into public.quiz_answers
    (session_id, player_id, question_id, chosen_index, points_awarded, bonus_points, correct, answer_text, powerup, elapsed_ms)
  values (p_session, p_player, p_question, p_chosen, p_points, p_bonus, p_correct, p_text, p_powerup, p_elapsed)
  on conflict (player_id, question_id) do nothing;
  if not found then return false; end if;

  update public.quiz_players set total_score = total_score + p_points, streak = p_streak where id = p_player;
  return true;
end;
$$;
revoke execute on function public.quiz_record_answer(uuid, uuid, uuid, integer, integer, integer, integer, boolean, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.quiz_record_answer(uuid, uuid, uuid, integer, integer, integer, integer, boolean, text, text, integer, integer) to service_role;

-- Skipping a question also has to undo the streak effects: recompute streaks from the answers that remain.
create or replace function public.quiz_skip_question(p_session uuid, p_question uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare removed integer;
begin
  update public.quiz_players p
     set total_score = p.total_score - a.points_awarded
    from public.quiz_answers a
   where a.session_id = p_session and a.question_id = p_question and a.player_id = p.id;
  delete from public.quiz_answers where session_id = p_session and question_id = p_question;
  get diagnostics removed = row_count;
  -- A discarded question must not change anyone's streak: rebuild it from the answers that are left, newest first.
  update public.quiz_players p set streak = coalesce((
    select count(*) from (
      select a.correct,
             sum(case when a.correct is distinct from true then 1 else 0 end) over (order by a.answered_at desc rows unbounded preceding) as misses
        from public.quiz_answers a
        join public.quiz_questions q on q.id = a.question_id
       where a.player_id = p.id and q.type <> 'poll'
    ) t where t.misses = 0
  ), 0) where p.session_id = p_session;
  return removed;
end;
$$;
