-- Home opts in per block, the same rule the content studio uses: Home also renders awards, opportunities and
-- news, so an admin restyling the calendar must not wake up to a new band on Home.
alter table public.calendar_settings
  add column if not exists next_up_on_home boolean not null default false;

-- The update grant on this table is column-scoped (20261009090000_calendar.sql:159-161), so a new
-- column is not writable until it is named here. Forgetting this is a save that changes nothing.
grant update (next_up_on_home) on public.calendar_settings to authenticated;
