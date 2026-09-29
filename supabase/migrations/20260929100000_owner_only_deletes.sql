-- Deleting published content is owner-only, matching insert/update on the same tables.
-- Non-owner admins are unaffected for everything else; a blocked delete removes 0 rows,
-- which the admin screens already report as "no changes were saved".
alter policy news_admin_delete on public.news using ((select public.is_owner()));
alter policy events_admin_delete on public.events using ((select public.is_owner()));
alter policy award_categories_delete_admin on public.award_categories using ((select public.is_owner()));
alter policy award_nominees_delete_admin on public.award_nominees using ((select public.is_owner()));
alter policy award_seasons_delete_admin on public.award_seasons using ((select public.is_owner()));
