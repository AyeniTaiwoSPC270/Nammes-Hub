-- The homepage hero was a single `site_content.hero_image_url` while every other banner was already an
-- ordered `text[]` slideshow. These columns make the hero match, so /admin/home can offer the same
-- multi-image controls as /admin/banners without inventing a second image table.

alter table public.site_content
  add column if not exists hero_image_urls text[],
  add column if not exists hero_transition text,
  add column if not exists hero_interval_seconds integer not null default 5;

-- The single column stays (Home still reads it as the fallback, and a rebuild from an older migration
-- snapshot must not lose the picture). Seed the array from it so existing sites keep their hero after
-- the admin screen starts preferring the array.
update public.site_content
set hero_image_urls = array[hero_image_url]
where hero_image_urls is null
  and hero_image_url is not null;
