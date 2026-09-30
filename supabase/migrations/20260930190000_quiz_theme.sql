-- Custom look for the live quiz ("Quiz Design Studio"): colours, backdrop, event headline and effects.
-- quizzes.theme is what the admin designs; each game copies it when it starts, so editing a quiz never restyles a running game.
-- The API cleans the theme before a game copies it, so a hand-edited row can never put unexpected values on the screens.
alter table public.quizzes
  add column theme jsonb not null default '{}'::jsonb check (jsonb_typeof(theme) = 'object' and pg_column_size(theme) < 4000);

alter table public.quiz_sessions
  add column theme jsonb not null default '{}'::jsonb check (jsonb_typeof(theme) = 'object' and pg_column_size(theme) < 4000);
