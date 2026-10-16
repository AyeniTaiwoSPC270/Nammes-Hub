-- Rejoin: a student whose phone dropped should get their seat and score back, not "that nickname is taken".
--
-- Two halves. This file is the schema half plus the hosted-session cleanup the codebase was missing; the
-- token-to-resume behaviour is api/_lib/handlers/quiz-join.js and the durable browser half is PlayQuiz.jsx.

alter table public.quiz_players add column if not exists left_at timestamptz;

comment on column public.quiz_players.left_at is
  'When this player stopped playing. Null while they still hold their seat, so a partial unique index on the nickname can ignore them.';

-- A nickname only has to be unique while that player is still playing, so the constraint is narrowed the same way
-- quiz_sessions_active_code is (20260930150000:38 -- "A join code only has to be unique while its game is still
-- running"). That index is the codebase's own pattern for this, not an invention.
--
-- HONEST SCOPE NOTE: nothing writes left_at yet, so this change is behaviourally identical to the index it replaces.
-- Durable rejoin is delivered by the localStorage token + resume path in quiz-join.js, not by this. It is here so the
-- next soft-delete does not have to drop and rebuild an index while a game is running.
--
-- Making kick soft rather than a delete is NOT a one-line follow-up: kick currently deletes the row, which is what
-- fails the kicked player's token lookup on their next call. Marking left_at instead keeps the row, so every roster,
-- player-count, team-member and CSV query that counts players would also have to filter on left_at is null, and any
-- one that misses it silently inflates the lobby count and the player limit. That is a deliberate separate change.
drop index if exists public.quiz_players_nickname;
create unique index if not exists quiz_players_nickname
  on public.quiz_players (session_id, lower(nickname))
  where left_at is null;

-- quiz_sessions is the root of the hosted quiz tree (players, teams, answers, tokens and the result cards all hang
-- off it by on delete cascade), and unlike practice, battles and community sets it had no cleanup at all. Ninety days
-- is what HostQuiz.jsx's CSV export and AdminQuizReport.jsx are allowed to assume they can still read a game back.
--
-- Only finished games go. An abandoned lobby is still being looked at, and deleting it would hand its join code to
-- whoever tries it next.
create or replace function public.quiz_session_cleanup(p_days integer default 90) returns integer
  language sql
  security invoker
  set search_path = public
as $$
  with gone as (
    delete from public.quiz_sessions
     where state = 'finished'
       and finished_at is not null
       and finished_at < now() - make_interval(days => p_days)
    returning 1
  ) select count(*)::integer from gone;
$$;
revoke execute on function public.quiz_session_cleanup(integer) from public, anon, authenticated;
grant execute on function public.quiz_session_cleanup(integer) to service_role;

-- Returns the row count, so a dry run is the same call with the delete removed. No window shorter than 90 days.
--
-- Forty-one past three, so it misses the top of the hour that every other schedule in this database shares
-- (20261009120000:53 records that pattern). Scheduled here rather than left as a comment because this is pure SQL:
-- the calendar reminders job waits for a route to be deployed first, and there is no route here to wait for.
select cron.schedule('quiz-session-cleanup', '41 3 * * *', 'select public.quiz_session_cleanup()');