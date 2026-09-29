-- EMERGENCY ROLLBACK for 20260929071000_least_privilege_grants.sql
-- Restores Supabase's original wide-open default grants. Run this if the site breaks
-- (empty pages for logged-out visitors, signup failing, admin actions erroring),
-- then tell Claude what broke so the migration can be corrected.
-- Note: this brings back the wide-open permissions, so treat it as temporary.

grant all on all tables in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
