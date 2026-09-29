-- Least-privilege table grants and function EXECUTE.
-- Row-level security stays as the second layer. Every grant below was derived from what the
-- app actually does. A rollback script sits in supabase/rollbacks/.
-- A few grants are deliberately kept for now and will be tightened in a later change.

-- ---------- Tables ----------
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Logged-out visitors: read public content (RLS still filters rows).
grant select on
  public.events, public.news, public.opportunities, public.resources, public.excos,
  public.outlines, public.timetables, public.event_photos, public.page_banners, public.site_content,
  public.award_seasons, public.award_categories, public.award_nominees, public.award_votes,
  public.forms, public.form_questions, public.form_responses, public.outline_submissions,
  public.admins            -- needed so policy sub-queries on `admins` do not error; RLS shows anon 0 rows
to anon;

-- Logged-out visitors: the only two public writes.
grant insert on public.contact_messages, public.form_responses to anon;

-- Future tables are private to anon unless granted deliberately.
alter default privileges in schema public revoke all on tables from anon;

-- ---------- Functions ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant  execute on all functions in schema public to service_role;

-- Used inside RLS policies, so both roles need them.
grant execute on function public.is_admin(), public.is_owner() to anon, authenticated;

-- Signup pre-check.
grant execute on function public.is_student_id_taken(text) to anon, authenticated;

-- RPCs the signed-in app calls (each re-checks auth.uid()/role inside).
grant execute on function
  public.touch_last_seen(),
  public.set_own_email_notifications(boolean),
  public.set_own_entry_year(integer),
  public.set_own_full_name(text),
  public.submit_change_request(text, text, text, jsonb),
  public.apply_change_request(uuid),
  public.reject_change_request(uuid, text),
  public.admin_set_user_disabled(uuid, boolean),
  public.transfer_ownership(uuid),
  public.submit_award_ballot(jsonb)
to authenticated;

-- Auth service fires the signup trigger.
grant execute on function public.handle_new_user_profile() to supabase_auth_admin;

-- New functions are private by default.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
