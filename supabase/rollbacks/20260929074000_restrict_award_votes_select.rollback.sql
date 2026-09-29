-- EMERGENCY ROLLBACK for 20260929074000_restrict_award_votes_select.sql
-- Restores the previous vote-reading rules. Run only if the results pages break after the change.

drop policy if exists award_votes_select on public.award_votes;
create policy award_votes_select on public.award_votes
  for select to public
  using (
    ((select auth.uid()) = voter_id)
    or exists (select 1 from admins where admins.user_id = (select auth.uid()))
    or exists (
      select 1 from award_categories c join award_seasons s on s.id = c.season_id
      where c.id = award_votes.category_id and s.phase = 'revealed'
    )
  );
grant select on public.award_votes to anon;
