-- Live quiz battle mode, phase C: knockout bracket in a hosted game. Spec: docs/superpowers/specs/2026-10-01-quiz-battle-mode.md
-- Rollback in supabase/rollbacks/.

alter table public.quiz_sessions
  add column bracket_mode boolean not null default false,
  -- questions per match (best of N): a round is this many questions
  add column bracket_length smallint not null default 3 check (bracket_length in (1, 3, 5)),
  -- the skill of the bot that faces a player left without an opponent
  add column bracket_bot_skill text not null default 'average' check (bracket_bot_skill in ('beginner', 'average', 'expert', 'mixed')),
  -- fixed when the game starts
  add column bracket_rounds smallint check (bracket_rounds is null or bracket_rounds between 1 and 12),
  add column bracket_done boolean not null default false,
  add column bracket_champion uuid references public.quiz_players(id) on delete set null;

-- One row per match. Names and characters are copied in, so a match still reads correctly if a player is removed.
create table public.quiz_bracket_matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  round smallint not null check (round >= 0),
  slot smallint not null check (slot >= 0),
  player_a uuid references public.quiz_players(id) on delete set null,
  player_b uuid references public.quiz_players(id) on delete set null,
  name_a text,
  avatar_a smallint,
  name_b text,
  avatar_b smallint,
  -- the second side is a computer player (player_b stays empty)
  bot_b boolean not null default false,
  bot_skill text check (bot_skill in ('beginner', 'average', 'expert')),
  score_a integer,
  score_b integer,
  winner text check (winner in ('a', 'b')),
  settled_at timestamptz,
  unique (session_id, round, slot)
);
create index quiz_bracket_matches_session on public.quiz_bracket_matches (session_id, round);

-- Everyone can read a game's bracket (phones and the projector); only the server writes.
alter table public.quiz_bracket_matches enable row level security;
revoke all on public.quiz_bracket_matches from anon, authenticated;
grant select on public.quiz_bracket_matches to anon, authenticated;
create policy quiz_bracket_matches_read on public.quiz_bracket_matches for select to anon, authenticated using (true);
grant all on public.quiz_bracket_matches to service_role;
