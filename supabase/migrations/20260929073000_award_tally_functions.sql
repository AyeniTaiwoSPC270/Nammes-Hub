-- Part 1 of 2: aggregate-only access to award votes. Changes no existing access.
-- The app reads these instead of raw vote rows (which carry voter_id).
-- Visible to everyone once a season is 'revealed'; admins may also see running totals earlier.

create or replace function public.award_tally(p_season_id uuid)
returns table (category_id uuid, nominee_id uuid, votes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select v.category_id, v.nominee_id, count(*)::bigint
  from public.award_votes v
  join public.award_categories c on c.id = v.category_id
  join public.award_seasons s on s.id = c.season_id
  where c.season_id = p_season_id
    and (s.phase = 'revealed' or public.is_admin())
  group by v.category_id, v.nominee_id
$$;

create or replace function public.award_ballot_count(p_season_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct v.voter_id)::bigint
  from public.award_votes v
  join public.award_categories c on c.id = v.category_id
  join public.award_seasons s on s.id = c.season_id
  where c.season_id = p_season_id
    and (s.phase = 'revealed' or public.is_admin())
$$;

revoke execute on function public.award_tally(uuid), public.award_ballot_count(uuid) from public;
-- Intentionally callable by anyone: they return counts only, gated by season phase above.
grant execute on function public.award_tally(uuid), public.award_ballot_count(uuid) to anon, authenticated;
