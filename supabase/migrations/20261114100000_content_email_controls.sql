-- Post emails are now optional per post and switchable per content type.
--
-- Before this, `news` and `events` inserts fired notify_email_webhook() unconditionally, so an admin who
-- wanted a quiet post had to delete the trigger or accept the fan-out. And `opportunities` never emailed
-- at all, even though the `new_content` email design is described as covering "news, an event or an
-- opportunity" (api/_lib/emailDesign.js:358). Both are settled here.
--
-- Two gates, checked in this order:
--   1. `email_members` on the row -- untick it on a post to publish without an alert.
--   2. `feature_flags.email_<table>` -- an owner-wide pause that needs no deploy, like every other switch.
-- A missing flag row is read as on, so a rebuild that loses the seed does not silently stop the alerts.

-- `if not exists` so a file that failed halfway through can simply be run again.
alter table public.news
  add column if not exists email_members boolean not null default true;

alter table public.events
  add column if not exists email_members boolean not null default true;

alter table public.opportunities
  add column if not exists email_members boolean not null default true;

insert into public.feature_flags (key, enabled) values
  ('email_news', true),
  ('email_events', true),
  ('email_opportunities', true)
on conflict (key) do nothing;

-- Re-declared wholesale: `create or replace` replaces the whole body, and the guards belong before the
-- net.http_post so a paused or opted-out post makes no request at all. Everything below the guards is
-- copied from 20261031100000_report_a_problem.sql.
create or replace function public.notify_email_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
  target_url text;
  ts bigint := extract(epoch from now())::bigint;
  k text;
  sig text;
  content_key text;
begin
  -- Only the contact table carries `kind`; to_jsonb(NEW) on the other tables would read a key that is
  -- not there, so the guard stays inside this branch.
  if TG_TABLE_NAME = 'contact_messages' and (to_jsonb(NEW)->>'kind') = 'report' then
    return NEW;
  end if;

  if TG_TABLE_NAME in ('news', 'events', 'opportunities') then
    if coalesce((to_jsonb(NEW)->>'email_members')::boolean, true) is false then
      return NEW;
    end if;

    content_key := case TG_TABLE_NAME
      when 'news' then 'email_news'
      when 'events' then 'email_events'
      else 'email_opportunities'
    end;

    if not coalesce((select enabled from public.feature_flags where key = content_key), true) then
      return NEW;
    end if;
  end if;

  select decrypted_secret into secret from vault.decrypted_secrets where name = 'webhook_shared_secret';
  -- Never block the insert that fired the trigger; without the secret the email is simply not sent.
  if secret is null then return NEW; end if;

  k := case TG_TABLE_NAME when 'profiles' then to_jsonb(NEW)->>'user_id' else to_jsonb(NEW)->>'id' end;
  sig := encode(extensions.hmac(ts::text || '.' || TG_TABLE_NAME || '.' || k, secret, 'sha256'), 'hex');

  target_url := case TG_TABLE_NAME
    when 'profiles' then 'https://www.nammeshub.com.ng/api/webhook-welcome'
    when 'contact_messages' then 'https://www.nammeshub.com.ng/api/webhook-contact'
    else 'https://www.nammeshub.com.ng/api/webhook-new-content'
  end;

  perform net.http_post(
    url := target_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-timestamp', ts::text,
      'x-webhook-signature', sig
    ),
    -- Contact messages send only their id (the handler re-reads the row), so visitor text never sits in request logs.
    body := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'record', case when TG_TABLE_NAME = 'contact_messages' then jsonb_build_object('id', k) else to_jsonb(NEW) end
    )
  );

  return NEW;
end;
$$;

-- Opportunities now join the two content tables. The function's else branch already routes them to
-- /api/webhook-new-content, so only the trigger was missing.
drop trigger if exists opportunities_notify_new_content on public.opportunities;
create trigger opportunities_notify_new_content after insert on public.opportunities
  for each row execute function public.notify_email_webhook();

-- apply_change_request builds the row from an explicit column list, so a column it does not name is
-- never written -- a non-owner admin's unticked box would be silently dropped and the post would still
-- email. The three new columns are carried here the same way the video columns are: wholesale insert,
-- and `payload ? 'column'` on update so a request queued before this migration leaves the live value
-- alone. Body copied from 20261029160000_news_video_preview_tuning.sql.
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
                               video_preview_seconds, video_loop, email_members)
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
        (req.payload->>'video_loop')::boolean,
        coalesce((req.payload->>'email_members')::boolean, true)
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
          then (req.payload->>'video_loop')::boolean else video_loop end,
        email_members = case when req.payload ? 'email_members'
          then (req.payload->>'email_members')::boolean else email_members end
      where id = req.record_id;
    end if;

  elsif req.entity_type = 'events' then
    if req.action = 'insert' then
      insert into public.events (id, title, date, tone, meta, description, image_url, email_members)
      values (
        req.payload->>'id', req.payload->>'title', req.payload->>'date', req.payload->>'tone',
        req.payload->>'meta', req.payload->>'description', req.payload->>'image_url',
        coalesce((req.payload->>'email_members')::boolean, true)
      );
    else
      update public.events set
        title = req.payload->>'title', date = (req.payload->>'date')::date, tone = req.payload->>'tone',
        meta = req.payload->>'meta', description = req.payload->>'description', image_url = req.payload->>'image_url',
        email_members = case when req.payload ? 'email_members'
          then (req.payload->>'email_members')::boolean else email_members end
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
