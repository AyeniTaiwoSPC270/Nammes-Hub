-- Admin-chosen player limit per game, and the moment a lobby filled up (drives the 10-second auto-start countdown).
-- quizzes.max_players is the default offered when hosting; each game copies it, so editing a quiz never changes a running game.
alter table public.quizzes
  add column max_players integer not null default 50 check (max_players between 2 and 150);

alter table public.quiz_sessions
  add column max_players integer not null default 50 check (max_players between 2 and 150),
  add column full_at timestamptz;
