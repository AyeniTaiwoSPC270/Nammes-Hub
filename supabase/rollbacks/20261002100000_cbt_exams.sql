-- Rolls back 20261002100000_cbt_exams.sql. This deletes every CBT exam, attempt and question bank.
-- Delete the banks first (their quizzes): delete from public.quizzes where is_cbt;
drop function if exists public.cbt_cleanup();
drop function if exists public.cbt_exam_stats(uuid);
drop function if exists public.cbt_create_exam(uuid, text);
drop table if exists public.cbt_attempts;
drop trigger if exists cbt_exams_touch on public.cbt_exams;
drop trigger if exists cbt_exams_bank_cleanup on public.cbt_exams;
drop table if exists public.cbt_exams;
drop function if exists public.cbt_touch();
drop function if exists public.cbt_exam_deleted();
drop function if exists public.cbt_new_code();
drop table if exists public.cbt_courses;
alter table public.quiz_questions drop column if exists no_shuffle, drop column if exists topic, drop column if exists explanation;
alter table public.quizzes drop column if exists cbt_settings, drop column if exists is_cbt;
