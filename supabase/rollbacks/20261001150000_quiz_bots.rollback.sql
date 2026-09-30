-- Rolls back 20261001150000_quiz_bots.sql.
alter table public.quiz_questions drop column if exists difficulty;
alter table public.quiz_players drop column if exists bot_skill;
