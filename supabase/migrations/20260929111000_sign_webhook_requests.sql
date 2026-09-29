-- The webhook trigger now sends a signed request instead of the raw shared secret.
-- Apply ONLY after the API handlers that verify signatures are deployed.
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
    else 'https://www.nammeshub.com.ng/api/webhook-new-content'
  end;

  perform net.http_post(
    url := target_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-timestamp', ts::text,
      'x-webhook-signature', sig
    ),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'record', to_jsonb(NEW))
  );

  return NEW;
end;
$$;
