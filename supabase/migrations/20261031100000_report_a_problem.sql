-- Report a problem: a visitor flags a broken link or wrong fact on an outline, resource, news or
-- event page. The row lands in contact_messages like any other message, but under a `kind` so it
-- can never be mistaken for something a human owes a reply to -- that distinction is what keeps the
-- dashboard's "unanswered messages" number meaningful.
--
-- Design: docs/superpowers/specs/2026-10-31-report-a-problem-design.md

-- ===== Columns =====
alter table public.contact_messages
  add column if not exists kind text not null default 'message',
  add column if not exists category text,
  add column if not exists page_url text,
  add column if not exists page_title text;

-- A report has no name and no email by design: there is nothing to reply to, and demanding an
-- address would cost responses for no benefit. Dropping the nullability would leave the columns
-- unusable, so the message shape moves into the row-level check below instead -- a plain message
-- still cannot be saved without all three.
alter table public.contact_messages
  alter column name drop not null,
  alter column email drop not null,
  alter column message drop not null;

alter table public.contact_messages
  add constraint contact_messages_kind_check
    check (kind in ('message', 'report'));

alter table public.contact_messages
  add constraint contact_messages_shape_check check (
    (
      kind = 'message'
      and name is not null
      and email is not null
      and message is not null
      and char_length(message) between 1 and 5000
    )
    or (
      kind = 'report'
      and (category is null or category in ('broken_link', 'wrong_info', 'outdated', 'other'))
      and (page_url is null or (page_url like '/%' and char_length(page_url) <= 300))
      and (page_title is null or char_length(page_title) <= 200)
      and char_length(coalesce(message, '')) <= 1000
    )
  );

-- ===== Kill switch =====
-- Off until it is switched on from the System page: the link, the modal and the server branch all
-- disappear again without a deploy.
insert into public.feature_flags (key, enabled) values ('reports', false)
on conflict (key) do nothing;

-- ===== The contact alert must not fire for reports =====
-- notify_email_webhook() emails the owner on every contact_messages insert. A report is triaged in
-- the inbox with the handled tick, never replied to, so one email per bug report is pure noise.
-- Re-declared wholesale because that function is shared by three tables and `create or replace`
-- replaces the whole body: everything below the guard is copied verbatim from
-- 20260929131000_contact_message_alert.sql.
create or replace function public.notify_email_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
  target_url text;
  ts bigint := extract(epoch from now())::bigint;
  k text;
  sig text;
begin
  -- Only the contact table carries `kind`; to_jsonb(NEW) on the other two would read a key that is
  -- not there, so the guard stays inside this branch.
  if TG_TABLE_NAME = 'contact_messages' and (to_jsonb(NEW)->>'kind') = 'report' then
    return NEW;
  end if;

  select decrypted_secret into secret from vault.decrypted_secrets where name = 'webhook_shared_secret';
  -- Never block the insert that fired the trigger; without the secret the email is simply not sent.
  if secret is null then return NEW; end if;

  k := case TG_TABLE_NAME when 'profiles' then to_jsonb(NEW)->>'user_id' else to_jsonb(NEW)->>'id' end;
  sig := encode(extensions.hmac(ts::text || '.' || TG_TABLE_NAME || '.' || k, secret, 'sha256'), 'hex');

  target_url := case TG_TABLE_NAME
    when 'profiles' then 'https://www.nammeshub.com.ng/api/webhook-welcome'
    when 'contact_messages' then 'https://www.nammeshub.com.ng/api/webhook-contact'
    else 'https://www.nammeshub.com.ng/api/webhook-new-content'
  end;

  perform net.http_post(
    url := target_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-timestamp', ts::text,
      'x-webhook-signature', sig
    ),
    -- Contact messages send only their id (the handler re-reads the row), so visitor text never sits in request logs.
    body := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'record', case when TG_TABLE_NAME = 'contact_messages' then jsonb_build_object('id', k) else to_jsonb(NEW) end
    )
  );

  return NEW;
end;
$$;

drop trigger if exists contact_messages_notify on public.contact_messages;
create trigger contact_messages_notify after insert on public.contact_messages
  for each row execute function public.notify_email_webhook();
