# Events: per-event photo gallery

Date: 2026-09-03

## Problem

Events currently supports exactly one photo per event (`events.image_url`, added in `2026-08-10-events-photo-upload-design.md`) shown as a card cover image, and `/events` is list-only with no detail page (`2026-07-26-news-opportunities-design.md` decided against one). The user wants each event to have a full photo gallery: admins upload many photos to a given event, and students can browse and download them. That needs somewhere to put a gallery UI, which means Events needs a detail page after all.

## Decision

Add a `/events/:id` detail page with **Details** / **Gallery** tabs, backed by a new `event_photos` table (one event has many photos) and its own Storage bucket, separate from the existing single `image_url` cover photo. Admin gallery management lives on its own page (`/admin/events/:id/gallery`) reached via a new per-row action in Admin > Events, rather than folding multi-file upload into the existing single-photo `AdminResourceForm` field.

Confirmed with the user: both per-photo download and a "download all" zip are in scope; gallery uploads are multi-file (pick several at once) rather than one-at-a-time.

**Out of scope** (and why): captions/alt text (no existing photo field in this codebase has one — would be inventing a need); reordering (photos are inherently chronological — upload order via `created_at` is already the meaningful order); a moderation/approval queue (only admins can upload at all, same `admins`-table gate as everything else — no untrusted-submitter path to moderate); video (explicitly asked for "pictures"; video is a different shape of problem — players, poster frames, larger files).

## Scope

| Layer | Change |
|---|---|
| Supabase `event_photos` table | New table: `id uuid default gen_random_uuid() primary key`, `event_id text references events(id) on delete cascade`, `image_url text not null`, `created_at timestamptz not null default now()` |
| Supabase Storage | New `event-gallery` bucket (public read, admin-gated write) — mirrors `event-images` policies; objects stored at `${eventId}/${timestamp}-${filename}` |
| `src/data/events.js` | Add `getEventById(list, id)` |
| `src/data/eventPhotos.js` (new) | `fetchEventPhotos(eventId)`, `useEventPhotosQuery(eventId)` |
| `src/lib/downloadImage.js` (new) | `downloadImage(url, filename)` — fetch-as-blob + synthetic click, since Storage URLs are cross-origin and the `download` attribute alone won't force a save |
| `src/components/GalleryLightbox.jsx` (new) | Full-screen photo viewer: prev/next, close, per-photo download button |
| `src/pages/EventDetail.jsx` (new) | `/events/:id` — Details / Gallery tabs |
| `src/pages/Events.jsx` | Cards become `Link`s to `/events/:id` (matches News' card-links-to-detail pattern) |
| `src/components/admin/AdminResourceList.jsx` | Add optional `renderRowExtra(row)` prop — generic slot, rendered next to Edit/Delete |
| `src/components/admin/AdminResourceManager.jsx` | Forward an optional `renderRowExtra` prop through to `AdminResourceList` |
| `src/pages/admin/AdminEvents.jsx` | Pass `renderRowExtra` rendering a "Gallery" icon-link to `/admin/events/:id/gallery` |
| `src/pages/admin/AdminEventGallery.jsx` (new) | `/admin/events/:id/gallery` — multi-file upload + thumbnail grid with per-photo delete |
| `src/App.jsx` | Routes: `events/:id` (public), `admin/events/:id/gallery` (protected) |
| `package.json` | Add `jszip` dependency (client-side zip for "Download all") |
| `ADMIN.md` | Note the Gallery action under the Events section |
| `DESIGN_SYSTEM.md` | Events line: mention linking to a detail page with Details/Gallery tabs |

## Database migration

```sql
create table event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete cascade,
  image_url text not null,
  created_at timestamptz not null default now()
);

alter table event_photos enable row level security;

create policy "event_photos_public_select" on event_photos for select
  to public using (true);

create policy "event_photos_admin_insert" on event_photos for insert
  to public with check (auth.uid() in (select user_id from admins));

create policy "event_photos_admin_delete" on event_photos for delete
  to public using (auth.uid() in (select user_id from admins));
```

No update policy — photos are add/remove only, never edited in place.

## Storage bucket + policies

Mirrors `event-images` (from the prior spec), new bucket so cover photos and gallery photos stay independent:

```sql
insert into storage.buckets (id, name, public) values ('event-gallery', 'event-gallery', true);

create policy "event_gallery_public_select" on storage.objects for select
  to public using (bucket_id = 'event-gallery');

create policy "event_gallery_admin_insert" on storage.objects for insert
  to public with check (bucket_id = 'event-gallery' and auth.uid() in (select user_id from admins));

create policy "event_gallery_admin_delete" on storage.objects for delete
  to public using (bucket_id = 'event-gallery' and auth.uid() in (select user_id from admins));
```

No update policy on Storage either — deleting and re-uploading is how a bad photo gets replaced, matching how the admin UI works (delete button, not an edit-in-place button).

## Admin flow

**Entry point.** `AdminResourceList` gains an optional `renderRowExtra(row)` prop rendered as an extra icon button in the actions cell, alongside Edit/Delete. It's optional and unused by every other section (News, Opportunities, Resources, Excos, Outlines) — only `AdminEvents.jsx` passes it:

```jsx
<AdminResourceManager
  table="events"
  title="Events"
  config={eventsAdminConfig}
  orderBy={{ column: 'created_at', ascending: true }}
  renderRowExtra={(row) => (
    <Link to={`/admin/events/${row.id}/gallery`} title="Manage gallery" className="text-ink-muted transition-colors hover:text-green-900">
      <span className="material-symbols-outlined text-xl">photo_library</span>
    </Link>
  )}
/>
```

`AdminResourceManager` just forwards the prop through to `AdminResourceList` unchanged.

**`AdminEventGallery.jsx`.** Loads the event (for the title in the header/breadcrumb — `supabase.from('events').select().eq('id', id).single()`) and its photos (`useEventPhotosQuery(id)`, keyed `['event_photos', id]`). A `<input type="file" multiple accept="image/*">` drives an upload mutation that, per selected file: validates type/size (same "Please choose an image file." / "Image must be smaller than 5MB." messages as `EventImageUploadField`), uploads to `event-gallery` at `${id}/${Date.now()}-${filename}`, gets the public URL, and inserts a row into `event_photos`. Files upload sequentially (simplicity over throughput — galleries are dozens of photos, not hundreds) with a small "Uploading 2 of 5…" progress indicator. Existing photos render as a thumbnail grid; each thumbnail has a delete button that removes the Storage object then the `event_photos` row, invalidating the query on success. Breadcrumb: `Admin > Events > {event.title} > Gallery`, using the existing `Breadcrumbs` component.

## Public flow

**`getEventById`** in `src/data/events.js`, same shape as `getNewsById`:

```js
export function getEventById(list, id) {
  return list.find((e) => String(e.id) === id)
}
```

**`EventDetail.jsx`** (`/events/:id`) follows `NewsDetail.jsx`'s loading/error/not-found structure exactly (skeleton while `useEventsQuery` loads, `ErrorState` on failure, `<Navigate to="/events" replace />` if the id doesn't match anything). Once loaded, renders a `Breadcrumbs` (`Events > {event.title}`) and two tab buttons, "Details" and "Gallery", local `useState` for the active tab (no need for it to be a route — matches the lightweight tone of the rest of the app, and a refresh landing back on Details is fine).

- **Details tab**: same content as today's `EventCard` — cover photo (if any), title, date, meta, description.
- **Gallery tab**: `useEventPhotosQuery(event.id)`. Zero photos → `EmptyState` ("No photos yet"). Otherwise: a "Download all" button above a responsive thumbnail grid; clicking a thumbnail opens `GalleryLightbox` with that photo, `initialIndex` set to the clicked one.

**`GalleryLightbox.jsx`** — full-screen fixed overlay (`position: fixed`, dark backdrop, `role="dialog"` `aria-modal="true"`), current photo centered, prev/next arrow buttons (disabled/hidden at the ends — no wraparound, simplest to reason about), a close button, and a download button that calls `downloadImage`. Closes on backdrop click, the close button, or Escape (a `keydown` listener while mounted). No focus-trap library — a `useEffect` moves focus to the dialog on mount and restores it to the trigger thumbnail on unmount, consistent with how the rest of this codebase favors small hand-rolled solutions over new UI dependencies (e.g. the hand-rolled admin delete-confirm inline state) except where a real capability (zipping) is genuinely missing.

**`Events.jsx`** — `EventCard`'s outer `<article>` becomes a `<Link to={`/events/${event.id}`}>`, same hover treatment it already has (`-translate-y-0.5`, shadow), matching how `News.jsx` wraps its cards.

## Download mechanics

`src/lib/downloadImage.js`:

```js
export async function downloadImage(url, filename) {
  const response = await fetch(url)
  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(blobUrl)
}
```

Used directly for a single photo's download button. "Download all" (in `EventDetail.jsx`'s Gallery tab) fetches every photo as a blob, adds each to a `JSZip` instance, generates the zip blob, and reuses the same blob-URL-download trick to save `${event.title}-photos.zip`. `jszip` is added as a dependency — no existing package in this codebase does client-side zipping, and this is the one piece of the feature that's a genuine new capability rather than a recombination of existing patterns.

## Docs

- `ADMIN.md`: under the Events bullet, add that a "Gallery" icon per event row opens a page for uploading/removing that event's photo gallery, separate from the single cover photo.
- `DESIGN_SYSTEM.md`: the Events line changes from "3-col grid of Cards showing a full-bleed cover photo…" to also note cards link to a detail page with Details/Gallery tabs.

## Accessibility

- Gallery thumbnails and lightbox image are decorative relative to surrounding text in the same way News/Events cover photos already are (`alt=""`), except the lightbox's own controls (close/prev/next/download) get real `aria-label`s since they're interactive, not decorative.
- `GalleryLightbox` is a `role="dialog"` `aria-modal="true"` with focus moved in on open and restored on close, and closes on Escape — the minimum needed for a modal to not trap keyboard/screen-reader users, given there's no existing modal component or dependency in this codebase to lean on.

## Testing

Pure-function coverage: `getEventById` (mirrors existing `getNewsById`/`getEventById`-style tests already in `src/data/events.test.js`). `downloadImage` and the zip flow are almost entirely side effects (fetch, DOM, object URLs) — verified by inspection/manual testing like the existing upload features, not unit tests.

Manual verification: upload several photos to an event via `/admin/events/:id/gallery`, confirm they appear in that event's `/events/:id` Gallery tab; confirm an event with zero gallery photos shows the empty state; confirm per-photo download and "Download all" both produce real saved files (not new tabs); confirm deleting a photo in admin removes it from the public gallery; confirm the existing single-cover-photo flow (Details tab, Events list cards) is unaffected; confirm News/Excos/Outlines/Resources/Opportunities admin sections are unaffected by the `renderRowExtra` addition (prop is optional and unused there).
