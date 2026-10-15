-- Undoes 20261015100000_content_looks.sql. Order matters: the trigger goes before its table, because
-- DROP TRIGGER ... ON <table> still requires the relation to resolve, and content_settings goes before
-- content_looks because it holds the two foreign keys into it.
--
-- Same shape as 20261009090000_calendar.rollback.sql, which drops its touch function rather than leaving
-- it orphaned.
drop trigger if exists content_settings_touch on public.content_settings;

drop table if exists public.content_settings;

drop function if exists public.touch_content_updated_at();

drop table if exists public.content_looks;