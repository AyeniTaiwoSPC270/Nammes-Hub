-- Page banners for the three public pages that had none: /awards, /quiz, /forms.
-- Every page with a PageBanner needs a row here, because the admin editor saves with
-- `update ... where page_key = ...` (src/data/pageBanners.js) and that matches zero rows
-- without one. A missing row also means no title or subtitle for the studio to prefill.

insert into public.page_banners (page_key, title, subtitle) values
  ('awards', 'Annual Awards', 'Nominate, vote, and celebrate the outstanding members of the department.'),
  ('quizzes', 'Quizzes and battles', 'Play, practise or challenge a friend. No account needed.'),
  ('forms', 'Open forms', 'Event registrations, surveys, and applications currently accepting responses.')
-- `on conflict` because these migrations are applied by hand in the SQL editor, where a re-run is a
-- live accident rather than a tracked one, and page_key is the primary key.
on conflict (page_key) do nothing;

-- The slideshow columns are read on every bannered page and written by
-- /admin/banners, but no earlier migration creates them: the live database picked them up
-- outside this repo. `if not exists` keeps this a no-op there and makes a rebuild from
-- migrations match what the app already expects.
--
-- The types are asserted here from what the app sends: text[] for the ordered image list
-- (PageBannerImagesField appends to an array), text for the transition name, integer for the
-- slide interval. If the live columns were added with different types these are skipped in
-- silence and a rebuild would drift from production, so check them before trusting a rebuild.
alter table public.page_banners
  add column if not exists image_urls text[],
  add column if not exists transition text,
  add column if not exists interval_seconds integer not null default 5;