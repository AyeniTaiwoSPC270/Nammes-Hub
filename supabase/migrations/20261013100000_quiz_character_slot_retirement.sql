-- Keep deleted character slots reserved without retaining their authored character data.
alter table public.quiz_characters
  add column if not exists deleted_at timestamptz;
