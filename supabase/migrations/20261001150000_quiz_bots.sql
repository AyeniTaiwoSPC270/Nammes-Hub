-- Test bots for the live quiz: admins can add computer players to a game's lobby, and each question can say how
-- hard it is so the bots know how likely they are to get it right. Rollback in supabase/rollbacks/.

-- A bot player has a skill level; real players leave it empty.
alter table public.quiz_players
  add column bot_skill text check (bot_skill in ('beginner', 'average', 'expert'));

-- How hard a question is (the editor sets it). Empty means "work it out from the points".
alter table public.quiz_questions
  add column difficulty text check (difficulty in ('easy', 'medium', 'hard'));
