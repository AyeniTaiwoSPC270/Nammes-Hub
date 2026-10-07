-- Question banks: an admin sets how many questions a game asks out of the ones the quiz holds, and whether the
-- questions and their answers are shuffled. Spec: docs/superpowers/specs/2026-10-07-quiz-question-banks.md
--
-- The draw happens once, when a game, a battle or a practice run starts, and the result is frozen onto that row. Phones
-- and the projector then read the same list and the same answer orders, so everyone sees one identical game. The columns
-- are all nullable, and a game started before this migration has them null and plays every question in position order
-- exactly as it did before.
--
-- Every column is a jsonb object check rather than a set of columns, matching cbt_settings: the settings are only ever
-- read together and cleaned in one place (quizDraw.js), so a single object keeps that one shape.

alter table public.quizzes
  -- { draw_count, shuffle_questions, shuffle_options }. All null or absent means "ask every question, in order, with the
  -- answers as written", which is how every quiz behaved before this.
  add column draw_settings jsonb check (draw_settings is null or jsonb_typeof(draw_settings) = 'object'),
  -- A battle is two people at their own pace, so it stays shorter than a hosted game. Null takes the quiz's own draw count.
  add column battle_question_count integer check (battle_question_count is null or battle_question_count between 1 and 50);

-- A hosted game and a practice run both walk a frozen list. quiz_practice_runs needs it as well as quiz_sessions because a
-- practice run is a row of its own, not a session.
alter table public.quiz_sessions
  -- The questions this game asks, in play order. Null for a game that started before this migration.
  add column question_ids uuid[],
  -- Which answer is shown where: option_orders[id][i] is the original position of the answer shown at i.
  add column option_orders jsonb check (option_orders is null or jsonb_typeof(option_orders) = 'object');

alter table public.quiz_practice_runs
  add column question_ids uuid[],
  add column option_orders jsonb check (option_orders is null or jsonb_typeof(option_orders) = 'object');

-- A battle already froze its question_ids when it was created, so it only needs the answer orders.
alter table public.quiz_battles
  add column option_orders jsonb check (option_orders is null or jsonb_typeof(option_orders) = 'object');

-- The ceiling on a battle was 12 here, 10 in BATTLE_MAX_QUESTIONS and 10 again in a literal in the battle handler: three
-- numbers for one thing. The admin now chooses (up to 50) and the code reads one constant, so this check just follows it
-- up. Existing battles hold at most 12 and stay valid.
--
-- Dropped by what the constraint checks rather than by its generated name, the same way the quiz_questions shape rules were
-- replaced in 20261001110000: a name that did not match would fail the whole migration halfway, leaving the columns added
-- but the old 12-question ceiling still in force.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.quiz_battles'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%cardinality(question_ids%'
  loop
    execute format('alter table public.quiz_battles drop constraint %I', c);
  end loop;
end $$;

alter table public.quiz_battles
  add constraint quiz_battles_question_ids_check check (cardinality(question_ids) between 1 and 50);