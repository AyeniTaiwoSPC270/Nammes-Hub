# Events: real photo upload

Date: 2026-08-10

## Problem

Events cards always render a small fixed tone icon (`EVENT_TONE_ICONS[event.tone]` via `Card`'s `imageVariant="icon"`) — there's no way to attach a real photo to an event, unlike News which got full-bleed cover-photo support in `2026-08-09-news-photo-feed-design.md`. The `events` table has no `image_url` column and `eventsAdminConfig.js` has no image field, so this isn't a bug — the capability was simply never built for Events. The user wants Events brought up to the same photo-forward treatment as News.

## Decision

Add real photo upload to Events, matching News' `imageVariant="cover"` display, but with a purpose-built upload field rather than reusing News' `ImageUploadField`. News' field bakes in a drag-to-resize handle for `image_width_pct` (needed because NewsDetail displays the image at an admin-chosen width); Events has no equivalent per-post width control — its cards are always a fixed 4:3 crop — so pulling in the resize UI would just be a dead control that visibly does nothing. Instead, follow the pattern Excos' `AvatarUploadField` already establishes in this codebase: a plain upload-and-preview field, own Storage bucket, no resize affordance.

## Scope

| Layer | Change |
|---|---|
| Supabase `events` table | Add nullable `image_url text` column |
| Supabase Storage | New `event-images` bucket (public read, admin-gated write) — mirrors `news-images`/`exco-photos` policies exactly |
| `src/components/admin/EventImageUploadField.jsx` (new) | Upload-and-preview field, no resize handle — same shape as `AvatarUploadField`, rectangular 4:3 preview instead of circular |
| `src/pages/admin/config/eventsAdminConfig.js` | New field: `{ field: 'image_url', label: 'Photo', type: 'event-image' }` |
| `src/components/admin/AdminResourceForm.jsx` | New `'event-image'` branch (same shape as the existing `'avatar'` branch) |
| `src/pages/Events.jsx` | `Card` switches from `EVENT_TONE_ICONS` icon to `imageVariant="cover" imageAspect="standard"`; no photo → no image row (matches News' convention) |
| `ADMIN.md` | "Image uploads" section: add Event photos to the 5MB-cap note |
| `DESIGN_SYSTEM.md` | Events line: describe cover photos instead of tone icons |

Out of scope: an Events detail page (none exists, not being added — Events stays list-only per the existing `2026-07-26-news-opportunities-design.md` decision); resize/crop controls for event photos (fixed 4:3 `object-cover`, no per-post override, consistent with News' grid cards); deleting the now-unused `EVENT_TONE_ICONS` assets from `src/lib/illustrations.js` (left in place, same call made for News' now-unused `categoryImage` — low-risk to leave, not worth the churn of removing asset files); a generic/shared image-upload abstraction across News/Events/Excos (three small purpose-built fields is simpler than one configurable one right now — see "Why not reuse/generalize" below).

## Why not reuse or generalize the upload field

Three real options existed: (a) reuse `ImageUploadField` as-is and add an unused `image_width_pct` column just to satisfy its shape, (b) make `ImageUploadField` take a `resizable` prop so both News and Events share one component, (c) copy the `AvatarUploadField` shape into a new `EventImageUploadField`. (a) ships dead UI and a meaningless DB column. (b) is a reasonable YAGNI call *against* right now — it would require touching the working, already-shipped News upload flow to add a conditional it doesn't need, for the benefit of a component that (with Excos' `AvatarUploadField` already being a second, separately-maintained upload field) wouldn't even fully unify the pattern. (c) matches how this codebase already handles this exact situation (Excos has its own simple field, News has its own resizable field) — Events gets its own simple field, no shared abstraction forced prematurely.

## Database migration

```sql
alter table events add column image_url text;
```

No RLS change needed — `events_admin_update`/`events_admin_insert` are row-level policies (`auth.uid() in (select user_id from admins)`), not column-scoped, so they already cover the new column.

## Storage bucket + policies

Mirrors the existing `news-images` bucket exactly (verified via `pg_policies` on `storage.objects`):

```sql
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

## Component: `EventImageUploadField`

Copies `AvatarUploadField`'s structure exactly (file input → validate type/size ≤5MB → upload to Storage → `getPublicUrl` → `onChange(url)`), with two differences:
- Bucket: `event-images` instead of `exco-photos`.
- Preview: `<div className="mt-2 aspect-[4/3] w-full max-w-[400px] overflow-hidden rounded-sm bg-green-100"><img className="h-full w-full object-cover" /></div>` instead of the 120×120 circle — previews roughly how the photo will crop on the actual card (`imageAspect="standard"` is also 4:3), rather than a shape that doesn't match final placement.

Same validation messages as the existing fields ("Please choose an image file.", "Image must be smaller than 5MB.") for consistency.

## Admin form wiring

`AdminResourceForm.jsx` gains a branch for `f.type === 'event-image'`, placed next to the existing `'avatar'` branch:

```jsx
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

`buildFormState`/`buildPayload` in `src/lib/adminFields.js` already handle any field type not explicitly matched by falling through to the generic `else` branch (`state[f.field] = record?.[f.field] ?? ''` / `payload[f.field] = values[f.field] === '' ? null : values[f.field]`) — `'event-image'` needs no new case there, it behaves like a plain text-valued field for state/payload purposes. Confirmed by reading `adminFields.js`: only `'list'`, `'image'`, and `'number'` have special-cased branches; everything else (including today's `'avatar'`) already falls through correctly.

## Events page

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

The `EVENT_TONE_ICONS` import is removed from `Events.jsx` (no longer referenced there). It stays exported from `src/lib/illustrations.js` — unused, not deleted, per the "out of scope" note above.

## Docs

- `ADMIN.md`: "News photos and Exco photos are capped at **5MB**..." → "News photos, Event photos, and Exco photos are capped at **5MB**...".
- `DESIGN_SYSTEM.md`: the Events line in the page-by-page rundown (currently "2-col grid of tone Cards") gets updated to mention cover photos, matching the correction already made for News' line in the prior spec.

## Accessibility

Same as News/Excos: uploaded photos are decorative relative to the adjacent text (title/date/description already convey the event's content) — `alt=""` + `aria-hidden="true"`, handled automatically by `Card`'s existing `imageVariant="cover"` implementation (no new code needed here, it's inherited).

## Testing

Presentational + form-wiring change, no new pure functions. Verified by inspection: upload a photo to an event via `/admin` (confirm the 5MB/file-type validation errors match News'/Excos'), confirm it renders full-bleed on `/events`, confirm an event with no photo shows just the colored block (no icon, no broken image), confirm Excos and News admin forms/pages are visually unchanged.
