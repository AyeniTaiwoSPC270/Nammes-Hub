-- Exported from Supabase's applied-migration history. Apply after 03_*.sql. See 01 for notes.
-- Contains no secrets: the webhook secret is generated at run time inside the database.

-- ===== 20260905155216_email_notifications_and_broadcasts =====
alter table public.profiles
  add column email_notifications_enabled boolean not null default true;

create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  sent_by uuid not null references auth.users(id),
  recipient_count int not null,
  created_at timestamptz not null default now()
);

alter table public.broadcasts enable row level security;

create policy "broadcasts_admin_select" on public.broadcasts for select
  using (auth.uid() in (select user_id from public.admins));

create or replace function public.set_own_email_notifications(enabled boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set email_notifications_enabled = enabled where user_id = auth.uid();
$$;

create or replace function public.get_notification_recipients()
returns table(email text)
language sql
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.user_id = u.id
  where p.email_notifications_enabled = true and u.email is not null;
$$;

revoke execute on function public.get_notification_recipients() from public, anon, authenticated;


-- ===== 20260905161106_email_webhook_triggers =====
create extension if not exists pg_net;

select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'webhook_shared_secret',
  'Shared secret sent as x-webhook-secret to the Vercel email endpoints'
);

create or replace function public.notify_email_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
  target_url text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'webhook_shared_secret';

  target_url := case TG_TABLE_NAME
    when 'profiles' then 'https://www.nammeshub.com.ng/api/webhook-welcome'
    else 'https://www.nammeshub.com.ng/api/webhook-new-content'
  end;

  perform net.http_post(
    url := target_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'record', to_jsonb(NEW))
  );

  return NEW;
end;
$$;

create trigger profiles_notify_welcome
  after insert on public.profiles
  for each row execute function public.notify_email_webhook();

create trigger news_notify_new_content
  after insert on public.news
  for each row execute function public.notify_email_webhook();

create trigger events_notify_new_content
  after insert on public.events
  for each row execute function public.notify_email_webhook();


-- ===== 20260905161359_verify_webhook_secret_function =====
create or replace function public.verify_webhook_secret(candidate text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'webhook_shared_secret' and decrypted_secret = candidate
  );
$$;

revoke execute on function public.verify_webhook_secret(text) from public, anon, authenticated;


-- ===== 20260909113900_add_category_to_forms =====
alter table public.forms
  add column category text not null default 'other'
  check (category in ('event', 'application', 'survey', 'other'));

-- ===== 20260920205110_security_hardening_function_search_path =====
alter function public.is_admin() set search_path = public;
alter function public.is_owner() set search_path = public;
alter function public.submit_award_ballot(p_votes jsonb) set search_path = public;
alter function public.admins_guard_delete() set search_path = public;
alter function public.touch_last_seen() set search_path = public;
alter function public.admin_set_user_disabled(target uuid, disabled boolean) set search_path = public;
alter function public.transfer_ownership(new_owner uuid) set search_path = public;
alter function public.submit_change_request(p_entity_type text, p_action text, p_record_id text, p_payload jsonb) set search_path = public;
alter function public.reject_change_request(p_id uuid, p_reason text) set search_path = public;
alter function public.apply_change_request(p_id uuid) set search_path = public;


-- ===== 20260920205202_add_missing_fk_indexes =====
create index if not exists idx_award_categories_season_id on public.award_categories (season_id);
create index if not exists idx_award_nominations_category_id on public.award_nominations (category_id);
create index if not exists idx_award_nominations_submitted_by on public.award_nominations (submitted_by);
create index if not exists idx_award_nominees_category_id on public.award_nominees (category_id);
create index if not exists idx_award_seasons_created_by on public.award_seasons (created_by);
create index if not exists idx_award_votes_category_id on public.award_votes (category_id);
create index if not exists idx_award_votes_nominee_id on public.award_votes (nominee_id);
create index if not exists idx_award_votes_voter_id on public.award_votes (voter_id);
create index if not exists idx_broadcasts_sent_by on public.broadcasts (sent_by);
create index if not exists idx_cgpa_courses_semester_id on public.cgpa_courses (semester_id);
create index if not exists idx_change_requests_reviewed_by on public.change_requests (reviewed_by);
create index if not exists idx_change_requests_submitted_by on public.change_requests (submitted_by);
create index if not exists idx_event_photos_event_id on public.event_photos (event_id);
create index if not exists idx_form_questions_form_id on public.form_questions (form_id);
create index if not exists idx_form_responses_form_id on public.form_responses (form_id);
create index if not exists idx_form_responses_respondent_id on public.form_responses (respondent_id);
create index if not exists idx_forms_created_by on public.forms (created_by);
create index if not exists idx_outline_submissions_outline_id on public.outline_submissions (outline_id);
create index if not exists idx_outline_submissions_submitted_by on public.outline_submissions (submitted_by);


-- ===== 20260920205522_optimize_rls_policies_auth_uid_initplan =====
ALTER POLICY "admins_self_select" ON public."admins"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "award_categories_delete_admin" ON public."award_categories"
  USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid())))));

ALTER POLICY "award_categories_insert_admin" ON public."award_categories"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = (select auth.uid())) AND admins.is_owner))));

ALTER POLICY "award_categories_update_admin" ON public."award_categories"
  USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = (select auth.uid())) AND admins.is_owner))));

ALTER POLICY "award_nominations_delete_admin" ON public."award_nominations"
  USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid())))));

ALTER POLICY "award_nominations_insert" ON public."award_nominations"
  WITH CHECK ((((select auth.uid()) = submitted_by) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (EXISTS ( SELECT 1
   FROM (award_categories c
     JOIN award_seasons s ON ((s.id = c.season_id)))
  WHERE ((c.id = award_nominations.category_id) AND (s.phase = 'nominating'::text))))));

ALTER POLICY "award_nominations_select" ON public."award_nominations"
  USING ((((select auth.uid()) = submitted_by) OR (EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid()))))));

ALTER POLICY "award_nominations_update_own" ON public."award_nominations"
  USING (((select auth.uid()) = submitted_by))
  WITH CHECK ((((select auth.uid()) = submitted_by) AND (EXISTS ( SELECT 1
   FROM (award_categories c
     JOIN award_seasons s ON ((s.id = c.season_id)))
  WHERE ((c.id = award_nominations.category_id) AND (s.phase = 'nominating'::text))))));

ALTER POLICY "award_nominees_delete_admin" ON public."award_nominees"
  USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid())))));

ALTER POLICY "award_nominees_insert_admin" ON public."award_nominees"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid())))));

ALTER POLICY "award_nominees_update_admin" ON public."award_nominees"
  USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid())))));

ALTER POLICY "award_seasons_delete_admin" ON public."award_seasons"
  USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid())))));

ALTER POLICY "award_seasons_insert_admin" ON public."award_seasons"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = (select auth.uid())) AND admins.is_owner))));

ALTER POLICY "award_seasons_update_admin" ON public."award_seasons"
  USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = (select auth.uid())) AND admins.is_owner))));

ALTER POLICY "award_votes_delete_admin" ON public."award_votes"
  USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid())))));

ALTER POLICY "award_votes_insert" ON public."award_votes"
  WITH CHECK ((((select auth.uid()) = voter_id) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (EXISTS ( SELECT 1
   FROM (award_categories c
     JOIN award_seasons s ON ((s.id = c.season_id)))
  WHERE ((c.id = award_votes.category_id) AND (s.phase = 'voting'::text))))));

ALTER POLICY "award_votes_select" ON public."award_votes"
  USING ((((select auth.uid()) = voter_id) OR (EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid())))) OR (EXISTS ( SELECT 1
   FROM (award_categories c
     JOIN award_seasons s ON ((s.id = c.season_id)))
  WHERE ((c.id = award_votes.category_id) AND (s.phase = 'revealed'::text))))));

ALTER POLICY "broadcasts_admin_select" ON public."broadcasts"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "Users manage courses in their own semesters" ON public."cgpa_courses"
  USING ((EXISTS ( SELECT 1
   FROM cgpa_semesters s
  WHERE ((s.id = cgpa_courses.semester_id) AND (s.user_id = (select auth.uid()))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM cgpa_semesters s
  WHERE ((s.id = cgpa_courses.semester_id) AND (s.user_id = (select auth.uid()))))));

ALTER POLICY "Users manage their own semesters" ON public."cgpa_semesters"
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "change_requests_select_own" ON public."change_requests"
  USING (((select auth.uid()) = submitted_by));

ALTER POLICY "change_requests_select_owner" ON public."change_requests"
  USING ((EXISTS ( SELECT 1
   FROM admins a
  WHERE ((a.user_id = (select auth.uid())) AND a.is_owner))));

ALTER POLICY "contact_messages_select_admin" ON public."contact_messages"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "event_photos_admin_delete" ON public."event_photos"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "event_photos_admin_insert" ON public."event_photos"
  WITH CHECK (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "events_admin_delete" ON public."events"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "events_admin_insert" ON public."events"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = (select auth.uid())) AND admins.is_owner))));

ALTER POLICY "events_admin_update" ON public."events"
  USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = (select auth.uid())) AND admins.is_owner))));

ALTER POLICY "excos_admin_delete" ON public."excos"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "excos_admin_insert" ON public."excos"
  WITH CHECK (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "excos_admin_update" ON public."excos"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "form_questions_delete_admin" ON public."form_questions"
  USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid())))));

ALTER POLICY "form_questions_insert_admin" ON public."form_questions"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid())))));

ALTER POLICY "form_questions_update_admin" ON public."form_questions"
  USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid())))));

ALTER POLICY "form_responses_delete_admin" ON public."form_responses"
  USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid())))));

ALTER POLICY "form_responses_insert" ON public."form_responses"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM forms
  WHERE ((forms.id = form_responses.form_id) AND ((forms.require_signin = false) OR ((forms.require_signin = true) AND ((select auth.uid()) = form_responses.respondent_id)))))));

ALTER POLICY "form_responses_select_admin" ON public."form_responses"
  USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid())))));

ALTER POLICY "form_responses_select_own" ON public."form_responses"
  USING (((select auth.uid()) = respondent_id));

ALTER POLICY "form_responses_update_own" ON public."form_responses"
  USING ((((select auth.uid()) = respondent_id) AND (EXISTS ( SELECT 1
   FROM forms
  WHERE ((forms.id = form_responses.form_id) AND (forms.allow_edit_after_submit = true) AND (forms.is_accepting_responses = true))))));

ALTER POLICY "forms_delete_admin" ON public."forms"
  USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid())))));

ALTER POLICY "forms_insert_admin" ON public."forms"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid())))));

ALTER POLICY "forms_update_admin" ON public."forms"
  USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = (select auth.uid())))));

ALTER POLICY "news_admin_delete" ON public."news"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "news_admin_insert" ON public."news"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = (select auth.uid())) AND admins.is_owner))));

ALTER POLICY "news_admin_update" ON public."news"
  USING ((EXISTS ( SELECT 1
   FROM admins
  WHERE ((admins.user_id = (select auth.uid())) AND admins.is_owner))));

ALTER POLICY "opportunities_admin_delete" ON public."opportunities"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "opportunities_admin_insert" ON public."opportunities"
  WITH CHECK (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "opportunities_admin_update" ON public."opportunities"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "outline_submissions_admin_delete" ON public."outline_submissions"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "outline_submissions_admin_update" ON public."outline_submissions"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "outline_submissions_insert_own" ON public."outline_submissions"
  WITH CHECK ((submitted_by = (select auth.uid())));

ALTER POLICY "outline_submissions_select_admin" ON public."outline_submissions"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "outlines_admin_delete" ON public."outlines"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "outlines_admin_insert" ON public."outlines"
  WITH CHECK (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "outlines_admin_update" ON public."outlines"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "profiles_insert_own" ON public."profiles"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "profiles_select_admin" ON public."profiles"
  USING ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.user_id = (select auth.uid())))));

ALTER POLICY "profiles_select_own" ON public."profiles"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "resources_admin_delete" ON public."resources"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "resources_admin_insert" ON public."resources"
  WITH CHECK (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "resources_admin_update" ON public."resources"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "site_content_admin_update" ON public."site_content"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "timetables_admin_delete" ON public."timetables"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "timetables_admin_insert" ON public."timetables"
  WITH CHECK (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));

ALTER POLICY "timetables_admin_update" ON public."timetables"
  USING (((select auth.uid()) IN ( SELECT admins.user_id
   FROM admins)));


-- ===== 20260922103931_add_site_links_to_site_content =====
alter table public.site_content
  add column substack_url text default 'https://nammescommunique.substack.com',
  add column whatsapp_url text,
  add column x_url text,
  add column instagram_url text,
  add column linkedin_url text,
  add column youtube_url text;

update public.site_content set substack_url = 'https://nammescommunique.substack.com' where id = 1 and substack_url is null;


-- ===== 20260922110249_create_page_banners =====
create table public.page_banners (
  page_key text primary key,
  title text not null default '',
  subtitle text not null default '',
  image_url text,
  updated_at timestamptz not null default now()
);

alter table public.page_banners enable row level security;

create policy page_banners_public_select on public.page_banners
  for select to public using (true);

create policy page_banners_admin_update on public.page_banners
  for update to public using ((select auth.uid()) in (select user_id from admins));

insert into public.page_banners (page_key, title, subtitle, image_url) values
  ('about', 'About NAMMES', 'Learn more about NAMMES, our mission and values.', 'https://images.unsplash.com/photo-1584365098838-50ccef838f4a?auto=format&fit=crop&w=1600&q=80'),
  ('contact', 'Contact Us', 'Questions, feedback, or ideas for NAMMES Hub? We''d love to hear from you.', null),
  ('events', 'Events', 'Workshops, seminars, and gatherings from the department.', null),
  ('excos', 'The Aegis 26/27', 'Meet the Executive Council leading NAMMES for the 2026/2027 session.', 'https://images.unsplash.com/photo-1584365098838-50ccef838f4a?auto=format&fit=crop&w=1600&q=80'),
  ('news', 'Department News', 'News and announcements, posted jointly with the PRO.', null),
  ('opportunities', 'Opportunities', 'Explore current engineering roles, internships, and research positions.', null),
  ('outlines', 'Course Outlines', 'Access detailed curriculum structures and requirements.', null),
  ('resources', 'Resources', 'Access lecture notes, past questions, and study materials curated for engineering excellence.', null),
  ('timetable', 'Timetable', 'Select your level to view the class and exam schedule.', null),
  ('cgpa', 'CGPA Calculator', 'Calculate your cumulative grade point average by level and semester.', null);


-- ===== 20260922110539_create_page_banners_storage_bucket =====
insert into storage.buckets (id, name, public) values ('page-banners', 'page-banners', true);

create policy page_banners_bucket_public_select on storage.objects
  for select to public using (bucket_id = 'page-banners');

create policy page_banners_bucket_admin_insert on storage.objects
  for insert to public with check (bucket_id = 'page-banners' and auth.uid() in (select user_id from admins));

create policy page_banners_bucket_admin_update on storage.objects
  for update to public using (bucket_id = 'page-banners' and auth.uid() in (select user_id from admins));

create policy page_banners_bucket_admin_delete on storage.objects
  for delete to public using (bucket_id = 'page-banners' and auth.uid() in (select user_id from admins));


-- ===== 20260925120259_add_maintenance_mode_to_site_content =====
alter table public.site_content
  add column maintenance_mode boolean not null default false,
  add column maintenance_message text,
  add column maintenance_contact_email text;

-- ===== 20260925121835_add_broadcast_images_bucket_and_column =====
alter table public.broadcasts add column image_url text;

insert into storage.buckets (id, name, public)
values ('broadcast-images', 'broadcast-images', true);

create policy "broadcast_images_public_select" on storage.objects
  for select using (bucket_id = 'broadcast-images');

create policy "broadcast_images_admin_insert" on storage.objects
  for insert with check (bucket_id = 'broadcast-images' and auth.uid() in (select user_id from admins));

create policy "broadcast_images_admin_update" on storage.objects
  for update using (bucket_id = 'broadcast-images' and auth.uid() in (select user_id from admins));

create policy "broadcast_images_admin_delete" on storage.objects
  for delete using (bucket_id = 'broadcast-images' and auth.uid() in (select user_id from admins));

-- ===== 20260925130435_add_template_id_to_broadcasts =====
ALTER TABLE public.broadcasts
  ADD COLUMN template_id text NOT NULL DEFAULT 'default';

-- ===== 20260925134251_create_email_templates_table =====
create table public.email_templates (
  template_id text primary key,
  html text not null,
  updated_at timestamptz not null default now()
);

alter table public.email_templates enable row level security;

create policy email_templates_admin_select on public.email_templates
  for select
  using ((select auth.uid()) in (select user_id from admins));

create policy email_templates_admin_update on public.email_templates
  for update
  using ((select auth.uid()) in (select user_id from admins));

insert into public.email_templates (template_id, html) values
  ('default', $tpl_default$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Announcement - NAMMES Hub</title>
<style>

*,*::before,*::after{box-sizing:border-box;}
body{margin:0;padding:48px 16px;background-color:#f6f3f2;font-family:'Public Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#000904;-webkit-font-smoothing:antialiased;line-height:1.6;}
.email-container{max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #c2c8c1;border-radius:8px;overflow:hidden;}
.wordmark{font-size:19px;font-weight:700;letter-spacing:-0.02em;text-decoration:none;color:#0b2417;}
.wordmark img{vertical-align:middle;margin-right:8px;}
.wordmark span{vertical-align:middle;}
.cta-container{margin:28px 0 12px 0;}
.cta-button{display:inline-block;background-color:#ae3200;color:#ffffff !important;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:9999px;letter-spacing:.01em;}
.email-footer{padding:24px 40px 32px 40px;background-color:#faf8f7;border-top:1px solid #ece8e4;font-size:12px;line-height:1.6;color:#6b6558;}
.footer-link{color:#6b6558;text-decoration:underline;}
@media (max-width:640px){body{padding:16px 8px;}.email-body{padding:28px 24px 32px 24px !important;}.email-footer{padding:20px 24px 28px 24px;}.cta-button{display:block;text-align:center;}}

.header-bar{background-color:#0b2417;padding:24px 40px;}
.header-bar .wordmark{color:#ffffff;}
.header-tag{font-family:'IBM Plex Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9cd6b2;background-color:rgba(255,255,255,.08);padding:4px 8px;border-radius:4px;}
.email-body{padding:40px 40px 36px 40px;}
.content-image{width:100%;max-width:520px;height:auto;border-radius:8px;display:block;margin:24px 0 0 0;}
.subject-title{font-size:23px;font-weight:700;line-height:1.3;color:#0b2417;margin:0 0 24px 0;letter-spacing:-.015em;}
.content-area{font-size:15px;line-height:1.7;color:#191813;}
.content-area p{margin:0 0 18px 0;}
.content-area a{color:#ae3200;text-decoration:underline;}
</style>
</head>
<body>
  <div class="email-container">
    <div class="header-bar">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><a href="{{site_url}}" class="wordmark"><img src="{{site_url}}/logo.png" width="22" height="22" alt="NAMMES Hub" style="border-radius:4px;" /><span>NAMMES Hub</span></a></td>
        <td align="right"><span class="header-tag">Official Notice</span></td>
      </tr></table>
    </div>
    <div class="email-body">
      <h1 class="subject-title">{{subject}}</h1>
      <div class="content-area">{{body}}</div>
      {{image}}
    </div>
    <div class="email-footer">
      <div>You're receiving this because you're a NAMMES Hub member — <a href="{{site_url}}/account" class="footer-link">manage your notification preferences</a>.</div>
      <div style="margin-top:6px;">National Association of Metallurgical and Materials Engineering Students · Faculty of Engineering, University of Lagos</div>
    </div>
  </div>
</body>
</html>$tpl_default$),
  ('bold', $tpl_bold$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Announcement - NAMMES Hub</title>
<style>

*,*::before,*::after{box-sizing:border-box;}
body{margin:0;padding:48px 16px;background-color:#f6f3f2;font-family:'Public Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#000904;-webkit-font-smoothing:antialiased;line-height:1.6;}
.email-container{max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #c2c8c1;border-radius:8px;overflow:hidden;}
.wordmark{font-size:19px;font-weight:700;letter-spacing:-0.02em;text-decoration:none;color:#0b2417;}
.wordmark img{vertical-align:middle;margin-right:8px;}
.wordmark span{vertical-align:middle;}
.cta-container{margin:28px 0 12px 0;}
.cta-button{display:inline-block;background-color:#ae3200;color:#ffffff !important;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:9999px;letter-spacing:.01em;}
.email-footer{padding:24px 40px 32px 40px;background-color:#faf8f7;border-top:1px solid #ece8e4;font-size:12px;line-height:1.6;color:#6b6558;}
.footer-link{color:#6b6558;text-decoration:underline;}
@media (max-width:640px){body{padding:16px 8px;}.email-body{padding:28px 24px 32px 24px !important;}.email-footer{padding:20px 24px 28px 24px;}.cta-button{display:block;text-align:center;}}

.header-bar{background-color:#ff5a1f;padding:18px 40px;}
.header-bar .wordmark{color:#ffffff;}
.header-tag{display:inline-block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#ffffff;background-color:rgba(255,255,255,.18);padding:4px 10px;border-radius:4px;}
.email-body{padding:24px 40px 40px 40px;}
.eyebrow-row{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#ae3200;margin-bottom:14px;}
.content-image{width:100%;max-width:520px;height:auto;border-radius:8px;display:block;margin:24px 0 0 0;}
.subject-title{font-size:28px;font-weight:800;line-height:1.15;color:#0b2417;margin:0 0 20px 0;letter-spacing:-.02em;}
.content-area{font-size:16px;line-height:1.75;color:#191813;}
.content-area p{margin:0 0 18px 0;}
.content-area a{color:#ae3200;text-decoration:underline;}
</style>
</head>
<body>
  <div class="email-container">
    <div class="header-bar">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><a href="{{site_url}}" class="wordmark"><img src="{{site_url}}/logo.png" width="22" height="22" alt="NAMMES Hub" style="border-radius:4px;" /><span>NAMMES Hub</span></a></td>
        <td align="right"><span class="header-tag">Official Bulletin</span></td>
      </tr></table>
    </div>
    <div class="email-body">
      <div class="eyebrow-row">Announcement · {{date}}</div>
      <h1 class="subject-title">{{subject}}</h1>
      <div class="content-area">{{body}}</div>
      {{image}}
      <div class="cta-container">
        <a href="{{site_url}}" class="cta-button">Visit NAMMES Hub &rarr;</a>
      </div>
    </div>
    <div class="email-footer">
      <div>You're receiving this because you're a NAMMES Hub member — <a href="{{site_url}}/account" class="footer-link">manage your notification preferences</a>.</div>
      <div style="margin-top:6px;">National Association of Metallurgical and Materials Engineering Students · Faculty of Engineering, University of Lagos</div>
    </div>
  </div>
</body>
</html>$tpl_bold$),
  ('minimal', $tpl_minimal$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Announcement - NAMMES Hub</title>
<style>

*,*::before,*::after{box-sizing:border-box;}
body{margin:0;padding:48px 16px;background-color:#f6f3f2;font-family:'Public Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#000904;-webkit-font-smoothing:antialiased;line-height:1.6;}
.email-container{max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #c2c8c1;border-radius:8px;overflow:hidden;}
.wordmark{font-size:19px;font-weight:700;letter-spacing:-0.02em;text-decoration:none;color:#0b2417;}
.wordmark img{vertical-align:middle;margin-right:8px;}
.wordmark span{vertical-align:middle;}
.cta-container{margin:28px 0 12px 0;}
.cta-button{display:inline-block;background-color:#ae3200;color:#ffffff !important;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:9999px;letter-spacing:.01em;}
.email-footer{padding:24px 40px 32px 40px;background-color:#faf8f7;border-top:1px solid #ece8e4;font-size:12px;line-height:1.6;color:#6b6558;}
.footer-link{color:#6b6558;text-decoration:underline;}
@media (max-width:640px){body{padding:16px 8px;}.email-body{padding:28px 24px 32px 24px !important;}.email-footer{padding:20px 24px 28px 24px;}.cta-button{display:block;text-align:center;}}

.email-header{padding:32px 40px 20px 40px;}
.header-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#6b6558;}
.header-divider{height:1px;background-color:#ece8e4;margin:0 40px;}
.email-body{padding:24px 40px 44px 40px;}
.eyebrow-row{font-size:12px;color:#6b6558;margin-bottom:16px;}
.content-image-sm{width:100%;max-width:280px;height:auto;border-radius:6px;display:block;margin:24px 0 0 0;}
.subject-title{font-size:20px;font-weight:700;line-height:1.35;color:#0b2417;margin:0 0 20px 0;letter-spacing:-.01em;padding-bottom:20px;border-bottom:1px solid #f0edea;}
.content-area{font-size:15px;line-height:1.75;color:#1c1b1b;}
.content-area p{margin:0 0 18px 0;}
.content-area a{color:#ae3200;text-decoration:underline;}
</style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><a href="{{site_url}}" class="wordmark"><img src="{{site_url}}/logo.png" width="22" height="22" alt="NAMMES Hub" style="border-radius:4px;" /><span>NAMMES Hub</span></a></td>
        <td align="right"><span class="header-label">Notice</span></td>
      </tr></table>
    </div>
    <div class="header-divider"></div>
    <div class="email-body">
      <div class="eyebrow-row">{{date}}</div>
      <h1 class="subject-title">{{subject}}</h1>
      <div class="content-area">{{body}}</div>
      {{image}}
    </div>
    <div class="email-footer">
      <div>You're receiving this because you're a NAMMES Hub member — <a href="{{site_url}}/account" class="footer-link">manage your notification preferences</a>.</div>
      <div style="margin-top:6px;">National Association of Metallurgical and Materials Engineering Students · Faculty of Engineering, University of Lagos</div>
    </div>
  </div>
</body>
</html>$tpl_minimal$),
  ('event', $tpl_event$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Event - NAMMES Hub</title>
<style>

*,*::before,*::after{box-sizing:border-box;}
body{margin:0;padding:48px 16px;background-color:#f6f3f2;font-family:'Public Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#000904;-webkit-font-smoothing:antialiased;line-height:1.6;}
.email-container{max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #c2c8c1;border-radius:8px;overflow:hidden;}
.wordmark{font-size:19px;font-weight:700;letter-spacing:-0.02em;text-decoration:none;color:#0b2417;}
.wordmark img{vertical-align:middle;margin-right:8px;}
.wordmark span{vertical-align:middle;}
.cta-container{margin:28px 0 12px 0;}
.cta-button{display:inline-block;background-color:#ae3200;color:#ffffff !important;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:9999px;letter-spacing:.01em;}
.email-footer{padding:24px 40px 32px 40px;background-color:#faf8f7;border-top:1px solid #ece8e4;font-size:12px;line-height:1.6;color:#6b6558;}
.footer-link{color:#6b6558;text-decoration:underline;}
@media (max-width:640px){body{padding:16px 8px;}.email-body{padding:28px 24px 32px 24px !important;}.email-footer{padding:20px 24px 28px 24px;}.cta-button{display:block;text-align:center;}}

.email-header{padding:28px 40px 0 40px;}
.header-tag{display:inline-block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#ae3200;background-color:#fff0e6;border:1px solid rgba(174,50,0,.18);padding:4px 10px;border-radius:4px;}
.email-body{padding:20px 40px 40px 40px;}
.date-badge{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#ae3200;background-color:#fff0e6;border:1px solid rgba(174,50,0,.18);padding:5px 10px;border-radius:4px;margin-bottom:16px;}
.content-image{width:100%;max-width:520px;height:auto;border-radius:8px;display:block;margin:20px 0 0 0;}
.subject-title{font-size:24px;font-weight:700;line-height:1.3;color:#0b2417;margin:0 0 14px 0;letter-spacing:-.015em;}
.content-area{font-size:15px;line-height:1.7;color:#191813;}
.content-area p{margin:0 0 18px 0;}
.content-area a{color:#ae3200;text-decoration:underline;}
</style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><a href="{{site_url}}" class="wordmark"><img src="{{site_url}}/logo.png" width="22" height="22" alt="NAMMES Hub" style="border-radius:4px;" /><span>NAMMES Hub</span></a></td>
        <td align="right"><span class="header-tag">Official Invitation</span></td>
      </tr></table>
    </div>
    <div class="email-body">
      <div class="date-badge">{{date}}</div>
      <h1 class="subject-title">{{subject}}</h1>
      <div class="content-area">{{body}}</div>
      {{image}}
      <div class="cta-container">
        <a href="{{site_url}}/events" class="cta-button">See events &rarr;</a>
      </div>
    </div>
    <div class="email-footer">
      <div>You're receiving this because you're a NAMMES Hub member — <a href="{{site_url}}/account" class="footer-link">manage your notification preferences</a>.</div>
      <div style="margin-top:6px;">National Association of Metallurgical and Materials Engineering Students · Faculty of Engineering, University of Lagos</div>
    </div>
  </div>
</body>
</html>$tpl_event$),
  ('alert', $tpl_alert$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Urgent - NAMMES Hub</title>
<style>

*,*::before,*::after{box-sizing:border-box;}
body{margin:0;padding:48px 16px;background-color:#f6f3f2;font-family:'Public Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#000904;-webkit-font-smoothing:antialiased;line-height:1.6;}
.email-container{max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #c2c8c1;border-radius:8px;overflow:hidden;}
.wordmark{font-size:19px;font-weight:700;letter-spacing:-0.02em;text-decoration:none;color:#0b2417;}
.wordmark img{vertical-align:middle;margin-right:8px;}
.wordmark span{vertical-align:middle;}
.cta-container{margin:28px 0 12px 0;}
.cta-button{display:inline-block;background-color:#ae3200;color:#ffffff !important;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:9999px;letter-spacing:.01em;}
.email-footer{padding:24px 40px 32px 40px;background-color:#faf8f7;border-top:1px solid #ece8e4;font-size:12px;line-height:1.6;color:#6b6558;}
.footer-link{color:#6b6558;text-decoration:underline;}
@media (max-width:640px){body{padding:16px 8px;}.email-body{padding:28px 24px 32px 24px !important;}.email-footer{padding:20px 24px 28px 24px;}.cta-button{display:block;text-align:center;}}

.top-strip{height:6px;background-color:#ba1a1a;}
.header-bar{background-color:#ba1a1a;padding:14px 40px;}
.header-bar .wordmark{color:#ffffff;font-size:15px;}
.header-tag{display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#ffffff;background-color:rgba(255,255,255,.18);padding:4px 10px;border-radius:9999px;}
.email-body{padding:28px 40px 40px 40px;}
.alert-card{background-color:#f6f3f2;border-left:4px solid #ba1a1a;border-radius:0 8px 8px 0;padding:24px 28px;}
.callout{background-color:#ffdad6;border-radius:8px;padding:14px 16px;margin-top:16px;}
.callout-label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#ba1a1a;margin-bottom:6px;}
.content-image{width:100%;max-width:520px;height:auto;border-radius:8px;display:block;margin:20px 0 0 0;}
.subject-title{font-size:22px;font-weight:800;line-height:1.3;color:#000904;margin:0;letter-spacing:-.01em;}
.content-area{font-size:15px;line-height:1.7;color:#191813;}
.content-area p{margin:0 0 18px 0;}
.content-area p:last-child{margin-bottom:0;}
.content-area a{color:#ae3200;text-decoration:underline;}
</style>
</head>
<body>
  <div class="email-container">
    <div class="top-strip"></div>
    <div class="header-bar">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><a href="{{site_url}}" class="wordmark"><img src="{{site_url}}/logo.png" width="22" height="22" alt="NAMMES Hub" style="border-radius:4px;" /><span>NAMMES Hub</span></a></td>
        <td align="right"><span class="header-tag">Urgent Notice</span></td>
      </tr></table>
    </div>
    <div class="email-body">
      <div class="alert-card">
        <h1 class="subject-title">{{subject}}</h1>
        <div class="callout">
          <span class="callout-label">Please read carefully</span>
          <div class="content-area">{{body}}</div>
        </div>
        {{image}}
      </div>
    </div>
    <div class="email-footer">
      <div>You're receiving this because you're a NAMMES Hub member — <a href="{{site_url}}/account" class="footer-link">manage your notification preferences</a>.</div>
      <div style="margin-top:6px;">National Association of Metallurgical and Materials Engineering Students · Faculty of Engineering, University of Lagos</div>
    </div>
  </div>
</body>
</html>$tpl_alert$),
  ('digest', $tpl_digest$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Digest - NAMMES Hub</title>
<style>

*,*::before,*::after{box-sizing:border-box;}
body{margin:0;padding:48px 16px;background-color:#f6f3f2;font-family:'Public Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#000904;-webkit-font-smoothing:antialiased;line-height:1.6;}
.email-container{max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #c2c8c1;border-radius:8px;overflow:hidden;}
.wordmark{font-size:19px;font-weight:700;letter-spacing:-0.02em;text-decoration:none;color:#0b2417;}
.wordmark img{vertical-align:middle;margin-right:8px;}
.wordmark span{vertical-align:middle;}
.cta-container{margin:28px 0 12px 0;}
.cta-button{display:inline-block;background-color:#ae3200;color:#ffffff !important;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:9999px;letter-spacing:.01em;}
.email-footer{padding:24px 40px 32px 40px;background-color:#faf8f7;border-top:1px solid #ece8e4;font-size:12px;line-height:1.6;color:#6b6558;}
.footer-link{color:#6b6558;text-decoration:underline;}
@media (max-width:640px){body{padding:16px 8px;}.email-body{padding:28px 24px 32px 24px !important;}.email-footer{padding:20px 24px 28px 24px;}.cta-button{display:block;text-align:center;}}

.email-header{padding:28px 40px 16px 40px;text-align:center;border-bottom:1px solid #f0edea;}
.email-header .wordmark{display:inline-block;}
.eyebrow{display:block;margin-top:6px;font-family:'IBM Plex Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#6b6558;}
.email-body{padding:36px 44px 40px 44px;}
.content-image{width:100%;max-width:520px;height:auto;border-radius:8px;display:block;margin:22px auto 0 auto;}
.subject-title{font-size:26px;font-weight:700;line-height:1.25;color:#0b2417;margin:0 0 22px 0;letter-spacing:-.02em;text-align:center;}
.divider{width:48px;height:2px;background-color:#ff5a1f;margin:0 auto 26px auto;}
.content-area{font-size:15px;line-height:1.8;color:#1c1b1b;max-width:480px;margin:0 auto;}
.content-area p{margin:0 0 18px 0;}
.content-area a{color:#ae3200;text-decoration:underline;}
.cta-container{text-align:center;}
</style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <a href="{{site_url}}" class="wordmark"><img src="{{site_url}}/logo.png" width="22" height="22" alt="NAMMES Hub" style="border-radius:4px;" /><span>NAMMES Hub</span></a>
      <span class="eyebrow">Weekly Dispatch · {{date_full}}</span>
    </div>
    <div class="email-body">
      <h1 class="subject-title">{{subject}}</h1>
      <div class="divider"></div>
      <div class="content-area">{{body}}</div>
      {{image}}
      <div class="cta-container">
        <a href="{{site_url}}" class="cta-button">Read more on NAMMES Hub &rarr;</a>
      </div>
    </div>
    <div class="email-footer">
      <div>You're receiving this because you're a NAMMES Hub member — <a href="{{site_url}}/account" class="footer-link">manage your notification preferences</a>.</div>
      <div style="margin-top:6px;">National Association of Metallurgical and Materials Engineering Students · Faculty of Engineering, University of Lagos</div>
    </div>
  </div>
</body>
</html>$tpl_digest$),
  ('celebration', $tpl_celebration$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Celebration - NAMMES Hub</title>
<style>

*,*::before,*::after{box-sizing:border-box;}
body{margin:0;padding:48px 16px;background-color:#f6f3f2;font-family:'Public Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#000904;-webkit-font-smoothing:antialiased;line-height:1.6;}
.email-container{max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #c2c8c1;border-radius:8px;overflow:hidden;}
.wordmark{font-size:19px;font-weight:700;letter-spacing:-0.02em;text-decoration:none;color:#0b2417;}
.wordmark img{vertical-align:middle;margin-right:8px;}
.wordmark span{vertical-align:middle;}
.cta-container{margin:28px 0 12px 0;}
.cta-button{display:inline-block;background-color:#ae3200;color:#ffffff !important;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:9999px;letter-spacing:.01em;}
.email-footer{padding:24px 40px 32px 40px;background-color:#faf8f7;border-top:1px solid #ece8e4;font-size:12px;line-height:1.6;color:#6b6558;}
.footer-link{color:#6b6558;text-decoration:underline;}
@media (max-width:640px){body{padding:16px 8px;}.email-body{padding:28px 24px 32px 24px !important;}.email-footer{padding:20px 24px 28px 24px;}.cta-button{display:block;text-align:center;}}

.stripe{height:6px;background:linear-gradient(90deg,#ff5a1f 0%,#ff5a1f 50%,#0b2417 50%,#0b2417 100%);}
.email-header{padding:26px 40px 12px 40px;}
.header-tag{display:inline-block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#1c6b3a;background-color:#e6f0ea;border:1px solid rgba(28,107,58,.18);padding:4px 10px;border-radius:9999px;margin-top:14px;}
.email-body{padding:16px 40px 40px 40px;}
.content-image{width:100%;max-width:520px;height:auto;border-radius:8px;display:block;margin:20px 0 0 0;}
.subject-title{font-size:25px;font-weight:800;line-height:1.25;color:#0b2417;margin:0 0 18px 0;letter-spacing:-.015em;text-align:center;}
.content-area{font-size:15px;line-height:1.7;color:#191813;max-width:480px;margin:0 auto;}
.content-area p{margin:0 0 18px 0;}
.content-area a{color:#ae3200;text-decoration:underline;}
.cta-container{text-align:center;}
</style>
</head>
<body>
  <div class="email-container">
    <div class="stripe"></div>
    <div class="email-header">
      <a href="{{site_url}}" class="wordmark"><img src="{{site_url}}/logo.png" width="22" height="22" alt="NAMMES Hub" style="border-radius:4px;" /><span>NAMMES Hub</span></a>
      <div><span class="header-tag">Congratulations</span></div>
    </div>
    <div class="email-body">
      <h1 class="subject-title">{{subject}}</h1>
      <div class="content-area">{{body}}</div>
      {{image}}
      <div class="cta-container">
        <a href="{{site_url}}/awards" class="cta-button">View all results &rarr;</a>
      </div>
    </div>
    <div class="email-footer">
      <div>You're receiving this because you're a NAMMES Hub member — <a href="{{site_url}}/account" class="footer-link">manage your notification preferences</a>.</div>
      <div style="margin-top:6px;">National Association of Metallurgical and Materials Engineering Students · Faculty of Engineering, University of Lagos</div>
    </div>
  </div>
</body>
</html>$tpl_celebration$);


-- ===== 20260928171019_add_profile_entry_year_and_course_type =====

alter table public.profiles
  add column entry_year integer check (entry_year is null or entry_year between 2000 and 2100);

alter table public.cgpa_courses
  add column course_type text not null default 'compulsory' check (course_type in ('compulsory', 'elective'));

create or replace function public.set_own_full_name(name text)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.profiles set full_name = nullif(trim(name), '') where user_id = auth.uid();
$$;

create or replace function public.set_own_entry_year(year integer)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.profiles set entry_year = year where user_id = auth.uid();
$$;

