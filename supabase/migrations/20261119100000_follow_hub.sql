-- The /follow page: one landing spot for the department's socials, newsletter and the Hub itself, reached
-- by printing or sharing a QR code (src/pages/Follow.jsx, Admin -> Site Links).
--
-- The QR points at this site's own /follow rather than a link-in-bio service, so the QR never has to be
-- reprinted when a social URL changes: the admin edits site_content and the same code resolves to the new
-- links. That also means the only thing worth counting is how many people arrived through the code, which
-- is what this table is for.
--
-- Aggregate only: one row per (day, source), never one row per scan. A scan is not a visit to be analysed,
-- it is a number on an admin card, and a per-scan table would grow forever to answer one question.
create table public.follow_scans (
  day date not null,
  source text not null check (source in ('qr', 'link')),
  scans integer not null default 0 check (scans >= 0),
  primary key (day, source)
);

alter table public.follow_scans enable row level security;

-- Admins read; nobody writes through PostgREST. The only writer is record_follow_scan below, so a client
-- cannot backfill a flattering number by inserting rows directly.
create policy follow_scans_select_admin on public.follow_scans
  for select to authenticated using ((select public.is_admin()));

revoke all on public.follow_scans from anon, authenticated;
grant select on public.follow_scans to authenticated;

-- The beacon. Callable by anyone with the anon key, so the source is a whitelist rather than a free-text
-- field, and an unknown value is dropped instead of being stored under a name the admin panel cannot show.
--
-- The day is Lagos local time. Vercel runs UTC, and a scan at 00:30 in Lagos would otherwise land on
-- yesterday's row for the first hour of every day -- the same reason the analytics buckets are Lagos.
create or replace function public.record_follow_scan(p_source text default 'qr')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Africa/Lagos')::date;
begin
  if p_source is null or p_source not in ('qr', 'link') then
    return;
  end if;

  insert into public.follow_scans (day, source, scans)
  values (v_day, p_source, 1)
  on conflict (day, source) do update set scans = public.follow_scans.scans + 1;
end;
$$;

revoke execute on function public.record_follow_scan(text) from public;
grant execute on function public.record_follow_scan(text) to anon, authenticated;

-- One call for the whole card. security definer because follow_scans is admin-only and the function must
-- read it consistently regardless of the caller's own policies, so it re-checks is_admin() itself.
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
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.follow_scan_summary() from public, anon;
grant execute on function public.follow_scan_summary() to authenticated;
