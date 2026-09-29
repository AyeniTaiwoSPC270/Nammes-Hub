-- Restores the shared-secret header version of the trigger function (handlers still accept it until the legacy path is removed).
create or replace function public.notify_email_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
  target_url text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'webhook_shared_secret';
  target_url := case TG_TABLE_NAME
    when 'profiles' then 'https://www.nammeshub.com.ng/api/webhook-welcome'
    else 'https://www.nammeshub.com.ng/api/webhook-new-content'
  end;
  perform net.http_post(
    url := target_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'record', to_jsonb(NEW))
  );
  return NEW;
end;
$$;
