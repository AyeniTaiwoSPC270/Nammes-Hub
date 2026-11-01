-- News slugs: every article gets a readable URL, and every URL that already exists keeps working.
-- Spec: docs/superpowers/specs/2026-10-31-news-slugs-share-preview-design.md
--
-- The slug is generated in SQL rather than in the admin form, for two reasons: a queued non-owner
-- edit goes through apply_change_request, which builds its own insert, and a backfill of the rows
-- that already exist would otherwise need a second implementation that could disagree with the
-- first. One function, one trigger, one backfill loop.

-- ===== Column =====
-- Nullable until the backfill below has run; the unique index lets that happen in any order.
alter table public.news add column if not exists slug text;

-- ===== The slug itself =====
-- ASCII-folds to [a-z0-9], collapses runs of anything else to a single hyphen, trims, caps at 60.
-- Collisions append a slice of the id (unique by definition), which keeps two posts with the same
-- title distinguishable without a lookup table. Not immutable on purpose: it reads `news` to test
-- for a clash, so Postgres must not be allowed to precompute it.
create or replace function public.news_slug(p_title text, p_id uuid)
returns text
language plpgsql
as $$
declare
  base text;
  candidate text;
  attempt int := 1;
begin
  base := trim(both '-' from lower(regexp_replace(coalesce(p_title, ''), '[^a-zA-Z0-9]+', '-', 'g')));
  if length(base) > 60 then
    base := trim(both '-' from left(base, 60));
  end if;
  if base = '' then
    base := 'post';
  end if;

  candidate := base;
  while exists (select 1 from public.news where slug = candidate) loop
    attempt := attempt + 1;
    if attempt = 2 then
      candidate := base || '-' || left(coalesce(p_id::text, 'x'), 6);
    else
      candidate := base || '-' || left(coalesce(p_id::text, 'x'), 6) || '-' || attempt;
    end if;
  end loop;
  return candidate;
end;
$$;

-- ===== Fill it in on insert =====
-- A BEFORE trigger rather than a default, because a default cannot read another column: the slug
-- comes from `title`, and `title` is only known to the row being inserted.
create or replace function public.news_set_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.news_slug(new.title, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists news_set_slug on public.news;
create trigger news_set_slug before insert on public.news
  for each row execute function public.news_set_slug();

-- ===== Backfill =====
-- One row at a time so each call to news_slug() sees the slugs already handed out in this
-- transaction; a single set-based update would race with itself and trip the unique index.
do $$
declare
  row record;
begin
  for row in select id, title from public.news where slug is null order by created_at loop
    update public.news set slug = public.news_slug(row.title, row.id) where id = row.id;
  end loop;
end;
$$;

-- Not `create unique index if not exists`: the backfill above is what makes this safe, and a
-- silently skipped index would leave duplicates free to appear later.
create unique index news_slug_key on public.news (slug);

-- ===== Kill switch =====
-- Off until it is switched on from the System page: with the flag off, the share button does not
-- render and the preview handler serves the app shell, so crawlers see the baseline tags that
-- index.html already carries.
insert into public.feature_flags (key, enabled) values ('news_share', false)
on conflict (key) do nothing;
