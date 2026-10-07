-- Rolls back 20261007120000_quiz_question_draw.sql.
--
-- Put the battle ceiling back before dropping anything else, so the table is never briefly without a check on
-- question_ids.
alter table public.quiz_battles drop constraint if exists quiz_battles_question_ids_check;
alter table public.quiz_battles add constraint quiz_battles_question_ids_check check (cardinality(question_ids) between 1 and 12);

-- Games, battles and practice runs that started while these columns existed lose their frozen question list. Their rows
-- stay, and they fall back to playing every question in position order, which is what they did before question banks.
alter table public.quiz_battles drop column if exists option_orders;
alter table public.quiz_practice_runs drop column if exists option_orders;
alter table public.quiz_practice_runs drop column if exists question_ids;
alter table public.quiz_sessions drop column if exists option_orders;
alter table public.quiz_sessions drop column if exists question_ids;
alter table public.quizzes drop column if exists battle_question_count;
alter table public.quizzes drop column if exists draw_settings;