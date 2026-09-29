-- Email queue. The API saves emails here and a worker (called every minute by pg_cron) sends them,
-- retrying failures with a growing delay. Nothing is lost if the email provider is briefly down.
-- Server only: no access for anon or authenticated. The owner sees counts through email_queue_stats().
-- NOTE: the schedule (run_email_worker) is switched on separately, AFTER the worker route is deployed.

create table public.email_outbox (
  id bigint generated always as identity primary key,
  kind text not null,
  to_email text not null,
  reply_to text,
  subject text not null,
  html text not null,
  dedupe_key text unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_due_idx on public.email_outbox (next_attempt_at) where status = 'pending';

alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
grant select, insert, update, delete on public.email_outbox to service_role;

-- Takes up to p_limit due emails and leases them for 5 minutes so two workers never send the same one.
create or replace function public.claim_email_batch(p_limit int)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select id from public.email_outbox
    where status = 'pending' and next_attempt_at <= now()
    order by id
    limit greatest(1, least(coalesce(p_limit, 100), 200))
    for update skip locked
  )
  update public.email_outbox o
  set attempts = o.attempts + 1, next_attempt_at = now() + interval '5 minutes'
  from due where o.id = due.id
  returning o.*;
end $$;
revoke execute on function public.claim_email_batch(int) from public, anon, authenticated;
grant execute on function public.claim_email_batch(int) to service_role;

-- Counts only, for the owner's System page.
create or replace function public.email_queue_stats()
returns table (pending bigint, failed bigint, sent_24h bigint, oldest_pending timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query select
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'failed'),
    count(*) filter (where status = 'sent' and sent_at > now() - interval '24 hours'),
    min(created_at) filter (where status = 'pending')
  from public.email_outbox;
end $$;
revoke execute on function public.email_queue_stats() from public, anon;
grant execute on function public.email_queue_stats() to authenticated;

-- Signed call to the worker route (same signing scheme as the content webhooks).
create or replace function public.run_email_worker()
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
  sig := encode(extensions.hmac(ts::text || '.email_outbox.tick', secret, 'sha256'), 'hex');
  perform net.http_post(
    url := 'https://www.nammeshub.com.ng/api/email-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-timestamp', ts::text,
      'x-webhook-signature', sig
    ),
    body := jsonb_build_object('table', 'email_outbox', 'record', jsonb_build_object('id', 'tick'))
  );
end $$;
revoke execute on function public.run_email_worker() from public, anon, authenticated;

-- Retention: finished and given-up emails contain recipients and message bodies, so they are cleared after 30 days.
create or replace function public.purge_old_data()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.contact_messages where created_at < now() - interval '12 months';
  delete from public.error_log where at < now() - interval '30 days';
  delete from public.email_outbox where status in ('sent', 'failed') and created_at < now() - interval '30 days';
$$;
revoke execute on function public.purge_old_data() from public, anon, authenticated;
