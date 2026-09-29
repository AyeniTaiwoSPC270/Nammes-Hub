-- Uniqueness: "one vote / one nomination per person" was only a BEFORE INSERT trigger, so two simultaneous
--     requests could both pass. Unique indexes are race-proof. 
-- Disabled accounts: disabled accounts were only signed out in the browser. Now the database refuses their writes too.

-- ---------- race-proof constraints ----------
create unique index if not exists award_votes_one_per_voter
  on public.award_votes (category_id, voter_id);
create unique index if not exists award_nominations_one_per_person
  on public.award_nominations (category_id, submitted_by);

-- form_responses "one per person" is a per-form setting, so it stays a trigger; serialise
-- concurrent inserts for the same (form, person) so the EXISTS check cannot race.
create or replace function public.enforce_one_response_per_person()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_one_per_person boolean;
begin
  select one_response_per_person into v_one_per_person from forms where id = new.form_id;
  if v_one_per_person and new.respondent_id is not null then
    perform pg_advisory_xact_lock(hashtext(new.form_id::text || ':' || new.respondent_id::text));
    if exists (
      select 1 from form_responses
      where form_id = new.form_id
        and respondent_id = new.respondent_id
    ) then
      raise exception 'You have already responded to this form.';
    end if;
  end if;
  return new;
end;
$function$;

-- ---------- server-side disabled-account enforcement ----------
-- SECURITY DEFINER on purpose: logged-out visitors have no SELECT on `profiles`, and
-- Postgres checks table privileges even for branches that are not taken, so an invoker function
-- would error for anon and break public forms. It only ever answers about the caller's OWN
-- account (auth.uid()) and returns a boolean, so it leaks nothing. Logged-out callers count as active.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not coalesce(
    (select is_disabled from public.profiles where user_id = (select auth.uid())),
    false
  )
$$;
grant execute on function public.is_active_user() to anon, authenticated;

alter policy award_votes_insert on public.award_votes
  with check (
    ((select auth.uid()) = voter_id)
    and public.is_active_user()
    and exists (select 1 from profiles where profiles.user_id = (select auth.uid()))
    and exists (
      select 1 from award_categories c join award_seasons s on s.id = c.season_id
      where c.id = award_votes.category_id and s.phase = 'voting'
    )
  );

alter policy award_nominations_insert on public.award_nominations
  with check (
    ((select auth.uid()) = submitted_by)
    and public.is_active_user()
    and exists (select 1 from profiles where profiles.user_id = (select auth.uid()))
    and exists (
      select 1 from award_categories c join award_seasons s on s.id = c.season_id
      where c.id = award_nominations.category_id and s.phase = 'nominating'
    )
  );

alter policy award_nominations_update_own on public.award_nominations
  using (((select auth.uid()) = submitted_by) and public.is_active_user())
  with check (
    ((select auth.uid()) = submitted_by)
    and public.is_active_user()
    and exists (
      select 1 from award_categories c join award_seasons s on s.id = c.season_id
      where c.id = award_nominations.category_id and s.phase = 'nominating'
    )
  );

alter policy form_responses_insert on public.form_responses
  with check (
    public.is_active_user()
    and exists (
      select 1 from forms
      where forms.id = form_responses.form_id
        and (forms.require_signin = false
             or (forms.require_signin = true and (select auth.uid()) = form_responses.respondent_id))
    )
  );

alter policy form_responses_update_own on public.form_responses
  using (
    ((select auth.uid()) = respondent_id)
    and public.is_active_user()
    and exists (
      select 1 from forms
      where forms.id = form_responses.form_id
        and forms.allow_edit_after_submit = true
        and forms.is_accepting_responses = true
    )
  );

alter policy outline_submissions_insert_own on public.outline_submissions
  with check (submitted_by = (select auth.uid()) and public.is_active_user());

alter policy "Users manage their own semesters" on public.cgpa_semesters
  using (((select auth.uid()) = user_id) and public.is_active_user())
  with check (((select auth.uid()) = user_id) and public.is_active_user());

alter policy "Users manage courses in their own semesters" on public.cgpa_courses
  using (
    public.is_active_user()
    and exists (select 1 from cgpa_semesters s
                where s.id = cgpa_courses.semester_id and s.user_id = (select auth.uid()))
  )
  with check (
    public.is_active_user()
    and exists (select 1 from cgpa_semesters s
                where s.id = cgpa_courses.semester_id and s.user_id = (select auth.uid()))
  );
