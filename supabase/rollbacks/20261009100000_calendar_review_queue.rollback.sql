-- Undoes 20261009100000_calendar_review_queue.sql.
--
-- Any calendar rows that were applied through the review queue survive; only the queue's ability to
-- carry them is removed, and the request rows themselves are left as they are.

alter table public.change_requests
  drop constraint if exists change_requests_entity_type_check;

alter table public.change_requests
  add constraint change_requests_entity_type_check
  check (entity_type in ('news', 'events', 'award_season'));

-- Restores the three-table apply_change_request from supabase/history/03_2026-09-04_to_2026-09-05_awards_and_roles.sql:314.
create or replace function public.apply_change_request(p_id uuid)
returns void
language plpgsql security definer as $$
declare
  req public.change_requests%rowtype;
  target_season_id uuid;
  existing_ids uuid[];
begin
  if not (select public.is_owner()) then
    raise exception 'Owner only';
  end if;

  select * into req from public.change_requests where id = p_id and status = 'pending';
  if not found then
    raise exception 'No pending request with that id.';
  end if;

  if req.entity_type = 'news' then
    if req.action = 'insert' then
      insert into public.news (id, category, tone, date, title, body, author, badge_tone, badge_label, image_url, image_width_pct)
      values (
        req.payload->>'id', req.payload->>'category', req.payload->>'tone', (req.payload->>'date')::date,
        req.payload->>'title', req.payload->>'body', req.payload->>'author',
        req.payload->>'badge_tone', req.payload->>'badge_label', req.payload->>'image_url',
        (req.payload->>'image_width_pct')::int
      );
    else
      update public.news set
        category = req.payload->>'category', tone = req.payload->>'tone', date = (req.payload->>'date')::date,
        title = req.payload->>'title', body = req.payload->>'body', author = req.payload->>'author',
        badge_tone = req.payload->>'badge_tone', badge_label = req.payload->>'badge_label',
        image_url = req.payload->>'image_url', image_width_pct = (req.payload->>'image_width_pct')::int
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
        title = req.payload->>'title', date = req.payload->>'date', tone = req.payload->>'tone',
        meta = req.payload->>'meta', description = req.payload->>'description', image_url = req.payload->>'image_url'
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
    from public.award_nominations where season_id = target_season_id and nominee_id::text = req.record_id;
    update public.award_nominations set deleted_at = now()
    where season_id = target_season_id and nominee_id::text = req.record_id and deleted_at is null
      and not (req.record_id = any(existing_ids));

  else
    raise exception 'Unknown entity type: %', req.entity_type;
  end if;

  update public.change_requests set status = 'applied', resolved_at = now() where id = p_id;
end $$;