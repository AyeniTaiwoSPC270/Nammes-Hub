-- Owner-controlled kill switches. Turning a flag off blocks that action for everyone
-- (admins excepted for uploads) without touching the existing access rules: each switch is a
-- RESTRICTIVE policy, which must pass in addition to the normal policies.
create table public.feature_flags (
  key text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.feature_flags (key) values ('voting'), ('nominations'), ('uploads'), ('broadcasts'), ('public_forms');

alter table public.feature_flags enable row level security;
revoke all on public.feature_flags from anon, authenticated;
grant select on public.feature_flags to anon, authenticated;
grant update (enabled, updated_at) on public.feature_flags to authenticated;
create policy feature_flags_select on public.feature_flags for select to anon, authenticated using (true);
create policy feature_flags_update_owner on public.feature_flags for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create or replace function public.feature_enabled(p_key text)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((select enabled from public.feature_flags where key = p_key), true)
$$;
grant execute on function public.feature_enabled(text) to anon, authenticated;

create policy kill_voting on public.award_votes as restrictive for insert
  with check (public.feature_enabled('voting'));

create policy kill_nominations_insert on public.award_nominations as restrictive for insert
  with check (public.feature_enabled('nominations'));
create policy kill_nominations_update on public.award_nominations as restrictive for update
  using (public.feature_enabled('nominations')) with check (public.feature_enabled('nominations'));

create policy kill_forms_insert on public.form_responses as restrictive for insert
  with check (public.feature_enabled('public_forms'));
create policy kill_contact_insert on public.contact_messages as restrictive for insert
  with check (public.feature_enabled('public_forms'));

create policy kill_member_uploads on storage.objects as restrictive for insert
  with check (
    bucket_id not in ('award-nominee-photos', 'outline-attachments', 'form-uploads')
    or public.feature_enabled('uploads')
    or public.is_admin()
  );
