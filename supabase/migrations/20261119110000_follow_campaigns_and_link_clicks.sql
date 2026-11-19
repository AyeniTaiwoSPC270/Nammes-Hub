-- Per-poster follow scans, and which link a visitor chose once they arrived.
--
-- 20261119100000_follow_hub.sql counted arrivals per day and per source only, which answers "did the QR
-- work" but not "which poster worked", and says nothing about whether the page then sent anyone anywhere.
-- A poster is now named on the code (`/follow?src=qr&c=october-flyer`) and every channel tile reports one
-- click, so the admin card can separate a busy noticeboard from one that produces nothing.
--
-- Both tables stay aggregate: one row per (day, key), never one row per event. A click is a number on a
-- card, not a journey to be analysed, and a per-event table would grow forever to answer one question.

-- The campaign is part of the key rather than a column on a separate table: a scan is always attributed to
-- at most one poster, and '' is the unnamed general code so it keeps its own row. The default fills the
-- rows that predate campaigns without inventing a name for them.
alter table public.follow_scans
  add column if not exists campaign text not null default '';

alter table public.follow_scans
  add constraint follow_scans_campaign_shape check (
    campaign = '' or (campaign ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(campaign) <= 32)
  );

alter table public.follow_scans
  drop constraint if exists follow_scans_pkey;

alter table public.follow_scans
  add primary key (day, source, campaign);

create table public.follow_link_clicks (
  day date not null,
  link text not null check (link ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(link) <= 40),
  clicks integer not null default 0 check (clicks >= 0),
  primary key (day, link)
);

alter table public.follow_link_clicks enable row level security;

-- Admins read; nobody writes through PostgREST. The only writer is record_follow_link_click below, so a
-- client cannot backfill a flattering number by inserting rows directly.
create policy follow_link_clicks_select_admin on public.follow_link_clicks
  for select to authenticated using ((select public.is_admin()));

revoke all on public.follow_link_clicks from anon, authenticated;
grant select on public.follow_link_clicks to authenticated;

-- The old one-argument function has to go: `create or replace` with a second parameter would leave both
-- overloads in place, and a named-argument call would become ambiguous. The database also refuses a
-- campaign whose shape the browser would have folded, so the two copies of the rule cannot drift silently.
drop function if exists public.record_follow_scan(text);

create or replace function public.record_follow_scan(p_source text default 'qr', p_campaign text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Africa/Lagos')::date;
  v_campaign text := coalesce(p_campaign, '');
begin
  if p_source is null or p_source not in ('qr', 'link') then
    return;
  end if;

  if v_campaign <> '' and (
    v_campaign !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_campaign) > 32
  ) then
    return;
  end if;

  insert into public.follow_scans (day, source, campaign, scans)
  values (v_day, p_source, v_campaign, 1)
  on conflict (day, source, campaign) do update set scans = public.follow_scans.scans + 1;
end;
$$;

revoke execute on function public.record_follow_scan(text, text) from public;
grant execute on function public.record_follow_scan(text, text) to anon, authenticated;

-- The link beacon. The key is a platform (`whatsapp`) or a Hub path (`calendar`); an unknown or malformed
-- value is dropped rather than stored under a name the admin panel cannot show.
create or replace function public.record_follow_link_click(p_link text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Africa/Lagos')::date;
begin
  if p_link is null
     or p_link !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or char_length(p_link) > 40 then
    return;
  end if;

  insert into public.follow_link_clicks (day, link, clicks)
  values (v_day, p_link, 1)
  on conflict (day, link) do update set clicks = public.follow_link_clicks.clicks + 1;
end;
$$;

revoke execute on function public.record_follow_link_click(text) from public;
grant execute on function public.record_follow_link_click(text) to anon, authenticated;

-- One call for the whole card. security definer because both tables are admin-only and the function must
-- read them consistently regardless of the caller's own policies, so it re-checks is_admin() itself.
create or replace function public.follow_scan_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can read scan counts.';
  end if;

  select jsonb_build_object(
    'total', coalesce((select sum(scans) from public.follow_scans), 0),
    'today', coalesce((select sum(scans) from public.follow_scans where day = v_today), 0),
    'last7', coalesce((select sum(scans) from public.follow_scans where day > v_today - 7), 0),
    'last30', coalesce((select sum(scans) from public.follow_scans where day > v_today - 30), 0),
    'bySource', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'scans', total) order by total desc, source)
        from (
          select source, sum(scans)::int as total
            from public.follow_scans
           group by source
        ) s
    ), '[]'::jsonb),
    'byCampaign', coalesce((
      select jsonb_agg(jsonb_build_object('campaign', campaign, 'scans', total) order by total desc, campaign)
        from (
          select campaign, sum(scans)::int as total
            from public.follow_scans
           where campaign <> ''
           group by campaign
        ) c
    ), '[]'::jsonb),
    'linkClicks', coalesce((select sum(clicks) from public.follow_link_clicks), 0),
    'byLink', coalesce((
      select jsonb_agg(jsonb_build_object('link', link, 'clicks', total) order by total desc, link)
        from (
          select link, sum(clicks)::int as total
            from public.follow_link_clicks
           group by link
        ) l
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.follow_scan_summary() from public, anon;
grant execute on function public.follow_scan_summary() to authenticated;
