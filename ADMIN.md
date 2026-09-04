# Admin Guide (NAMMES Hub)

Quick reference for maintaining the site without touching code.

## Where the admin area is

Sign in at `/login`, then click **Admin** in the navbar (it only shows up once you're
signed in). That takes you to `/admin`, which links out to seven sections:

- **News** — the department news cards shown on the homepage and `/news`.
- **Opportunities** — the deadline-sorted table on `/opportunities`.
- **Events** — entries on the `/events` page. Each row also has a **Gallery** icon
  that opens a page for uploading and removing that event's photo gallery (separate
  from the single cover photo shown on the events list).
- **Resources** — drive links / files on `/resources`.
- **Excos** — the "Meet the Excos" grid on the homepage (name, role, photo, order).
- **Outlines** — course outline entries on `/outlines`.
- **Submissions** — student-contributed past questions/notes waiting for approval
  before they show up on a course's outline page.
- **Awards** — run a department award season end-to-end: create categories, advance
  the season through nominating → curating → voting → closed → revealed, curate raw
  nominations into a shortlist per category (with optional nominee photos), and view
  vote tallies. Only students with a department matric number (`240406XXX`) on their
  account can nominate or vote — this is enforced automatically, not something you
  configure per season.

Each section is add / edit / delete — no code involved. Use "← Back to Admin" at the
top of any section to return to the section list.

## Adding a second admin

1. Have the new admin sign up for a normal account on the site first (`/signup`).
2. Go to the Supabase dashboard for this project → **SQL Editor**.
3. Run `select id, email from auth.users;` to find their account's `id`.
4. Run `insert into admins (user_id) values ('<that-id>');` using the id from step 3.

They can now sign in and see the Admin link like any other admin.

## Image uploads

News photos, Event cover/gallery photos, and Exco photos are capped at **5MB**, image
files only. If an upload is rejected, it's almost always the file size or the file
type — resize/compress or pick a `.jpg`/`.png`.

## Outline contribution uploads

Students can attach a file (PDF/JPG/PNG, up to **10MB**) or paste a link when
contributing a past question or notes to a course outline. Submissions start as
**pending** and won't be visible to other students until approved from
**Admin → Submissions**.

## Fixing a student's matric number

Matric numbers are set once at signup and can't be changed by the student afterward.
If someone made a typo or an account predates the Awards feature and has no matric
number on file at all, fix it directly in the Supabase dashboard's Table Editor: open
the `profiles` table, find their row by `user_id` (cross-reference `auth.users` by
email if needed), and edit `student_id` there. It must match the department format
(`240406XXX`) or the save will be rejected.

## If the admin forms don't cover something

The Supabase dashboard's **Table Editor** can view and edit any row directly, in any
table — it's a plainer spreadsheet-like interface and needs no code. Use it as a
fallback for anything the admin forms above don't handle.
