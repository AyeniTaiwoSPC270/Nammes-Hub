-- Reminder emails for the academic calendar.
--
-- Two things live here: the `academic_reminder` row in email_templates, so the reminder's look is designable in
-- the email studio that already exists (spec section 9) rather than on a parallel surface, and the signed
-- function pg_cron calls to reach the handler.
--
-- The html column is deliberately empty, exactly as it is for `welcome` and `new_content`
-- (20260930100000_email_design_studio.sql:12-14): an automatic email's content is fixed by the app
-- (api/_lib/emailDesign.js academicReminderContent) and only its design is an admin's to change.
--
-- NOTE: the schedule (calendar-reminders) is switched on separately, AFTER the route is deployed. Same rule as
-- 20260929180000_email_outbox.sql:4 -- a cron tick against a rewrite that is not deployed yet is a 404 every
-- day, and an automatic 404 nobody chose is harder to trace than one chosen on purpose.

insert into public.email_templates (template_id, html)
values ('academic_reminder', '')
on conflict (template_id) do nothing;

-- Signed call to the calendar reminder route. Copied from run_email_worker
-- (20260929180000_email_outbox.sql:71-95) rather than generalised: the signing scheme, the Vault lookup and the
-- revoke are the whole security boundary of this route, and one implementation of it is one thing to audit.
-- The table/key pair is 'academic_calendar'/'remind', which no other caller signs, so an email_outbox/tick
-- signature cannot be replayed here (webhookAuth.js:10 signs over these three parts only).
create or replace function public.run_calendar_reminders()
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
  sig := encode(extensions.hmac(ts::text || '.academic_calendar.remind', secret, 'sha256'), 'hex');
  perform net.http_post(
    url := 'https://www.nammeshub.com.ng/api/calendar-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-timestamp', ts::text,
      'x-webhook-signature', sig
    ),
    body := jsonb_build_object('table', 'academic_calendar', 'record', jsonb_build_object('id', 'remind'))
  );
end $$;
revoke execute on function public.run_calendar_reminders() from public, anon, authenticated;

-- Switch the schedule on after the route is deployed:
--   select cron.schedule('calendar-reminders', '7 * * * *', 'select public.run_calendar_reminders()');
--
-- Hourly, seven minutes past, so it misses the :00 spike every other schedule in this database shares. It does
-- not need to run more often: a reminder is due for the whole Lagos day, so any tick inside that day catches it,
-- and the dedupe key on the queued rows means the extra ticks queue nothing.