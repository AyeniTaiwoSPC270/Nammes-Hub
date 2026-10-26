-- Rollback for 20261026120000_analytics.sql
--
-- Drops the dashboards's own objects and restores purge_old_data to the body it had before the page
-- views were added. contact_messages.handled_at/handled_by are dropped too, which loses which messages
-- had been dealt with -- that is the cost of removing the state the metric was built on.

drop function if exists public.admin_analytics(integer);
drop function if exists public.record_page_view(text, text, text, text);

drop policy if exists page_views_select_admin on public.page_views;
drop table if exists public.page_views;

drop policy if exists contact_messages_update_admin on public.contact_messages;
alter table public.contact_messages
  drop column if exists handled_by,
  drop column if exists handled_at;

delete from public.feature_flags where key = 'analytics';

create or replace function public.purge_old_data()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.contact_messages where created_at < now() - interval '12 months';
  delete from public.error_log where at < now() - interval '30 days';
$$;
