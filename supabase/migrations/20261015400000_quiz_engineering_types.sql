-- Units, ordering and diagram questions.
--
-- Everything here is additive. No existing column is retyped and no existing question is touched, because every type
-- so far is still a legal row and the shape constraint has to keep accepting them.

-- ---- Units: a numeric question with a unit attached ----
-- numeric_answer and numeric_tolerance are untouched on purpose. Keeping the number bare is what lets the existing
-- tolerance code work unchanged, and it is what stops a unit alias from ever scaling a magnitude.
alter table public.quiz_questions
  add column numeric_unit text check (numeric_unit is null or char_length(numeric_unit) between 1 and 12),
  add column numeric_unit_aliases text[] not null default '{}';

-- The aliases are the per-question safety valve. There is deliberately no global unit registry: one is where `N` and
-- `kN` eventually merge, and a question answered in kN would then accept 2500 N.

-- ---- Diagram targets ----
-- Normalised to the image's own box, 0..1, with r a fraction of min(width, height) so a marker stays circular on any
-- display. Normalised rather than pixels because processQuizImage downscales to 1280px on upload: a stored pixel
-- coordinate does not survive the admin re-uploading the same picture at a smaller size.
alter table public.quiz_questions
  add column diagram_targets jsonb not null default '[]'::jsonb
    check (jsonb_typeof(diagram_targets) = 'array');

-- ---- Answer columns ----
-- chosen_index is already nullable, so there is no NOT NULL fight. What does not fit in a smallint is a permutation
-- (order_answer) or a graded fraction (credit).
alter table public.quiz_answers          add column order_answer smallint[], add column credit numeric;
alter table public.quiz_practice_answers add column order_answer smallint[], add column credit numeric;
alter table public.quiz_battle_answers   add column order_answer smallint[], add column credit numeric;

-- credit is not derivable from points_awarded after the fact: the speed scaling, the streak bonus, the comeback
-- boost and the 2x multiplier all mutate that figure, so "4 of 6 steps in the right place" cannot be reconstructed
-- from it. It is stored once at grading time instead.
comment on column public.quiz_answers.credit is
  'fraction of the answer that was correct, stored at grading time; null for a single-answer question';

-- ---- The shape constraint ----
-- Rebuilt rather than widened: quiz_questions_shape is a single check over the whole row, and an ordering question
-- with no options or a diagram question with no picture would otherwise be accepted by the old constraint.
alter table public.quiz_questions drop constraint if exists quiz_questions_shape;
alter table public.quiz_questions
  add constraint quiz_questions_shape check (
    (type = 'multiple'    and array_length(options, 1) between 2 and 4 and correct_index is not null and correct_index < array_length(options, 1))
    or (type = 'truefalse' and array_length(options, 1) = 2 and correct_index is not null and correct_index < 2)
    or (type = 'poll'       and array_length(options, 1) between 2 and 4)
    or (type = 'numeric'    and numeric_answer is not null)
    or (type = 'text'       and coalesce(array_length(accepted_answers, 1), 0) between 1 and 8)
    or (type = 'order'      and coalesce(array_length(options, 1), 0) between 2 and 12)
    or (type = 'diagram'    and image_path is not null and jsonb_array_length(diagram_targets) between 1 and 12)
  );

-- ---- Recording: three signature changes ----
-- Each is a drop + recreate because Postgres will not replace an existing signature, which is why the file at
-- 20261001110000:76 already does this for the 6-argument version. The old overloads are dropped so nothing can keep
-- calling the version that silently discards a partial answer's credit.

drop function if exists public.quiz_record_answer(uuid, uuid, uuid, integer, integer, integer, integer, boolean, text, text, integer, integer);
create or replace function public.quiz_record_answer(
  p_session uuid, p_player uuid, p_question uuid, p_index integer, p_chosen integer, p_points integer,
  p_bonus integer, p_correct boolean, p_text text, p_powerup text, p_streak integer, p_elapsed integer,
  p_order smallint[], p_credit numeric
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
    (session_id, player_id, question_id, chosen_index, points_awarded, bonus_points, correct, answer_text,
     powerup, elapsed_ms, order_answer, credit)
  values (p_session, p_player, p_question, p_chosen, p_points, p_bonus, p_correct, p_text,
          p_powerup, p_elapsed, p_order, p_credit)
  on conflict (player_id, question_id) do nothing;
  if not found then return false; end if;

  update public.quiz_players set total_score = total_score + p_points, streak = p_streak where id = p_player;
  return true;
end;
$$;
revoke execute on function public.quiz_record_answer(uuid, uuid, uuid, integer, integer, integer, integer, boolean, text, text, integer, integer, smallint[], numeric) from public, anon, authenticated;
grant execute on function public.quiz_record_answer(uuid, uuid, uuid, integer, integer, integer, integer, boolean, text, text, integer, integer, smallint[], numeric) to service_role;

drop function if exists public.quiz_practice_record(uuid, uuid, integer, text, boolean, integer);
create or replace function public.quiz_practice_record(
  p_run uuid, p_question uuid, p_chosen integer, p_text text, p_correct boolean, p_points integer,
  p_order smallint[], p_credit numeric
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.quiz_practice_answers
    (run_id, question_id, chosen_index, answer_text, correct, points_awarded, order_answer, credit)
  values (p_run, p_question, p_chosen, p_text, p_correct, p_points, p_order, p_credit)
  on conflict (run_id, question_id) do nothing;
  if not found then return false; end if;
  update public.quiz_practice_runs set total_score = total_score + p_points where id = p_run;
  return true;
end;
$$;
revoke execute on function public.quiz_practice_record(uuid, uuid, integer, text, boolean, integer, smallint[], numeric) from public, anon, authenticated;
grant execute on function public.quiz_practice_record(uuid, uuid, integer, text, boolean, integer, smallint[], numeric) to service_role;

drop function if exists public.quiz_battle_record(uuid, text, uuid, integer, text, boolean, integer, integer);
create or replace function public.quiz_battle_record(
  p_battle uuid, p_slot text, p_question uuid, p_chosen integer, p_text text, p_correct boolean, p_points integer,
  p_elapsed integer, p_order smallint[], p_credit numeric
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.quiz_battle_answers
    (battle_id, slot, question_id, chosen_index, answer_text, correct, points_awarded, elapsed_ms, order_answer, credit)
  values (p_battle, p_slot, p_question, p_chosen, p_text, p_correct, p_points, p_elapsed, p_order, p_credit)
  on conflict (battle_id, slot, question_id) do nothing;
  if not found then return false; end if;
  update public.quiz_battle_sides set total_score = total_score + p_points where battle_id = p_battle and slot = p_slot;
  return true;
end;
$$;
revoke execute on function public.quiz_battle_record(uuid, text, uuid, integer, text, boolean, integer, integer, smallint[], numeric) from public, anon, authenticated;
grant execute on function public.quiz_battle_record(uuid, text, uuid, integer, text, boolean, integer, integer, smallint[], numeric) to service_role;