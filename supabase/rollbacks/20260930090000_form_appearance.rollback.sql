alter table public.form_questions
  drop column if exists style,
  drop column if exists image;

alter table public.forms
  drop column if exists theme;
