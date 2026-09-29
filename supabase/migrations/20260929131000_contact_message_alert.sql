-- Emails the owner when a contact message arrives, through the same signed webhook used for news and events.
-- Apply ONLY after /api/webhook-contact is deployed.
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

create trigger contact_messages_notify after insert on public.contact_messages
  for each row execute function public.notify_email_webhook();
