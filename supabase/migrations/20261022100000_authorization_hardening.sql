-- Close the authorization gaps found in the 2026-10-22 audit.
--
-- 1. The review-queue RPCs are SECURITY DEFINER, so they bypass both the owner-only RLS rules and
--    the mfa_required_* policies. The owner check is restated and the same aal2 check the API
--    routes use is added. apply_change_request also lost its search_path pin when the calendar
--    branch recreated it, and its final write named a status/column pair the table does not have.
-- 2. The award-season branch had been replaced with a nominee deletion that referenced columns
--    award_nominations does not have. Restore the category reconciliation the admin screen submits.
-- 3. Media for owner-only News/Events rows: an admin may still upload a new file, because the review
--    queue needs that, but only the owner may replace or delete a published one.

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
      from public.award_categories where season_id = target_season_id;
    select coalesce(array_agg((c->>'id')::uuid), array[]::uuid[]) into keep_ids
      from jsonb_array_elements(req.payload->'categories') c;

    delete from public.award_categories
      where season_id = target_season_id and not (id = any(keep_ids));

    for cat in select * from jsonb_array_elements(req.payload->'categories')
    loop
      if (cat->>'id')::uuid = any(existing_ids) then
        update public.award_categories set
          title = cat->>'title', description = cat->>'description', sort_order = (cat->>'sort_order')::int
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

create or replace function public.reject_change_request(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_mfa_ok() then
    raise exception 'Two-factor verification required';
  end if;
  if not public.is_owner() then
    raise exception 'Only the owner can review changes.';
  end if;
  update public.change_requests
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = p_reason
    where id = p_id and status = 'pending';
end;
$$;

create or replace function public.submit_change_request(p_entity_type text, p_action text, p_record_id text, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'Only admins can submit changes.';
  end if;
  if not public.admin_mfa_ok() then
    raise exception 'Two-factor verification required';
  end if;
  insert into public.change_requests (entity_type, action, record_id, payload, submitted_by)
  values (p_entity_type, p_action, p_record_id, p_payload, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.transfer_ownership(new_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid() and is_owner) then
    raise exception 'Only the current owner can transfer ownership.';
  end if;
  if not public.admin_mfa_ok() then
    raise exception 'Two-factor verification required';
  end if;
  if not exists (select 1 from public.admins where user_id = new_owner) then
    raise exception 'Target user must already be an admin.';
  end if;
  update public.admins set is_owner = false where user_id = auth.uid();
  update public.admins set is_owner = true where user_id = new_owner;
end;
$$;

-- Uploads stay open to any admin so the review queue can carry a new picture; replacing or deleting
-- the file behind an owner-published row is the part that has to match the row's owner-only policy.
alter policy news_images_admin_update on storage.objects
  using (bucket_id = 'news-images' and (select public.is_owner()));
alter policy news_images_admin_delete on storage.objects
  using (bucket_id = 'news-images' and (select public.is_owner()));
alter policy "event_images_admin_update" on storage.objects
  using (bucket_id = 'event-images' and (select public.is_owner()));
alter policy "event_images_admin_delete" on storage.objects
  using (bucket_id = 'event-images' and (select public.is_owner()));
