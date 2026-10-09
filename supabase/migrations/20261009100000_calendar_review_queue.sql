-- Let the review queue carry academic calendar entries.
--
-- AdminResourceManager's review-gated path calls submit_change_request('academic_calendar', ...), which
-- currently fails on two counts: change_requests.entity_type is constrained to three tables, and
-- apply_change_request has no branch to apply one. Both are in supabase/history/03_...sql:279 and :347-379,
-- which predate the calendar. Without this a non-owner admin cannot propose a senate date at all, and the
-- failure surfaces as a raw Postgres check-constraint error rather than as anything the screen can explain.
--
-- The new branch copies the events branch's shape exactly: an explicit column list on insert, and the
-- same list on update keyed by record_id. Only the 9 columns academic_calendar owns are touched, so a
-- payload cannot reach created_at or updated_at.

alter table public.change_requests
  drop constraint if exists change_requests_entity_type_check;

alter table public.change_requests
  add constraint change_requests_entity_type_check
  check (entity_type in ('news', 'events', 'award_season', 'academic_calendar'));

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

  elsif req.entity_type = 'academic_calendar' then
    if req.action = 'insert' then
      insert into public.academic_calendar (id, session, semester, title, kind, starts_at, ends_at, note, remind_days)
      values (
        req.payload->>'id', req.payload->>'session', (req.payload->>'semester')::int,
        req.payload->>'title', req.payload->>'kind',
        nullif(req.payload->>'starts_at', '')::date, nullif(req.payload->>'ends_at', '')::date,
        req.payload->>'note', nullif(req.payload->>'remind_days', '')::int
      );
    else
      update public.academic_calendar set
        session = req.payload->>'session', semester = (req.payload->>'semester')::int,
        title = req.payload->>'title', kind = req.payload->>'kind',
        starts_at = nullif(req.payload->>'starts_at', '')::date,
        ends_at = nullif(req.payload->>'ends_at', '')::date,
        note = req.payload->>'note', remind_days = nullif(req.payload->>'remind_days', '')::int
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