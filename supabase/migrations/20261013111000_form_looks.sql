-- Named saved appearances for the Form Design Studio (src/components/admin/forms/FormDesignModal.jsx), the
-- counterpart of quiz_looks and calendar_looks.
--
-- forms.theme holds one appearance per form, and the fourteen FORM_PRESETS (src/lib/formTheme.js:108) are compiled
-- into the bundle, so there was no way for an admin to keep the appearance they had just built. This is that.
--
-- Deliberately NOT owner-write, unlike calendar_looks: forms are admin-write
-- (supabase/history/02_2026-09-04_submissions_forms_profiles.sql:116-125, narrowed but not restricted to the owner),
-- and a form's appearance belongs to whoever can edit the form.

create table public.form_looks (
  id text primary key,
  name text not null check (char_length(name) between 1 and 40),
  design jsonb not null default '{}'::jsonb check (jsonb_typeof(design) = 'object'),
  created_at timestamptz not null default now()
);

-- Nothing indexes this by form: a look is not attached to one. The table holds one row per appearance an admin has
-- saved, which is a handful rather than a row per form.

alter table public.form_looks enable row level security;

-- Read is admin-only even though `forms` is public-read, because a saved appearance is only ever read by the studio.
revoke all on public.form_looks from anon, authenticated;
grant select, insert, update, delete on public.form_looks to authenticated;

create policy form_looks_admin_all on public.form_looks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Two-factor enforcement ----------
-- `forms` is in the 20260929150000_admin_mfa_enforcement.sql:28-33 list, so this table joins it rather than
-- following the quiz tables, which are not in it. Restrictive policies pass IN ADDITION to the one above.
do $$
declare t text;
begin
  foreach t in array array['form_looks'] loop
    execute format('create policy mfa_required_insert on public.%I as restrictive for insert with check ((select public.admin_mfa_ok()))', t);
    execute format('create policy mfa_required_update on public.%I as restrictive for update using ((select public.admin_mfa_ok())) with check ((select public.admin_mfa_ok()))', t);
    execute format('create policy mfa_required_delete on public.%I as restrictive for delete using ((select public.admin_mfa_ok()))', t);
  end loop;
end $$;
