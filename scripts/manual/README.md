# NAMMES Hub Handbook

Source for the downloadable user manual (`public/documents/NAMMES-Hub-Handbook.pdf`), linked from the site footer
and the About page. Written as HTML/CSS and printed to PDF with Edge/Chrome, so it stays editable as plain text.

## Rebuild the PDF

```
node scripts/manual/build.mjs
```

Needs Microsoft Edge or Chrome installed, and `pdftotext` on PATH (used once to find each chapter's page number for
the table of contents; the build prints twice). Output goes to `public/documents/NAMMES-Hub-Handbook.pdf`.

## Editing from the site (Admin > Handbook)

Admins can also edit the text in the browser and rebuild the PDF without a computer setup. Edits are saved in the
`handbook_chapters` / `handbook_settings` tables and layered over the text in these files (`book-content.mjs` merges
them). **Rebuild PDF** calls `/api/handbook-build`, which renders the same book with a serverless Chromium
(`api/_lib/handbookBuild.js`), uploads it to the public `handbook` storage bucket and sets `site_content.handbook_pdf_url`,
which the footer and About page use. This folder's PDF is only the fallback until that first rebuild.
Saved edits win over these files, so after changing a chapter here, use **Restore original text** on that page in the admin.

## Where things live

| File | What it holds |
| --- | --- |
| `content-start.mjs` | Part One: welcome, quick start, navigation, account |
| `content-academics.mjs` | Part Two: outlines, curriculum, timetable, CGPA, resources |
| `content-community.mjs` | Parts Three and Four: events, news, opportunities, awards, forms, about/excos/contact |
| `content-admin.mjs` | Part Five (admin guide) and the appendices |
| `helpers.mjs` | Callouts, steps, tables, screenshot frames |
| `book.css` | The whole design (page size, NAMMES colours, covers, chapter openers) |
| `book-content.mjs` | The editable content (defaults + admin edits merged); shared with the admin editor and server |
| `book-lib.mjs` | Assembles covers, front matter, contents, chapters, authors into one HTML page (pure, no files) |
| `build.mjs` | Local build: runs `book-lib` and prints it with Edge/Chrome |
| `data/authors.mjs` | The Executive Council credited as authors (snapshot of the `excos` table) |
| `authors/`, `screens/` | Author photos and site screenshots the book embeds |

## Keeping it current

- **New executive council:** update `data/authors.mjs`, run `node scripts/manual/fetch-authors.mjs` (downloads and
  crops the photos), then rebuild. Also change "The Aegis 26/27" and the edition line in `book-content.mjs`.
- **Site changed:** edit the matching chapter text, and refresh screenshots with
  `npm i --no-save puppeteer-core`, then `node scripts/manual/capture-screens.mjs <folder>` and
  `node scripts/manual/prep-screens.mjs <folder>`.
- The admin chapters describe features as read from the code; admin screens can't be screenshotted without a login,
  so those chapters use redrawn illustrations instead.
