-- READ-ONLY verification for 20260929071000_least_privilege_grants.sql (changes nothing).
-- Every row should show ok = true after the migration.
select check_name, ok from (values
  ('anon cannot INSERT admins',               not has_table_privilege('anon','public.admins','INSERT')),
  ('anon cannot UPDATE profiles',             not has_table_privilege('anon','public.profiles','UPDATE')),
  ('anon cannot SELECT profiles',             not has_table_privilege('anon','public.profiles','SELECT')),
  ('anon cannot DELETE news',                 not has_table_privilege('anon','public.news','DELETE')),
  ('authenticated cannot TRUNCATE admins',    not has_table_privilege('authenticated','public.admins','TRUNCATE')),
  ('anon can still SELECT news',              has_table_privilege('anon','public.news','SELECT')),
  ('anon can still SELECT form_responses',    has_table_privilege('anon','public.form_responses','SELECT')),
  ('anon can still INSERT contact_messages',  has_table_privilege('anon','public.contact_messages','INSERT')),
  ('anon can still INSERT form_responses',    has_table_privilege('anon','public.form_responses','INSERT')),
  ('signed-in can still UPDATE cgpa_courses', has_table_privilege('authenticated','public.cgpa_courses','UPDATE')),
  ('anon cannot run transfer_ownership',      not has_function_privilege('anon','public.transfer_ownership(uuid)','EXECUTE')),
  ('anon cannot run apply_change_request',    not has_function_privilege('anon','public.apply_change_request(uuid)','EXECUTE')),
  ('signed-in cannot call trigger fn',        not has_function_privilege('authenticated','public.notify_email_webhook()','EXECUTE')),
  ('signed-in can set own name',              has_function_privilege('authenticated','public.set_own_full_name(text)','EXECUTE')),
  ('signed-in can submit ballot',             has_function_privilege('authenticated','public.submit_award_ballot(jsonb)','EXECUTE')),
  ('RLS helper is_admin works for anon',      has_function_privilege('anon','public.is_admin()','EXECUTE')),
  ('service_role can list recipients',        has_function_privilege('service_role','public.get_notification_recipients()','EXECUTE')),
  ('service_role can verify webhook secret',  has_function_privilege('service_role','public.verify_webhook_secret(text)','EXECUTE')),
  ('auth service can run signup trigger fn',  has_function_privilege('supabase_auth_admin','public.handle_new_user_profile()','EXECUTE'))
) as t(check_name, ok)
order by ok, check_name;
