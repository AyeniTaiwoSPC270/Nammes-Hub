-- Rolls back 20261001100000_quiz_host_controls_images.sql.
drop policy if exists quiz_images_admin_delete on storage.objects;
drop policy if exists quiz_images_admin_update on storage.objects;
drop policy if exists quiz_images_admin_insert on storage.objects;
-- The quiz-images bucket is left in place: Supabase does not allow deleting storage rows with SQL. Empty and delete it in the dashboard if wanted.
alter table public.quiz_questions drop column if exists image_alt, drop column if exists image_path;
drop function if exists public.quiz_skip_question(uuid, uuid);
drop table if exists public.quiz_host_log;
alter table public.quiz_sessions
  drop column if exists paused_total_ms, drop column if exists paused_at, drop column if exists time_bonus_ms,
  drop column if exists blocked_nicknames, drop column if exists locked;
