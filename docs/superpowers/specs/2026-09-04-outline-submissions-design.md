# Peer-sourced outline submissions — design

Date: 2026-09-04

## Context

Today the "Downloads" section on a course's outline page (`OutlineDetail.jsx`) shows at most two admin-entered links (`past_questions_link`, `lecturer_notes_link`) per course. Students have no way to contribute past questions, lecture notes, or other course materials themselves — everything comes from one admin typing links into `AdminOutlines.jsx`.

This spec adds a peer-sourced contribution flow layered onto the existing Outlines drill-down (`/outlines/:level/:semester/:code`): any signed-in student can submit a file or link for a course, an admin reviews it in a moderation queue, and only approved submissions become publicly visible. It follows [[2026-08-09-admin-cms-design]]'s existing pattern — RLS is the real security boundary, the UI is just a clean experience layered on top.

## Goals

- Let any signed-in student attach a past question, lecture notes, or other material to a specific course, either by uploading a file (PDF/JPG/PNG, ≤10MB) or pasting a link.
- Nothing submitted becomes publicly visible until an admin approves it.
- Admins moderate from one dedicated queue across all courses, not per-course.
- Submitter identity is recorded (for admin accountability/follow-up) but never shown to other students — approved contributions display unattributed.
- Course pages show approved contributions grouped/labeled by type (Past Question / Lecture Notes / Other) with an optional session/year tag.

## Non-goals

- No public credit/attribution for contributors (per approved design — admin-only visible).
- No anonymous (logged-out) submissions — matches the app's existing pattern of gating writes behind a session.
- No rich moderation workflow (no comments/revision requests) — just approve, reject, or delete.
- No changes to the existing admin-entered `past_questions_link`/`lecturer_notes_link` fields on `outlines` — they keep working as-is; this is an additive, separate list.
- No rate limiting/spam heuristics beyond requiring auth — out of scope for a small department hub.

## Architecture

### Data: new table + storage bucket

```sql
-- outline_submissions
id uuid primary key default gen_random_uuid(),
outline_id text not null references outlines(id),
type text not null,              -- 'past_question' | 'lecturer_notes' | 'other'
session text,                    -- nullable, e.g. '2023/2024'
title text not null,             -- short label, e.g. "2023 second semester exam"
file_url text,                   -- nullable, Supabase Storage public URL
external_url text,               -- nullable, pasted link — exactly one of file_url/external_url is set
status text not null default 'pending',   -- 'pending' | 'approved' | 'rejected'
submitted_by uuid not null references auth.users(id),
submitted_by_email text not null,          -- denormalized, so admin list needs no join
created_at timestamptz not null default now()
```

Storage bucket `outline-attachments`: files are written to `${auth.uid()}/${timestamp}-${filename}`, public read.

### RLS

- `outline_submissions` `insert`: any authenticated user, only for rows where `submitted_by = auth.uid()`.
- `outline_submissions` `select`: `status = 'approved'` rows are public; `pending`/`rejected` rows only visible to rows in `admins` (same table/pattern as [[2026-08-09-admin-cms-design]]).
- `outline_submissions` `update`/`delete`: `admins` only.
- `outline-attachments` bucket: `insert` for any authenticated user into their own `${auth.uid()}/...` prefix; public `select`; `delete` restricted to `admins`.

This mirrors the existing app-wide pattern: the UI never checks "am I an admin" client-side (no such flag exists anywhere in this codebase today — see `Navbar.jsx`, which shows the Admin link to any signed-in user); RLS is the actual gate, same as every other admin write in the app.

### Student-facing UI (`OutlineDetail.jsx`)

- New "Community contributions" `Card` below the existing "Downloads" card. Lists approved submissions for this course (fetched via `outline_id`), each showing a type badge, title, optional session, and either a download link (`file_url`) or external link (`external_url`).
- A "Contribute" button renders a new `ContributeForm.jsx` component inline (or in a lightweight panel, matching this page's existing card-based layout — no modal library in this app today, so inline expand/collapse):
  - `type` select (Past Question / Lecture Notes / Other)
  - `session` text input (optional)
  - `title` text input (required)
  - a toggle between "Upload a file" and "Paste a link"; upload path reuses the drag-and-drop file input pattern from `ImageUploadField.jsx` (adapted: `accept="application/pdf,image/*"`, 10MB cap, uploads to `outline-attachments` instead of `news-images`, no image preview/resize since files may not be images)
- If `useAuth()` has no session, the button is replaced with a "Sign in to contribute" link to `/login` (page itself stays public/unprotected — only the contribute action requires auth, consistent with how the rest of the app gates writes rather than reads).
- On successful insert: toast success ("Thanks — this is awaiting review."), form collapses. The new row does not appear in the list (it's `pending`, and RLS hides it from non-admins anyway).

### Admin moderation (`pages/admin/AdminSubmissions.jsx`, new)

- New route `admin/submissions` (inside the existing `ProtectedRoute` block in `App.jsx`), new card on `Admin.jsx` alongside the other seven sections.
- Default view: all `pending` submissions across every course, newest first. Each row shows course code (joined from `outlines`), type, title, session, submitter email, and a link/preview to the file or external URL, plus **Approve** / **Reject** buttons.
- A secondary tab/filter shows `approved` + `rejected` history, with a **Delete** action (hard delete row + storage object if `file_url` is set) for cleanup.
- Approve → `status = 'approved'`. Reject → `status = 'rejected'` (kept, not deleted, so there's a record of what was rejected and why it might resurface). Built as a bespoke page (not `AdminResourceManager`) since approve/reject-with-history doesn't fit that component's generic add/edit/delete shape — same reasoning `AdminEventGallery.jsx` already used to break from the generic manager for a workflow `AdminResourceManager` doesn't fit.

## Error handling

- Form validation (required `title`, must have exactly one of file or link) happens client-side before submit, reusing the existing `FormField error` pattern.
- File upload failures (wrong type, too large) show inline under the upload field, mirroring `ImageUploadField.jsx`'s existing error handling.
- A write rejected by RLS (shouldn't happen in normal use, but e.g. a stale/expired session) surfaces as a generic inline error, same as every other Supabase error in this app.
- Empty states: "No contributions yet — be the first to add one." on the course page; "No pending submissions." in the admin queue.

## Testing

Consistent with this project's existing approach (pure functions get Vitest coverage, everything else is verified manually against the dev server):
- Any new pure helpers (e.g. grouping submissions by `type` for display, or the validation "exactly one of file/link") get direct unit tests, following the pattern in `outlines.test.js`/`adminFields.test.js`.
- End-to-end flow (submit as a non-admin test account → confirm it's invisible on the course page → approve as admin → confirm it appears → reject a second one → confirm it stays hidden) verified manually via the running dev server against Supabase, same as prior specs in this project (no Supabase mocking infra exists here).
