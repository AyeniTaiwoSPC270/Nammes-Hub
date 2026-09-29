-- EMERGENCY ROLLBACK for 20260929072000_integrity_and_active_user.sql
-- Removes the disabled-account clause from the policies (restores the exact previous rules)
-- and drops the unique indexes. Run only if signed-in users can no longer save things.

drop index if exists public.award_votes_one_per_voter;
drop index if exists public.award_nominations_one_per_person;

alter policy award_votes_insert on public.award_votes
  with check (
    ((select auth.uid()) = voter_id)
    and exists (select 1 from profiles where profiles.user_id = (select auth.uid()))
    and exists (select 1 from award_categories c join award_seasons s on s.id = c.season_id
                where c.id = award_votes.category_id and s.phase = 'voting')
  );
alter policy award_nominations_insert on public.award_nominations
  with check (
    ((select auth.uid()) = submitted_by)
    and exists (select 1 from profiles where profiles.user_id = (select auth.uid()))
    and exists (select 1 from award_categories c join award_seasons s on s.id = c.season_id
                where c.id = award_nominations.category_id and s.phase = 'nominating')
  );
alter policy award_nominations_update_own on public.award_nominations
  using ((select auth.uid()) = submitted_by)
  with check (
    ((select auth.uid()) = submitted_by)
    and exists (select 1 from award_categories c join award_seasons s on s.id = c.season_id
                where c.id = award_nominations.category_id and s.phase = 'nominating')
  );
alter policy form_responses_insert on public.form_responses
  with check (
    exists (select 1 from forms where forms.id = form_responses.form_id
            and (forms.require_signin = false
                 or (forms.require_signin = true and (select auth.uid()) = form_responses.respondent_id)))
  );
alter policy form_responses_update_own on public.form_responses
  using (
    ((select auth.uid()) = respondent_id)
    and exists (select 1 from forms where forms.id = form_responses.form_id
                and forms.allow_edit_after_submit = true and forms.is_accepting_responses = true)
  );
alter policy outline_submissions_insert_own on public.outline_submissions
  with check (submitted_by = (select auth.uid()));
alter policy "Users manage their own semesters" on public.cgpa_semesters
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "Users manage courses in their own semesters" on public.cgpa_courses
  using (exists (select 1 from cgpa_semesters s where s.id = cgpa_courses.semester_id and s.user_id = (select auth.uid())))
  with check (exists (select 1 from cgpa_semesters s where s.id = cgpa_courses.semester_id and s.user_id = (select auth.uid())));
