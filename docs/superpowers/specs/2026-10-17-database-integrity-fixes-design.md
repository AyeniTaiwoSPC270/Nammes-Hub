# Database Integrity Fixes Design

Two tracked defects that a rebuild from `supabase/history` + `supabase/migrations` would either reproduce wrongly or
lose outright: a `page_banners` row that does not exist, and two `outlines` columns that exist only in production.

**Status:** draft. **Date:** 2026-10-17. **Plan:** none yet.

These are the two entries under "Known open bugs" in `AGENTS.md`. This spec closes them and adds the guards that stop
the same class returning.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Migration | Seed the missing `curriculum` banner; add `outlines.past_questions_name` and `lecturer_notes_name` |
| `src/data/pageBanners.js` | Turn the zero-row failure into a readable message |
| `supabase/migrations.test.js` | Two guards: every editable page has a banner row; every column the outlines UI reads has DDL |

### Out

- **An insert policy on `page_banners`.** The table has select (public) and update (admin) only. Adding insert widens a
  write surface to fix a data gap; the seed plus the guard is the smaller change. See §3.2.
- **Backfilling the lost values.** The production rows' `past_questions_name` / `lecturer_notes_name` values are not in
  any repo file. The migration stops the next rebuild losing them; it cannot restore what the last one may have lost.
- **An outlines review-queue branch.** `apply_change_request` has no `outlines` branch, so there is no column list to
  extend (verified: `grep outlines supabase/migrations/20261009100000_calendar_review_queue.sql` returns nothing).
- **Renaming or constraining `page_key`.** It is the primary key and the API of the table.

---

## 2. The defects

### 2.1 `page_banners` has no `curriculum` row

`AdminPageBanners.jsx` lists **15** editable pages; the seeds across `supabase/history/04_…:483` and
`20261008120000_page_banners_awards_quizzes_forms.sql` insert **14** — every key except `curriculum`.

`updatePageBanner` (`src/data/pageBanners.js:19`) is `update … eq('page_key', …).select().single()`. With no matching
row, PostgREST answers `.single()` with an error, so the admin gets a failure toast rather than a save — the effect
the `AGENTS.md` note describes as "silently does nothing". Either way the title and subtitle cannot be set, and
`usePageBanner('curriculum')` returns `undefined`, so the page renders without its banner.

This is not a one-off: the row exists for every other page only because someone remembered to seed it.

### 2.2 `outlines` name columns have no DDL

`past_questions_name` and `lecturer_notes_name` are:

- read by `src/lib/outlinePdf.js:165-166`;
- rendered by `src/pages/outlines/OutlineDetail.jsx:128,139`;
- edited by `src/pages/admin/config/outlinesAdminConfig.js:29,31`.

They appear in **no** file under `supabase/`. The link columns beside them (`past_questions_link`,
`lecturer_notes_link`) *are* in `supabase/history/01_…:239-240`. So the two name columns were added through the
dashboard, and a rebuild from tracked SQL produces a table the outlines editor writes to and PostgREST rejects.

---

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Banner fix | Seed the row in a migration | One `insert … on conflict do nothing`, matching how every other page got its row |
| Banner cause | Leave `updatePageBanner` update-only | The update path is correct; the data was missing. See §3.2 for why not upsert |
| Banner error | Map `PGRST116` to "This page has no banner row yet." | If a future page key repeats the mistake, the admin should read a sentence, not a PostgREST code |
| Outlines fix | `add column if not exists` in a new migration | Additive, idempotent, and matches the `page_banners` slideshow-columns precedent (`20261008120000`, lines 22-30) |
| Guards | In `supabase/migrations.test.js` | That file already reads migrations to stop one hand-synced list drifting from another; these are two more lists of the same kind |
| Seed values | Real copy, not empty strings | `title`/`subtitle` are `not null default ''`; an empty banner is a title-less band a visitor sees |

### 3.2 Why not make the update an upsert

`page_banners` has exactly two policies (`supabase/history/04_…:477,480`): public select, and update for a signed-in
admin. There is no insert policy, and none of the migrations grant insert on it. An upsert would therefore fail with a
policy violation until this change also added:

- `create policy page_banners_admin_insert … for insert to authenticated`;
- the matching grant;
- a review of whether that table belongs in the MFA restrictive list like every other admin-writable settings row.

That is a write-surface change to fix a missing row. Not worth it. If a future page key is added and not seeded, the
guard test fails before it ships, which is the outcome upsert was there to produce.

---

## 4. The migration

One file, `supabase/migrations/<next timestamp>_banner_and_outline_column_fixes.sql`:

```sql
-- The curriculum page is the one key in AdminPageBanners.PAGES with no row. The editor is
-- `update ... where page_key = ...`, so the row is what makes the title editable at all.
insert into public.page_banners (page_key, title, subtitle) values
  ('curriculum', 'Curriculum', 'The programme structure by level and semester, from 100 to 500.')
on conflict (page_key) do nothing;

-- These two are read by the outline page, its PDF and its admin editor, but no tracked SQL
-- creates them: they were added through the dashboard. `if not exists` keeps this a no-op on
-- the live database and makes a rebuild from history + migrations match what the app expects.
alter table public.outlines
  add column if not exists past_questions_name text,
  add column if not exists lecturer_notes_name text;
```

Applied by hand in the SQL editor, in name order, per `README.md` §Database setup. Timestamp after the newest file in
`supabase/migrations/` at the time of writing (currently `20261017120000_admin_inbox.sql`).

---

## 5. The two guards

`supabase/migrations.test.js` currently reads only `supabase/migrations`. Both new checks need `supabase/history/*.sql`
as well, because that is where the original `page_banners` rows live and where the outlines table is defined. The
README's rebuild is "history, then migrations", so a guard that reads one half cannot prove a rebuild works.

1. **Every editable page has a row.** Parse the `PAGES` array out of `AdminPageBanners.jsx`, collect every
   `insert into public.page_banners … ('<key>'` across `history/` + `migrations/`, and assert every key is present.
   This is the `QUESTION_TYPES` pattern: the UI's list and the SQL's list must agree, and the failure names the key.

2. **Every outlines column the UI reads has DDL.** For the two names, assert an `add column` statement exists in
   `history/` or `migrations/`. Keep the list explicit rather than scanning every `course.<field>` in JSX: an
   incidental property (a boolean, a computed field) would fail a scan without being a column. Two literal strings,
   with a comment naming the three files that read them, is the honest version.

Both strip SQL comments before matching, for the same reason the existing test does: these migrations explain
themselves in prose that quotes the statement.

---

## 6. Verification

1. `npm test` — the two new guards pass, and the suite is green apart from the known worktree failures. That sentence
   is only true once the test-isolation spec lands; until then, run the two files explicitly:
   `npx vitest run supabase/migrations.test.js`.
2. Normalise the new migration for CRLF (the guard test already does this) and confirm both checks fail when the seed
   line is removed — a guard nobody has watched fail is a guard nobody knows works.
3. A rebuild rehearsal on a scratch database: `history/01…04`, then every migration in order, then
   `select page_key from page_banners where page_key = 'curriculum'` and
   `select past_questions_name from outlines limit 0`.

---

## 7. Open questions

1. **Curriculum copy.** "Curriculum" / "The programme structure by level and semester, from 100 to 500." is a
   placeholder the admin can edit. If there is approved wording, it belongs in the seed.
2. **Anything else added through the dashboard?** The outlines columns were found by grepping the UI. The same class
   may exist elsewhere; a one-off audit of `course.<field>` / `row.<field>` reads against the migrations is worth an
   hour, but it is not this spec.
