-- The approved University of Lagos academic calendar for the 2026/2027 session, reduced to the
-- entries a student can actually act on.
--
-- Source: SENATE-PROPOSED-ACADEMIC-CALENDAR-2026-2027.pdf, approved by Senate on 30 September 2026.
--
-- Deliberately NOT seeded (see docs/superpowers/specs/2026-10-08-academic-calendar-design.md section 4):
--   - "Consideration of Results by BCOS" (2027-03-23, 2027-08-10) and the two Senate meetings
--     (2027-03-31, 2027-08-25). Staff-only; a student cannot act on any of them.
--   - All four statutory programmes, which the senate lists as recurring rather than dated: Faculty
--     Board of Studies/Examiners (2nd Wednesday monthly), Inaugural Lectures (1st and 3rd Wednesday
--     monthly), Senate Meeting (last Wednesday monthly), and Uploading of Results (two weeks after
--     examinations). All staff-only.
--   - DLI Residential Programme (2027-07-12 to 2027-08-07). A Distance Learning Institute cohort on
--     its own admission track, published in the same senate calendar but addressed to a different
--     audience than this page serves. Easiest thing in this file to add back via the paste screen if
--     NAMMES runs it for its own members.
--
-- 2027-03-08 resumption is printed on both pages of the PDF and is seeded once, under semester 2
-- where it actually belongs. It stays in the 2026/2027 session even though the senate prints it on the
-- second-semester page: the session is the year a student is enrolled in, not the page it appears on.
--
-- Every date below was cross-checked against the weekday name printed beside it in the source, so a
-- transcription error here would surface as an internal contradiction. 23 of the 26 rows are attested
-- end to end. The three exceptions are the two undated rows, which have no date to check; s2-02, whose
-- page-2 line prints a bare "March 8, 2027" and takes its weekday only from the page-1 duplicate; and
-- s1-14's end date, which the source gives only as the bare day number in "Monday, February 22 - 26,
-- 2027" (the 26 does fall on the Friday that closes that week).
--
-- Ids are 2026-2027-s<semester>-<nn>: deterministic, unique within this migration, and they sort into
-- the source document's order, which is the order the admin entries screen groups them by semester.
--
-- `on conflict` because these migrations are applied by hand in the SQL editor, where a re-run is a
-- live accident rather than a tracked one (same reasoning as 20261008120000_page_banners_*.sql:10).
insert into public.academic_calendar
  (id, session, semester, title, kind, starts_at, ends_at, note, remind_days)
values
  -- ---------- First semester ----------
  ('2026-2027-s1-01', '2026/2027', 1, 'Payment of Fees & Online Registration for Returning Students'          , 'registration', date '2026-10-05', null, null, 3),
  ('2026-2027-s1-02', '2026/2027', 1, 'Resumption and Commencement of Lectures'                               , 'lectures', date '2026-10-19', null, null, 1),
  ('2026-2027-s1-03', '2026/2027', 1, 'End of Registration of Courses for All Students'                       , 'registration', date '2026-12-04', null, null, 3),
  ('2026-2027-s1-04', '2026/2027', 1, 'Orientation Programme for Fresh Students'                              , 'orientation', null, null, '(1 week); date to be announced', null),
  ('2026-2027-s1-05', '2026/2027', 1, 'Matriculation Ceremony'                                                , 'orientation', null, null, 'date to be announced', null),
  ('2026-2027-s1-06', '2026/2027', 1, 'Editing of Registered Courses'                                         , 'registration', date '2026-12-07', date '2026-12-20', '(2 weeks)', null),
  ('2026-2027-s1-07', '2026/2027', 1, 'Christmas/New Year Break'                                              , 'break', date '2026-12-21', date '2027-01-03', '(2 weeks)', null),
  ('2026-2027-s1-08', '2026/2027', 1, 'Resumption from Christmas/New Year Break'                              , 'lectures', date '2027-01-04', null, null, 1),
  ('2026-2027-s1-09', '2026/2027', 1, 'Lectures End'                                                          , 'lectures', date '2027-01-15', null, '(13 weeks)', 3),
  ('2026-2027-s1-10', '2026/2027', 1, 'Lecture Free Week / GST Examinations'                                  , 'exams', date '2027-01-18', date '2027-01-22', null, 7),
  ('2026-2027-s1-11', '2026/2027', 1, 'Undergraduate Examinations in All Faculties'                           , 'exams', date '2027-01-25', date '2027-02-12', '(3 weeks)', 7),
  ('2026-2027-s1-12', '2026/2027', 1, 'Examinations in Core Courses, Faculty of Education'                    , 'exams', date '2027-02-15', date '2027-02-20', '(1 week); Faculty of Education only', 7),
  ('2026-2027-s1-13', '2026/2027', 1, 'End of First Semester / Opening of Second Semester Registration Portal', 'registration', date '2027-02-20', null, null, 7),
  ('2026-2027-s1-14', '2026/2027', 1, '57th Convocation Ceremonies'                                           , 'convocation', date '2027-02-22', date '2027-02-26', '(1 week)', null),
  ('2026-2027-s1-15', '2026/2027', 1, 'First Semester Break'                                                  , 'break', date '2027-02-22', date '2027-03-06', '(2 weeks)', null),
  -- ---------- Second semester ----------
  --
  -- s1-01 carries a reminder and s2-01 below does not, which looks inconsistent until you read
  -- what the two rows announce. The plan's "registration close 3" covers s1-03 and s2-03. Of the
  -- two openings, s1-01 also announces the fees bill, which carries a penalty for missing it, so
  -- it gets 3; s2-01 announces a window opening, and there is nothing a student loses by ignoring it.
  ('2026-2027-s2-01', '2026/2027', 2, 'Online Registration of Courses Commences'                              , 'registration', date '2027-02-22', null, null, null),
  ('2026-2027-s2-02', '2026/2027', 2, 'Resumption and Commencement of Lectures'                               , 'lectures', date '2027-03-08', null, null, 1),
  ('2026-2027-s2-03', '2026/2027', 2, 'End of Registration of Courses'                                        , 'registration', date '2027-03-28', null, '(5 weeks)', 3),
  ('2026-2027-s2-04', '2026/2027', 2, 'Hall and Faculty Week'                                                 , 'lectures', date '2027-04-05', date '2027-05-02', '(4 weeks); lectures continue', null),
  ('2026-2027-s2-05', '2026/2027', 2, 'Editing of Registered Courses'                                         , 'registration', date '2027-04-12', date '2027-04-25', '(2 weeks)', null),
  ('2026-2027-s2-06', '2026/2027', 2, 'Lectures End'                                                          , 'lectures', date '2027-06-04', null, '(13 weeks)', 3),
  ('2026-2027-s2-07', '2026/2027', 2, 'Lecture Free Week / GST Examinations'                                  , 'exams', date '2027-06-07', date '2027-06-11', '(1 week)', 7),
  ('2026-2027-s2-08', '2026/2027', 2, 'Undergraduate Examinations in All Faculties'                           , 'exams', date '2027-06-14', date '2027-07-03', '(3 weeks)', 7),
  ('2026-2027-s2-09', '2026/2027', 2, 'Examinations in Core Courses, Faculty of Education'                    , 'exams', date '2027-07-05', date '2027-07-10', '(1 week); Faculty of Education only', 7),
  ('2026-2027-s2-10', '2026/2027', 2, 'End of Second Semester / Students Depart'                              , 'lectures', date '2027-07-10', null, null, 7),
  ('2026-2027-s2-11', '2026/2027', 2, 'Proposed Date of Resumption, 2027/2028 Session'                        , 'lectures', date '2027-09-13', null, null, 1)
on conflict (id) do nothing;

-- Three rows open on 2027-02-22: 57th Convocation Ceremonies (s1-14), First Semester Break (s1-15) and
-- second-semester registration (s2-01). Finals have finished, graduates are being convened and the
-- rest are on break while the next cohort starts registering. The overlap is real, not a transcription
-- slip, and whatever renders this must show all three.

-- The banner row /calendar reads. Without it the admin banner editor saves with
-- `update ... where page_key = ...` and matches zero rows, and the page has no title or subtitle to
-- prefill (same reason as 20261008120000_page_banners_awards_quizzes_forms.sql:2-4).
insert into public.page_banners (page_key, title, subtitle)
values
  ('calendar', 'Academic Calendar',
   'Lectures, examinations, registration and breaks for the current session, alongside department events.')
on conflict (page_key) do nothing;
