drop policy if exists kill_member_uploads on storage.objects;
drop policy if exists kill_contact_insert on public.contact_messages;
drop policy if exists kill_forms_insert on public.form_responses;
drop policy if exists kill_nominations_update on public.award_nominations;
drop policy if exists kill_nominations_insert on public.award_nominations;
drop policy if exists kill_voting on public.award_votes;
drop function if exists public.feature_enabled(text);
drop table if exists public.feature_flags;
