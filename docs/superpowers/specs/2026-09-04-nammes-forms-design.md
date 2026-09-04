# NAMMES Forms (Google Forms clone) — design

Date: 2026-09-04

## Context

NAMMES Hub has no way to collect structured input from students beyond the existing Outline contribution flow (files/links tied to a specific course). This spec adds a general-purpose form builder: admins design a form from a set of question types, share it, students fill it out, and admins review responses — a scoped clone of Google Forms' core loop, not a 1:1 feature match.

Intended uses span event registration/RSVPs, surveys/feedback, and applications (Exco elections, committee sign-ups) — a flexible builder rather than a single-purpose flow, per the approved brainstorm.

## Goals

- Admins create/edit forms with an ordered list of questions, each one of: short answer, paragraph, multiple choice, checkboxes, dropdown, linear scale, file upload, date, time.
- Per-form settings, admin-configurable: require sign-in to respond, limit to one response per person (only meaningful with sign-in required), allow editing a response after submit, accepting-responses toggle, optional close date.
- Students/visitors fill out forms at a shareable link; open forms are also discoverable via a `/forms` listing page.
- Admins view responses three ways — summary (per-question aggregates), table (spreadsheet-style), individual (one response at a time) — and export all responses as CSV.

## Non-goals

- No live Google Sheets sync/export — CSV covers the same need (opens directly in Sheets) without a Google Cloud OAuth integration. Can be revisited later as its own scoped feature if CSV proves insufficient.
- No conditional logic / branching (e.g. "skip to section 3 if X") — out of scope for v1.
- No form templates/duplication, no collaborator/multi-admin ownership per form (all admins can manage all forms, matching every other admin section in this app).
- No rate limiting/spam heuristics beyond the sign-in requirement toggle — consistent with the rest of the app's small-department threat model.
- No real-time response notifications (email-on-submit) — admins check the responses view manually, same as the existing Submissions queue.

## Architecture

### Data: three new tables + storage bucket

```sql
-- forms
id uuid primary key default gen_random_uuid(),
title text not null,
description text,
created_by uuid not null references auth.users(id),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
is_accepting_responses boolean not null default true,
closes_at timestamptz,                    -- nullable, auto-close deadline
require_signin boolean not null default false,
one_response_per_person boolean not null default false,  -- only meaningful when require_signin
allow_edit_after_submit boolean not null default false

-- form_questions
id uuid primary key default gen_random_uuid(),
form_id uuid not null references forms(id) on delete cascade,
position int not null,
type text not null,               -- 'short_text' | 'paragraph' | 'multiple_choice' | 'checkboxes'
                                   -- | 'dropdown' | 'linear_scale' | 'file_upload' | 'date' | 'time'
label text not null,
helper_text text,
required boolean not null default false,
options jsonb,                    -- array of strings, for multiple_choice/checkboxes/dropdown
scale_min int,
scale_max int,
scale_min_label text,
scale_max_label text

-- form_responses
id uuid primary key default gen_random_uuid(),
form_id uuid not null references forms(id) on delete cascade,
respondent_id uuid references auth.users(id),   -- nullable when require_signin = false
respondent_email text,                           -- denormalized for the admin table/CSV view
answers jsonb not null,                          -- { "<question_id>": value }
submitted_at timestamptz not null default now(),
updated_at timestamptz not null default now()

-- partial unique index — only constrains identified respondents, never anonymous ones
create unique index one_response_per_person on form_responses (form_id, respondent_id)
  where respondent_id is not null;
```

`answers` is a single JSONB blob keyed by question id rather than a normalized per-answer table. This app's convention for anything stats/chart-shaped (`chartMath.js`) is to fetch rows and compute in JS rather than push aggregation into SQL, and at department scale (hundreds of responses, not millions) that holds for the response summary view too. One insert per submission; table/individual views read the row directly; summary stats are computed client-side by iterating responses per question. Revisit only if response volume or query needs change materially.

File upload answers store a Storage URL, same pattern as `outline-attachments`: new bucket `form-uploads`, objects written to `${form_id}/${timestamp}-${filename}` (uploaded before the response row exists, so it can't key off the response id), public read.

The `one_response_per_person` unique constraint is created as a partial index (`where respondent_id is not null`) so it only bites when there's a stable identity to key on; anonymous responses (`respondent_id is null`) are never constrained by it.

### RLS

- `forms`, `form_questions`: public `select` (needed for `/forms` and the fill-out page); `insert`/`update`/`delete` restricted to rows in the existing `admins` table — same pattern as every other admin-managed table in this app.
- `form_responses`:
  - `insert`: allowed if the form's `require_signin = false` (any visitor, `respondent_id` left null), or if `require_signin = true` and `auth.uid() = respondent_id`. Enforced via a policy that joins back to `forms` on `form_id`.
  - `select`/`update` own response: `auth.uid() = respondent_id`; `update` additionally requires the form's `allow_edit_after_submit = true` and `is_accepting_responses = true` (checked in the policy, not just client-side).
  - `select` all responses for a form: `admins` only.
  - No `delete` policy for respondents (admins only, via the `admins` check) — consistent with how `outline_submissions` handles deletion.
- Storage bucket `form-uploads`: `insert` follows the same require-signin logic as the `form_responses` insert policy; public `select`; `delete` restricted to `admins`.

As with every other write path in this app, the UI never checks "am I an admin" client-side — RLS is the actual gate (see [[2026-08-09-admin-cms-design]]).

### Public-facing UI

- **`/forms`** (new nav-reachable route) — `Card` grid of forms where `is_accepting_responses = true` and (`closes_at` is null or in the future), same visual pattern as the Events/Resources index pages.
- **`/forms/:id`** (new) — the fill-out page:
  - Renders questions in `position` order, one component per `type` (radio for multiple choice, checkbox group, native select for dropdown, a 1–N scale control for linear scale, file input reusing the existing upload-field pattern/size caps from `ImageUploadField.jsx`/Outline contributions, native date/time inputs for date/time).
  - Client-side required-field validation before submit, reusing the `FormField error` pattern.
  - If `require_signin` and no session: inline "sign in to respond" prompt (same tone as the Outline contribution gate), page itself stays reachable/unprotected.
  - If `one_response_per_person` and the signed-in user already has a response: show it read-only, with an **Edit** button if `allow_edit_after_submit`, otherwise a "you've already responded" state.
  - If the form isn't accepting responses (manual toggle or past `closes_at`): a closed-state message in place of the form (not a 404 — a shared link should still resolve to something legible).
  - On successful insert/update: toast success, then the read-only/closed state as appropriate.

### Admin UI

- **`/admin/forms`** (new entry in `ADMIN_SECTIONS`, `Admin.jsx`) — bespoke list page (like `AdminSubmissions.jsx`, not the generic `adminFields.js`/`AdminResourceManager` CRUD pattern, since forms have a nested question list that pattern doesn't support). Each row: title, response count, accepting/closed badge, links to **Edit**, **Responses**, **Delete** (native `confirm()`, consistent with existing admin delete actions).
- **`/admin/forms/:id/edit`** (new form goes through the same route with no id, or a `/new`) — the builder:
  - Title/description fields, a settings panel (require sign-in, one-per-person — disabled unless require-signin is on, allow edit after submit, accepting-responses toggle, optional close date).
  - Questions rendered as an inline vertical stack of cards (one per question, matching Google Forms' own editing model — admins need to see the whole form while building it, which a modal-per-question would hide), each with: type picker, label, helper text, required toggle, and a type-specific options editor (add/remove/reorder choice strings for multiple_choice/checkboxes/dropdown; min/max + labels for linear_scale). Reorder via up/down arrow buttons (matches this app's flat, no-drag-and-drop interaction style elsewhere) rather than drag-and-drop.
  - Ghost "+ Add question" button appends a new card to the stack.
  - Save persists the form row, then replaces the full question set (delete-and-reinsert) — simplest correct approach given question lists are expected to be small (tens, not hundreds), avoiding diffing logic for add/remove/reorder.
- **`/admin/forms/:id/responses`** (new) — three tabs plus an export button:
  - **Summary** — per-question aggregates computed client-side from the fetched response set: bar breakdown for multiple_choice/checkboxes/dropdown/linear_scale, response count + scrollable text list for short_text/paragraph, file link list for file_upload. Built using the `dataviz` skill for chart layout/palette, following the existing convention (`chartMath.js`) of computing chart data in JS rather than SQL.
  - **Table** — one row per respondent, one column per question, using the existing `Table` component conventions; wrapped in `.nm-table-wrap` per the design system's horizontal-scroll rule since column count is unbounded.
  - **Individual** — paginated single-response view (prev/next through the fetched set).
  - **Export CSV** — client-side CSV generation (question labels as header row, one line per response) from the same fetched data; no new dependency.

## Error handling

- Builder validation before save: title required, every question needs a non-empty label, choice-type questions need at least one option, linear scale needs `scale_min < scale_max`. Inline errors via the existing `FormField error` pattern.
- Fill-out validation: required questions block submit with inline errors; file upload errors (type/size) mirror `ImageUploadField.jsx`.
- A write rejected by RLS (e.g. a form closed between page load and submit, or a stale session) surfaces as a generic inline error, same as every other Supabase error path in this app.
- Empty states: "No forms yet" on `/admin/forms`; "No open forms right now" on `/forms`; "No responses yet" on the responses tabs.

## Testing

Consistent with this project's existing approach (pure functions get Vitest coverage, everything else verified manually against the dev server):
- New pure helpers get direct unit tests: CSV serialization, per-question summary aggregation (grouping/counting answers by question type), and the builder's client-side validation (title/options/scale-range checks) — following the pattern in `adminFields.test.js`/`chartMath.test.js`.
- End-to-end flow verified manually via the running dev server against Supabase: build a form with each question type as admin → submit as a signed-out visitor (open form) → submit as a signed-in student (require-signin form, confirm one-response-per-person blocks a second submit, confirm edit-after-submit works when enabled) → confirm all three response views and CSV export show the right data → toggle accepting-responses off and confirm the closed state → delete the form and confirm cascade cleanup of questions/responses/storage objects.
