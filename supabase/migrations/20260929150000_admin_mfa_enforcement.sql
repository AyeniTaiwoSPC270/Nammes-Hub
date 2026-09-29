-- Two-factor enforcement for admin powers, controlled by a switch that ships OFF.
-- When feature_flags.require_admin_mfa is enabled, anyone listed in `admins` can write to admin-managed
-- tables and storage only if their session passed the second step (JWT aal = aal2). Everyone else is unaffected.
-- Emergency undo (works from the Supabase SQL editor even if you cannot sign in):
--   update public.feature_flags set enabled = false where key = 'require_admin_mfa';

insert into public.feature_flags (key, enabled) values ('require_admin_mfa', false)
on conflict (key) do nothing;

create or replace function public.admin_mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not coalesce((select enabled from public.feature_flags where key = 'require_admin_mfa'), false)
    or not exists (select 1 from public.admins where user_id = (select auth.uid()))
    or coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
$$;
grant execute on function public.admin_mfa_ok() to anon, authenticated;

-- Restrictive policies must pass IN ADDITION to the existing ones, so no existing rule is edited.
do $$
declare t text;
begin
  foreach t in array array[
    'admins', 'award_categories', 'award_nominations', 'award_nominees', 'award_seasons', 'award_votes',
    'contact_messages', 'email_templates', 'event_photos', 'events', 'excos', 'feature_flags',
    'form_questions', 'form_responses', 'forms', 'news', 'opportunities', 'outline_submissions',
    'outlines', 'page_banners', 'resources', 'site_content', 'timetables'
  ] loop
    execute format('create policy mfa_required_insert on public.%I as restrictive for insert with check ((select public.admin_mfa_ok()))', t);
    execute format('create policy mfa_required_update on public.%I as restrictive for update using ((select public.admin_mfa_ok())) with check ((select public.admin_mfa_ok()))', t);
    execute format('create policy mfa_required_delete on public.%I as restrictive for delete using ((select public.admin_mfa_ok()))', t);
  end loop;
end $$;

create policy mfa_required_insert on storage.objects as restrictive for insert
  with check ((select public.admin_mfa_ok()));
create policy mfa_required_update on storage.objects as restrictive for update
  using ((select public.admin_mfa_ok())) with check ((select public.admin_mfa_ok()));
create policy mfa_required_delete on storage.objects as restrictive for delete
  using ((select public.admin_mfa_ok()));
