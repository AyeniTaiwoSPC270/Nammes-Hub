select cron.unschedule('purge-old-data');
drop function if exists public.anonymise_user(uuid);
drop function if exists public.purge_old_data();
-- pg_cron extension left installed.
