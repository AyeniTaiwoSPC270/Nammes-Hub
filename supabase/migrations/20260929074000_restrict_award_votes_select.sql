-- Part 2 of 2: raw award_votes rows (which include voter_id) are readable only by the voter.
-- Apply ONLY after the client that reads award_tally() is deployed, or the results pages go blank.

drop policy if exists award_votes_select on public.award_votes;
create policy award_votes_select on public.award_votes
  for select to authenticated
  using ((select auth.uid()) = voter_id);

revoke select on public.award_votes from anon;
