# Events Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins upload a multi-photo gallery to any event, and let students browse and download those photos (single or all-as-zip) from a new per-event detail page.

**Architecture:** A new `event_photos` table (many rows per event) backed by a new `event-gallery` Storage bucket, mirroring the RLS/policy shape already used for `event-images`/`news-images`/`exco-photos`. Events gains its first detail page (`/events/:id`, Details + Gallery tabs) since a gallery needs somewhere to live; `Events.jsx` cards become links to it, matching how `News.jsx` cards already link to `/news/:id`. Admin gallery management is a separate page (`/admin/events/:id/gallery`) reached via a new generic `renderRowExtra` slot on the shared `AdminResourceList`/`AdminResourceManager` components, rather than folding multi-file upload into the existing single-cover-photo `AdminResourceForm` field.

**Tech Stack:** React (Vite), Tailwind CSS v4, Supabase (Postgres + Storage), TanStack Query, React Router. New dependency: `jszip` (client-side zip for "Download all").

**Spec:** `docs/superpowers/specs/2026-09-03-events-gallery-design.md`

## Global Constraints

- Design tokens only — no raw hex values in class names.
- Gallery photos and lightbox images stay decorative (`alt=""`); interactive lightbox controls (close/prev/next/download) get real `aria-label`s.
- 5MB file-size cap and image-type-only validation on every upload, matching the existing messages exactly ("Please choose an image file.", "Image must be smaller than 5MB.").
- No captions, no reordering, no moderation queue, no video — out of scope per the spec.
- Lint (`npm run lint`) and build (`npm run build`) must stay clean after every task.
- Don't touch `ImageUploadField.jsx`, `AvatarUploadField.jsx`, `EventImageUploadField.jsx`, or any News/Excos/Outlines/Resources/Opportunities files — this plan only adds new files/routes and makes small additive changes to shared admin components.
- Supabase project id for all migration/verification calls: `ascdypvchlbpfupsssuy` (same project used by the prior Events photo-upload plan).

---

### Task 1: Supabase schema + storage bucket

**Files:** none (Supabase migration only, applied via the `apply_migration` MCP tool)

**Interfaces:**
- Produces: `event_photos` table (`id uuid primary key default gen_random_uuid()`, `event_id text not null references events(id) on delete cascade`, `image_url text not null`, `created_at timestamptz not null default now()`), RLS enabled with public select + admin-only insert/delete; `event-gallery` Storage bucket (public read, admin-gated insert/delete, no update policy).

- [ ] **Step 1: Apply the migration**

Call `apply_migration` (project_id `ascdypvchlbpfupsssuy`, name `event_photos_gallery`) with:

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

insert into storage.buckets (id, name, public) values ('event-gallery', 'event-gallery', true);

create policy "event_gallery_public_select" on storage.objects for select
  to public using (bucket_id = 'event-gallery');

create policy "event_gallery_admin_insert" on storage.objects for insert
  to public with check (bucket_id = 'event-gallery' and auth.uid() in (select user_id from admins));

create policy "event_gallery_admin_delete" on storage.objects for delete
  to public using (bucket_id = 'event-gallery' and auth.uid() in (select user_id from admins));
```

- [ ] **Step 2: Verify the table exists with RLS enabled**

Call `list_tables` (project_id `ascdypvchlbpfupsssuy`, schemas `["public"]`, verbose `true`) and confirm `public.event_photos` exists with columns `id` (uuid), `event_id` (text), `image_url` (text, not null), `created_at` (timestamptz), and `rls_enabled: true`.

- [ ] **Step 3: Verify the table policies**

Call `execute_sql` (project_id `ascdypvchlbpfupsssuy`) with:
```sql
select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'event_photos' order by policyname;
```
Expected: 3 rows (`event_photos_admin_delete`/`DELETE`, `event_photos_admin_insert`/`INSERT`, `event_photos_public_select`/`SELECT`).

- [ ] **Step 4: Verify the bucket and its policies**

Call `execute_sql` (project_id `ascdypvchlbpfupsssuy`) with:
```sql
select id, public from storage.buckets where id = 'event-gallery';
```
Expected: one row, `public = true`.

```sql
select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'event_gallery%' order by policyname;
```
Expected: 3 rows (`event_gallery_admin_delete`/`DELETE`, `event_gallery_admin_insert`/`INSERT`, `event_gallery_public_select`/`SELECT`).

No commit for this task — it's a database change, not a file change.

---

### Task 2: Data layer — `getEventById` and `eventPhotos` queries

**Files:**
- Modify: `src/data/events.js`
- Modify: `src/data/events.test.js`
- Create: `src/data/eventPhotos.js`

**Interfaces:**
- Consumes: `event_photos` table from Task 1.
- Produces: `getEventById(list, id)` (returns the matching event object or `undefined`, same shape as `getNewsById`); `fetchEventPhotos(eventId)` (returns an array of `{ id, event_id, image_url, created_at }` rows, oldest first); `useEventPhotosQuery(eventId)` (TanStack Query hook, `queryKey: ['event_photos', eventId]`).

- [ ] **Step 1: Write the failing test for `getEventById`**

In `src/data/events.test.js`, change the import line:
```js
import { groupEventsByTime } from './events'
```
to:
```js
import { groupEventsByTime, getEventById } from './events'
```

Then append this new `describe` block at the end of the file:

```js
describe('getEventById', () => {
  it('finds an event by id', () => {
    expect(getEventById(fixture, 'b').title).toBe('Next seminar')
  })
  it('returns undefined for an unknown id', () => {
    expect(getEventById(fixture, 'does-not-exist')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- events.test.js`
Expected: FAIL — `getEventById is not a function` (or `undefined is not a function`).

- [ ] **Step 3: Implement `getEventById`**

In `src/data/events.js`, add this export (same shape as `getNewsById` in `src/data/news.js`):

```js
export function getEventById(list, id) {
  return list.find((e) => String(e.id) === id)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- events.test.js`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Create `src/data/eventPhotos.js`**

No test for this file — it's Supabase/react-query wiring, not pure logic, matching the existing convention in this codebase where `fetchEvents`/`useEventsQuery` (in `events.js`) and `fetchNews`/`useNewsQuery` (in `news.js`) are also untested; only the pure functions alongside them (`groupEventsByTime`, `getNewsById`) get unit tests.

```js
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchEventPhotos(eventId) {
  const { data, error } = await supabase
    .from('event_photos')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export function useEventPhotosQuery(eventId) {
  return useQuery({
    queryKey: ['event_photos', eventId],
    queryFn: () => fetchEventPhotos(eventId),
    enabled: Boolean(eventId),
  })
}
```

- [ ] **Step 6: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
git add src/data/events.js src/data/events.test.js src/data/eventPhotos.js
git commit -m "$(cat <<'EOF'
feat: add getEventById and an event_photos query hook

getEventById mirrors news.js's getNewsById so EventDetail/AdminEventGallery
can find a single event out of the already-cached events list, the same
way NewsDetail does. eventPhotos.js is new Supabase wiring for the
upcoming per-event gallery feature.
EOF
)"
```

---

### Task 3: Admin gallery management page

**Files:**
- Modify: `src/components/admin/AdminResourceList.jsx`
- Modify: `src/components/admin/AdminResourceManager.jsx`
- Modify: `src/pages/admin/AdminEvents.jsx`
- Create: `src/pages/admin/AdminEventGallery.jsx`
- Modify: `src/App.jsx`
- Modify: `ADMIN.md`

**Interfaces:**
- Consumes: `event_photos` table + `event-gallery` bucket from Task 1; `getEventById`/`useEventsQuery` from `src/data/events.js`; `useEventPhotosQuery` from Task 2's `src/data/eventPhotos.js`; `useToast` from `src/lib/ToastContext.jsx`.
- Produces: `AdminResourceList`/`AdminResourceManager` gain an optional `renderRowExtra(row)` prop (a function returning a React node, rendered in the actions cell) — unused by every section except Events, so News/Opportunities/Resources/Excos/Outlines admin pages are unaffected.

- [ ] **Step 1: Add `renderRowExtra` to `AdminResourceList.jsx`**

Change the function signature:
```jsx
export default function AdminResourceList({ config, rows, onEdit, onDelete, emptyLabel }) {
```
to:
```jsx
export default function AdminResourceList({ config, rows, onEdit, onDelete, emptyLabel, renderRowExtra }) {
```

Then in the actions cell, add the extra slot right before the Edit button:
```jsx
    <div key={row.id} className="flex justify-center gap-3">
      <button
        type="button"
        title="Edit"
```
becomes:
```jsx
    <div key={row.id} className="flex justify-center gap-3">
      {renderRowExtra && renderRowExtra(row)}
      <button
        type="button"
        title="Edit"
```

- [ ] **Step 2: Forward `renderRowExtra` through `AdminResourceManager.jsx`**

Change the function signature:
```jsx
export default function AdminResourceManager({ table, title, config, orderBy }) {
```
to:
```jsx
export default function AdminResourceManager({ table, title, config, orderBy, renderRowExtra }) {
```

Then pass it through to `AdminResourceList`:
```jsx
            <AdminResourceList
              config={config}
              rows={filteredRows}
              onEdit={setEditing}
              onDelete={(row) => deleteMutation.mutate(row)}
              emptyLabel={
```
becomes:
```jsx
            <AdminResourceList
              config={config}
              rows={filteredRows}
              onEdit={setEditing}
              onDelete={(row) => deleteMutation.mutate(row)}
              renderRowExtra={renderRowExtra}
              emptyLabel={
```

- [ ] **Step 3: Wire the "Gallery" action into `AdminEvents.jsx`**

Replace the full file with:

```jsx
import { Link } from 'react-router-dom'
import AdminResourceManager from '../../components/admin/AdminResourceManager'
import { eventsAdminConfig } from './config/eventsAdminConfig'

export default function AdminEvents() {
  return (
    <AdminResourceManager
      table="events"
      title="Events"
      config={eventsAdminConfig}
      orderBy={{ column: 'created_at', ascending: true }}
      renderRowExtra={(row) => (
        <Link
          to={`/admin/events/${row.id}/gallery`}
          title="Manage gallery"
          className="text-ink-muted transition-colors hover:text-green-900"
        >
          <span className="material-symbols-outlined text-xl">photo_library</span>
        </Link>
      )}
    />
  )
}
```

- [ ] **Step 4: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed (confirms the `renderRowExtra` plumbing alone doesn't break anything before the page it points to exists).

- [ ] **Step 5: Create `src/pages/admin/AdminEventGallery.jsx`**

```jsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useEventsQuery, getEventById } from '../../data/events'
import { useEventPhotosQuery } from '../../data/eventPhotos'
import Breadcrumbs from '../../components/Breadcrumbs'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { useToast } from '../../lib/ToastContext'

async function uploadOnePhoto(eventId, file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be smaller than 5MB.')
  }
  const path = `${eventId}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`
  const { error: uploadError } = await supabase.storage.from('event-gallery').upload(path, file)
  if (uploadError) throw uploadError
  const { data } = supabase.storage.from('event-gallery').getPublicUrl(path)
  const { error: insertError } = await supabase
    .from('event_photos')
    .insert({ event_id: eventId, image_url: data.publicUrl })
  if (insertError) throw insertError
}

export default function AdminEventGallery() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [uploadProgress, setUploadProgress] = useState(null)

  const eventsQuery = useEventsQuery()
  const event = getEventById(eventsQuery.data ?? [], id)

  const photosQuery = useEventPhotosQuery(id)
  const photos = photosQuery.data ?? []

  const uploadMutation = useMutation({
    mutationFn: async (files) => {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress({ done: i, total: files.length })
        await uploadOnePhoto(id, files[i])
      }
    },
    onSuccess: (_data, files) => {
      queryClient.invalidateQueries({ queryKey: ['event_photos', id] })
      toast.success(`${files.length} photo${files.length === 1 ? '' : 's'} added.`)
    },
    onError: (error) => {
      toast.error(error.message)
    },
    onSettled: () => {
      setUploadProgress(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (photo) => {
      const path = photo.image_url.split('/event-gallery/')[1]
      if (path) await supabase.storage.from('event-gallery').remove([decodeURIComponent(path)])
      const { error } = await supabase.from('event_photos').delete().eq('id', photo.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event_photos', id] })
      toast.success('Photo removed.')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  function handleFileChange(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    uploadMutation.mutate(files)
    e.target.value = ''
  }

  if (eventsQuery.isError && !eventsQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this event right now." onRetry={eventsQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs
        items={[
          { label: 'Admin', to: '/admin' },
          { label: 'Events', to: '/admin/events' },
          { label: event ? event.title : '…' },
        ]}
      />

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-900">Gallery{event ? `: ${event.title}` : ''}</h1>
          <p className="mt-1 text-ink-muted">Upload and remove photos for this event's gallery.</p>
        </div>
        <Link
          to="/admin/events"
          className="inline-flex items-center gap-1 text-sm font-semibold text-green-900 no-underline hover:text-orange-500 hover:underline"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to Events
        </Link>
      </div>

      <label className="mt-6 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-hairline bg-surface-low p-8 text-center transition-colors hover:bg-hairline/20">
        <span className="material-symbols-outlined text-3xl text-ink-muted">add_photo_alternate</span>
        <span className="text-sm font-semibold text-ink-muted">
          {uploadProgress ? `Uploading ${uploadProgress.done + 1} of ${uploadProgress.total}…` : 'Click to upload photos'}
        </span>
        <span className="text-xs text-ink-muted">JPEG, PNG up to 5MB each — select multiple at once</span>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          disabled={Boolean(uploadProgress)}
          className="hidden"
        />
      </label>

      {photosQuery.isError && !photosQuery.data ? (
        <div className="mt-6">
          <ErrorState message="Couldn't load this gallery right now." onRetry={photosQuery.refetch} />
        </div>
      ) : photos.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon="photo_library" title="No photos yet" description="Uploaded photos will show up here." />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-low shadow-md">
              <img src={photo.image_url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => deleteMutation.mutate(photo)}
                aria-label="Delete photo"
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-danger text-white shadow-md transition-transform hover:scale-105"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Add the admin route in `src/App.jsx`**

Add the lazy import next to the other admin imports:
```js
const AdminEvents = lazy(() => import('./pages/admin/AdminEvents'))
```
becomes:
```js
const AdminEvents = lazy(() => import('./pages/admin/AdminEvents'))
const AdminEventGallery = lazy(() => import('./pages/admin/AdminEventGallery'))
```

Add the route inside the `<Route element={<ProtectedRoute />}>` block, right after the existing Events admin route:
```jsx
            <Route path="admin/events" element={<AdminEvents />} />
```
becomes:
```jsx
            <Route path="admin/events" element={<AdminEvents />} />
            <Route path="admin/events/:id/gallery" element={<AdminEventGallery />} />
```

- [ ] **Step 7: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 8: Update `ADMIN.md`**

Replace:
```
- **Events** — entries on the `/events` page.
```
with:
```
- **Events** — entries on the `/events` page. Each row also has a **Gallery** icon
  that opens a page for uploading and removing that event's photo gallery (separate
  from the single cover photo shown on the events list).
```

Replace:
```
News photos, Event photos, and Exco photos are capped at **5MB**, image files only. If
an upload is rejected, it's almost always the file size or the file type — resize/compress
or pick a `.jpg`/`.png`.
```
with:
```
News photos, Event cover/gallery photos, and Exco photos are capped at **5MB**, image
files only. If an upload is rejected, it's almost always the file size or the file
type — resize/compress or pick a `.jpg`/`.png`.
```

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/AdminResourceList.jsx src/components/admin/AdminResourceManager.jsx src/pages/admin/AdminEvents.jsx src/pages/admin/AdminEventGallery.jsx src/App.jsx ADMIN.md
git commit -m "$(cat <<'EOF'
feat: add admin gallery management for events

AdminResourceList/Manager gain an optional renderRowExtra slot (unused
by every other admin section) so Events can add a per-row "Gallery"
action. AdminEventGallery lets admins multi-file upload and delete
photos for one event's gallery, separate from the existing single
cover-photo field.
EOF
)"
```

---

### Task 4: Public event detail page — gallery, lightbox, downloads

**Files:**
- Create: `src/lib/downloadImage.js`
- Create: `src/components/GalleryLightbox.jsx`
- Create: `src/pages/EventDetail.jsx`
- Modify: `src/App.jsx`
- Modify: `package.json` (and `package-lock.json`, via `npm install`)
- Modify: `DESIGN_SYSTEM.md`

**Interfaces:**
- Consumes: `useEventsQuery`/`getEventById` (`src/data/events.js`), `useEventPhotosQuery` (Task 2's `src/data/eventPhotos.js`).
- Produces: `downloadImage(url, filename)` (fetches a URL as a blob and triggers a save) and `saveBlob(blob, filename)` (the shared save mechanic, also used for the zip); `GalleryLightbox` component — props `{ photos, index, onIndexChange, onClose }`, a controlled full-screen viewer (no internal open/closed state — the parent owns "which index is open, or null").

- [ ] **Step 1: Install `jszip`**

Run: `npm install jszip`
Expected: `package.json` and `package-lock.json` gain a `jszip` entry.

- [ ] **Step 2: Create `src/lib/downloadImage.js`**

```js
export function saveBlob(blob, filename) {
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(blobUrl)
}

export async function downloadImage(url, filename) {
  const response = await fetch(url)
  const blob = await response.blob()
  saveBlob(blob, filename)
}
```

No unit test for this file — it's pure DOM/network side effects (`fetch`, `URL.createObjectURL`, a synthetic click), the same category as the existing upload fields (`AvatarUploadField.jsx`, `EventImageUploadField.jsx`), which are also untested and verified by inspection/manual use instead.

- [ ] **Step 3: Create `src/components/GalleryLightbox.jsx`**

```jsx
import { useEffect, useRef } from 'react'
import { downloadImage } from '../lib/downloadImage'

export default function GalleryLightbox({ photos, index, onIndexChange, onClose }) {
  const dialogRef = useRef(null)
  const photo = photos[index]

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndexChange(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [index, photos.length, onIndexChange, onClose])

  if (!photo) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Photo viewer"
        tabIndex={-1}
        className="relative flex max-h-full max-w-4xl flex-col items-center outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={photo.image_url} alt="" className="max-h-[80vh] max-w-full rounded-md object-contain" />

        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => onIndexChange(index - 1)}
            disabled={index === 0}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink-900 shadow-md disabled:opacity-40"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button
            type="button"
            aria-label="Download this photo"
            onClick={() => downloadImage(photo.image_url, `photo-${photo.id}.jpg`)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink-900 shadow-md hover:text-green-900"
          >
            <span className="material-symbols-outlined">download</span>
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => onIndexChange(index + 1)}
            disabled={index === photos.length - 1}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink-900 shadow-md disabled:opacity-40"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>

        <button
          type="button"
          aria-label="Close photo viewer"
          onClick={onClose}
          className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-danger text-white shadow-md hover:scale-105"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/pages/EventDetail.jsx`**

```jsx
import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import JSZip from 'jszip'
import Breadcrumbs from '../components/Breadcrumbs'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { SkeletonText } from '../components/ui/Skeleton'
import GalleryLightbox from '../components/GalleryLightbox'
import { saveBlob } from '../lib/downloadImage'
import { useEventsQuery, getEventById } from '../data/events'
import { useEventPhotosQuery } from '../data/eventPhotos'

export default function EventDetail() {
  const { id } = useParams()
  const [tab, setTab] = useState('details')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [zipping, setZipping] = useState(false)

  const eventsQuery = useEventsQuery()
  const photosQuery = useEventPhotosQuery(id)
  const photos = photosQuery.data ?? []

  if (eventsQuery.isError && !eventsQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this event right now." onRetry={eventsQuery.refetch} />
      </div>
    )
  }

  if (eventsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <div className="h-4 w-48 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-4 h-8 w-2/3 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-6 h-64 w-full animate-pulse rounded-lg bg-hairline" />
        <div className="mt-6">
          <SkeletonText lines={4} />
        </div>
      </div>
    )
  }

  const event = getEventById(eventsQuery.data ?? [], id)
  if (!event) return <Navigate to="/events" replace />

  async function handleDownloadAll() {
    setZipping(true)
    try {
      const zip = new JSZip()
      for (let i = 0; i < photos.length; i++) {
        const response = await fetch(photos[i].image_url)
        const blob = await response.blob()
        zip.file(`photo-${i + 1}.jpg`, blob)
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      saveBlob(zipBlob, `${event.title}-photos.zip`)
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Events', to: '/events' }, { label: event.title }]} />

      <h1 className="mt-1.5 text-3xl font-bold text-ink-900">{event.title}</h1>

      <div className="mt-6 flex gap-2 border-b border-hairline">
        <button
          type="button"
          onClick={() => setTab('details')}
          className={[
            'px-4 py-2 text-sm font-semibold border-b-2 -mb-px',
            tab === 'details' ? 'border-green-900 text-green-900' : 'border-transparent text-ink-muted',
          ].join(' ')}
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => setTab('gallery')}
          className={[
            'px-4 py-2 text-sm font-semibold border-b-2 -mb-px',
            tab === 'gallery' ? 'border-green-900 text-green-900' : 'border-transparent text-ink-muted',
          ].join(' ')}
        >
          Gallery{photos.length > 0 ? ` (${photos.length})` : ''}
        </button>
      </div>

      {tab === 'details' ? (
        <div className="mt-6">
          {event.image_url && <img src={event.image_url} alt="" className="w-full rounded-lg" />}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <span>{event.date}</span>
            {event.meta && (
              <>
                <span aria-hidden="true">&middot;</span>
                <span>{event.meta}</span>
              </>
            )}
          </div>
          <p className="mt-4 max-w-2xl leading-relaxed text-ink">{event.description}</p>
        </div>
      ) : (
        <div className="mt-6">
          {photosQuery.isError && !photosQuery.data ? (
            <ErrorState message="Couldn't load this gallery right now." onRetry={photosQuery.refetch} />
          ) : photos.length === 0 ? (
            <EmptyState
              icon="photo_library"
              title="No photos yet"
              description="Photos from this event will show up here once they're added."
            />
          ) : (
            <>
              <div className="mb-4 flex justify-end">
                <Button variant="secondary" size="sm" onClick={handleDownloadAll} loading={zipping}>
                  <span className="material-symbols-outlined text-base">download</span>
                  Download all
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((photo, i) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className="aspect-[4/3] overflow-hidden rounded-md bg-surface-low shadow-md transition-transform hover:scale-[1.02]"
                  >
                    <img src={photo.image_url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {lightboxIndex !== null && (
        <GalleryLightbox
          photos={photos}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Add the public route in `src/App.jsx`**

Add the lazy import next to the other public page imports:
```js
const Events = lazy(() => import('./pages/Events'))
```
becomes:
```js
const Events = lazy(() => import('./pages/Events'))
const EventDetail = lazy(() => import('./pages/EventDetail'))
```

Add the route right after the existing Events route:
```jsx
          <Route path="events" element={<Events />} />
```
becomes:
```jsx
          <Route path="events" element={<Events />} />
          <Route path="events/:id" element={<EventDetail />} />
```

- [ ] **Step 6: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 7: Update the Events line in `DESIGN_SYSTEM.md`**

Replace:
```
- **Events** (`src/pages/Events.jsx`) — 3-col grid of Cards showing a full-bleed cover photo (`imageVariant="cover"`) when an event has one uploaded, otherwise just the colored tone block (no icon).
```
with:
```
- **Events** (`src/pages/Events.jsx`) — cards grouped into Upcoming/Past sections, each showing a full-bleed cover photo when uploaded (otherwise just the colored tone block), linking to `/events/:id` for a **Details** (same content as the card) / **Gallery** tabbed detail page (`src/pages/EventDetail.jsx`). The Gallery tab supports per-photo and "download all" (zip) downloads via a lightbox (`src/components/GalleryLightbox.jsx`).
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/downloadImage.js src/components/GalleryLightbox.jsx src/pages/EventDetail.jsx src/App.jsx package.json package-lock.json DESIGN_SYSTEM.md
git commit -m "$(cat <<'EOF'
feat: add event detail page with photo gallery and downloads

New /events/:id page with Details/Gallery tabs. Gallery tab shows a
lightbox (prev/next, per-photo download) and a "Download all" zip
button. Storage URLs are cross-origin so a plain download attribute
won't force a save -- downloadImage/saveBlob fetch-as-blob instead.
EOF
)"
```

---

### Task 5: Events list links to the detail page

**Files:**
- Modify: `src/pages/Events.jsx`

**Interfaces:**
- Consumes: `/events/:id` route from Task 4.

- [ ] **Step 1: Wrap `EventCard` in a `Link`**

Add the import at the top:
```js
import PageBanner from '../components/PageBanner'
```
becomes:
```js
import { Link } from 'react-router-dom'
import PageBanner from '../components/PageBanner'
```

Replace the `EventCard` function:
```jsx
function EventCard({ event }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-md transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md">
      {event.image_url && <img src={event.image_url} alt="" className="h-48 w-full object-cover" />}
      <div className="flex flex-grow flex-col gap-2 p-6">
```
with:
```jsx
function EventCard({ event }) {
  return (
    <Link
      to={`/events/${event.id}`}
      className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-md transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md"
    >
      {event.image_url && <img src={event.image_url} alt="" className="h-48 w-full object-cover" />}
      <div className="flex flex-grow flex-col gap-2 p-6">
```

Then close it with `</Link>` instead of `</article>`:
```jsx
      </div>
    </article>
  )
}
```
becomes:
```jsx
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Events.jsx
git commit -m "$(cat <<'EOF'
feat: link Events cards to their detail page

Matches how News cards already link to /news/:id. Events is no longer
list-only now that each event has a Details/Gallery detail page.
EOF
)"
```

---

### Task 6: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including the new `getEventById` tests from Task 2.

- [ ] **Step 2: Seed temporary gallery photos**

The admin upload flow needs a logged-in admin session this verification pass doesn't have — so seed test data directly via `execute_sql` (project_id `ascdypvchlbpfupsssuy`) to verify the *display/download* paths end-to-end:

```sql
select id, title from events order by created_at limit 1;
```
then, using the returned `id`:
```sql
insert into event_photos (event_id, image_url) values
  ('<id-from-above>', 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=800&q=80'),
  ('<id-from-above>', 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80'),
  ('<id-from-above>', 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80');
```

- [ ] **Step 3: Start the dev server and verify the public flow**

Run: `npm run dev` (background), open `/events` in a browser. Confirm:
- The seeded event's card links to `/events/<id>` (not a dead click).
- On the detail page, the Details tab shows the same title/date/meta/description as the card.
- The Gallery tab shows "Gallery (3)" and the three seeded thumbnails.
- Clicking a thumbnail opens the lightbox; prev/next navigate, Escape and the close button both close it, the download button on a photo saves a real image file (not a new tab).
- "Download all" produces a `.zip` file containing 3 images.
- An event with zero gallery photos shows the "No photos yet" empty state on its Gallery tab.

- [ ] **Step 4: Clean up the seeded data**

```sql
delete from event_photos where event_id = '<id-from-step-2>';
```

- [ ] **Step 5: Confirm other admin sections are unaffected**

Open `/admin` → News, Opportunities, Resources, Excos, Outlines — confirm each still renders its list/form exactly as before (the `renderRowExtra` prop is optional and only Events passes it).

- [ ] **Step 6: Stop the dev server**

Kill the `npm run dev` process started in Step 3.

- [ ] **Step 7: Flag the remaining manual check to the user**

Report to the user: the authenticated admin flow itself (Admin → Events → Gallery icon → select multiple files → confirm upload progress, thumbnails, and delete-per-photo all work) needs a spot-check with real admin credentials, since this verification pass could only test the display/download paths, not the authenticated upload/delete flow.
