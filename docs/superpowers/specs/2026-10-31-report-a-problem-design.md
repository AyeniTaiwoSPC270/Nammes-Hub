# Report a problem — design

Date: 2026-10-31
Status: agreed, ready to plan

## Goal

A visitor spots a broken link or a wrong fact on an outline, resource, news or event page and can say
so in a few seconds, without an account. The report lands where the admin already reads messages,
gets triaged with the same `handled` tick, and can be switched off from the System page without a
deploy.

## Decisions

| Question | Decision |
|---|---|
| Where the link appears | Outline detail, resource list, news article, event detail |
| What the form carries | Page title and URL pre-filled, category dropdown, optional note |
| Categories | `broken_link`, `wrong_info`, `outdated`, `other` — a closed list |
| Who can report | Anyone, signed in or not |
| Where it stores | **`contact_messages`, no new table** — with an explicit `kind` column |
| How it submits | `api/submit-public.js`, new `type: 'report'` — Turnstile check and rate limit come free |
| Admin surface | A filter in the existing Messages inbox — no new route, no new admin page |
| Notifications | Reports are **excluded** from the contact webhook email and from the "unanswered messages" KPI |
| Retention | Unchanged — reports age out with the 12-month contact purge |
| Kill switch | `feature_flags` key `reports`, seeded **off** |

## Why `contact_messages` and not a new table

There is no dedicated page for reports and no workflow beyond "read it, tick it handled" — which is
exactly what the Messages inbox already does. A second table would buy a schema, a second RLS
policy set, a second inbox source and a second place to look, in exchange for nothing. What *is*
bought by staying is one honest distinction: a `kind` column, so a report can never be mistaken for
a message someone expects a reply to.

## Data

New columns on `contact_messages`, all existing rows untouched:

| column | type | notes |
|---|---|---|
| `kind` | `text not null default 'message'` | `check (kind in ('message','report'))` |
| `category` | `text` nullable | check against the four values, `null` for a plain message |
| `page_url` | `text` nullable | path only (`/news/<slug>`), never an absolute URL |
| `page_title` | `text` nullable | the heading as the visitor saw it |

A second length constraint covers the new columns, mirroring the existing
`contact_messages_lengths`. `insert` stays revoked from `anon`/`authenticated`
(`20260929160000_close_direct_public_inserts.sql`) — the server writes, nobody else.

A `feature_flags` row with `key = 'reports'`, seeded off.

## Server

`api/submit-public.js` grows a `type: 'report'` branch next to `contact`:

- Validation is `validateReport` in `api/_lib/publicSubmission.js`, alongside `validateContact`, so
  the browser and the API clean a value the same way. It checks the category against the closed
  list, bounds `page_title` (1–200), `page_url` (1–300, must start with `/`) and the note (0–1000),
  and trims.
- The flag is read with the same per-key query the handler already runs for `public_forms`; off
  means `503` before any write.
- The insert sets `kind: 'report'` server-side. A payload claiming `kind: 'message'` with report
  fields, or vice versa, is not a thing the handler accepts.
- Turnstile is unchanged: no site key configured → skipped, site key without secret → refuse.

## UI

`src/components/ReportProblem.jsx` — one component, imported by the four pages. It renders a small
text link carrying the `flag` glyph (already in `icon_names=`, so `iconFont.test.js` stays green)
and opens a modal.

- Modal opens with title and path filled from the current page; neither is editable (a report about
  the wrong page is worse than no report).
- Category dropdown, defaulting to empty so a category is always a deliberate choice; a note field
  labelled "Anything else we should know? (optional)".
- Submit → `POST /api/submit-public` with `{ type: 'report', token, category, page_url, page_title,
  message }`. Success closes the modal with a toast; failure keeps the form filled and shows the
  server's message.
- Flag off → the link does not render at all, on every page.
- The modal is a dialog with a visible close control, `Escape` closes it, and focus returns to the
  link — no focus-trap library, the repo has none.

## Admin

**Messages inbox** (`src/pages/admin/AdminMessages.jsx`) gains a three-way filter — **All /
Messages / Reports** — as local state plus a `?filter=` search param so a link can land on one
view. Reports render `page_title` as the row heading with `page_url` as a link, the category as a
`Badge`, and the note underneath; `kind='report'` rows never offer the mailto link (a report has no
reply address to speak of).

**Admin inbox bell**: `admin_inbox()` labels every contact row "New contact message". It gains a
`case` so a report reads **"New problem report"** with `page_title` as the detail, and
`INBOX_CATEGORIES` in `src/lib/adminInbox.js` gets a `reports` entry — icon `flag`, label
"Problem reports", href `/admin/messages?filter=reports`. `flag` is already in `icon_names=`, so
`iconFont.test.js` stays green.

**Email alert**: `notify_email_webhook()` fires for every `contact_messages` insert. A guard skips
rows where `kind = 'report'` — a bug report is triaged, not replied to, and the owner does not need
an email per report. The guard reads the row through `to_jsonb(NEW)` only inside the
`TG_TABLE_NAME = 'contact_messages'` branch, so it cannot touch the `profiles` path.

**Analytics**: `admin_analytics()` gains a `reports` KPI (count in range, with `previous`, like the
other KPIs), excludes `kind = 'report'` from `unhandledMessages`, and labels the activity-feed row
"New problem report" instead of "New contact message". The dashboard's `analytics` flag already
gates the whole function; nothing new to guard.

**Interaction with feature 3.** This spec and the Rate the Hub spec both re-declare
`admin_analytics()` and `admin_inbox()`. `create or replace` replaces wholesale, so the migration
written *last* must contain the union of both changes or it silently drops the earlier one. The
implementation plan sequences them and states which migration carries both.

## Failure modes

| Failure | Behaviour |
|---|---|
| Flag off | Link hidden; server answers 503 even if a client posts directly |
| Turnstile token missing/invalid | Existing messages, unchanged |
| Category outside the four | 400 from `validateReport` |
| `page_url` not starting with `/` | 400 — nothing absolute, nothing off-site |
| Insert fails | 500 with a generic message, form keeps its values |
| Old rows (pre-migration) | `kind` defaults to `'message'`, `category` null — indistinguishable from today |

## Testing

- **`api/_lib/publicSubmission.test.js`** (extend): `validateReport` accepts each of the four
  categories, rejects an unknown one, rejects an absolute or off-site `page_url`, bounds all three
  strings, and treats an empty note as valid.
- **`src/data/publicSubmit.js`**: the report payload is assembled with `kind` absent from the
  client — a source-scan assertion that the client never decides `kind`.
- **`supabase/migrations.test.js`** (extend): the `kind` check constraint, the `reports` flag row,
  and that `insert` is still revoked from `anon`.
- **`src/lib/adminInbox.test.js`** (extend): `reports` category is registered and its icon is in
  `icon_names=`.

`npm test`, `npm run lint`, `npm run build`.

## Files touched

`supabase/migrations/<ts>_report_a_problem.sql`, `api/submit-public.js`,
`api/_lib/publicSubmission.js` + test, `src/data/publicSubmit.js`, new
`src/components/ReportProblem.jsx`, `src/pages/outlines/OutlineDetail.jsx`,
`src/pages/resources/ResourceList.jsx`, `src/pages/NewsDetail.jsx`,
`src/pages/EventDetail.jsx`, `src/pages/admin/AdminMessages.jsx`,
`supabase/migrations/20261017120000_admin_inbox.sql` (via a new migration that re-declares
`admin_inbox()`), `src/lib/adminInbox.js` + test, a per-key flag hook beside the pattern in
`src/data/calendar.js`, this spec.

## Out of scope

- Screenshots or attachments on a report.
- Routing reports to a different admin, or any workflow beyond the handled tick.
- A separate table, a separate inbox, or a separate admin route.
- Emailing the reporter (there is no reply address by design).
- Changing the 12-month retention of contact messages.

## Verification limits

Tests, lint and build can be verified locally. The modal's appearance, focus behaviour, the flag
hiding the link on all four pages, and the inbox filter **have not been seen** — they need a
browser. The Turnstile path and the webhook-alarm change need a deployed environment and cannot be
faked locally.
