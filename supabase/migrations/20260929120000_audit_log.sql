-- Append-only trail of sensitive changes. Only the owner can read it; nobody can edit or delete rows.
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb
);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
create policy audit_log_select_owner on public.audit_log
  for select to authenticated using ((select public.is_owner()));

create or replace function public.log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb := case when TG_OP <> 'INSERT' then to_jsonb(OLD) end;
  new_row jsonb := case when TG_OP <> 'DELETE' then to_jsonb(NEW) end;
begin
  insert into public.audit_log (actor, action, entity, entity_id, before, after)
  values (
    (select auth.uid()), TG_OP, TG_TABLE_NAME,
    coalesce(new_row->>'id', new_row->>'user_id', new_row->>'template_id',
             old_row->>'id', old_row->>'user_id', old_row->>'template_id'),
    old_row, new_row
  );
  return coalesce(NEW, OLD);
end $$;

-- Account disabling is logged without copying the whole profile (which holds personal data).
create or replace function public.log_profile_disable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor, action, entity, entity_id, before, after)
  values ((select auth.uid()), 'UPDATE', 'profiles', NEW.user_id::text,
          jsonb_build_object('is_disabled', OLD.is_disabled),
          jsonb_build_object('is_disabled', NEW.is_disabled));
  return NEW;
end $$;

revoke execute on function public.log_change() from public, anon, authenticated;
revoke execute on function public.log_profile_disable() from public, anon, authenticated;

create trigger admins_audit after insert or update or delete on public.admins
  for each row execute function public.log_change();
create trigger broadcasts_audit after insert or update or delete on public.broadcasts
  for each row execute function public.log_change();
create trigger email_templates_audit after update on public.email_templates
  for each row execute function public.log_change();
create trigger news_audit_del after delete on public.news
  for each row execute function public.log_change();
create trigger events_audit_del after delete on public.events
  for each row execute function public.log_change();
create trigger forms_audit_del after delete on public.forms
  for each row execute function public.log_change();
create trigger profiles_disable_audit after update of is_disabled on public.profiles
  for each row when (old.is_disabled is distinct from new.is_disabled)
  execute function public.log_profile_disable();
