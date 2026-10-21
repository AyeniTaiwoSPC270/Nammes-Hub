-- The four holiday loops now exist in the studio's music list (christmas, valentine, easter, independence —
-- added to THEME_MUSIC the same day), so each seeded preset can carry the track written for its season
-- instead of borrowing chill/afro/cinematic. The quiz half of a holiday theme is applied per quiz by the
-- owner, so this only changes what the form is pre-filled with.
--
-- The guard keeps an owner's edit: only a row still holding the value 20261020120000 seeded is moved, so
-- re-running or re-applying later never overwrites music the owner picked themselves.

update public.holiday_themes
set quiz = jsonb_set(quiz, '{design,sound,music}', '"christmas"'::jsonb)
where id = 'christmas-2026' and quiz #>> '{design,sound,music}' = 'cinematic';

update public.holiday_themes
set quiz = jsonb_set(quiz, '{design,sound,music}', '"valentine"'::jsonb)
where id = 'valentines-2027' and quiz #>> '{design,sound,music}' = 'chill';

update public.holiday_themes
set quiz = jsonb_set(quiz, '{design,sound,music}', '"easter"'::jsonb)
where id = 'easter-2027' and quiz #>> '{design,sound,music}' = 'chill';

update public.holiday_themes
set quiz = jsonb_set(quiz, '{design,sound,music}', '"independence"'::jsonb)
where id = 'independence-2026' and quiz #>> '{design,sound,music}' = 'afro';
