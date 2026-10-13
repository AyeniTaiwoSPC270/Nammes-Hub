-- Named saved looks for the Quiz Design Studio: the design an admin made once, kept so it can be put back on any
-- quiz later. This is what quizzes.theme could not do -- that column holds one look per quiz, so the only way to reuse
-- one was duplicateQuiz, which copies the questions too.
--
-- Deliberately the shape of calendar_looks (20261009090000_calendar.sql:68): a text PK minted by the client, name plus
-- a whole design object, written whole on every save. The result card is NOT here -- it has its own column and its own
-- draft in the studio, and it is rendered from quizCardRender.js rather than the theme.

create table public.quiz_looks (
  id text primary key,
  name text not null check (char_length(name) between 1 and 40),
  design jsonb not null default '{}'::jsonb
    check (jsonb_typeof(design) = 'object' and pg_column_size(design) < 4000),
  created_at timestamptz not null default now()
);

-- A look is not attached to any quiz, so there is nothing here to cascade from and nothing to index on: the table holds
-- one row per design an admin has saved, not one row per quiz.

alter table public.quiz_looks enable row level security;

-- Admin-write, not owner-write, because this is a quiz table like quiz_characters (20261013090000_quiz_character_cast.sql:41-45)
-- rather than a site-content table like calendar_looks. Any admin who can design a quiz's look can save it for reuse.
-- No two-factor policy, matching the other quiz tables: they are not in the 20260929150000_admin_mfa_enforcement.sql:28-33
-- list and neither is this one. Adding it would be a rule the quiz tables do not share.
revoke all on public.quiz_looks from anon, authenticated;
grant select, insert, update, delete on public.quiz_looks to authenticated;
create policy quiz_looks_admin_all on public.quiz_looks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
