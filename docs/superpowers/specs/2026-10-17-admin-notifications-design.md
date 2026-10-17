# Admin Notification Bell

A bell in the admin area that tells an admin what has arrived since they last looked — student
submissions, contact messages, form responses, owner review items, server errors — plus short
announcements one admin can post for the rest.

**Status:** approved. **Date:** 2026-10-17. **Branch:** `feat/admin-notifications`.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| `admin_announcements` | Short admin-to-admin notes. Plain text, any admin may post |
| `admin_inbox_seen` | Per-admin, per-category `seen_at`. The only read state |
| `public.admin_inbox()` | One `security definer` RPC unioning the six sources |
| `src/lib/adminInbox.js` | The category list and pure shaping/counting helpers |
| `src/data/adminInbox.js` | React Query hooks: inbox, mark seen, post announcement |
| `src/components/admin/AdminNotificationBell.jsx` | The bell, the panel and the composer |
| `Admin.jsx` + `AdminLayout.jsx` | Two mounts of the same component |

### Out

- **Email and push.** Bell only. The existing `email_outbox` and per-user
  `email_notifications_enabled` preference are untouched.
- **A public navbar entry.** The user menu stays as it is; the bell lives in the admin area only.
- **Per-item read receipts.** Read state is one timestamp per category per admin. Per-item
  dismissal is a table with a row per admin per notification and was rejected as scope.
- **Triggers on the source tables.** Nothing is written at source; the inbox is derived at read
  time. A source that is added later appears by editing one function, not by remembering to add a
  trigger to it.
- **A `feature_flags` key.** The bell is admin-only and reads tables that already exist; a kill
  switch would add a query to every admin page for no deploy-time benefit.
- **Realtime.** React Query polling is enough for a feed that changes a few times a day, and it
  keeps the Supabase realtime surface unchanged.

---

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Derived vs stored | **Derived at read time** | The user asked for "anything that usually updates that admins need to check". A stored row needs a writer in every producer, and a forgotten writer fails silently — the repo already carries that scar in the `quiz_record_answer` call-site drift. A union cannot miss a row that exists |
| New table for announcements | **Yes, only for announcements** | Announcements are the one thing that exists nowhere. Everything else is a row someone else already wrote |
| Read state | **`admin_inbox_seen (user_id, category, seen_at)`** | One timestamp per category is enough to say "new since I last opened this". A per-item table buys dismissal nobody asked for |
| Badge clears | **On opening the panel, plus a "Mark all read" button** | The button is an explicit affordance; opening normally leaves it with nothing to clear. Unresolved work still shows its own outstanding count, so clearing the badge cannot hide a task |
| Who receives | **Every admin** | Matches `admins` membership. Owner-only sources are filtered **server-side** |
| Owner-only sources | **`reviews` and `errors`, gated in SQL** | `error_log`'s RLS is owner-only and `security definer` would bypass it. If the RPC did not check `is_owner()` itself, a non-owner's bell would leak the owner's error log |
| Where the href lives | **In `INBOX_CATEGORIES` (JS), not in SQL** | Navigation is a client concern; SQL returns a category key. One owner of the mapping means a route rename cannot leave the RPC pointing at an old path |
| Polling | **60s + refetch on focus** | Cheap; the admin area is not open for hours on end |

---

## 3. Data model

One migration, `supabase/migrations/20261017120000_admin_inbox.sql`, and its rollback
`supabase/rollbacks/20261017120000_admin_inbox.rollback.sql`.

### 3.1 `admin_announcements`

```sql
create table public.admin_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body  text not null check (char_length(body)  between 1 and 2000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
```

RLS: select for `public.is_admin()`; insert for `public.is_admin()` with
`created_by = auth.uid()`; delete for `created_by = auth.uid() or public.is_owner()`.
No update policy — an announcement is a note, not a document.

### 3.2 `admin_inbox_seen`

```sql
create table public.admin_inbox_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in
    ('submissions','messages','responses','reviews','errors','announcements')),
  seen_at timestamptz not null default now(),
  primary key (user_id, category)
);
```

RLS: select, insert and update only where `user_id = auth.uid()`.
`on delete cascade` so deleting an account does not leave orphans.

### 3.3 Indexes

```sql
create index on public.contact_messages  (created_at desc);
create index on public.outline_submissions (status, created_at desc);
create index on public.form_responses    (submitted_at desc);
create index on public.change_requests   (status, created_at desc);
create index on public.admin_announcements (created_at desc);
```

`error_log` already has a unique index leading with `route`; the inbox only reads the last 30
days and the retention job deletes older rows, so no index is added there.

### 3.4 Grants

The least-privilege migration revokes everything and then restores specific grants, and it sets
default privileges so **future tables and functions are private**. This migration must therefore
grant explicitly:

```sql
grant select, insert, update on public.admin_inbox_seen to authenticated;
grant select, insert, delete on public.admin_announcements to authenticated;
grant execute on function public.admin_inbox() to authenticated;
```

Nothing is granted to `anon`. RLS remains the second layer.

---

## 4. `admin_inbox()`

```sql
create or replace function public.admin_inbox()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$ ... $$;
```

- Raises unless `public.is_admin()`. `security definer` is required because `error_log` is
  readable only by the owner, and because the union must not depend on the caller's row visibility
  for the owner-gated sources.
- `v_owner := public.is_owner()` is computed once and used as a predicate on `change_requests`
  and `error_log`, so a non-owner's payload contains neither.
- Each source is filtered to `now() - interval '30 days'` and ranked with
  `row_number() over (partition by category order by created_at desc)`; at most **10 per
  category** survive, which bounds the payload at 60 items.
- Returns:

```json
{
  "categories": {
    "submissions": { "outstanding": 3, "seenAt": "2026-10-16T09:00:00+00:00" }
  },
  "items": [
    { "category": "submissions", "id": "…", "title": "New course material submission",
      "detail": "PHY 101 past questions", "createdAt": "2026-10-17T08:12:00+00:00" }
  ]
}
```

- `outstanding` is the **all-time** count of work not yet resolved, and only two sources have
  that state: pending submissions and pending owner reviews. Messages, responses, errors and
  announcements are never "resolved", so they report `0` rather than a number that can never be
  cleared — a to-do that grows forever is not a to-do. `items` is the "what happened recently"
  list; `outstanding` is the "there is still work" number.
- `seenAt` is `null` for a category never opened, which makes every returned item unread.

Source summaries (the `detail` column, which is plain text and rendered as text):

| Category | Table | Title | Detail |
|---|---|---|---|
| `submissions` | `outline_submissions` where `status = 'pending'` | New course material submission | row `title` |
| `messages` | `contact_messages` | New contact message | sender name, falling back to email |
| `responses` | `form_responses` join `forms` | New form response | form title |
| `reviews` *(owner)* | `change_requests` where `status = 'pending'` | Change awaiting approval | `entity_type || ' ' || action` |
| `errors` *(owner)* | `error_log` | Server error | `route || ' — ' || message` |
| `announcements` | `admin_announcements` | row `title` | row `body` |

---

## 5. Client

### 5.1 `src/lib/adminInbox.js` (pure)

The single list of categories, in display order:

```js
export const INBOX_CATEGORIES = [
  { key: 'submissions', label: 'Submissions', icon: 'fact_check',      href: '/admin/submissions' },
  { key: 'messages',    label: 'Messages',    icon: 'mail',            href: '/admin/messages' },
  { key: 'responses',   label: 'Form responses', icon: 'checklist',    href: '/admin/forms' },
  { key: 'reviews',     label: 'Reviews',     icon: 'pending_actions', href: '/admin/reviews' },
  { key: 'errors',      label: 'System errors', icon: 'error',         href: '/admin/system' },
  { key: 'announcements', label: 'Announcements', icon: 'campaign',    href: '/admin' },
]
```

Helpers, all pure:

- `normaliseInbox(payload, now)` → `{ categories, items, unread }`. Drops items whose category is
  not in the list (a stale client against a newer RPC), attaches `label`/`icon`/`href` from the
  list, converts `seenAt`/`createdAt` to numbers, and computes `unread` per category as the number
  of returned items newer than `seenAt`.
- `groupInboxItems(items)` → categories in `INBOX_CATEGORIES` order, each with its items, empty
  groups dropped.
- `totalUnread(categories)` → the badge number.
- `validateAnnouncement({ title, body })` → an error string or `null`, mirroring the SQL checks so
  the composer refuses before the round trip.

No `Date` formatting here — relative time stays in the component, where the clock can be read.

### 5.2 `src/data/adminInbox.js`

- `fetchAdminInbox()` → `supabase.rpc('admin_inbox')`, then `normaliseInbox`.
- `useAdminInboxQuery(enabled)` → key `['admin', 'inbox']`, `refetchInterval: 60_000`.
- `markInboxSeen(userId, categories)` → upsert `{ user_id, category, seen_at: now() }` on
  `(user_id, category)`.
- `postAnnouncement({ title, body, userId })` → insert with `created_by`.
- Mutations invalidate `['admin', 'inbox']`.

### 5.3 `AdminNotificationBell.jsx`

- Bell button: `notifications` glyph, `aria-expanded`, `aria-label="Admin notifications"`, unread
  count in a pill capped at `9+`.
- Panel: `absolute` dropdown, `w-[min(24rem,calc(100vw-2rem))]`, scrolls, `role="dialog"` +
  `aria-label`. Outside click closes it (same `mousedown` listener idiom as `UserMenu`), Escape
  closes it.
- On open: fetch once more, then `markInboxSeen` for every category in the payload. The panel
  keeps rendering the items already fetched, so the admin still sees what was new.
- Each item links to its category's `href` and closes the panel.
- Section header shows `outstanding` when it is above zero, including for categories with no
  recent items (a pending review older than 30 days must not vanish).
- Empty state: "Nothing new."
- Footer: "Mark all read" and "Post announcement", which reveals the composer. Any admin can
  post; the button is disabled until `validateAnnouncement` passes.
- Errors surface through the existing `ToastContext`.
- Rendered in the dashboard header (`Admin.jsx`) and in the admin shell bar (`AdminLayout.jsx`),
  so every `/admin/*` page has it and no public page does.

---

## 6. Tests

| File | What it asserts |
|---|---|
| `src/lib/adminInbox.test.js` | Unread counting with and without `seenAt`; items older than `seenAt` are not unread; unknown categories are dropped; group order follows `INBOX_CATEGORIES`; empty groups dropped; `totalUnread`; `validateAnnouncement` boundary lengths (1/120, 1/2000) |
| `src/lib/adminInbox.test.js` (source scan) | Every `category` literal in the migration's union appears in `INBOX_CATEGORIES`, and every `INBOX_CATEGORIES` key appears in the migration's check constraint. A source added on one side fails the suite |
| `src/lib/iconFont.test.js` (existing) | `notifications` and `done_all` must be added to `index.html`'s `icon_names=` in alphabetical order |

---

## 7. Risks and what cannot be verified here

- **RLS and `security definer` need a real Supabase session.** Whether a non-owner's payload
  really omits `reviews` and `errors`, and whether the upsert on `admin_inbox_seen` passes RLS,
  cannot be proven by Vitest. The policies are written to be checked directly in SQL.
- **`is_owner()` inside a `security definer` function** reads `admins` as the function owner, so it
  is the caller's `auth.uid()` that matters, not the function owner's. That is the intended
  behaviour and matches `apply_change_request`, but it is worth confirming with two accounts.
- **Polling cost.** One RPC every 60 seconds per open admin tab. Six sources with 30-day windows
  and per-category limits; the indexes above keep it to index scans.
- **The bell is only as complete as the union.** A future admin feature that writes a new kind of
  "something arrived" row will not appear until `admin_inbox()` is extended — the source-scan test
  makes adding the category to JS without SQL fail, but it cannot detect a table nobody added to
  either.
