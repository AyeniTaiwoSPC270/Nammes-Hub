-- The curriculum page is the one key in AdminPageBanners.PAGES with no row. The editor is
-- `update ... where page_key = ...` (src/data/pageBanners.js), so the row is what makes the
-- title editable at all; without it every save matches zero rows.
insert into public.page_banners (page_key, title, subtitle) values
  ('curriculum', 'Curriculum', 'The programme structure by level and semester, from 100 to 500.')
on conflict (page_key) do nothing;

-- These two are read by the outline page, its PDF and its admin editor, but no tracked SQL
-- creates them: they were added through the dashboard. `if not exists` keeps this a no-op on
-- the live database and makes a rebuild from history + migrations match what the app expects.
alter table public.outlines
  add column if not exists past_questions_name text,
  add column if not exists lecturer_notes_name text;
