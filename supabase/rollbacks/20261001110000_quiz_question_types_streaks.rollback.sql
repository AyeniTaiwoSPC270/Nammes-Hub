-- Rolls back 20261001110000_quiz_question_types_streaks.sql.
-- Questions that are not plain multiple choice (numeric, text, poll) and their answers are removed first, because the
-- old shape cannot hold them.
delete from public.quiz_answers where chosen_index is null;
delete from public.quiz_questions where type in ('numeric', 'text', 'poll');

drop function if exists public.quiz_record_answer(uuid, uuid, uuid, integer, integer, integer, integer, boolean, text, text, integer, integer);
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
  return removed;
end;
$$;

drop table if exists public.quiz_powerup_uses;
alter table public.quiz_sessions drop column if exists game_options;
alter table public.quizzes drop column if exists game_options;
alter table public.quiz_players drop column if exists powerups_used, drop column if exists streak;
alter table public.quiz_answers
  drop column if exists elapsed_ms, drop column if exists powerup, drop column if exists bonus_points,
  drop column if exists correct, drop column if exists answer_text;
alter table public.quiz_answers alter column chosen_index set not null;

alter table public.quiz_questions drop constraint if exists quiz_questions_shape;
alter table public.quiz_questions alter column correct_index set not null;
alter table public.quiz_questions
  add check (array_length(options, 1) between 2 and 4),
  add check (correct_index < array_length(options, 1));
alter table public.quiz_questions
  drop column if exists points_multiplier, drop column if exists accepted_answers,
  drop column if exists numeric_tolerance, drop column if exists numeric_answer, drop column if exists type;
