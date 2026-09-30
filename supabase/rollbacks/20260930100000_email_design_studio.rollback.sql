drop table if exists public.broadcast_drafts;
drop table if exists public.email_styles;

alter table public.broadcasts
  drop column if exists design,
  drop column if exists blocks;

delete from public.email_templates where template_id in ('welcome', 'new_content');
alter table public.email_templates drop column if exists design;
