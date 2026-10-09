-- Undoes 20261009091000_calendar_seed.sql.
--
-- Deletes only the 26 seeded rows, matched by id prefix rather than by session: once admins can add
-- their own entries (task T9) a `where session = '2026/2027'` would take those with it. Ids minted
-- outside this migration do not carry the prefix, so they survive.
--
-- The table, its RLS and its triggers belong to 20261009090000 and are left alone; run that
-- migration's own rollback afterwards if you want the whole feature gone.

delete from public.academic_calendar where id like '2026-2027-s1-%' or id like '2026-2027-s2-%';

delete from public.page_banners where page_key = 'calendar';