-- Remove two RPCs the app no longer calls.
-- Apply ONLY after the signup client that no longer calls is_student_id_taken is deployed.
-- Duplicate matric numbers are still rejected by the unique index on profiles.
drop function if exists public.is_student_id_taken(text);

-- Account disabling now goes through /api/disable-user, which also bans the auth session.
revoke execute on function public.admin_set_user_disabled(uuid, boolean) from public, anon, authenticated;
