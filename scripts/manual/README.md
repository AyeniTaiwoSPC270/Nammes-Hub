# NAMMES Hub Handbook

Source for the downloadable user manual (`public/documents/NAMMES-Hub-Handbook.pdf`), linked from the site footer
and the About page. Written as HTML/CSS and printed to PDF with Edge/Chrome, so it stays editable as plain text.

## Rebuild the PDF

```
npm run manual:build
```

Needs Microsoft Edge or Chrome installed. Page text is read with **pdf.js**, already a dependency and the same reader the
serverless builder uses, so there is no external binary to install. The build prints twice: the first pass measures where
each chapter lands, the second prints with real page numbers in the contents. Output goes to
`public/documents/NAMMES-Hub-Handbook.pdf`.

## Screenshots

Every image in the book is a real capture of `https://www.nammeshub.com.ng`. Nothing is drawn, and a screen that cannot be
captured gets no picture rather than an illustration that has drifted out of date.

```
npm run manual:capture        # public pages -> out/raw
npm run manual:capture:admin  # admin pages  -> out/raw   (signs in first)
npm run manual:prep           # out/raw -> screens/*.jpg
```

Add `--only=name,name` to re-shoot a few pages instead of all of them, and `--admin` to the second command. Anything you
photograph by hand goes in `scripts/manual/out/drop/` and the third command converts it.

`manual:capture:admin` needs `HANDBOOK_ADMIN_EMAIL` in `.env.local`, pointing at a **throwaway admin account with no
authenticator app enrolled**. The sign-in does not use the login form: production has Turnstile on it and a headless
browser never receives a token, so the script exchanges a magic link through Supabase's admin API instead and drops the
session straight into `localStorage`. The session is cached in `scripts/manual/out/admin-session.json` so a run mints one,
not one per page.

**Never captured, on purpose:** `/admin/users`, `/admin/messages`, `/admin/reviews`, `/admin/system`,
`/admin/broadcasts`, `/admin/submissions` and any form's `/responses`. The handbook is a public download, and those pages
hold member emails, contact messages, matric numbers and server errors.

The welcome tour keys off each user's id and covers every admin page until it is skipped, so the script clicks **Skip**
once after signing in.

Run `node scripts/manual/check-content.mjs` after changing chapters. It fails the build if the chapters are not numbered
1..N in order, if the book references an image that does not exist, if an image in `screens/` is used by nothing, or if a
"where do I find…" entry points at a chapter that does not exist.

## Editing from the site (Admin > Handbook)

Admins can also edit the text in the browser and rebuild the PDF without a computer setup. Edits are saved in the
`handbook_chapters` / `handbook_settings` tables and layered over the text in these files (`book-content.mjs` merges
them). **Rebuild PDF** calls `/api/handbook-build`, which renders the same book with a serverless Chromium
(`api/_lib/handbookBuild.js`), uploads it to the public `handbook` storage bucket and sets `site_content.handbook_pdf_url`,
which the footer and About page use. This folder's PDF is only the fallback until that first rebuild.
The covers, front pages, team name, session and the authors' names, roles and photos are editable too (defaults live in
`book-content.mjs`; `{{team}}` / `{{session}}` tokens fill in wherever they appear). Saved edits win over these files, so after changing a chapter here, use **Restore original text** on that page in the admin.

## Where things live

| File | What it holds |
| --- | --- |
| `content-start.mjs` | Part One: welcome, quick start, navigation, account |
| `content-academics.mjs` | Part Two: outlines, curriculum, timetable, CGPA, resources |
| `content-community.mjs` | Parts Three and Four: events, news, opportunities, awards, forms, about/excos/contact |
| `content-quiz.mjs` | Two chapters on the live quiz: Chapter 15 (members: live games, practice, battles) and Chapter 22 (admins: building, hosting, reports); spliced in by the community and admin files |
| `content-admin.mjs` | Part Five (admin guide) and the appendices |
| `helpers.mjs` | Callouts, steps, tables, screenshot frames |
| `book.css` | The whole design (page size, NAMMES colours, covers, chapter openers) |
| `book-content.mjs` | The editable content (defaults + admin edits merged); shared with the admin editor and server |
| `book-lib.mjs` | Assembles covers, front matter, contents, chapters, authors into one HTML page (pure, no files) |
| `build.mjs` | Local build: runs `book-lib` and prints it with Edge/Chrome |
| `capture-screens.mjs` | Photographs the live site, public and admin |
| `prep-screens.mjs` | Crops footers and writes the compact JPEGs the book embeds |
| `check-content.mjs` | Fails if the numbering, the images or the finder do not line up |
| `data/authors.mjs` | The Executive Council credited as authors (snapshot of the `excos` table) |
| `authors/`, `screens/` | Author photos and site screenshots the book embeds |

## Keeping it current

- **New executive council:** update `data/authors.mjs`, run `node scripts/manual/fetch-authors.mjs` (downloads and
  crops the photos), then rebuild. Also change "The Aegis 26/27" and the edition line in `book-content.mjs`.
- **Site changed:** edit the matching chapter text, then `npm run manual:capture` and `npm run manual:prep`. Admin
  sections need `npm run manual:capture:admin` too, and that account has no MFA. Run `node scripts/manual/check-content.mjs`
  before you rebuild the PDF.
- **Added a chapter:** give it the next `num` and wire it into the file for its part. `check-content.mjs` catches a
  duplicate number, a gap, or a chapter referenced by the finder that does not exist.
- The admin chapters describe features as read from the code; admin screens cannot be screenshotted without a login, so
  those chapters use tables and steps rather than pictures of the parts nobody can reach.
