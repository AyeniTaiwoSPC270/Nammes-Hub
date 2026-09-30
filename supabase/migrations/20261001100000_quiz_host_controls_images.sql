-- Live quiz premium features A: host controls (kick, lock, pause, extend, skip, rename) and images on questions.
-- See docs/superpowers/specs/2026-09-30-live-quiz-premium-features.md (features 8 and 2). Rollback in supabase/rollbacks/.

-- ---- Host controls ----
alter table public.quiz_sessions
  add column locked boolean not null default false,
  add column blocked_nicknames text[] not null default '{}',
  add column time_bonus_ms integer not null default 0 check (time_bonus_ms between 0 and 60000),
  add column paused_at timestamptz,
  add column paused_total_ms integer not null default 0 check (paused_total_ms >= 0);

-- What the host did and when, for settling disputes afterwards. Admin read only; the server writes.
create table public.quiz_host_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  op text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.quiz_host_log enable row level security;
revoke all on public.quiz_host_log from anon, authenticated;
grant select on public.quiz_host_log to authenticated;
create policy quiz_host_log_admin_read on public.quiz_host_log for select to authenticated
  using ((select public.is_admin()));
grant all on public.quiz_host_log to service_role;

-- Skipping a question throws away its answers and takes their points back, in one step. Server only.
create or replace function public.quiz_skip_question(p_session uuid, p_question uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare removed integer;
begin
  update public.quiz_players p
     set total_score = p.total_score - a.points_awarded
    from public.quiz_answers a
   where a.session_id = p_session and a.question_id = p_question and a.player_id = p.id;
  delete from public.quiz_answers where session_id = p_session and question_id = p_question;
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke execute on function public.quiz_skip_question(uuid, uuid) from public, anon, authenticated;
grant execute on function public.quiz_skip_question(uuid, uuid) to service_role;

-- ---- Images on questions ----
alter table public.quiz_questions
  add column image_path text check (image_path is null or image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}(-[0-9]{10,13})?\.(webp|jpg|png)$'),
  add column image_alt text check (image_alt is null or char_length(image_alt) <= 200);

-- Public read (questions are shown on phones), admin-only write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quiz-images', 'quiz-images', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy quiz_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'quiz-images' and (select public.is_admin()));
create policy quiz_images_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'quiz-images' and (select public.is_admin()))
  with check (bucket_id = 'quiz-images' and (select public.is_admin()));
create policy quiz_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'quiz-images' and (select public.is_admin()));
