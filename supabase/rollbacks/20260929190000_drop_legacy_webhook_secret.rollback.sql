create or replace function public.verify_webhook_secret(candidate text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'webhook_shared_secret' and decrypted_secret = candidate
  );
$$;
revoke execute on function public.verify_webhook_secret(text) from public, anon, authenticated;
