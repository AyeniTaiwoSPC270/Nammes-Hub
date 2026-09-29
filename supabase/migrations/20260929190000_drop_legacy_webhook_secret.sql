-- The raw shared-secret check is no longer used: webhooks and the email worker are signed only.
-- Apply ONLY after the code that stops calling it is deployed.
drop function if exists public.verify_webhook_secret(text);
