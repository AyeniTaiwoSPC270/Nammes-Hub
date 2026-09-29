-- Data retention and account anonymisation.
-- Retention: contact messages are kept 12 months, server error entries 30 days. The audit log is kept
-- (it does not hold personal data). Run daily by pg_cron.
-- Anonymise: for accounts that cannot be deleted because votes/submissions point at them. Removes the
-- personal details but keeps the records, which then show as an unknown user.

create extension if not exists pg_cron;

create or replace function public.purge_old_data()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.contact_messages where created_at < now() - interval '12 months';
  delete from public.error_log where at < now() - interval '30 days';
$$;
revoke execute on function public.purge_old_data() from public, anon, authenticated;

create or replace function public.anonymise_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.admins where user_id = p_user) then
    raise exception 'Remove admin access before anonymising this account';
  end if;
  delete from public.profiles where user_id = p_user;
  delete from public.cgpa_semesters where user_id = p_user;
  update public.form_responses set respondent_email = null where respondent_id = p_user;
end $$;
revoke execute on function public.anonymise_user(uuid) from public, anon, authenticated;
grant execute on function public.anonymise_user(uuid) to service_role;

select cron.schedule('purge-old-data', '17 3 * * *', 'select public.purge_old_data()');
