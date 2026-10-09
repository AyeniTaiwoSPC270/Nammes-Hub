-- Undoes 20261009090000_calendar.sql. Order matters: the triggers go before the tables they are on,
-- because DROP TRIGGER ... ON <table> still requires the relation to resolve.
--
-- This migration seeds nothing but the calendar_settings row. The 26 senate rows arrive in
-- 20261009091000_calendar_seed.sql, so running this rollback after that migration drops them too --
-- run the seed migration's own rollback first if the rows are wanted.

drop trigger if exists academic_calendar_audit_del on public.academic_calendar;
drop trigger if exists academic_calendar_touch on public.academic_calendar;
drop trigger if exists calendar_settings_touch on public.calendar_settings;

drop function if exists public.touch_calendar_updated_at();

delete from public.feature_flags where key = 'calendar';

-- Added to this table in 20261009090000. Existing rows and the events table itself are untouched.
alter table public.events
  drop column if exists starts_at,
  drop column if exists ends_at,
  drop column if exists kind,
  drop column if exists remind_days;

drop table if exists public.calendar_looks;
drop table if exists public.calendar_settings;
drop table if exists public.academic_calendar;