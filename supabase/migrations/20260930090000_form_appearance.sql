-- Form appearance: a theme per form, plus an image and text style per question.
-- All three are JSON, validated and clamped by the app (src/lib/formTheme.js) before saving and
-- again before rendering. Existing forms keep null and look exactly as before.
-- Existing row policies and grants already cover new columns: only admins can write forms and
-- form_questions, and everyone can read them.

alter table public.forms
  add column if not exists theme jsonb;

alter table public.form_questions
  add column if not exists image jsonb,
  add column if not exists style jsonb;
