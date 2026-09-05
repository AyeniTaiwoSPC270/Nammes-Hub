# Admin users, ownership, and a review queue for News/Events/Awards — design

Date: 2026-09-05

## Context

`/admin` today has one flat privilege level: a user is either in the `admins` table or not, and every admin can write directly to every content table (see [[2026-08-09-admin-cms-design]]). Two gaps prompted this spec:

1. There's no page to see who has an account, when they signed up, whether they still use the site, or to manage who holds admin access. The `admins` table exists (used throughout RLS) but is empty — nobody can currently pass an admin check, and nothing lets anyone add themselves.
2. `/admin` itself is gated only by `ProtectedRoute`, which checks for *any* logged-in session, not admin membership — a regular student who signs in can currently open the admin dashboard shell (writes still fail via RLS, but the UI shouldn't be reachable at all).

While scoping the users page, the user (`240406009@live.unilag.edu.ng`, the sole existing account) described a second, larger need: they hold a time-limited "president" role and want a permanent **owner** status that can be handed off to a successor, plus the ability to require their sign-off on the most visible content (News, Events, Awards) before it publishes — other admins can still create/edit it, but it stays invisible to the public until the owner approves. Lower-stakes sections (Opportunities, Excos, Outlines, Timetables, Resources, Forms) are explicitly out of scope for gating and keep today's direct-write behavior.

## Goals

- A `/admin/users` page listing every account: name, matric, joined date, last-seen, auto-derived active/inactive, admin/owner badge, with actions to promote/demote admins, transfer ownership, and enable/disable an account.
- A permanent, transferable **owner** role, distinct from regular admins: only the owner can remove an admin or transfer ownership; any admin can add a new admin. The owner can never be removed from `admins` without transferring ownership first (enforced in the database, not just hidden in the UI).
- A review-queue pipeline for News, Events, and Awards (season/category setup only — see Non-goals): regular admins' creates/edits go to a pending state invisible to the public; the owner approves or rejects from a `/admin/reviews` page with a before/after diff. The owner's own edits to these sections publish immediately.
- A real admin-only guard on `/admin/*` (currently only checks for a session).
- `last_seen_at` tracked automatically (not just last sign-in) and used to compute active/inactive.
- A soft account-disable an admin can toggle, enforced at the app level (signs the user out on next auth check with an explanatory message).

## Non-goals

- No approval gating on Opportunities, Excos, Outlines, Timetables, Resources, or Forms — these stay direct-write for any admin, matching today's behavior.
- No approval gating on Awards nominee curation or phase transitions (nominating → curating → voting → closed → revealed) — only the season/category setup step (`AdminAwardSeason`) is gated. Curation and phase changes are already invisible to the public until `revealed`, so the existing phase machine is the gate for that content.
- No approval gating on deletes anywhere — only creates/edits. Deleting something an admin no longer wants live takes effect immediately.
- No real auth-level account ban (no Supabase Admin API, no service-role key, no serverless function). Disable is a soft, app-level block — sufficient for this app's stakes, chosen explicitly over the heavier alternative.
- No changes to the existing outline-submissions review flow (`AdminSubmissions`, student-submitted course materials) — that's a separate, already-working approval mechanism and isn't touched by this spec.
- No email/notification system for rejected changes — the submitting admin sees the rejection (and reason) the next time they view that item in their own admin list; nothing is pushed to them.
- No level/course-level field on profiles — explicitly deferred; not collected at signup today and out of scope here.

## Data model

```sql
-- profiles: two new columns
alter table public.profiles
  add column last_seen_at timestamptz,
  add column is_disabled boolean not null default false;

-- admins: ownership flag, at most one true at a time
alter table public.admins
  add column is_owner boolean not null default false;
create unique index admins_one_owner_idx on public.admins ((is_owner)) where is_owner;

-- generic review queue for News / Events / Award season+category setup
create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('news', 'events', 'award_season')),
  action text not null check (action in ('insert', 'update')),
  record_id text,                    -- null for inserts (new news/events id) or the award_seasons.id for award_season
  payload jsonb not null,            -- proposed row (news/events) or {title, categories:[...]} (award_season)
  submitted_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);
```

`change_requests` has no client-facing INSERT/UPDATE RLS policy — all writes to it go through the security-definer functions below, which enforce their own authorization internally. It has two SELECT policies: submitters see their own rows, the owner sees all.

## Ownership & admin management

- `admins_self_select` (existing) stays; add `admins_select_admin_all` — any row in `admins` can `SELECT` all of `admins` (needed for the Users page to show admin/owner badges).
- `admins_insert_admin` — any existing admin can insert a new admin row, **with check** `new.is_owner = false or exists (select 1 from admins where user_id = auth.uid() and is_owner)` — a regular admin can add admins but can't sneak in as owner.
- `admins_delete_admin` — only the owner (`exists (select 1 from admins where user_id = auth.uid() and is_owner)`) can delete a row.
- A `before delete` trigger on `admins` raises if `old.is_owner` — the owner's own row can never be deleted directly, by anyone, including themselves; they must transfer first.
- A `before delete` trigger (or reuse of the same one) also blocks deleting the last remaining row regardless of ownership, so the table can never end up empty.
- `transfer_ownership(new_owner uuid)` (security definer): checks caller is current owner, checks `new_owner` already has an `admins` row, sets caller's `is_owner = false` and target's `is_owner = true` in one transaction. This is how the user hands off the role at the end of their tenure.
- `admin_set_user_disabled(target uuid, disabled boolean)` (security definer): checks caller is any admin, sets `profiles.is_disabled` for the target row.
- `profiles` gets one new SELECT policy: `exists (select 1 from admins where user_id = auth.uid())` can select all rows (today admins can only see their own profile — needed for the Users list).
- Seeding: insert the sole existing account (`240406009@live.unilag.edu.ng`) into `admins` with `is_owner = true` as part of the migration.

## Last-seen tracking & soft disable

- `touch_last_seen()` (security definer): `update profiles set last_seen_at = now() where user_id = auth.uid()`. No RLS UPDATE policy on `profiles.last_seen_at` is needed — the function is the only write path, and it can only ever touch the caller's own row.
- `AuthContext` calls it once per browser session (guarded by a `sessionStorage` flag) once a session is confirmed present — not on every route change.
- `AuthContext` also fetches the caller's own `profiles.is_disabled` after session load. If true: immediately `supabase.auth.signOut()` and surface "This account has been disabled — contact an admin" on the Login page. Known limitation of the soft-disable approach (explicitly chosen over a real ban): a user already mid-session isn't force-logged-out the instant an admin disables them — only on their next auth check or reload.
- Active/inactive on the Users page is computed client-side from `last_seen_at`: active if seen within the last 14 days, otherwise inactive. Not stored — derived at render time.

## Review-queue architecture

Two security-definer functions drive the whole queue, reused across all three gated entity types:

- `submit_change_request(entity_type text, action text, record_id text, payload jsonb)`: checks caller is any admin, inserts a `pending` row. Returns the new request id.
- `apply_change_request(id uuid)`: checks caller is the owner, loads the pending row, and — based on `entity_type`/`action` — performs the real `insert`/`update` against `news`, `events`, or (`award_seasons` + `award_categories` together) using the payload, then marks the request `approved` with `reviewed_by`/`reviewed_at`. Branches per entity type explicitly (no dynamic SQL) since only three types exist.
  - For `award_season`, the payload's `categories` array is the proposed *full* category list for that season, applied the same way `saveCategories` does today (diff against what's currently live: insert new ids, update matching ids, delete ids no longer present). A category disappearing because a non-owner admin removed it while editing the season is part of that one pending edit, not a standalone delete — it only takes effect on approval, same as the rest of the season's fields. This doesn't conflict with "deletes stay immediate": that rule covers an admin directly deleting a whole live news/event/season/category record from a list view, which remains an instant, ungated action on all three entity types (their DELETE policies are untouched by this spec).
- `reject_change_request(id uuid, reason text)`: owner-only, marks `rejected` with the reason. No change to live data.

RLS on the gated tables' INSERT/UPDATE tightens from "any admin" to **owner-only** direct writes:

```sql
-- news / events: change existing admin_insert / admin_update policies from
--   auth.uid() in (select user_id from admins)
-- to
--   exists (select 1 from admins where user_id = auth.uid() and is_owner)
-- (delete stays "any admin", unchanged, per the deletes-are-immediate decision)

-- award_seasons / award_categories: same tightening on their insert/update policies
```

Regular admins can therefore only affect these tables via `submit_change_request`; the owner's own edits go straight to the real tables as before (no reason to self-review).

### Frontend integration

- `AdminResourceManager` (the shared list+form component behind `AdminNews`/`AdminEvents`) gains a `reviewGated` config flag. When true and the caller isn't owner: `saveMutation` calls `submit_change_request` instead of a direct `insert`/`update`, and the success toast reads "Submitted for review" instead of "added/updated." The list also merges in the caller's own pending requests for that table (fetched by `submitted_by = auth.uid()` and `status = 'pending'`) so they see what's awaitng approval; delete is untouched (still direct, any admin).
- `AdminAwardSeason`'s `saveMutation` gets the same branch: owner saves season + categories directly as today; a non-owner admin instead calls `submit_change_request('award_season', ..., { title, categories })` and sees a "Submitted for review" state instead of navigating to the edit view of a live season.
- New `/admin/reviews` page, listed in `ADMIN_SECTIONS` only when the current user is owner: lists all `pending` `change_requests`, each showing entity type, submitter, and a plain field-by-field before/after (fetching the current live row by `record_id` and diffing against `payload`; for inserts, the "before" side is empty). Approve/Reject buttons call `apply_change_request`/`reject_change_request`; reject prompts for a short reason.

## `/admin` route gating

- New `useIsAdminQuery()`: selects the caller's own `admins` row (allowed by `admins_self_select`), returns whether it exists (and, separately, whether `is_owner`).
- New `AdminRoute` component replaces the plain `ProtectedRoute` wrapping `/admin/*` in `App.jsx`: no session → redirect to `/login`; session but no `admins` row → redirect to `/`; otherwise render the outlet. `Admin.jsx`'s `ADMIN_SECTIONS` list also filters out `/admin/reviews` for non-owners (that page's tile plus the corresponding route both check ownership; a non-owner who navigates there directly sees "Only the owner can review pending changes.").

## `/admin/users` page

Table columns: Name, Matric, Joined (`profiles.created_at`), Last seen (`last_seen_at`, "—" if never tracked), Status (Active/Inactive badge, computed), Role (Admin/Owner badge or none), and row actions:
- **Make admin / Remove admin** — insert/delete on `admins` (remove disabled/hidden for non-owners per the RLS above; also disabled for the owner's own row).
- **Disable / Enable** — calls `admin_set_user_disabled`; disabled for the viewer's own row (can't disable yourself).
- **Make owner** (owner-only, shown on other admins' rows) — calls `transfer_ownership`; a confirm step since it immediately gives up the current owner's protected status.

New `src/data/users.js`: `fetchAllProfiles()` + `fetchAllAdmins()` merged client-side into one list (no FK between `profiles` and `admins` to join through PostgREST directly), plus thin wrappers for the mutations above (`assignAdmin`, `revokeAdmin`, `setUserDisabled`, `transferOwnership`). Same shape/pattern as `src/data/excos.js` etc.

## Error handling

- `submit_change_request`/`apply_change_request`/`reject_change_request`/`transfer_ownership`/`admin_set_user_disabled` all raise a Postgres exception on an unauthorized caller; the client surfaces this the same generic way existing RLS-rejected writes do today (inline error via the existing toast pattern).
- The DB triggers preventing owner deletion / last-admin deletion raise on the attempt; the Users page also disables the corresponding button client-side so this is a backstop, not the primary UX.
- A disabled user hitting `AuthContext`'s check gets signed out and routed to Login with an explanatory message rather than a generic error.

## Testing

- `src/data/users.js` gets a `*.test.js` following the existing mocked-Supabase pattern used by `profiles.test.js`/`excos.js`'s siblings, covering the merge logic (profiles + admins → one list with derived active/inactive) and each mutation wrapper.
- The active/inactive 14-day derivation is a pure function, unit tested directly (e.g. `isActive(lastSeenAt, now)`).
- The diff view on `/admin/reviews` (payload vs. live row → changed-fields list) is a pure function, unit tested with representative before/after payloads for news, events, and award_season.
- End-to-end flows (submit as regular admin → appears in queue → owner approves → goes live; owner reject → stays hidden, submitter sees rejection; ownership transfer; disable → signed out; last-admin/owner deletion blocked; `/admin` redirect for non-admins) are manually verified against the dev server — consistent with this project's existing approach of no Supabase-mocking infra for integration-level flows.

## Rollout

This migration seeds `240406009@live.unilag.edu.ng`'s existing `admins` row (once created) with `is_owner = true`, since it's the only account in the system today and belongs to the user driving this spec.
