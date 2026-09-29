-- SECURITY FIX: any signed-in user could add themselves to `admins`.
-- The old INSERT policy allowed any row with is_owner = false and never checked the caller.
-- Now only the owner can add admins, and never as another owner (use transfer_ownership()).

drop policy if exists admins_insert_admin on public.admins;
create policy admins_insert_admin on public.admins
  for insert to authenticated
  with check (public.is_owner() and is_owner = false);

drop policy if exists admins_delete_admin on public.admins;
create policy admins_delete_admin on public.admins
  for delete to authenticated
  using (public.is_owner());

drop policy if exists admins_select_admin_all on public.admins;
create policy admins_select_admin_all on public.admins
  for select to authenticated
  using (public.is_admin());

drop policy if exists admins_self_select on public.admins;
create policy admins_self_select on public.admins
  for select to authenticated
  using ((select auth.uid()) = user_id);
