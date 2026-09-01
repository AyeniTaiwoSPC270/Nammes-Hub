# Events Photo Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins attach a real photo to an event (mirroring News' cover-photo cards), replacing the small fixed tone icon Events cards show today.

**Architecture:** Add an `image_url` column to the `events` table and a dedicated `event-images` Storage bucket (mirroring `news-images`'s RLS policies exactly). A new `EventImageUploadField` component (copy of `AvatarUploadField`'s upload-and-preview shape, no resize UI — Events has nothing for a width percentage to control) plugs into the existing `AdminResourceForm`/`eventsAdminConfig` admin CRUD infrastructure via a new `'event-image'` field type. `Events.jsx` switches its `Card` usage from `imageVariant="icon"` (the tone icon) to `imageVariant="cover"`.

**Tech Stack:** React (Vite), Tailwind CSS v4, Supabase (Postgres + Storage), no new dependencies.

## Global Constraints

- Design tokens only — no raw hex values in class names.
- All uploaded images stay decorative: `alt=""` (handled by `Card`'s existing `imageVariant="cover"` implementation — no new alt-text code needed).
- 5MB file-size cap and image-type-only validation, matching `ImageUploadField`/`AvatarUploadField`'s existing messages exactly ("Please choose an image file.", "Image must be smaller than 5MB.") — consistency across all three upload fields.
- No resize/crop UI on the new field — Events cards are always a fixed 4:3 `object-cover` crop, there is nothing for a width percentage to control (unlike News' `image_width_pct`, which sizes NewsDetail's full-page hero image).
- Lint (`npm run lint`) and build (`npm run build`) must stay clean after every task.
- Don't touch `ImageUploadField.jsx`, `AvatarUploadField.jsx`, News, or Excos — this plan only adds new files/fields, it doesn't modify the shared pieces those already depend on.

---

### Task 1: Supabase schema + storage bucket

**Files:** none (Supabase migration only, applied via the `apply_migration` MCP tool against project `ascdypvchlbpfupsssuy`)

**Interfaces:**
- Produces: `events.image_url` (nullable `text` column); `event-images` Storage bucket with the same 4-policy shape (`_public_select`, `_admin_insert`, `_admin_update`, `_admin_delete`) as `news-images`/`exco-photos`.

- [ ] **Step 1: Apply the migration**

Call `apply_migration` (project_id `ascdypvchlbpfupsssuy`, name `events_image_upload`) with:

```sql
alter table events add column image_url text;

insert into storage.buckets (id, name, public) values ('event-images', 'event-images', true);

create policy "event_images_public_select" on storage.objects for select
  to public using (bucket_id = 'event-images');

create policy "event_images_admin_insert" on storage.objects for insert
  to public with check (bucket_id = 'event-images' and auth.uid() in (select user_id from admins));

create policy "event_images_admin_update" on storage.objects for update
  to public using (bucket_id = 'event-images' and auth.uid() in (select user_id from admins));

create policy "event_images_admin_delete" on storage.objects for delete
  to public using (bucket_id = 'event-images' and auth.uid() in (select user_id from admins));
```

- [ ] **Step 2: Verify the column exists**

Call `list_tables` (project_id `ascdypvchlbpfupsssuy`, schemas `["public"]`, verbose `true`) and confirm `public.events`'s `columns` array now includes `image_url` (`data_type: "text"`, nullable).

- [ ] **Step 3: Verify the bucket and policies exist**

Call `execute_sql` (project_id `ascdypvchlbpfupsssuy`) with:
```sql
select id, public from storage.buckets where id = 'event-images';
```
Expected: one row, `public = true`.

```sql
select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'event_images%' order by policyname;
```
Expected: 4 rows (`event_images_admin_delete`/`DELETE`, `event_images_admin_insert`/`INSERT`, `event_images_admin_update`/`UPDATE`, `event_images_public_select`/`SELECT`).

No commit for this task — it's a database change, not a file change.

---

### Task 2: Admin event photo upload field

**Files:**
- Create: `src/components/admin/EventImageUploadField.jsx`
- Modify: `src/components/admin/AdminResourceForm.jsx`
- Modify: `src/pages/admin/config/eventsAdminConfig.js`
- Modify: `ADMIN.md`

**Interfaces:**
- Consumes: `events.image_url` column and `event-images` bucket from Task 1.
- Produces: `EventImageUploadField` component — props `{ label, url, onChange }`, `onChange` called with the uploaded photo's public URL (string), same call shape as `AvatarUploadField`.

- [ ] **Step 1: Create `EventImageUploadField.jsx`**

```jsx
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function EventImageUploadField({ label, url, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB.')
      return
    }
    setError('')
    setUploading(true)
    const path = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const { error: uploadError } = await supabase.storage.from('event-images').upload(path, file)
    setUploading(false)
    if (uploadError) {
      setError(uploadError.message)
      return
    }
    const { data } = supabase.storage.from('event-images').getPublicUrl(path)
    onChange(data.publicUrl)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-green-900">{label}</span>
      <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} />
      {error && <span className="text-xs text-danger">{error}</span>}
      {url && (
        <div className="mt-2 aspect-[4/3] w-full max-w-[400px] overflow-hidden rounded-sm bg-green-100">
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into `AdminResourceForm.jsx`**

Add the import alongside the existing upload-field imports:
```js
import ImageUploadField from './ImageUploadField'
import AvatarUploadField from './AvatarUploadField'
```
becomes:
```js
import ImageUploadField from './ImageUploadField'
import AvatarUploadField from './AvatarUploadField'
import EventImageUploadField from './EventImageUploadField'
```

Add a new branch immediately after the existing `f.type === 'avatar'` branch:
```jsx
        if (f.type === 'avatar') {
          return (
            <AvatarUploadField
              key={f.field}
              label={f.label}
              url={values[f.field]}
              onChange={(url) => setField(f.field, url)}
            />
          )
        }
```
becomes:
```jsx
        if (f.type === 'avatar') {
          return (
            <AvatarUploadField
              key={f.field}
              label={f.label}
              url={values[f.field]}
              onChange={(url) => setField(f.field, url)}
            />
          )
        }
        if (f.type === 'event-image') {
          return (
            <EventImageUploadField
              key={f.field}
              label={f.label}
              url={values[f.field]}
              onChange={(url) => setField(f.field, url)}
            />
          )
        }
```

No changes needed in `src/lib/adminFields.js` — `buildFormState`/`buildPayload` only special-case `'list'`, `'image'`, and `'number'`; any other type (including today's `'avatar'` and the new `'event-image'`) already falls through to the generic branch (`state[f.field] = record?.[f.field] ?? ''` / `payload[f.field] = values[f.field] === '' ? null : values[f.field]`), which is exactly the plain-string behavior this field needs.

- [ ] **Step 3: Add the field to `eventsAdminConfig.js`**

Replace:
```js
  fields: [
    { field: 'title', label: 'Title', type: 'text' },
    { field: 'date', label: 'Date label', type: 'text' },
    { field: 'tone', label: 'Card color', type: 'select', options: ['green', 'orange'] },
    { field: 'meta', label: 'Location / time', type: 'text', optional: true },
    { field: 'description', label: 'Description', type: 'textarea' },
  ],
```
with:
```js
  fields: [
    { field: 'title', label: 'Title', type: 'text' },
    { field: 'date', label: 'Date label', type: 'text' },
    { field: 'tone', label: 'Card color', type: 'select', options: ['green', 'orange'] },
    { field: 'meta', label: 'Location / time', type: 'text', optional: true },
    { field: 'description', label: 'Description', type: 'textarea' },
    { field: 'image_url', label: 'Photo', type: 'event-image' },
  ],
```

- [ ] **Step 4: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 5: Update `ADMIN.md`**

Replace:
```
News photos and Exco photos are capped at **5MB**, image files only. If an upload is
rejected, it's almost always the file size or the file type — resize/compress or pick
a `.jpg`/`.png`.
```
with:
```
News photos, Event photos, and Exco photos are capped at **5MB**, image files only. If
an upload is rejected, it's almost always the file size or the file type — resize/compress
or pick a `.jpg`/`.png`.
```

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/EventImageUploadField.jsx src/components/admin/AdminResourceForm.jsx src/pages/admin/config/eventsAdminConfig.js ADMIN.md
git commit -m "$(cat <<'EOF'
feat: add photo upload to the Events admin form

New EventImageUploadField (upload-and-preview, no resize UI --
Events has nothing for a width percentage to control) plugs into
AdminResourceForm via a new 'event-image' field type, following the
same shape as Excos' AvatarUploadField rather than reusing News'
resizable ImageUploadField.
EOF
)"
```

---

### Task 3: Events page — cover photos

**Files:**
- Modify: `src/pages/Events.jsx`
- Modify: `DESIGN_SYSTEM.md:137`

**Interfaces:**
- Consumes: `event.image_url` (from Task 1's column, populated via Task 2's admin field); `Card`'s `imageVariant`/`imageAspect` props (already shipped, see `2026-08-09-news-photo-feed-design.md`).

- [ ] **Step 1: Remove the `EVENT_TONE_ICONS` import**

Delete this line entirely (no other symbol from `../lib/illustrations` is used in this file):
```js
import { EVENT_TONE_ICONS } from '../lib/illustrations'
```

- [ ] **Step 2: Switch the `Card` to cover photos**

Replace:
```jsx
            <Card
              key={event.id}
              tone={event.tone}
              eyebrow={event.date}
              title={event.title}
              meta={event.meta || undefined}
              image={{ src: EVENT_TONE_ICONS[event.tone] || EVENT_TONE_ICONS.green }}
            >
              {event.description}
            </Card>
```
with:
```jsx
            <Card
              key={event.id}
              tone={event.tone}
              eyebrow={event.date}
              title={event.title}
              meta={event.meta || undefined}
              image={event.image_url ? { src: event.image_url } : undefined}
              imageVariant="cover"
              imageAspect="standard"
            >
              {event.description}
            </Card>
```

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed (the removed `EVENT_TONE_ICONS` import would surface as an unused-import lint error if Step 1 was missed).

- [ ] **Step 4: Update the Events line in `DESIGN_SYSTEM.md`**

Find (around line 137):
```
- **Events** (`src/pages/Events.jsx`) — 2-col grid of tone Cards.
```
Replace with:
```
- **Events** (`src/pages/Events.jsx`) — 2-col grid of Cards showing a full-bleed cover photo (`imageVariant="cover"`) when an event has one uploaded, otherwise just the colored tone block (no icon).
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/Events.jsx DESIGN_SYSTEM.md
git commit -m "$(cat <<'EOF'
feat: show event photos full-bleed instead of a tone icon

Switches Events' Card usage to imageVariant="cover" (matching News),
dropping the fixed EVENT_TONE_ICONS icon. Events without an uploaded
photo show just the colored tone block, no icon and no broken image
- same no-photo convention News already established.
EOF
)"
```

---

### Task 4: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all existing tests pass unchanged (this plan adds no new logic branches to test).

- [ ] **Step 2: Seed a temporary test photo on one event**

The admin upload form requires a logged-in admin session in the browser, which this verification pass doesn't have credentials for — so the upload *flow* itself (Step 5 below) needs a spot-check by a human admin. To verify the *display* path (Task 3) end-to-end without that login, temporarily set `image_url` directly on one of the two existing sample events via `execute_sql` (project_id `ascdypvchlbpfupsssuy`):

```sql
select id, title from events order by created_at limit 1;
```
then, using the returned `id`:
```sql
update events set image_url = 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=800&q=80' where id = '<id-from-above>';
```

- [ ] **Step 3: Start the dev server and verify `/events`**

Run: `npm run dev` (background), open `/events` in a browser. Confirm:
- The seeded event shows a full-bleed photo on top (4:3, `object-cover` — cropped, not stretched), tone-colored block with title/date/description below it.
- The other (unseeded) event shows no image row at all — just its colored tone block, no icon, no broken image.

- [ ] **Step 4: Revert the temporary test data**

```sql
update events set image_url = null where id = '<id-from-step-2>';
```
Confirm via a page refresh that the event goes back to showing no image row.

- [ ] **Step 5: Confirm News and Excos are unaffected**

Open `/news` and `/` (Home) — confirm both still show cover photos exactly as before (this plan touched no News files). Open `/admin` → Excos — confirm the avatar photo upload still works as before (this plan touched no Excos files).

- [ ] **Step 6: Stop the dev server**

Kill the `npm run dev` process started in Step 3.

- [ ] **Step 7: Flag the remaining manual check to the user**

Report to the user: the admin upload *form* itself (Admin → Events → Edit/Add → Photo field: choose a file, confirm the 4:3 preview appears, save, confirm it persists) needs a spot-check with real admin credentials, since this verification pass could only test the display path, not the authenticated upload flow.
