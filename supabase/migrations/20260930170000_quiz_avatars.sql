-- Each quiz player picks one of 50 characters (drawn in the app; the database only stores which one).
-- quiz_players already has a table-wide select grant, so the new column is readable like the rest of the row.
alter table public.quiz_players
  add column avatar_id smallint not null default 0 check (avatar_id between 0 and 49);
