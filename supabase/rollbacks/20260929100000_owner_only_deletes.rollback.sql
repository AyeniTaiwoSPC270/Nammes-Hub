-- Restores "any admin may delete" on the five tables.
alter policy news_admin_delete on public.news using ((select auth.uid()) in (select user_id from public.admins));
alter policy events_admin_delete on public.events using ((select auth.uid()) in (select user_id from public.admins));
alter policy award_categories_delete_admin on public.award_categories using (exists (select 1 from public.admins where user_id = (select auth.uid())));
alter policy award_nominees_delete_admin on public.award_nominees using (exists (select 1 from public.admins where user_id = (select auth.uid())));
alter policy award_seasons_delete_admin on public.award_seasons using (exists (select 1 from public.admins where user_id = (select auth.uid())));
