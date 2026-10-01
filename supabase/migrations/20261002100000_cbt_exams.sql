-- CBT practice exams: timed, exam-style papers by course. Spec: docs/superpowers/specs/2026-10-01-cbt-exam-mode.md
-- Admin exams are a course + an exam whose questions live in a hidden quiz (the "bank"); a student-made personal exam is
-- a community quiz with exam settings. Students never read these tables: the API (service role) draws, hides the answer
-- key, keeps the clock and grades. Rollback in supabase/rollbacks/.

-- A question bank is a normal quiz row marked is_cbt, so the existing question storage, import and maths carry over.
alter table public.quizzes
  add column is_cbt boolean not null default false,
  -- personal exams only: { duration_minutes, pass_mark_percent, shuffle_questions, shuffle_options, draw_count }
  add column cbt_settings jsonb check (cbt_settings is null or jsonb_typeof(cbt_settings) = 'object');

alter table public.quiz_questions
  add column explanation text check (explanation is null or char_length(explanation) <= 500),
  add column topic text check (topic is null or char_length(topic) <= 60),
  -- keep the answers in the order they were typed (for "all of the above" style questions)
  add column no_shuffle boolean not null default false;

create table public.cbt_courses (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('100', '200', '300', '400', '500', 'other')),
  code text not null check (char_length(btrim(code)) between 2 and 20),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (code)
);

-- A short, readable code shared by exams and personal community sets, so one /cbt/:code link finds either.
create or replace function public.cbt_new_code() returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.cbt_exams where code = candidate)
          and not exists (select 1 from public.quizzes where custom_code = candidate);
  end loop;
  return candidate;
end;
$$;

create table public.cbt_exams (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.cbt_courses(id) on delete cascade,
  quiz_id uuid not null unique references public.quizzes(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  session_label text check (session_label is null or char_length(session_label) <= 40),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  published boolean not null default false,
  mode text not null default 'bank' check (mode in ('bank', 'fixed')),
  draw_count integer check (draw_count is null or draw_count between 1 and 500),
  duration_minutes integer not null default 30 check (duration_minutes between 1 and 240),
  pass_mark_percent integer not null default 50 check (pass_mark_percent between 1 and 100),
  shuffle_questions boolean not null default true,
  shuffle_options boolean not null default true,
  show_explanations boolean not null default true,
  allow_study_mode boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cbt_exams alter column code set default public.cbt_new_code();
create index cbt_exams_course on public.cbt_exams (course_id);

-- Deleting an exam deletes its question bank too.
create or replace function public.cbt_exam_deleted() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.quizzes where id = old.quiz_id and is_cbt;
  return old;
end;
$$;
revoke execute on function public.cbt_exam_deleted() from public, anon, authenticated;
create trigger cbt_exams_bank_cleanup after delete on public.cbt_exams for each row execute function public.cbt_exam_deleted();

create or replace function public.cbt_touch() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger cbt_exams_touch before update on public.cbt_exams for each row execute function public.cbt_touch();

-- One row per attempt. Only the hash of the attempt's secret is stored.
create table public.cbt_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.cbt_exams(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  token_hash text not null unique,
  mode text not null default 'exam' check (mode in ('exam', 'study')),
  -- the draw, in the order shown, and for each question the order its answers were shown in (original positions)
  question_ids uuid[] not null check (cardinality(question_ids) between 1 and 500),
  option_orders jsonb not null default '{}'::jsonb,
  -- { question id: { chosen_index (original position) | answer_text } }
  answers jsonb not null default '{}'::jsonb,
  flagged uuid[] not null default '{}',
  pass_mark_percent integer not null default 50,
  started_at timestamptz not null default now(),
  -- null in study mode (no clock)
  deadline_at timestamptz,
  submitted_at timestamptz,
  score integer,
  total integer,
  -- [{ id, correct }], what the admin stats read
  results jsonb not null default '[]'::jsonb
);
create index cbt_attempts_exam on public.cbt_attempts (exam_id, submitted_at);
create index cbt_attempts_created on public.cbt_attempts (started_at);

alter table public.cbt_courses enable row level security;
alter table public.cbt_exams enable row level security;
alter table public.cbt_attempts enable row level security;
revoke all on public.cbt_courses, public.cbt_exams, public.cbt_attempts from anon, authenticated;
grant all on public.cbt_courses, public.cbt_exams, public.cbt_attempts to service_role;
-- Admins manage courses and exams; attempts are read-only for them (the stats), the server writes them.
grant select, insert, update, delete on public.cbt_courses, public.cbt_exams to authenticated;
grant select on public.cbt_attempts to authenticated;
create policy cbt_courses_admin_all on public.cbt_courses for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy cbt_exams_admin_all on public.cbt_exams for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy cbt_attempts_admin_read on public.cbt_attempts for select to authenticated using ((select public.is_admin()));

-- Makes an exam and its hidden question bank together.
create or replace function public.cbt_create_exam(p_course uuid, p_title text) returns public.cbt_exams
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quiz uuid;
  v_exam public.cbt_exams;
begin
  insert into public.quizzes (title, max_players, game_options, theme, tags, is_cbt, practice_enabled, battle_enabled)
  values (left(btrim(p_title), 120), 2, '{}'::jsonb, '{}'::jsonb, array['cbt'], true, false, false)
  returning id into v_quiz;
  insert into public.cbt_exams (course_id, quiz_id, title) values (p_course, v_quiz, left(btrim(p_title), 120)) returning * into v_exam;
  return v_exam;
end;
$$;
revoke execute on function public.cbt_create_exam(uuid, text) from public, anon;
grant execute on function public.cbt_create_exam(uuid, text) to authenticated;

-- What admins see for one exam: attempts, averages, pass rate, and the questions missed most often.
-- Runs with the caller's rights, so a non-admin sees nothing (cbt_attempts is admin-read only).
create or replace function public.cbt_exam_stats(p_exam uuid) returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with e as (select pass_mark_percent from public.cbt_exams where id = p_exam),
  a as (
    select * from public.cbt_attempts where exam_id = p_exam and mode = 'exam' and submitted_at is not null
  ),
  per as (
    select (r->>'id')::uuid as qid, count(*) as seen, count(*) filter (where (r->>'correct')::boolean) as right_count
      from a, jsonb_array_elements(a.results) r
     group by 1
  )
  select jsonb_build_object(
    'attempts', (select count(*) from a),
    'average_percent', (select coalesce(round(avg(100.0 * score / nullif(total, 0)), 1), 0) from a),
    'pass_rate', (select coalesce(round(100.0 * count(*) filter (where 100.0 * score / nullif(total, 0) >= (select pass_mark_percent from e)) / nullif(count(*), 0), 1), 0) from a),
    'average_seconds', (select coalesce(round(avg(extract(epoch from (submitted_at - started_at)))), 0) from a),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', per.qid, 'text', q.text, 'topic', q.topic, 'seen', per.seen, 'right', per.right_count,
                                          'miss_percent', round(100.0 * (per.seen - per.right_count) / per.seen, 1))
                       order by (per.seen - per.right_count)::numeric / per.seen desc, per.seen desc)
        from per join public.quiz_questions q on q.id = per.qid
    ), '[]'::jsonb)
  );
$$;
revoke execute on function public.cbt_exam_stats(uuid) from public, anon;
grant execute on function public.cbt_exam_stats(uuid) to authenticated;

-- Old attempts are cleared out: finished ones after 60 days, unfinished ones after 2 days.
create or replace function public.cbt_cleanup() returns integer
language sql
security invoker
set search_path = public
as $$
  with gone as (
    delete from public.cbt_attempts
     where (submitted_at is null and started_at < now() - interval '2 days')
        or started_at < now() - interval '60 days'
    returning 1
  ) select count(*)::integer from gone;
$$;
revoke execute on function public.cbt_cleanup() from public, anon, authenticated;
grant execute on function public.cbt_cleanup() to service_role;
