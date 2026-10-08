-- Focus mode: a per-form switch for answering without the site navbar and footer.
-- Opt-in per form, so turning it on for a long application does not change every other form on the
-- site. Existing rows get false and keep the navbar exactly as before.
-- Row policies and grants already cover the new column: only admins write forms, everyone reads
-- them, and src/data/forms.js decides from the value whether the chrome is hidden.

alter table public.forms
  add column if not exists focus_mode boolean not null default false;