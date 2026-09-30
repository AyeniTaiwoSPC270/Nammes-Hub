-- Community question sets: anyone can import their own questions (no account) and play them in practice and battles.
-- A set is a normal quiz row marked is_custom, found by a private 6-character code, and deleted after 30 days.
-- Rollback in supabase/rollbacks/.

alter table public.quizzes
  add column is_custom boolean not null default false,
  add column custom_code text unique check (custom_code is null or custom_code ~ '^[A-Z0-9]{6}$'),
  -- hash of the secret that lets the person who made the set delete it early
  add column owner_hash text,
  add column expires_at timestamptz;

create index quizzes_custom_expiry on public.quizzes (expires_at) where is_custom;

-- Removes expired sets (their questions, practice runs and battles go with them).
create or replace function public.quiz_custom_cleanup() returns integer
language sql
security invoker
set search_path = public
as $$
  with gone as (
    delete from public.quizzes where is_custom and expires_at < now() returning 1
  ) select count(*)::integer from gone;
$$;
revoke execute on function public.quiz_custom_cleanup() from public, anon, authenticated;
grant execute on function public.quiz_custom_cleanup() to service_role;
