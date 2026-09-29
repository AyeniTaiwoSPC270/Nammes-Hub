-- Exported from Supabase's applied-migration history. Apply after 01_*.sql. See 01 for notes.

-- ===== 20260904073550_outline_submissions =====
create table outline_submissions (
  id uuid primary key default gen_random_uuid(),
  outline_id text not null references outlines(id) on delete cascade,
  type text not null,
  session text,
  title text not null,
  file_url text,
  external_url text,
  status text not null default 'pending',
  submitted_by uuid not null references auth.users(id),
  submitted_by_email text not null,
  created_at timestamptz not null default now()
);

alter table outline_submissions enable row level security;

create policy "outline_submissions_insert_own" on outline_submissions for insert
  to public with check (submitted_by = auth.uid());

create policy "outline_submissions_select_approved" on outline_submissions for select
  to public using (status = 'approved');

create policy "outline_submissions_select_admin" on outline_submissions for select
  to public using (auth.uid() in (select user_id from admins));

create policy "outline_submissions_admin_update" on outline_submissions for update
  to public using (auth.uid() in (select user_id from admins));

create policy "outline_submissions_admin_delete" on outline_submissions for delete
  to public using (auth.uid() in (select user_id from admins));

insert into storage.buckets (id, name, public) values ('outline-attachments', 'outline-attachments', true);

create policy "outline_attachments_public_select" on storage.objects for select
  to public using (bucket_id = 'outline-attachments');

create policy "outline_attachments_own_insert" on storage.objects for insert
  to public with check (bucket_id = 'outline-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "outline_attachments_admin_delete" on storage.objects for delete
  to public using (bucket_id = 'outline-attachments' and auth.uid() in (select user_id from admins));

-- ===== 20260904082833_add_email_phone_to_excos =====
alter table public.excos
  add column if not exists email text,
  add column if not exists phone text;

-- ===== 20260904084925_create_contact_messages =====
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

create policy contact_messages_insert_public
  on public.contact_messages
  for insert
  with check (true);

create policy contact_messages_select_admin
  on public.contact_messages
  for select
  using (auth.uid() in (select user_id from public.admins));

-- ===== 20260904093316_nammes_forms_schema =====
create table forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_accepting_responses boolean not null default true,
  closes_at timestamptz,
  require_signin boolean not null default false,
  one_response_per_person boolean not null default false,
  allow_edit_after_submit boolean not null default false
);

create table form_questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  position int not null,
  type text not null,
  label text not null,
  helper_text text,
  required boolean not null default false,
  options jsonb,
  scale_min int,
  scale_max int,
  scale_min_label text,
  scale_max_label text
);

create table form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  respondent_id uuid references auth.users(id),
  respondent_email text,
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table forms enable row level security;
alter table form_questions enable row level security;
alter table form_responses enable row level security;

create policy "forms_select_all" on forms for select using (true);
create policy "forms_insert_admin" on forms for insert with check (
  exists (select 1 from admins where admins.user_id = auth.uid())
);
create policy "forms_update_admin" on forms for update using (
  exists (select 1 from admins where admins.user_id = auth.uid())
);
create policy "forms_delete_admin" on forms for delete using (
  exists (select 1 from admins where admins.user_id = auth.uid())
);

create policy "form_questions_select_all" on form_questions for select using (true);
create policy "form_questions_insert_admin" on form_questions for insert with check (
  exists (select 1 from admins where admins.user_id = auth.uid())
);
create policy "form_questions_update_admin" on form_questions for update using (
  exists (select 1 from admins where admins.user_id = auth.uid())
);
create policy "form_questions_delete_admin" on form_questions for delete using (
  exists (select 1 from admins where admins.user_id = auth.uid())
);

create policy "form_responses_insert" on form_responses for insert with check (
  exists (
    select 1 from forms
    where forms.id = form_responses.form_id
      and (
        forms.require_signin = false
        or (forms.require_signin = true and auth.uid() = form_responses.respondent_id)
      )
      and (
        forms.one_response_per_person = false
        or not exists (
          select 1 from form_responses existing
          where existing.form_id = form_responses.form_id
            and existing.respondent_id = form_responses.respondent_id
        )
      )
  )
);

create policy "form_responses_select_own" on form_responses for select using (
  auth.uid() = respondent_id
);

create policy "form_responses_select_admin" on form_responses for select using (
  exists (select 1 from admins where admins.user_id = auth.uid())
);

create policy "form_responses_update_own" on form_responses for update using (
  auth.uid() = respondent_id
  and exists (
    select 1 from forms
    where forms.id = form_responses.form_id
      and forms.allow_edit_after_submit = true
      and forms.is_accepting_responses = true
  )
);

create policy "form_responses_delete_admin" on form_responses for delete using (
  exists (select 1 from admins where admins.user_id = auth.uid())
);

insert into storage.buckets (id, name, public) values ('form-uploads', 'form-uploads', true)
on conflict (id) do nothing;

create policy "form_uploads_select_public" on storage.objects for select using (
  bucket_id = 'form-uploads'
);

create policy "form_uploads_insert" on storage.objects for insert with check (
  bucket_id = 'form-uploads'
  and exists (
    select 1 from forms
    where forms.id = ((storage.foldername(name))[1])::uuid
      and (
        forms.require_signin = false
        or (forms.require_signin = true and auth.uid() is not null)
      )
  )
);

create policy "form_uploads_delete_admin" on storage.objects for delete using (
  bucket_id = 'form-uploads' and exists (select 1 from admins where admins.user_id = auth.uid())
);

-- ===== 20260904095553_fix_form_responses_insert_recursion =====
drop policy if exists "form_responses_insert" on form_responses;

create policy "form_responses_insert" on form_responses for insert with check (
  exists (
    select 1 from forms
    where forms.id = form_responses.form_id
      and (
        forms.require_signin = false
        or (forms.require_signin = true and auth.uid() = form_responses.respondent_id)
      )
  )
);

create or replace function enforce_one_response_per_person()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_one_per_person boolean;
begin
  select one_response_per_person into v_one_per_person from forms where id = new.form_id;
  if v_one_per_person and new.respondent_id is not null then
    if exists (
      select 1 from form_responses
      where form_id = new.form_id
        and respondent_id = new.respondent_id
    ) then
      raise exception 'You have already responded to this form.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists form_responses_one_per_person on form_responses;
create trigger form_responses_one_per_person
before insert on form_responses
for each row execute function enforce_one_response_per_person();

-- ===== 20260904142651_profiles_schema =====
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  student_id text not null unique check (student_id ~ '^240406[0-9]{3}$'),
  full_name text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy profiles_select_own on profiles for select using (auth.uid() = user_id);
create policy profiles_insert_own on profiles for insert with check (auth.uid() = user_id);

create or replace function is_student_id_taken(p_student_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where student_id = p_student_id);
$$;

grant execute on function is_student_id_taken(text) to anon, authenticated;

create or replace function handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (user_id, student_id, full_name)
  values (new.id, new.raw_user_meta_data->>'student_id', new.raw_user_meta_data->>'full_name');
  return new;
exception
  when unique_violation then
    raise exception 'This matric number is already registered to another account.';
  when check_violation then
    raise exception 'Matric number must match the department format (240406XXX).';
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user_profile();
