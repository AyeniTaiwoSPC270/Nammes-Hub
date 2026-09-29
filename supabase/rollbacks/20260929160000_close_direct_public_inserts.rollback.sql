-- Re-opens direct inserts (the pre-existing RLS policies still apply).
grant insert on public.contact_messages to anon, authenticated;
grant insert on public.form_responses to anon;
