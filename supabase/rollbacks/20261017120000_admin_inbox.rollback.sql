-- Undoes 20261017120000_admin_inbox.sql.
-- The function first: the tables it reads can be dropped under it, but leaving it behind would
-- make it the one thing a later restore silently keeps.
drop function if exists public.admin_inbox();

-- admin_inbox_seen before admin_announcements is arbitrary; neither references the other. The
-- indexes go with their tables.
drop table if exists public.admin_inbox_seen;

drop table if exists public.admin_announcements;
