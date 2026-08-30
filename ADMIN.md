# Admin Guide (NAMMES Hub)

Quick reference for maintaining the site without touching code.

## Where the admin area is

Sign in at `/login`, then click **Admin** in the navbar (it only shows up once you're
signed in). That takes you to `/admin`, which links out to six sections:

- **News** — the department news cards shown on the homepage and `/news`.
- **Opportunities** — the deadline-sorted table on `/opportunities`.
- **Events** — entries on the `/events` page.
- **Resources** — drive links / files on `/resources`.
- **Excos** — the "Meet the Excos" grid on the homepage (name, role, photo, order).
- **Outlines** — course outline entries on `/outlines`.

Each section is add / edit / delete — no code involved. Use "← Back to Admin" at the
top of any section to return to the section list.

## Adding a second admin

1. Have the new admin sign up for a normal account on the site first (`/signup`).
2. Go to the Supabase dashboard for this project → **SQL Editor**.
3. Run `select id, email from auth.users;` to find their account's `id`.
4. Run `insert into admins (user_id) values ('<that-id>');` using the id from step 3.

They can now sign in and see the Admin link like any other admin.

## Image uploads

News photos, Event photos, and Exco photos are capped at **5MB**, image files only. If
an upload is rejected, it's almost always the file size or the file type — resize/compress
or pick a `.jpg`/`.png`.

## If the admin forms don't cover something

The Supabase dashboard's **Table Editor** can view and edit any row directly, in any
table — it's a plainer spreadsheet-like interface and needs no code. Use it as a
fallback for anything the admin forms above don't handle.
