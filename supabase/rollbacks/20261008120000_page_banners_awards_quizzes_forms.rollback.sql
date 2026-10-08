-- Rolls back 20261008120000_page_banners_awards_quizzes_forms.sql.
--
-- Drops the three seeded rows, which puts /awards, /quiz and /forms back to no banner: their pages
-- read the row with usePageBanner, so the fallback copy in the JSX takes over and /admin/banners
-- loses those three fieldsets.
delete from public.page_banners where page_key in ('awards', 'quizzes', 'forms');

-- Deliberately not dropping image_urls, transition and interval_seconds. That ALTER is `if not exists`
-- because the live database already had those columns before this repo tracked them, and the other ten
-- bannered pages read all three on every load. Dropping them would break those pages, not restore them.