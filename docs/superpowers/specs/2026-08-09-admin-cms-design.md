# No-code admin CMS — design

Date: 2026-08-09

## Context

The user's Claude Code access ends 2026-08-19, which is also the project deadline. The user cannot write code themselves and will have zero AI coding help after that date. From that point on, the only way the site can keep changing is through whatever no-code path exists by the 19th.

Right now every piece of content is static:
- `src/data/news.js`, `opportunities.js`, `outlines.js` — hand-edited JS arrays
- `src/data/resources.js` — hand-edited, nested by level → semester
- `src/pages/Events.jsx` — content hardcoded inline in JSX (no data module at all)
- `src/pages/Home.jsx` — the `excos` roster (role/name) is a hardcoded array; there's no photo field at all today, just an initial-letter placeholder

Any content change today requires editing code and a redeploy. `src/pages/Admin.jsx` is already a placeholder that states the intent: *"Create, edit, and delete outlines, events, resources, news, and opportunities."* Supabase (`@supabase/supabase-js`, `src/lib/supabaseClient.js`) and real auth (`AuthContext`, `Login`/`Signup`/`ForgotPassword`/`ResetPassword`, per [[2026-07-23-supabase-auth-design]]) are already wired up — this spec is what actually connects them to content.

## Goals

- Move News, Opportunities, Events, Resources, **Outlines**, and **Excos** from static files/hardcoded JSX to Supabase tables, read live by the public pages (no redeploy needed to change content, ever again).
- Build a real `/admin` area, gated to logged-in admins, with create/edit/delete forms for all six content types.
- One reusable list+form builder driven by a small per-type config, not six bespoke UIs — keeps this buildable in the time remaining.
- News posts support an uploaded image with drag-resize sizing; Exco profiles support an uploaded photo with auto-crop-to-square. Both done entirely through the admin form.
- After the 19th, updating content (including posting a photo, adding a course outline, or swapping in a new Exco) requires nothing but a browser and a login — no code, no redeploy, no developer.

## Non-goals

- No speculative "future feature" flexibility beyond what's specified here (e.g. no generic page builder, no CMS-for-arbitrary-content, no editing of static page copy/headings/labels). The user confirmed the "new feature" worry is just-in-case, not a known need, and there will be no AI/code help to build it anyway — YAGNI. See "Fallback for unplanned needs" below instead.
- Images: only News (drag-resize) and Excos (fixed avatar crop) get an image field. Events/Opportunities/Resources/Outlines keep their current non-photo presentation (Events keeps its tone-based auto-illustration from `src/lib/illustrations.js`).
- No rich text/markdown editor anywhere — plain text/plain lists, matching the existing data shapes.
- No pagination (matches the existing News/Opportunities decision — revisit past ~50 rows).
- No self-service admin invites — admins are added by directly inserting a row in Supabase (a one-time/rare setup action, not a UI to build).
- No drag-to-reorder UI for Excos — display order is a plain numeric `sort_order` field edited like any other field.

## Architecture

### Data: Supabase tables, read live

Six new tables replace their static-file/hardcoded equivalents. Shapes mirror the existing JS data modules as closely as possible so the read-side page components barely change:

```sql
-- news
id text primary key,
category text not null,
tone text,                    -- 'green' | 'orange' | 'neutral', matches Card
date date not null,
title text not null,
body text not null,
author text not null,
badge_tone text,              -- nullable: 'new' | 'updated'
badge_label text,
image_url text,               -- nullable, Supabase Storage public URL
image_width_pct int           -- nullable, 30-100, see "Images" below

-- opportunities
id text primary key,
type text not null,           -- 'Scholarship' | 'Internship'
title text not null,
org text not null,
deadline date not null,
link text not null

-- events
id text primary key,
title text not null,
date text not null,           -- display label, e.g. "Nov 14" (matches current Card eyebrow usage)
tone text,
meta text,                    -- location/time line
description text

-- resources
id text primary key,
level int not null,           -- 100-500
semester int not null,        -- 1-2
category text not null,
title text not null,
updated date not null,
link text not null

-- outlines
id text primary key,
level int not null,           -- 100-500
semester int not null,        -- 1-2
code text not null,           -- e.g. "MME 101"
title text not null,
units int not null,
lecturer text not null,
updated date not null,
description text not null,
topics text[] not null default '{}',   -- one line per topic in the admin form, split/joined as an array
texts text[]                            -- nullable, same one-line-per-item treatment

-- excos
id text primary key,
role text not null,           -- e.g. "President"
name text,                    -- nullable, matches current "vacant seat" behavior (Treasurer has no name today)
photo_url text,               -- nullable, Supabase Storage public URL
sort_order int not null       -- controls display order, matches today's fixed array order
```

Outlines keeps its current level → semester grouping for display (same as Resources) — the admin form is still a flat "add one course" form, the page groups rows by `level`/`semester` client-side exactly as it does today.

Public pages fetch with the anon key (read-only, see RLS below) and keep their existing sort/filter/grouping helpers (`getNews`, `filterNewsByCategory`, `getOpportunities`, resources/outlines grouping by level/semester) as pure functions over the fetched rows — same pattern as today, just fed by a Supabase query instead of a literal array.

### Admin UI: one generic builder, six configs

New `src/pages/admin/` area:
- `AdminResourceList.jsx` — table of rows for a content type, with Edit/Delete/Add New actions.
- `AdminResourceForm.jsx` — renders fields from a config (`text`, `textarea`, `list`, `date`, `url`, `select`, `number`, `image`, `avatar`), handles create and edit.
  - `list` — a textarea where each line becomes one array item on save (used for `topics`/`texts`).
  - `image` vs `avatar` — both upload to Storage, but `image` (News) adds the drag-resize control, `avatar` (Excos) auto-crops to a square and stores no size field.
- Six config objects (`newsAdminConfig`, `opportunitiesAdminConfig`, `eventsAdminConfig`, `resourcesAdminConfig`, `outlinesAdminConfig`, `excosAdminConfig`) each listing `{ field, label, type, options? }` — the only per-content-type code.
- `Admin.jsx` becomes a small landing page linking to `/admin/news`, `/admin/opportunities`, `/admin/events`, `/admin/resources`, `/admin/outlines`, `/admin/excos`, each rendering `AdminResourceList` + the matching config.

### Images

News' `image` field type in `AdminResourceForm` is an upload widget (Supabase Storage bucket `news-images`) plus a drag handle on the image preview, per the approved mockup. Dragging sets `image_width_pct`, clamped to **30–100** and stored as a relative percentage (not raw pixels), so:
- it can never be dragged small enough to be pointless or large enough to break the layout,
- it scales proportionally on mobile automatically, since it's a percentage of the card width, not a fixed pixel size.

`News.jsx`/`NewsDetail.jsx` apply it as inline `width: {image_width_pct}%` on the image element; absence of a value (older/no-image posts) falls back to the current fixed illustration behavior.

Excos' `avatar` field type (Storage bucket `exco-photos`) is upload-only: no drag handle, the widget auto-crops to a centered square on upload since it always renders at the same fixed circular size (`Home.jsx`'s existing 120×120 circle). `Home.jsx` renders `photo_url` in that circle if present, falling back to the current initial-letter placeholder otherwise (so a still-vacant or photo-less seat looks exactly as it does today).

### Auth & security

Reuses the existing `AuthContext`/Supabase Auth session — no new login mechanism. A new `admins` table gates writes:

```sql
admins ( user_id uuid primary key references auth.users(id) )
```

RLS policy on all six content tables and the `news-images`/`exco-photos` storage buckets:
- `select`: allowed for everyone (`true`) — public site keeps working with the anon key.
- `insert` / `update` / `delete`: only if `auth.uid()` exists in `admins`.

`/admin/*` routes check `useAuth()` for a session and redirect to `/login` if absent; the admin-membership check itself only needs to be enforced by RLS (the database is the real gate — the UI check is just for a clean logged-out experience, not security).

## Error handling

- Form validation (required fields, valid URL/date) happens client-side before submit, reusing the existing `FormField error` pattern from the auth forms.
- A write rejected by RLS (non-admin somehow reaches the form) surfaces as a generic inline error — same as any other Supabase error today.
- Image upload failures (wrong file type, too large) show inline under the image field; the size limit and accepted types are enforced both in the widget and by the Storage bucket's own config.
- Empty content lists keep their existing empty-state copy ("No news posts in this category yet.", etc.).

## Testing

Consistent with this project's existing approach (pure functions get Vitest coverage, presentational/integration behavior is verified manually against the dev server):
- The `image_width_pct` clamp function (`clampImageWidth(value)` → clamps to 30–100) gets direct unit tests.
- The `list`-field split/join helpers (textarea lines ↔ `text[]`, used by `topics`/`texts`) get direct unit tests.
- Existing sort/filter/grouping helpers (`filterNewsByCategory`, `getOpportunities`, resources/outlines grouping by level/semester) keep their current tests, adjusted to operate on Supabase-shaped rows instead of the literal arrays.
- Admin CRUD flows (create/edit/delete for each of the six types, RLS rejecting a non-admin, image upload + resize, avatar upload + crop) are manually verified via the running dev server, same as the auth spec's verification approach — no Supabase mocking infra exists in this project yet, and building one isn't justified for the time remaining.

## Priority if time runs short

Build order, most-needed first: **News → Opportunities → Events → Resources → Excos → Outlines.** News and Opportunities will need the most frequent updates (announcements, deadlines); Excos is cheap to build (same shape as Events) and fixes a real current gap (no photos at all today). Outlines goes last — it's the largest existing dataset to migrate and the only type with array-valued fields, so it carries the most build + migration cost. If the 19th arrives before all six are done, whichever is left simply stays static a while longer and gets migrated in a later session using the same pattern.

## Fallback for unplanned needs

Not built now, documented for later:
- **Data-only tweaks the admin form doesn't cover:** Supabase's own table editor (supabase.com dashboard) can edit any row directly — no code, just a plainer UI than the in-app admin.
- **A genuine new feature/page:** would need either a short freelance engagement or a one-off month of Claude Code — there's no no-code path to new functionality, and none is being built speculatively here.
