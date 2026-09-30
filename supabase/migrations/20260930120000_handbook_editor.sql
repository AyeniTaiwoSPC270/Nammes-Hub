-- Admin > Handbook: admins edit the handbook's text, and the server rebuilds the PDF from those edits.
-- The original text lives in the repo (scripts/manual/content-*.mjs). These tables hold only what an admin
-- has changed, so deleting a row restores that chapter's original text.

create table public.handbook_chapters (
  id text primary key,
  title text,
  intro text,
  html text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- One row (id = 1). The first four columns are edited by admins; the rest describe the latest PDF build and are
-- written only by the server (service role).
create table public.handbook_settings (
  id smallint primary key default 1 check (id = 1),
  edition text,
  as_of text,
  foreword_html text,
  build_status text not null default 'idle' check (build_status in ('idle', 'building', 'done', 'failed')),
  build_started_at timestamptz,
  built_at timestamptz,
  built_pages integer,
  build_error text
);
insert into public.handbook_settings (id) values (1);

alter table public.handbook_chapters enable row level security;
alter table public.handbook_settings enable row level security;

revoke all on public.handbook_chapters, public.handbook_settings from anon, authenticated;
grant select, insert, update, delete on public.handbook_chapters to authenticated;
grant select on public.handbook_settings to authenticated;
grant update (edition, as_of, foreword_html) on public.handbook_settings to authenticated;

create policy handbook_chapters_admin on public.handbook_chapters for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy handbook_settings_select on public.handbook_settings for select to authenticated
  using ((select public.is_admin()));
create policy handbook_settings_update on public.handbook_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Two-factor enforcement (see admin_mfa_enforcement): same restrictive rules as the other admin tables.
do $$
declare t text;
begin
  foreach t in array array['handbook_chapters', 'handbook_settings'] loop
    execute format('create policy mfa_required_insert on public.%I as restrictive for insert with check ((select public.admin_mfa_ok()))', t);
    execute format('create policy mfa_required_update on public.%I as restrictive for update using ((select public.admin_mfa_ok())) with check ((select public.admin_mfa_ok()))', t);
    execute format('create policy mfa_required_delete on public.%I as restrictive for delete using ((select public.admin_mfa_ok()))', t);
  end loop;
end $$;

-- The address of the latest published PDF, shown on the footer and About page. Null = use the copy shipped with the site.
alter table public.site_content add column if not exists handbook_pdf_url text;

-- Published PDFs. Public to read; only the server (service role) uploads, so no insert/update/delete policy is added.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('handbook', 'handbook', true, 52428800, array['application/pdf'])
on conflict (id) do nothing;
