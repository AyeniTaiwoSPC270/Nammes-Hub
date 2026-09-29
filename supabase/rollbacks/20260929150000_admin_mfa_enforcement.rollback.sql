-- Removes two-factor enforcement completely.
do $$
declare t text;
begin
  foreach t in array array[
    'admins', 'award_categories', 'award_nominations', 'award_nominees', 'award_seasons', 'award_votes',
    'contact_messages', 'email_templates', 'event_photos', 'events', 'excos', 'feature_flags',
    'form_questions', 'form_responses', 'forms', 'news', 'opportunities', 'outline_submissions',
    'outlines', 'page_banners', 'resources', 'site_content', 'timetables'
  ] loop
    execute format('drop policy if exists mfa_required_insert on public.%I', t);
    execute format('drop policy if exists mfa_required_update on public.%I', t);
    execute format('drop policy if exists mfa_required_delete on public.%I', t);
  end loop;
end $$;
drop policy if exists mfa_required_insert on storage.objects;
drop policy if exists mfa_required_update on storage.objects;
drop policy if exists mfa_required_delete on storage.objects;
drop function if exists public.admin_mfa_ok();
delete from public.feature_flags where key = 'require_admin_mfa';
