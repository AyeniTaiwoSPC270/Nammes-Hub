-- Open quizzes: a game that is listed to players and runs without a human on the host screen.
-- Spec: docs/superpowers/specs/2026-11-09-open-quizzes-design.md
--
-- The clock has always lived in the host tab (`AUTO_ADVANCE_MS`, the 10-second full-lobby start, the question
-- expiry), so closing that tab stopped the game. These columns let the server own the same transitions:
-- `autopilot` says it may, `state_changed_at` says how long the current step has been up, and `lobby_start_at`
-- says when the 60-second lobby wait began.

alter table public.quiz_sessions
  add column if not exists scheduled_at timestamptz,
  add column if not exists open_join boolean not null default false,
  add column if not exists autopilot boolean not null default false,
  -- Every step writes it. A reveal that has been up for two seconds and one that has been up for twenty minutes
  -- are the same row without this, and the tick would step the second one immediately.
  add column if not exists state_changed_at timestamptz not null default now(),
  -- max(scheduled_at, first join), written once. A column rather than a min(joined_at) aggregate because every
  -- phone poll reads it and the projector counts down from it.
  add column if not exists lobby_start_at timestamptz;

-- The listing reads open sessions that are not finished, and the tick reads autopilot ones. Both are small
-- subsets of a table that only ever grows.
create index if not exists quiz_sessions_open on public.quiz_sessions (state, scheduled_at) where open_join;
create index if not exists quiz_sessions_autopilot on public.quiz_sessions (state) where autopilot;

-- Signed call to the quiz tick, copied from run_calendar_reminders (20261009120000_calendar_reminders.sql:31-68)
-- rather than generalised: the signing scheme, the Vault lookup and the revoke are the whole security boundary of
-- the route, and one implementation of it is one thing to audit. The table/key pair is 'quiz_sessions'/'tick',
-- which no other caller signs, so an email_outbox/tick or academic_calendar/remind signature cannot be replayed
-- here (webhookAuth.js:10 signs over these three parts only).
create or replace function public.run_quiz_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
  ts bigint := extract(epoch from now())::bigint;
  sig text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'webhook_shared_secret';
  if secret is null then return; end if;
  sig := encode(extensions.hmac(ts::text || '.quiz_sessions.tick', secret, 'sha256'), 'hex');
  perform net.http_post(
    url := 'https://www.nammeshub.com.ng/api/quiz?action=tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-timestamp', ts::text,
      'x-webhook-signature', sig
    ),
    body := jsonb_build_object('table', 'quiz_sessions', 'record', jsonb_build_object('id', 'tick'))
  );
end $$;
revoke execute on function public.run_quiz_tick() from public, anon, authenticated;

-- Switch the schedule on after the route is deployed:
--   select cron.schedule('quiz-tick', '* * * * *', 'select public.run_quiz_tick()');
--
-- Every minute, as the calendar reminders are, and for the same reason: a tick against a rewrite that is not
-- deployed yet is a 404 every minute. Sub-minute precision does not come from this schedule -- player polls
-- advance a room that is being watched (quiz-state.js), and this is what expires an empty lobby and finishes a
-- game nobody is looking at.
