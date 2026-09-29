-- Public submissions now go through /api/submit-public, which checks Turnstile before saving with the service role.
-- Apply ONLY after that route and the Turnstile secret are live.
--   contact_messages: nobody writes directly any more (signed-in members use the same form and route).
--   form_responses:   anonymous visitors no longer insert directly; signed-in respondents still do (RLS unchanged).
revoke insert on public.contact_messages from anon, authenticated;
revoke insert on public.form_responses from anon;
