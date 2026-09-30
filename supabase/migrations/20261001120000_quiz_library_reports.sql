-- Live quiz premium features C: the quiz library (tags, archive) and results reports. Features 6 and 7 of
-- docs/superpowers/specs/2026-09-30-live-quiz-premium-features.md. Rollback in supabase/rollbacks/.

-- ---- Library ----
alter table public.quizzes
  add column tags text[] not null default '{}' check (coalesce(array_length(tags, 1), 0) <= 8),
  add column archived_at timestamptz;

-- ---- Reports ----
-- Plain summaries of answers that are already stored. The views run with the caller's rights
-- (security_invoker), so they inherit quiz_answers being readable by admins only.
create view public.quiz_question_stats with (security_invoker = true) as
select a.session_id,
       a.question_id,
       count(*)::int as answered,
       count(*) filter (where a.correct is true)::int as correct_count,
       round(avg(a.elapsed_ms))::int as avg_elapsed_ms
  from public.quiz_answers a
 group by a.session_id, a.question_id;

create view public.quiz_answer_distribution with (security_invoker = true) as
select a.session_id, a.question_id, a.chosen_index, count(*)::int as votes
  from public.quiz_answers a
 where a.chosen_index is not null
 group by a.session_id, a.question_id, a.chosen_index;

create view public.quiz_player_stats with (security_invoker = true) as
select a.session_id,
       a.player_id,
       count(*)::int as answered,
       count(*) filter (where a.correct is true)::int as correct_count,
       round(avg(a.elapsed_ms))::int as avg_elapsed_ms
  from public.quiz_answers a
 group by a.session_id, a.player_id;

revoke all on public.quiz_question_stats, public.quiz_answer_distribution, public.quiz_player_stats from anon, authenticated;
grant select on public.quiz_question_stats, public.quiz_answer_distribution, public.quiz_player_stats to authenticated;
