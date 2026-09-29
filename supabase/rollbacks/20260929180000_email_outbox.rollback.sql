-- Turn the schedule off first if it was switched on: select cron.unschedule('email-worker');
create or replace function public.purge_old_data()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.contact_messages where created_at < now() - interval '12 months';
  delete from public.error_log where at < now() - interval '30 days';
$$;
drop function if exists public.run_email_worker();
drop function if exists public.email_queue_stats();
drop function if exists public.claim_email_batch(int);
drop table if exists public.email_outbox;
