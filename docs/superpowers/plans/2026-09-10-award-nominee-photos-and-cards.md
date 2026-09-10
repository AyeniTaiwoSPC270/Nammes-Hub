# Award Nominee Photos & Shareable Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move nominee-photo capture from admin curation to nomination time, and add a server-rendered card-generation endpoint that produces downloadable/shareable "campaign" posters (voting phase) and "winner" result cards (revealed phase).

**Architecture:** One new nullable column (`award_nominations.photo_url`) plus a relaxed storage insert policy; a required photo field added to the existing nomination form and an optional photo-group picker added to the existing curation screen; a new Vercel serverless function (`api/award-card.js`) that composites a nominee's photo + text onto a canvas template with `@napi-rs/canvas` and returns a PNG, with the winner variant computing the real winner server-side from `award_votes` so it can't be spoofed via query params; small UI additions (share/download buttons) on the existing `NomineeOption` and `ResultsSummary` components.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, Supabase (Postgres + Auth + Storage + RLS), Tailwind 4, Vitest, Vercel serverless functions (Node runtime), `@napi-rs/canvas`.

**Spec:** `docs/superpowers/specs/2026-09-10-award-nominee-photos-and-cards-design.md`

## Global Constraints

- Migrations are applied via the Supabase MCP `apply_migration` tool (`project_id: "ascdypvchlbpfupsssuy"`), not local `.sql` files — this project has no `supabase/migrations` directory (see the original awards-voting plan, `docs/superpowers/plans/2026-09-04-awards-voting.md`).
- Every DB write path is gated by RLS, never by a client-side "am I allowed" check.
- `photo_url` is required only at the application layer (form validation), never a DB `NOT NULL` — existing rows have no photo and must remain valid.
- The `api/award-card.js` winner variant must independently compute the winner from `award_votes` via `supabaseAdmin` — it must never trust a client-supplied nominee id as "the winner."
- Style conventions to match exactly: page wrapper `mx-auto max-w-[…] px-5 py-12 sm:px-6`; cards `rounded-lg border border-hairline bg-surface p-4 shadow-sm` (or `bg-surface-low` where the codebase already uses that tone); `Button`/`FormField`/`EmptyState`/`ErrorState` from `src/components/ui/*`; brand colors only via Tailwind tokens (`bg-green-900`, `text-orange-600`, never raw hex in JSX).
- Pure/testable logic gets a co-located `*.test.js` (Vitest). Page rendering, RLS behavior, and the actual PNG output are verified manually against the dev server + live Supabase project — this is the existing convention (`adminFields.test.js`/`chartMath.test.js`/`chunk.test.js` vs. everything else).
- The visual template for the cards (forest-green background, gold hex-lattice corner motif, gradient photo frame, orange "VOTE" ribbon / gold "★ WINNER" ribbon with laurel flourishes, serif nominee name) was approved as an HTML/CSS preview during design — Task 6 below translates that into canvas drawing calls.
- The voting ballot keeps its existing "all categories on one page, one submit" model — do not rebuild it as a paginated per-category flow (confirmed out of scope; see the spec's Visual design section).
- No nominee subtitle/level field is being added — nominee cards show photo + name only (confirmed out of scope).

---

## Task 1: Schema migration + nomination photo capture (data layer)

**Files:**
- Modify: `src/data/awardNominations.js`
- Modify: `src/data/awardNominations.test.js`

**Interfaces:**
- Produces (consumed by Task 3 and Task 4):
  - `upsertNomination({ id, categoryId, userId, nomineeName, photoUrl }) => Promise<void>` — `photoUrl` is a new parameter, written on both insert and update.
  - `groupNominationsByText(nominations) => Array<{ displayName: string, count: number, ids: string[], photos: string[] }>` — `photos` is the list of distinct, non-null `photo_url` values within the group, in the order they were encountered in the input array (which is already `created_at ascending` from `fetchNominationsForCategory`, so the last entry in `photos` is the most recently submitted one).

- [ ] **Step 1: Apply the migration**

Use the Supabase MCP tool with `project_id: "ascdypvchlbpfupsssuy"`, `name: "award_nominations_photo_url"`, and this `query`:

```sql
alter table award_nominations add column photo_url text;

create policy award_nominee_photos_insert_authenticated
  on storage.objects for insert
  with check (bucket_id = 'award-nominee-photos' and auth.role() = 'authenticated');
```

- [ ] **Step 2: Verify the migration**

Run a read-only query via the same MCP tool (`list_tables` or a `select column_name from information_schema.columns where table_name = 'award_nominations'`) and confirm `photo_url` is listed.

- [ ] **Step 3: Write the failing test for the extended grouping function**

Add to `src/data/awardNominations.test.js`:

```javascript
it('collects distinct photo urls per group, in input order', () => {
  const nominations = [
    { id: '1', nominee_name: 'Ada', photo_url: 'https://x/a1.jpg' },
    { id: '2', nominee_name: 'ada', photo_url: 'https://x/a2.jpg' },
    { id: '3', nominee_name: 'Ada', photo_url: 'https://x/a1.jpg' },
    { id: '4', nominee_name: 'Bola', photo_url: null },
  ]
  const groups = groupNominationsByText(nominations)
  const ada = groups.find((g) => g.displayName === 'Ada')
  expect(ada.photos).toEqual(['https://x/a1.jpg', 'https://x/a2.jpg'])
  const bola = groups.find((g) => g.displayName === 'Bola')
  expect(bola.photos).toEqual([])
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- awardNominations`
Expected: FAIL — `ada.photos` is `undefined` (the function doesn't produce a `photos` field yet).

- [ ] **Step 5: Implement `photoUrl` on `upsertNomination` and extend `groupNominationsByText`**

In `src/data/awardNominations.js`, replace `upsertNomination` and `groupNominationsByText`:

```javascript
export async function upsertNomination({ id, categoryId, userId, nomineeName, photoUrl }) {
  if (id) {
    const { error } = await supabase
      .from('award_nominations')
      .update({ nominee_name: nomineeName, photo_url: photoUrl || null, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('award_nominations')
    .insert({ category_id: categoryId, submitted_by: userId, nominee_name: nomineeName, photo_url: photoUrl || null })
  if (error) throw error
}
```

```javascript
export function groupNominationsByText(nominations) {
  const groups = new Map()
  for (const n of nominations) {
    const key = n.nominee_name.trim().toLowerCase().replace(/\s+/g, ' ')
    if (!groups.has(key)) groups.set(key, { displayName: n.nominee_name.trim(), count: 0, ids: [], photos: [] })
    const g = groups.get(key)
    g.count += 1
    g.ids.push(n.id)
    if (n.photo_url && !g.photos.includes(n.photo_url)) g.photos.push(n.photo_url)
  }
  return Array.from(groups.values()).sort((a, b) => b.count - a.count)
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- awardNominations`
Expected: PASS (all tests in the file, including the pre-existing ones — the added `photos` field doesn't change any existing assertion since they use `toEqual` on the whole object... check: the pre-existing tests assert `toEqual({ displayName, count, ids })` without `photos`, which will now fail because the actual object has an extra key.)

- [ ] **Step 7: Fix the pre-existing tests to include `photos: []`**

In `src/data/awardNominations.test.js`, update the two `toEqual` assertions that don't set `photo_url` on their fixtures to expect `photos: []`:

```javascript
expect(groups).toEqual([
  { displayName: 'Taiwo A.', count: 2, ids: ['1', '2'], photos: [] },
  { displayName: 'Chidi', count: 1, ids: ['3'], photos: [] },
])
```

(and the same `photos: []` addition in the "sorts groups by count descending" test's fixtures stay untouched since that test only asserts `displayName`/`count`, not the full object.)

- [ ] **Step 8: Run the full test file again**

Run: `npm test -- awardNominations`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/data/awardNominations.js src/data/awardNominations.test.js
git commit -m "feat: capture nominee photo_url on nomination, group photos by nominee"
```

---

## Task 2: Shared, required-aware photo upload field

**Files:**
- Create: `src/components/awards/NomineePhotoUploadField.jsx`
- Delete: `src/components/admin/AwardNomineePhotoUploadField.jsx`
- Modify: `src/pages/admin/AdminAwardCurate.jsx` (import path only, in this task)

**Interfaces:**
- Produces (consumed by Task 3 and Task 4):
  - `NomineePhotoUploadField({ label, url, onChange, required })` default export — `required` (boolean, default `false`) swaps the dropzone copy between "Click to upload photo (optional)" and a required variant, and adds a small red asterisk next to `label` when `true`.

- [ ] **Step 1: Create the shared component**

Create `src/components/awards/NomineePhotoUploadField.jsx`:

```jsx
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function NomineePhotoUploadField({ label, url, onChange, required = false }) {
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
    const { error: uploadError } = await supabase.storage.from('award-nominee-photos').upload(path, file)
    setUploading(false)
    if (uploadError) {
      setError(uploadError.message)
      return
    }
    const { data } = supabase.storage.from('award-nominee-photos').getPublicUrl(path)
    onChange(data.publicUrl)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-hairline bg-surface-low p-6 text-center transition-colors hover:bg-hairline/20">
        <span className="material-symbols-outlined text-3xl text-ink-muted">add_photo_alternate</span>
        <span className="text-sm font-semibold text-ink-muted">
          {uploading ? 'Uploading…' : required ? 'Upload a photo of your nominee' : 'Click to upload photo (optional)'}
        </span>
        <span className="text-xs text-ink-muted">JPEG, PNG up to 5MB{required ? ' — clear headshot preferred' : ''}</span>
        <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} className="hidden" />
      </label>
      {error && <span className="text-xs text-danger">{error}</span>}
      {url && (
        <div className="mt-2 aspect-square w-full max-w-[160px] overflow-hidden rounded-md bg-surface-low shadow-md">
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Delete the old admin-only component**

```bash
git rm src/components/admin/AwardNomineePhotoUploadField.jsx
```

- [ ] **Step 3: Update `AdminAwardCurate.jsx`'s import**

In `src/pages/admin/AdminAwardCurate.jsx`, change:

```javascript
import AwardNomineePhotoUploadField from '../../components/admin/AwardNomineePhotoUploadField'
```

to:

```javascript
import NomineePhotoUploadField from '../../components/awards/NomineePhotoUploadField'
```

and update its one usage:

```jsx
<NomineePhotoUploadField label="Photo" url={draftPhotoUrl} onChange={setDraftPhotoUrl} />
```

(no `required` prop passed — defaults to `false`, matching today's optional-during-curation behavior.)

- [ ] **Step 4: Run the full test suite to confirm nothing else imports the old path**

Run: `npm test`
Expected: PASS (no test imports `components/admin/AwardNomineePhotoUploadField` directly; if one does, update it the same way as Step 3).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move nominee photo upload field to a shared, required-aware component"
```

---

## Task 3: Nomination form — required photo per category

**Files:**
- Modify: `src/components/awards/NominationCategoryField.jsx`
- Modify: `src/pages/Awards.jsx`

**Interfaces:**
- Consumes: `NomineePhotoUploadField` (Task 2), `upsertNomination({ id, categoryId, userId, nomineeName, photoUrl })` (Task 1).
- Produces: `NominationCategoryField({ category, index, value, onChange, photoUrl, onPhotoChange })` — two new props alongside the existing four.

- [ ] **Step 1: Add the photo field to `NominationCategoryField`**

Replace the contents of `src/components/awards/NominationCategoryField.jsx`:

```jsx
import NomineePhotoUploadField from './NomineePhotoUploadField'

export default function NominationCategoryField({ category, index, value, onChange, photoUrl, onPhotoChange }) {
  const filled = Boolean((value || '').trim()) && Boolean(photoUrl)

  return (
    <div className="rounded-lg bg-surface-low p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">
          Category {String(index + 1).padStart(2, '0')}
        </span>
        <span
          className={[
            'inline-flex items-center gap-1 text-xs font-semibold',
            filled ? 'text-green-900' : 'text-ink-muted',
          ].join(' ')}
        >
          <span className="material-symbols-outlined text-base">{filled ? 'check_circle' : 'radio_button_unchecked'}</span>
          {filled ? 'Nominated' : 'Pending'}
        </span>
      </div>
      <h2 className="text-lg font-bold text-ink-900">{category.title}</h2>
      {category.description && <p className="mt-1 text-sm text-ink-muted">{category.description}</p>}
      <div className="relative mt-3 flex items-center">
        <span className="material-symbols-outlined pointer-events-none absolute left-3 text-ink-muted">person</span>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Who do you nominate for ${category.title}?`}
          className="w-full rounded-md border border-hairline bg-surface py-2.5 pl-10 pr-10 text-base text-ink transition-colors focus:border-green-900 focus:outline-none"
        />
        <span
          className={['material-symbols-outlined pointer-events-none absolute right-3', (value || '').trim() ? 'text-green-900' : 'text-hairline'].join(' ')}
        >
          {(value || '').trim() ? 'check_circle' : 'edit'}
        </span>
      </div>
      <div className="mt-3">
        <NomineePhotoUploadField label="Photo" url={photoUrl} onChange={onPhotoChange} required />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire photo state into `Awards.jsx`**

In `src/pages/Awards.jsx`, add a `photoDrafts` state alongside `drafts`, initialize it from `nominationsQuery.data`, extend the submit mutation to pass `photoUrl`, extend the "answered" completion check, and pass the two new props down.

Add the state declaration next to the existing one:

```javascript
const [photoDrafts, setPhotoDrafts] = useState({})
```

Extend the existing `useEffect` that seeds `drafts` from `nominationsQuery.data` to also seed `photoDrafts`:

```javascript
useEffect(() => {
  if (!nominationsQuery.data) return
  const nextNames = {}
  const nextPhotos = {}
  nominationsQuery.data.forEach((n) => {
    nextNames[n.category_id] = n.nominee_name
    nextPhotos[n.category_id] = n.photo_url || ''
  })
  setDrafts(nextNames)
  setPhotoDrafts(nextPhotos)
}, [nominationsQuery.data])
```

Change the `answeredCount` calculation used by the nominating-phase progress bar and by the submit mutation's filter from:

```javascript
const answeredCount = season.categories.filter((c) => (drafts[c.id] || '').trim()).length
```

to:

```javascript
const answeredCount = season.categories.filter((c) => (drafts[c.id] || '').trim() && photoDrafts[c.id]).length
```

Update the submit mutation's job filter/mapping (inside `submitMutation`'s `mutationFn`) from:

```javascript
const jobs = season.categories
  .filter((c) => (drafts[c.id] || '').trim())
  .map((c) => {
    const existing = nominationsByCategory[c.id]
    return upsertNomination({
      id: existing?.id,
      categoryId: c.id,
      userId: user.id,
      nomineeName: drafts[c.id].trim(),
    })
  })
```

to:

```javascript
const jobs = season.categories
  .filter((c) => (drafts[c.id] || '').trim() && photoDrafts[c.id])
  .map((c) => {
    const existing = nominationsByCategory[c.id]
    return upsertNomination({
      id: existing?.id,
      categoryId: c.id,
      userId: user.id,
      nomineeName: drafts[c.id].trim(),
      photoUrl: photoDrafts[c.id],
    })
  })
```

Update the `<NominationCategoryField>` usage in the `nominating` phase render block to pass the two new props:

```jsx
<NominationCategoryField
  key={c.id}
  category={c}
  index={i}
  value={drafts[c.id]}
  onChange={(value) => setDrafts((prev) => ({ ...prev, [c.id]: value }))}
  photoUrl={photoDrafts[c.id]}
  onPhotoChange={(url) => setPhotoDrafts((prev) => ({ ...prev, [c.id]: url }))}
/>
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS (no existing test exercises `Awards.jsx` directly — this step is a safety net for anything that does).

- [ ] **Step 4: Manual verification against the dev server**

Run: `npm run dev`. Sign in as a department student, go to `/awards` during the `nominating` phase, confirm: a category with only a name filled shows "Pending" (not "Nominated"), uploading a photo flips it to "Nominated", and "Save nominations" only persists categories where both a name and a photo are present.

- [ ] **Step 5: Commit**

```bash
git add src/components/awards/NominationCategoryField.jsx src/pages/Awards.jsx
git commit -m "feat: require a nominee photo alongside the name on the nomination form"
```

---

## Task 4: Curation — photo picker from the nomination group

**Files:**
- Modify: `src/pages/admin/AdminAwardCurate.jsx`

**Interfaces:**
- Consumes: `groups[].photos` (Task 1), `NomineePhotoUploadField` (Task 2, already imported by Task 2 Step 3).

- [ ] **Step 1: Add a thumbnail picker to the "Add as nominee" flow**

In `src/pages/admin/AdminAwardCurate.jsx`, inside the `isAdding` block (the `<div className="mt-4 flex flex-col gap-3 border-t border-hairline pt-4">`), insert a thumbnail row before the existing `<NomineePhotoUploadField>`, and default `draftPhotoUrl` to the group's most recent photo when opening the "Add as nominee" form.

Change the "Add as nominee" button's `onClick` from:

```javascript
onClick={() => {
  setAddingKey(key)
  setDraftName(g.displayName)
  setDraftPhotoUrl('')
}}
```

to:

```javascript
onClick={() => {
  setAddingKey(key)
  setDraftName(g.displayName)
  setDraftPhotoUrl(g.photos[g.photos.length - 1] || '')
}}
```

Then, inside the `isAdding` block, add the thumbnail chips above the `<NomineePhotoUploadField>` line, only when the group has more than one distinct photo:

```jsx
{g.photos.length > 1 && (
  <div className="flex flex-col gap-1.5">
    <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">
      Choose a submitted photo
    </span>
    <div className="flex gap-2">
      {g.photos.map((photo) => (
        <button
          key={photo}
          type="button"
          onClick={() => setDraftPhotoUrl(photo)}
          className={[
            'h-14 w-14 overflow-hidden rounded-md border-2 shadow-sm',
            draftPhotoUrl === photo ? 'border-green-900' : 'border-transparent',
          ].join(' ')}
        >
          <img src={photo} alt="" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Manual verification against the dev server**

As admin, on `/admin/awards/:seasonId/categories/:categoryId/curate` with a season in `curating` phase where two different students nominated the same name with two different photos: confirm the thumbnail row appears with both photos, clicking one updates the preview below, and "Confirm" creates the nominee with the chosen photo. For a group with only one submitted photo, confirm no thumbnail row appears and the single photo pre-fills directly.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/AdminAwardCurate.jsx
git commit -m "feat: let admin pick among a nominee group's submitted photos during curation"
```

---

## Task 5: Winner-determination pure logic

**Files:**
- Create: `api/_lib/awardCardData.js`
- Create: `api/_lib/awardCardData.test.js`

**Interfaces:**
- Produces (consumed by Task 7):
  - `determineWinner(votes: Array<{ nominee_id: string }>, nominees: Array<{ id: string, name: string, photo_url: string | null }>) => { nominee: object, count: number } | null` — returns `null` if `nominees` is empty or every nominee has zero votes; otherwise the highest-vote nominee, ties broken by whichever nominee appears first in the `nominees` array.

- [ ] **Step 1: Write the failing tests**

Create `api/_lib/awardCardData.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { determineWinner } from './awardCardData.js'

describe('determineWinner', () => {
  it('returns the nominee with the most votes', () => {
    const nominees = [
      { id: 'a', name: 'Ada' },
      { id: 'b', name: 'Bola' },
    ]
    const votes = [{ nominee_id: 'a' }, { nominee_id: 'a' }, { nominee_id: 'b' }]
    expect(determineWinner(votes, nominees)).toEqual({ nominee: nominees[0], count: 2 })
  })
  it('breaks ties by nominee array order', () => {
    const nominees = [
      { id: 'a', name: 'Ada' },
      { id: 'b', name: 'Bola' },
    ]
    const votes = [{ nominee_id: 'a' }, { nominee_id: 'b' }]
    expect(determineWinner(votes, nominees)).toEqual({ nominee: nominees[0], count: 1 })
  })
  it('returns null when there are no nominees', () => {
    expect(determineWinner([], [])).toBeNull()
  })
  it('returns null when no nominee has any votes', () => {
    const nominees = [{ id: 'a', name: 'Ada' }]
    expect(determineWinner([], nominees)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- awardCardData`
Expected: FAIL with "Failed to resolve import './awardCardData.js'" or similar.

- [ ] **Step 3: Implement `determineWinner`**

Create `api/_lib/awardCardData.js`:

```javascript
export function determineWinner(votes, nominees) {
  const counts = {}
  nominees.forEach((n) => {
    counts[n.id] = 0
  })
  votes.forEach((v) => {
    if (counts[v.nominee_id] !== undefined) counts[v.nominee_id] += 1
  })
  let best = null
  for (const n of nominees) {
    const count = counts[n.id] || 0
    if (count > 0 && (!best || count > best.count)) {
      best = { nominee: n, count }
    }
  }
  return best
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- awardCardData`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/_lib/awardCardData.js api/_lib/awardCardData.test.js
git commit -m "feat: add pure winner-determination logic for award result cards"
```

---

## Task 6: Card rendering module

**Files:**
- Create: `api/_lib/fonts/PlayfairDisplay-Bold.ttf`
- Create: `api/_lib/fonts/PublicSans-Regular.ttf`
- Create: `api/_lib/fonts/PublicSans-Bold.ttf`
- Create: `api/_lib/awardCardRender.js`
- Modify: `package.json`

**Interfaces:**
- Produces (consumed by Task 7):
  - `renderAwardCard({ variant, name, categoryTitle, seasonTitle, photoBuffer }) => Promise<Buffer>` — `variant` is `'campaign'` or `'winner'`; `photoBuffer` is the nominee's photo already fetched as a `Buffer` (or `null` if the nominee has no photo, in which case a plain silhouette placeholder is drawn); returns a PNG `Buffer`.

- [ ] **Step 1: Add the `@napi-rs/canvas` dependency**

```bash
npm install @napi-rs/canvas
```

- [ ] **Step 2: Download the font files**

```bash
mkdir -p api/_lib/fonts
curl -L -o api/_lib/fonts/PlayfairDisplay-Bold.ttf "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiukDQ.ttf"
curl -L -o api/_lib/fonts/PublicSans-Regular.ttf "https://fonts.gstatic.com/s/publicsans/v21/ijwGs572Xtc6ZYQws9YVwllKVG8qX1oyOymuFpm5ww.ttf"
curl -L -o api/_lib/fonts/PublicSans-Bold.ttf "https://fonts.gstatic.com/s/publicsans/v21/ijwGs572Xtc6ZYQws9YVwllKVG8qX1oyOymu8Z65ww.ttf"
```

Verify each file is a real TTF, not an error page: `file api/_lib/fonts/PlayfairDisplay-Bold.ttf` should report `TrueType Font data`, not `HTML document` or similar. If any of the three URLs 404s (Google Fonts occasionally rotates version paths), fetch the current URL by running `curl -s -H "User-Agent: Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36" "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap"` (swap in `Public+Sans:wght@400` / `:wght@700` for the other two) and use the `.ttf` URL it returns instead.

- [ ] **Step 3: Implement the rendering module**

Create `api/_lib/awardCardRender.js`:

```javascript
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let fontsRegistered = false
function ensureFonts() {
  if (fontsRegistered) return
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/PlayfairDisplay-Bold.ttf'), 'Playfair Display')
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/PublicSans-Regular.ttf'), 'Public Sans')
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/PublicSans-Bold.ttf'), 'Public Sans Bold')
  fontsRegistered = true
}

const WIDTH = 1080
const HEIGHT = 1350
const GREEN = '#0b2417'
const GREEN_DEEP = '#071a10'
const ORANGE = '#ff5a1f'
const ORANGE_DARK = '#ae3200'
const GOLD = '#e9b64f'
const GOLD_LIGHT = '#f7dfa0'

function drawHexLattice(ctx, x, y, w, h, flipX, flipY) {
  ctx.save()
  ctx.translate(x + (flipX ? w : 0), y + (flipY ? h : 0))
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
  ctx.strokeStyle = GOLD
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 1.2
  const hexW = 34
  const hexH = 30
  for (let row = 0; row * hexH < h; row++) {
    for (let col = 0; col * hexW < w; col++) {
      const cx = col * hexW + (row % 2 ? hexW / 2 : 0)
      const cy = row * hexH
      const dist = Math.sqrt(cx * cx + cy * cy) / Math.sqrt(w * w + h * h)
      ctx.globalAlpha = Math.max(0, 0.35 * (1 - dist * 1.8))
      if (ctx.globalAlpha <= 0) continue
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i
        const px = cx + 16 * Math.cos(angle)
        const py = cy + 16 * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawPhotoFrame(ctx, cx, topY, isWinner, photoImage) {
  const frameW = 560
  const frameH = 675
  const x = cx - frameW / 2
  const outerPad = isWinner ? 20 : 15
  const radius = 26

  ctx.save()
  if (isWinner) {
    const glow = ctx.createRadialGradient(cx, topY + frameH / 2, frameH * 0.2, cx, topY + frameH / 2, frameH * 0.9)
    glow.addColorStop(0, 'rgba(233,182,79,0.35)')
    glow.addColorStop(1, 'rgba(233,182,79,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  const grad = ctx.createLinearGradient(x, topY, x + frameW, topY + frameH)
  if (isWinner) {
    grad.addColorStop(0, GOLD_LIGHT)
    grad.addColorStop(0.45, GOLD)
    grad.addColorStop(1, '#a9781f')
  } else {
    grad.addColorStop(0, ORANGE)
    grad.addColorStop(0.45, '#ffb066')
    grad.addColorStop(1, ORANGE_DARK)
  }
  ctx.fillStyle = grad
  roundRect(ctx, x, topY, frameW, frameH, radius)
  ctx.fill()

  const innerX = x + outerPad
  const innerY = topY + outerPad
  const innerW = frameW - outerPad * 2
  const innerH = frameH - outerPad * 2
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  roundRect(ctx, innerX, innerY, innerW, innerH, radius - 8)
  ctx.fill()

  const photoPad = 8
  const photoX = innerX + photoPad
  const photoY = innerY + photoPad
  const photoW = innerW - photoPad * 2
  const photoH = innerH - photoPad * 2
  ctx.save()
  roundRect(ctx, photoX, photoY, photoW, photoH, radius - 14)
  ctx.clip()
  if (photoImage) {
    const scale = Math.max(photoW / photoImage.width, photoH / photoImage.height)
    const drawW = photoImage.width * scale
    const drawH = photoImage.height * scale
    ctx.drawImage(photoImage, photoX - (drawW - photoW) / 2, photoY - (drawH - photoH) / 2, drawW, drawH)
  } else {
    ctx.fillStyle = '#8b98a1'
    ctx.fillRect(photoX, photoY, photoW, photoH)
  }
  ctx.restore()
  ctx.restore()

  return { x, y: topY, w: frameW, h: frameH }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawRibbon(ctx, cx, y, isWinner) {
  const text = isWinner ? '★ WINNER' : 'VOTE'
  ctx.save()
  ctx.translate(cx - 220, y - 20)
  ctx.rotate((-8 * Math.PI) / 180)
  ctx.font = 'bold 30px "Public Sans Bold"'
  const paddingX = 24
  const textWidth = ctx.measureText(text).width
  const boxW = textWidth + paddingX * 2
  const boxH = 56
  if (isWinner) {
    const grad = ctx.createLinearGradient(0, 0, boxW, boxH)
    grad.addColorStop(0, GOLD_LIGHT)
    grad.addColorStop(0.6, GOLD)
    grad.addColorStop(1, '#c98f2c')
    ctx.fillStyle = grad
  } else {
    ctx.fillStyle = ORANGE
  }
  roundRect(ctx, 0, 0, boxW, boxH, 6)
  ctx.fill()
  ctx.fillStyle = isWinner ? '#3a2a06' : '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, paddingX, boxH / 2 + 2)
  ctx.restore()
}

function drawLaurel(ctx, cx, y, side) {
  const dir = side === 'left' ? -1 : 1
  const baseX = cx + dir * (280 + 30)
  ctx.save()
  ctx.strokeStyle = GOLD
  ctx.fillStyle = GOLD
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(baseX, y - 100)
  ctx.quadraticCurveTo(baseX + dir * 60, y, baseX, y + 100)
  ctx.stroke()
  for (const t of [-70, -40, -10, 20, 55, 85]) {
    const lx = baseX + dir * (t < 0 ? -t * 0.15 : t * 0.1) + dir * 20
    const ly = y + t
    ctx.beginPath()
    ctx.ellipse(lx, ly, 16, 8, dir * 0.6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export async function renderAwardCard({ variant, name, categoryTitle, seasonTitle, photoBuffer }) {
  ensureFonts()
  const isWinner = variant === 'winner'
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  const bg = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 1.1, HEIGHT * 0.2, WIDTH / 2, HEIGHT * 1.1, HEIGHT * 1.1)
  bg.addColorStop(0, GREEN_DEEP)
  bg.addColorStop(1, GREEN)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const latticeSize = 380
  drawHexLattice(ctx, 0, 0, latticeSize, latticeSize, false, false)
  drawHexLattice(ctx, WIDTH - latticeSize, 0, latticeSize, latticeSize, true, false)
  drawHexLattice(ctx, 0, HEIGHT - latticeSize, latticeSize, latticeSize, false, true)
  drawHexLattice(ctx, WIDTH - latticeSize, HEIGHT - latticeSize, latticeSize, latticeSize, true, true)

  ctx.textAlign = 'center'
  ctx.fillStyle = ORANGE
  ctx.font = 'bold 22px "Public Sans Bold"'
  ctx.fillText('NAMMES HUB', WIDTH / 2, 90)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '18px "Public Sans"'
  ctx.fillText(seasonTitle, WIDTH / 2, 118)

  const photoImage = photoBuffer ? await loadImage(photoBuffer) : null
  const frameTopY = 165
  const frame = drawPhotoFrame(ctx, WIDTH / 2, frameTopY, isWinner, photoImage)

  drawRibbon(ctx, WIDTH / 2, frame.y - 10, isWinner)
  if (isWinner) {
    drawLaurel(ctx, WIDTH / 2, frame.y + frame.h / 2, 'left')
    drawLaurel(ctx, WIDTH / 2, frame.y + frame.h / 2, 'right')
  }

  const nameY = frame.y + frame.h + 70
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 56px "Playfair Display"'
  if (isWinner) {
    ctx.shadowColor = 'rgba(233,182,79,0.55)'
    ctx.shadowBlur = 24
  }
  ctx.fillText(name, WIDTH / 2, nameY)
  ctx.shadowBlur = 0

  ctx.fillStyle = isWinner ? GOLD : ORANGE
  ctx.font = 'bold 24px "Public Sans Bold"'
  ctx.fillText(categoryTitle.toUpperCase(), WIDTH / 2, nameY + 46)

  const footerY = HEIGHT - 60
  ctx.strokeStyle = isWinner ? GOLD : ORANGE
  ctx.globalAlpha = 0.6
  ctx.beginPath()
  ctx.moveTo(WIDTH / 2 - 150, footerY - 20)
  ctx.lineTo(WIDTH / 2 + 150, footerY - 20)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '16px "Public Sans"'
  ctx.fillText('nammeshub.com/awards', WIDTH / 2, footerY)

  return canvas.toBuffer('image/png')
}
```

- [ ] **Step 4: Smoke-test the renderer manually**

Run this ad-hoc script once from the repo root to confirm the module produces a valid, non-empty PNG (there's no pixel-level unit test for canvas output, consistent with this app's convention of manually verifying rendered output rather than unit-testing it):

```bash
node -e "
import('./api/_lib/awardCardRender.js').then(async ({ renderAwardCard }) => {
  const buf = await renderAwardCard({ variant: 'campaign', name: 'Ada Chukwu', categoryTitle: 'Best Dressed', seasonTitle: 'Materials Horizon Awards 2026', photoBuffer: null })
  const fs = await import('node:fs')
  fs.writeFileSync('/tmp/test-card.png', buf)
  console.log('wrote', buf.length, 'bytes')
})
"
```

Expected: prints `wrote <some number > 10000> bytes` with no errors. Open `/tmp/test-card.png` and visually confirm it resembles the approved preview (forest-green background, orange gradient frame, gray silhouette placeholder, "Ada Chukwu" in serif type, "BEST DRESSED" below it).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/awardCardRender.js api/_lib/fonts package.json package-lock.json
git commit -m "feat: add server-side award card rendering with @napi-rs/canvas"
```

---

## Task 7: `api/award-card.js` endpoint

**Files:**
- Create: `api/award-card.js`

**Interfaces:**
- Consumes: `getSupabaseAdmin()` (`api/_lib/supabaseAdmin.js`), `determineWinner` (Task 5), `renderAwardCard` (Task 6).
- Produces: `GET /api/award-card?type=campaign&nomineeId=<uuid>` and `GET /api/award-card?type=winner&categoryId=<uuid>`, both returning `image/png` on success.

- [ ] **Step 1: Implement the handler**

Create `api/award-card.js`:

```javascript
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { determineWinner } from './_lib/awardCardData.js'
import { renderAwardCard } from './_lib/awardCardRender.js'

async function fetchPhotoBuffer(photoUrl) {
  if (!photoUrl) return null
  try {
    const res = await fetch(photoUrl)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { type, nomineeId, categoryId } = req.query
  if (type !== 'campaign' && type !== 'winner') {
    res.status(400).json({ error: 'type must be "campaign" or "winner"' })
    return
  }

  const supabaseAdmin = getSupabaseAdmin()

  try {
    if (type === 'campaign') {
      if (!nomineeId) {
        res.status(400).json({ error: 'Missing nomineeId' })
        return
      }
      const { data: nominee, error: nomineeError } = await supabaseAdmin
        .from('award_nominees')
        .select('*, award_categories(*, award_seasons(*))')
        .eq('id', nomineeId)
        .maybeSingle()
      if (nomineeError) throw nomineeError
      if (!nominee) {
        res.status(404).json({ error: 'Nominee not found' })
        return
      }
      const category = nominee.award_categories
      const season = category?.award_seasons
      const photoBuffer = await fetchPhotoBuffer(nominee.photo_url)
      const png = await renderAwardCard({
        variant: 'campaign',
        name: nominee.name,
        categoryTitle: category?.title || '',
        seasonTitle: season?.title || 'NAMMES Hub Awards',
        photoBuffer,
      })
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=3600')
      res.status(200).send(png)
      return
    }

    // type === 'winner'
    if (!categoryId) {
      res.status(400).json({ error: 'Missing categoryId' })
      return
    }
    const { data: category, error: categoryError } = await supabaseAdmin
      .from('award_categories')
      .select('*, award_seasons(*)')
      .eq('id', categoryId)
      .maybeSingle()
    if (categoryError) throw categoryError
    if (!category || category.award_seasons?.phase !== 'revealed') {
      res.status(404).json({ error: 'Results are not available for this category' })
      return
    }

    const { data: nominees, error: nomineesError } = await supabaseAdmin
      .from('award_nominees')
      .select('*')
      .eq('category_id', categoryId)
    if (nomineesError) throw nomineesError

    const { data: votes, error: votesError } = await supabaseAdmin
      .from('award_votes')
      .select('nominee_id')
      .eq('category_id', categoryId)
    if (votesError) throw votesError

    const winner = determineWinner(votes, nominees)
    if (!winner) {
      res.status(404).json({ error: 'No winner recorded for this category' })
      return
    }

    const photoBuffer = await fetchPhotoBuffer(winner.nominee.photo_url)
    const png = await renderAwardCard({
      variant: 'winner',
      name: winner.nominee.name,
      categoryTitle: category.title,
      seasonTitle: category.award_seasons.title,
      photoBuffer,
    })
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.status(200).send(png)
  } catch (error) {
    console.error('award-card: render failed', error)
    res.status(500).json({ error: 'Could not generate the card' })
  }
}
```

- [ ] **Step 2: Manual verification against the dev environment**

This endpoint only runs under Vercel's dev server (`vercel dev`), not Vite's — if the project has a `vercel dev` workflow already documented (check `ADMIN.md` / `README.md`), use it; otherwise deploy to a preview environment (`vercel` from the CLI) and hit:
- `/api/award-card?type=campaign&nomineeId=<a real shortlisted nominee id from the live Supabase project>` — expect a downloadable PNG matching the approved campaign template.
- `/api/award-card?type=winner&categoryId=<a category id whose season is still in voting, not revealed>` — expect a `404` JSON body.
- `/api/award-card?type=winner&categoryId=<a category id from a revealed season with votes>` — expect a PNG showing whichever nominee actually has the most votes, and confirm it matches the admin tally shown on `/admin/awards/:seasonId/results`.

- [ ] **Step 3: Commit**

```bash
git add api/award-card.js
git commit -m "feat: add /api/award-card endpoint for campaign and winner PNG cards"
```

---

## Task 8: Share/download on the voting ballot

**Files:**
- Create: `src/lib/shareCard.js`
- Modify: `src/components/awards/NomineeOption.jsx`
- Modify: `src/pages/Awards.jsx`

**Interfaces:**
- Produces (consumed by Task 9 too):
  - `shareOrDownloadCard(imageUrl: string, filename: string, shareTitle: string) => Promise<void>` — fetches the image, uses `navigator.share({ files })` when the browser supports sharing files, otherwise triggers a plain `<a download>`.
- Produces: `NomineeOption({ nominee, selected, onSelect, onShare })` — `onShare` is optional; when provided, a small share icon button renders in the top-right corner of the photo.

- [ ] **Step 1: Implement the share/download utility**

Create `src/lib/shareCard.js`:

```javascript
export async function shareOrDownloadCard(imageUrl, filename, shareTitle) {
  const response = await fetch(imageUrl)
  if (!response.ok) throw new Error('Could not load the card image')
  const blob = await response.blob()
  const file = new File([blob], filename, { type: 'image/png' })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: shareTitle })
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Add the share button to `NomineeOption`**

Replace `src/components/awards/NomineeOption.jsx`:

```jsx
export default function NomineeOption({ nominee, selected, onSelect, onShare }) {
  return (
    <div
      className={[
        'flex flex-col overflow-hidden rounded-lg border bg-surface text-left shadow-sm transition-shadow hover:shadow-md',
        selected ? 'border-green-900' : 'border-hairline',
      ].join(' ')}
    >
      <button type="button" onClick={onSelect} className="relative flex aspect-[4/5] w-full items-center justify-center bg-surface-low">
        {nominee.photo_url ? (
          <img src={nominee.photo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-ink-muted">
            <span className="material-symbols-outlined text-4xl">person</span>
          </span>
        )}
        {selected && (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-900 text-white shadow-sm">
            <span className="material-symbols-outlined text-sm">check</span>
          </span>
        )}
        {onShare && (
          <span
            role="button"
            aria-label={`Share campaign card for ${nominee.name}`}
            onClick={(e) => {
              e.stopPropagation()
              onShare()
            }}
            className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-surface/90 text-ink shadow-sm hover:bg-surface"
          >
            <span className="material-symbols-outlined text-base">share</span>
          </span>
        )}
      </button>
      <div className="flex flex-col gap-1 p-3 text-center">
        <span className="truncate text-sm font-semibold text-ink-900">{nominee.name}</span>
        {selected && (
          <span className="mx-auto rounded bg-green-900/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[.05em] text-green-900">
            Selected
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire `onShare` in `Awards.jsx`**

In `src/pages/Awards.jsx`, import the utility and the toast context is already imported (`useToast`). Add the handler and pass it down in the `voting` phase's nominee grid:

```javascript
import { shareOrDownloadCard } from '../lib/shareCard'
```

```javascript
async function handleShareNominee(nominee) {
  try {
    await shareOrDownloadCard(
      `/api/award-card?type=campaign&nomineeId=${nominee.id}`,
      `${nominee.name.replace(/\s+/g, '-')}-campaign-card.png`,
      `Vote for ${nominee.name}`,
    )
  } catch (error) {
    toast.error(error.message)
  }
}
```

Update the `<NomineeOption>` usage inside the `voting` phase's category loop:

```jsx
<NomineeOption
  key={n.id}
  nominee={n}
  selected={selections[c.id] === n.id}
  onSelect={() => setSelections((prev) => ({ ...prev, [c.id]: n.id }))}
  onShare={() => handleShareNominee(n)}
/>
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Manual verification against a deployed preview**

(The `/api/award-card` endpoint needs a real Vercel environment, per Task 7 Step 2.) During `voting` phase, tap the share icon on a nominee card on a mobile browser that supports Web Share (e.g. Chrome on Android) — confirm the native share sheet opens with the campaign PNG attached. On desktop Chrome, confirm it falls back to a direct file download instead of throwing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shareCard.js src/components/awards/NomineeOption.jsx src/pages/Awards.jsx
git commit -m "feat: share/download a campaign card for each nominee during voting"
```

---

## Task 9: Download winner card on revealed results

**Files:**
- Modify: `src/components/awards/ResultsSummary.jsx`

**Interfaces:**
- Consumes: `shareOrDownloadCard` (Task 8).

- [ ] **Step 1: Add the download button**

In `src/components/awards/ResultsSummary.jsx`, import the utility:

```javascript
import { shareOrDownloadCard } from '../../lib/shareCard'
```

Add a handler function above the component's `return`:

```javascript
async function handleDownloadWinnerCard(categoryId, winnerName) {
  try {
    await shareOrDownloadCard(
      `/api/award-card?type=winner&categoryId=${categoryId}`,
      `${winnerName.replace(/\s+/g, '-')}-winner-card.png`,
      `${winnerName} — Winner`,
    )
  } catch {
    // Silently ignored here since ResultsSummary has no toast context wired in;
    // the download simply won't start, which is visible to the user directly.
  }
}
```

Inside the `winner &&` block, add a button next to the existing vote-count text (within the `<div className="text-left sm:text-right">` block), so the final block reads:

```jsx
{winner && (
  <div className="mt-3 flex flex-col gap-3 rounded-lg bg-orange-100 p-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-3">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-hairline bg-surface">
        {winner.nominee.photo_url ? (
          <img src={winner.nominee.photo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-ink-muted">
            <span className="material-symbols-outlined text-2xl">person</span>
          </span>
        )}
      </div>
      <div className="flex flex-col">
        <span className="w-fit rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[.05em] text-white">
          Winner
        </span>
        <span className="mt-0.5 font-bold text-ink-900">{winner.nominee.name}</span>
      </div>
    </div>
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="text-left sm:text-right">
        <span className="block font-bold text-orange-600">
          {winner.count} vote{winner.count === 1 ? '' : 's'}
        </span>
        <span className="text-xs text-ink-muted">
          {totalVotes ? Math.round((winner.count / totalVotes) * 100) : 0}% share
        </span>
      </div>
      <button
        type="button"
        onClick={() => handleDownloadWinnerCard(category.id, winner.nominee.name)}
        className="inline-flex items-center gap-1 rounded-md bg-surface px-2.5 py-1.5 text-xs font-semibold text-green-900 shadow-sm hover:bg-hairline/30"
      >
        <span className="material-symbols-outlined text-sm">download</span>
        Download result card
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Manual verification against a deployed preview**

On a revealed season's `/awards` results view (and the equivalent admin results view if it renders `ResultsSummary`), click "Download result card" for a category with a winner and confirm a PNG downloads matching the approved winner template, with the actual winning nominee's name/photo/category.

- [ ] **Step 4: Commit**

```bash
git add src/components/awards/ResultsSummary.jsx
git commit -m "feat: add winner-card download button to revealed award results"
```
