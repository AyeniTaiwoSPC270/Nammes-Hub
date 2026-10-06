-- A backdrop picture fills the whole projector, so it needs to be a lot bigger than a logo. The quiz-branding bucket was
-- sized for logos and sponsor marks (600px, 500KB from the studio), and this raises the server-side ceiling so a full
-- bleed background is not rejected by storage. The allowed mime types are unchanged, and the studio still shrinks a
-- picture down before uploading, so what lands here is a webp or jpeg at most 1600px and 1.5MB.
--
-- No change to quizzes.theme or quiz_sessions.theme is needed: the new backdrop settings are a handful of numbers and one
-- picture path, which fit inside the existing `pg_column_size(theme) < 4000` check.
update storage.buckets
  set file_size_limit = 1572864
  where id = 'quiz-branding';