-- The quiz autopilot's own clock, switched on.
--
-- 20261109120000_quiz_open_sessions.sql:30 created run_quiz_tick() and left the `cron.schedule` call commented
-- (:57) to be run by hand once the route was deployed. It never was, so the only engine left running an open or
-- scheduled quiz was a phone's `quiz-state` poll: a game whose last tab was closed sat on whatever step it was on
-- until that phone came back, and an empty lobby never expired off /play/open. That is the reported "the game only
-- continues when I come back".
--
-- Five seconds, not the one minute the calendar reminders use. A minute is the floor of five-field cron syntax and
-- it is far too coarse for a game: a twenty-second question would sit closed for up to a minute, and a bot that
-- thinks for three seconds would be asked to answer a question it had already missed. Supabase's pg_cron accepts a
-- seconds interval in place of the expression (Postgres 15.1.1.61+), so every transition lands within five seconds
-- of its deadline and a room with nobody in it keeps the time it would have kept with everybody watching.
--
-- The command returns early when no autopilot game is open, because this fires 17,280 times a day otherwise and a
-- tick against nothing is a Vercel invocation for nothing. `cron.schedule` updates a job of the same name, so a
-- project where it was already scheduled by hand ends up with this definition rather than a duplicate.
select cron.schedule('quiz-tick', '5 seconds', $$
  select public.run_quiz_tick()
  where exists (
    select 1 from public.quiz_sessions
    where autopilot and state <> 'finished'
  );
$$);
