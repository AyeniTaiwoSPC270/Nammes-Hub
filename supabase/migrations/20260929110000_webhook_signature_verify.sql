-- Verifies a signed webhook request. The signature is HMAC-SHA256 over "<timestamp>.<table>.<record key>"
-- using the shared secret held in Vault, so the secret itself never travels with the request and a captured
-- request cannot be replayed later or reused for a different record.
create or replace function public.verify_webhook_signature(p_ts bigint, p_table text, p_key text, p_sig text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
  expected text;
begin
  if p_ts is null or p_table is null or p_key is null or p_sig is null then return false; end if;
  if abs(extract(epoch from now())::bigint - p_ts) > 300 then return false; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'webhook_shared_secret';
  if secret is null then return false; end if;
  expected := encode(extensions.hmac(p_ts::text || '.' || p_table || '.' || p_key, secret, 'sha256'), 'hex');
  return expected = lower(p_sig);
end $$;

revoke execute on function public.verify_webhook_signature(bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.verify_webhook_signature(bigint, text, text, text) to service_role;
