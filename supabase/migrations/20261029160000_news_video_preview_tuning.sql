-- A card preview gets a length and a loop: per post, or inherited from the site default.
-- Spec: docs/superpowers/specs/2026-10-29-news-video-preview-timing-design.md
--
-- NULL on `news` means "inherit", so changing the site default moves every post that has no opinion
-- of its own, and a post can still say "the site says loop, I don't" with an explicit false.

alter table public.news
  add column video_preview_seconds integer,
  add column video_loop boolean;

alter table public.news
  add constraint news_video_preview_seconds_check
    check (video_preview_seconds is null or video_preview_seconds between 2 and 30);

-- The site default: not null with a floor, so a hand-written update cannot leave it unusable, and the
-- same 2-30 range the per-post column carries -- one range, two places, enforced the same way.
alter table public.content_settings
  add column news_video_preview_seconds integer not null default 3
    check (news_video_preview_seconds between 2 and 30),
  add column news_video_loop boolean not null default false;

-- The settings row's UPDATE grant is column-scoped to the original four columns plus updated_at
-- (20261015100000_content_looks.sql:108), and a column-scoped grant covers only the columns it names.
-- Without these two lines every save from the Design tab would be refused by Postgres with
-- "permission denied" -- the row would never reach the check constraint and the admin would only see
-- a toast. Column-level grants accumulate, so granting the two new columns here adds them to the set.
grant update (news_video_preview_seconds, news_video_loop)
  on public.content_settings to authenticated;

-- apply_change_request rewrites every column it names from the payload, so a column it does NOT know
-- about is set to NULL -- and it guards each UPDATE column on `payload ? 'column'` so a request queued
-- before this migration leaves the live values alone. Both rules carry the two new columns; the body
-- is copied whole from 20261026140000_news_video.sql because Postgres has no `alter function` for
-- adding payload handling, only `create or replace`.
create or replace function public.apply_change_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.change_requests%rowtype;
  target_season_id uuid;
  existing_ids uuid[];
  keep_ids uuid[];
  cat jsonb;
begin
  if not public.admin_mfa_ok() then
    raise exception 'Two-factor verification required';
  end if;
  if not public.is_owner() then
    raise exception 'Only the owner can review changes.';
  end if;

  select * into req from public.change_requests where id = p_id and status = 'pending';
  if not found then
    raise exception 'No pending request with that id.';
  end if;

  if req.entity_type = 'news' then
    if req.action = 'insert' then
      insert into public.news (id, category, tone, date, title, body, author, badge_tone, badge_label,
                               image_url, image_width_pct, video_kind, video_url, video_preview, video_position, video_duration,
                               video_preview_seconds, video_loop)
      values (
        req.payload->>'id', req.payload->>'category', req.payload->>'tone', (req.payload->>'date')::date,
        req.payload->>'title', req.payload->>'body', req.payload->>'author',
        req.payload->>'badge_tone', req.payload->>'badge_label', req.payload->>'image_url',
        (req.payload->>'image_width_pct')::int,
        req.payload->>'video_kind', req.payload->>'video_url',
        req.payload->>'video_preview',
        req.payload->>'video_position',
        nullif(req.payload->>'video_duration', ''),
        nullif(req.payload->>'video_preview_seconds', '')::int,
        (req.payload->>'video_loop')::boolean
      );
    else
      update public.news set
        category = req.payload->>'category', tone = req.payload->>'tone', date = (req.payload->>'date')::date,
        title = req.payload->>'title', body = req.payload->>'body', author = req.payload->>'author',
        badge_tone = req.payload->>'badge_tone', badge_label = req.payload->>'badge_label',
        image_url = req.payload->>'image_url', image_width_pct = (req.payload->>'image_width_pct')::int,
        video_kind = case when req.payload ? 'video_kind' then req.payload->>'video_kind' else video_kind end,
        video_url = case when req.payload ? 'video_url' then req.payload->>'video_url' else video_url end,
        video_preview = case when req.payload ? 'video_preview' then req.payload->>'video_preview' else video_preview end,
        video_position = case when req.payload ? 'video_position' then req.payload->>'video_position' else video_position end,
        video_duration = case when req.payload ? 'video_duration' then nullif(req.payload->>'video_duration', '') else video_duration end,
        video_preview_seconds = case when req.payload ? 'video_preview_seconds'
          then nullif(req.payload->>'video_preview_seconds', '')::int else video_preview_seconds end,
        video_loop = case when req.payload ? 'video_loop'
          then (req.payload->>'video_loop')::boolean else video_loop end
      where id = req.record_id;
    end if;

  elsif req.entity_type = 'events' then
    if req.action = 'insert' then
      insert into public.events (id, title, date, tone, meta, description, image_url)
      values (
        req.payload->>'id', req.payload->>'title', req.payload->>'date', req.payload->>'tone',
        req.payload->>'meta', req.payload->>'description', req.payload->>'image_url'
      );
    else
      update public.events set
        title = req.payload->>'title', date = (req.payload->>'date')::date, tone = req.payload->>'tone',
        meta = req.payload->>'meta', description = req.payload->>'description', image_url = req.payload->>'image_url'
      where id = req.record_id;
    end if;

  elsif req.entity_type = 'academic_calendar' then
    if req.action = 'insert' then
      insert into public.academic_calendar (id, session, semester, title, kind, starts_at, ends_at, note, remind_days)
      values (
        req.payload->>'id', req.payload->>'session', (req.payload->>'semester')::int, req.payload->>'title',
        req.payload->>'kind', nullif(req.payload->>'starts_at', '')::date, nullif(req.payload->>'ends_at', '')::date,
        req.payload->>'note', nullif(req.payload->>'remind_days', '')::int
      );
    else
      update public.academic_calendar set
        session = req.payload->>'session', semester = (req.payload->>'semester')::int, title = req.payload->>'title',
        kind = req.payload->>'kind', starts_at = nullif(req.payload->>'starts_at', '')::date,
        ends_at = nullif(req.payload->>'ends_at', '')::date, note = req.payload->>'note',
        remind_days = nullif(req.payload->>'remind_days', '')::int
      where id = req.record_id;
    end if;

  elsif req.entity_type = 'award_season' then
    if req.action = 'insert' then
      insert into public.award_seasons (title, phase, created_by)
      values (req.payload->>'title', 'nominating', req.submitted_by)
      returning id into target_season_id;
    else
      target_season_id := req.record_id::uuid;
      update public.award_seasons set title = req.payload->>'title' where id = target_season_id;
    end if;

    select coalesce(array_agg(id), array[]::uuid[]) into existing_ids
      from public.award_categories where season_id = target_season_id;
    select coalesce(array_agg((c->>'id')::uuid), array[]::uuid[]) into keep_ids
      from jsonb_array_elements(req.payload->'categories') c;

    delete from public.award_categories
      where season_id = target_season_id and not (id = any(keep_ids));

    for cat in select * from jsonb_array_elements(req.payload->'categories')
    loop
      if (cat->>'id')::uuid = any(existing_ids) then
        update public.award_categories
          set title = cat->>'title', description = cat->>'description', sort_order = (cat->>'sort_order')::int
        where id = (cat->>'id')::uuid;
      else
        insert into public.award_categories (id, season_id, title, description, sort_order)
        values ((cat->>'id')::uuid, target_season_id, cat->>'title', cat->>'description', (cat->>'sort_order')::int);
      end if;
    end loop;

  else
    raise exception 'Unknown entity type: %', req.entity_type;
  end if;

  update public.change_requests
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id;
end;
$$;
