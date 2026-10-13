-- Reverting this removes slot reservations, so a later character could reuse a previously assigned avatar_id.
alter table public.quiz_characters
  drop column if exists deleted_at;
