-- Undoes 20261009120000_calendar_reminders.sql.
--
-- Turn the schedule off FIRST if it was switched on: select cron.unschedule('calendar-reminders');
--
-- That is left as a comment for the same reason it is in 20260929180000_email_outbox.rollback.sql:1 -- this
-- migration never scheduled the job, so an unschedule of a job that was never created raises "job not found" and
-- aborts the rest of the rollback before the function and the template row are dropped. Do it by hand, in that
-- order, if the schedule is live.
drop function if exists public.run_calendar_reminders();

delete from public.email_templates where template_id = 'academic_reminder';

-- Any reminder already in the outbox keeps its row: email_outbox and its worker belong to
-- 20260929180000_email_outbox.sql and that rollback owns them.