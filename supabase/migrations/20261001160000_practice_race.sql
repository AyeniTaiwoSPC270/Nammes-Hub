-- Practice mode races: a practice run can be played against computer rivals ("bots") or against the recorded results of
-- real people who practised before ("ghosts"). Rollback in supabase/rollbacks/.
alter table public.quiz_practice_runs
  add column race_mode text not null default 'none' check (race_mode in ('none', 'bots', 'ghosts')),
  add column race_skill text check (race_skill in ('beginner', 'average', 'expert', 'mixed')),
  -- The past runs this run races against, fixed when it starts so the field never changes mid-run.
  add column race_ghosts uuid[] not null default '{}' check (cardinality(race_ghosts) <= 8);
