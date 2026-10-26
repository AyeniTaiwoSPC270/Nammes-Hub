-- News posts can carry a video alongside their cover image.
-- Spec: docs/superpowers/specs/2026-10-26-news-video-design.md
--
-- Five nullable columns: every existing row keeps working untouched, and `image_url` stays the cover.
-- Preview and position carry defaults so a hand-written INSERT that forgets them still lands on the
-- agreed behaviour, but they stay NULLABLE: a post with no video has no preview style, and writing
-- 'tap' onto every text-only row would be a value that means nothing.
-- The check constraints settle the two free-text enums at the door rather than leaving a renderer to
-- guess what `video_preview = 'hoverish'` was meant to do.

alter table public.news
  add column video_kind text,
  add column video_url text,
  add column video_preview text default 'tap',
  add column video_position text default 'top',
  add column video_duration text;

alter table public.news
  add constraint news_video_kind_check check (video_kind is null or video_kind in ('file', 'youtube'));
alter table public.news
  add constraint news_video_preview_check check (video_preview in ('auto', 'tap', 'hover', 'none'));
alter table public.news
  add constraint news_video_position_check check (video_position in ('top', 'bottom'));

-- Uploaded files, not links. 50MB is the agreed ceiling: the image bucket allows 5MB, and there is no
-- transcoding anywhere in this stack, so the admin's phone recording is what every visitor downloads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news-videos', 'news-videos', true, 52428800, array['video/mp4'])
on conflict (id) do nothing;

create policy news_videos_public_select on storage.objects
  for select using (bucket_id = 'news-videos');

-- Insert stays open to any admin and update/delete are owner-only, which is the exact posture the
-- 2026-10-22 hardening migration left `news-images` in: a non-owner admin may still put a new file
-- behind a queued edit, but replacing or deleting a published one is the owner's.
create policy news_videos_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'news-videos' and (select public.is_admin()));
create policy news_videos_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'news-videos' and (select public.is_owner()))
  with check (bucket_id = 'news-videos' and (select public.is_owner()));
create policy news_videos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'news-videos' and (select public.is_owner()));

-- The kill switch. `feature_enabled` coalesces a missing row to true, so forgetting this insert would
-- mean "always on" rather than "always off" -- but the row is what the owner flips from Admin > System.
insert into public.feature_flags (key) values ('news_video') on conflict (key) do nothing;

-- apply_change_request rewrites every column it names from the payload, so a column it does NOT know
-- about is set to NULL: an approved non-owner edit would silently strip the video off a live post.
-- This is the documented trap in AGENTS.md ("a theme column added to either would be silently dropped").
--
-- The UPDATE branch goes further and guards each video column on `payload ? 'column'`: a pending
-- request is a snapshot taken when it was submitted, so one queued before this migration -- or one
-- submitted by a client that hid the video fields because the kill switch was off -- must leave the
-- live video alone instead of writing NULL over it. A payload that carries the key as JSON null still
-- counts as present, which is exactly how "the admin cleared the video" reaches the row.
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
                               image_url, image_width_pct, video_kind, video_url, video_preview, video_position, video_duration)
      values (
        req.payload->>'id', req.payload->>'category', req.payload->>'tone', (req.payload->>'date')::date,
        req.payload->>'title', req.payload->>'body', req.payload->>'author',
        req.payload->>'badge_tone', req.payload->>'badge_label', req.payload->>'image_url',
        (req.payload->>'image_width_pct')::int,
        req.payload->>'video_kind', req.payload->>'video_url',
        req.payload->>'video_preview',
        req.payload->>'video_position',
        nullif(req.payload->>'video_duration', '')
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
        video_duration = case when req.payload ? 'video_duration' then nullif(req.payload->>'video_duration', '') else video_duration end
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
