-- Email design studio.
--  * email_templates.design: a saved visual design per template. Null keeps the template's HTML as it is.
--  * email_templates rows for the automatic emails (welcome, new_content) so their look can be designed too.
--    Their html stays empty: their content is fixed by the app.
--  * broadcasts.blocks / .design: what was actually sent, for history.
--  * email_styles: named, reusable looks ("Exam notice") any admin can apply to a broadcast.
--  * broadcast_drafts: unfinished broadcasts, private to the admin who wrote them.
-- The app validates and clamps all JSON (api/_lib/emailDesign.js) before saving and before rendering.

alter table public.email_templates add column if not exists design jsonb;

insert into public.email_templates (template_id, html)
values ('welcome', ''), ('new_content', '')
on conflict (template_id) do nothing;

alter table public.broadcasts
  add column if not exists blocks jsonb,
  add column if not exists design jsonb;

-- ---------- saved styles ----------
create table public.email_styles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  design jsonb not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.email_styles enable row level security;

create policy email_styles_admin_all on public.email_styles
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------- drafts ----------
create table public.broadcast_drafts (
  id uuid primary key default gen_random_uuid(),
  subject text not null default '' check (char_length(subject) <= 200),
  template_id text not null default 'default',
  blocks jsonb not null default '[]'::jsonb,
  design jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.broadcast_drafts enable row level security;

create policy broadcast_drafts_own on public.broadcast_drafts
  for all to authenticated
  using (created_by = (select auth.uid()) and (select public.is_admin()))
  with check (created_by = (select auth.uid()) and (select public.is_admin()));

-- ---------- grants ----------
revoke all on public.email_styles, public.broadcast_drafts from anon;
grant select, insert, update, delete on public.email_styles, public.broadcast_drafts to authenticated;

-- ---------- two-factor enforcement (same switch as every other admin table) ----------
do $$
declare t text;
begin
  foreach t in array array['email_styles', 'broadcast_drafts'] loop
    execute format('create policy mfa_required_insert on public.%I as restrictive for insert with check ((select public.admin_mfa_ok()))', t);
    execute format('create policy mfa_required_update on public.%I as restrictive for update using ((select public.admin_mfa_ok())) with check ((select public.admin_mfa_ok()))', t);
    execute format('create policy mfa_required_delete on public.%I as restrictive for delete using ((select public.admin_mfa_ok()))', t);
  end loop;
end $$;
