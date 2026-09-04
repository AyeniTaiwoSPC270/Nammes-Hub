# Peer-Sourced Outline Submissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any signed-in student attach a past question, lecture notes, or other file/link to a course's outline page, subject to admin approval in a new moderation queue, so course pages aren't limited to the single admin-entered "Downloads" links they have today.

**Architecture:** A new `outline_submissions` table (many rows per course, `status` pending/approved/rejected) backed by a new `outline-attachments` Storage bucket, with RLS enforcing "any signed-in user can insert their own row" and "only approved rows are publicly readable" — the same RLS-is-the-real-gate pattern already used everywhere else in this app. `OutlineDetail.jsx` gains a "Community contributions" card with a `ContributeForm` (new component) for signed-in students. A new bespoke `AdminSubmissions.jsx` page (not the generic `AdminResourceManager`, since approve/reject-with-history doesn't fit its add/edit/delete shape — same reasoning `AdminEventGallery.jsx` already used) gives admins one queue across all courses.

**Tech Stack:** React (Vite), Tailwind CSS v4, Supabase (Postgres + Storage), TanStack Query, React Router. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-04-outline-submissions-design.md`

## Global Constraints

- File uploads accept PDF/JPG/PNG only, capped at **10MB**, with error messages "Please choose a PDF, JPG, or PNG file." / "File must be smaller than 10MB." (per spec).
- The Outlines pages stay public; only the *contribute* action requires a signed-in session (`useAuth()`), matching how every other write in this app is gated.
- Nothing a student submits is publicly visible until an admin approves it — enforced by RLS (`status = 'approved'` for public `select`), not just UI hiding.
- Submitter identity (`submitted_by`, `submitted_by_email`) is recorded for admin use only, never rendered on a public page.
- No client-side "am I an admin" check anywhere (none exists in this codebase — see `Navbar.jsx`) — admin pages/actions rely entirely on RLS, same as every existing admin feature.
- Lint (`npm run lint`) and build (`npm run build`) must stay clean after every task.
- Don't modify `ImageUploadField.jsx`, `AdminResourceManager.jsx`, `AdminResourceForm.jsx`, or any existing admin config file — this plan only adds new files/routes.
- Supabase project id for all migration/verification calls: `ascdypvchlbpfupsssuy` (same project used by prior plans).

---

### Task 1: Supabase schema + storage bucket

**Files:** none (Supabase migration only, applied via the `apply_migration` MCP tool)

**Interfaces:**
- Produces: `outline_submissions` table (`id uuid primary key default gen_random_uuid()`, `outline_id text not null references outlines(id) on delete cascade`, `type text not null`, `session text`, `title text not null`, `file_url text`, `external_url text`, `status text not null default 'pending'`, `submitted_by uuid not null references auth.users(id)`, `submitted_by_email text not null`, `created_at timestamptz not null default now()`); `outline-attachments` Storage bucket (public read, own-folder insert, admin-only delete).

- [ ] **Step 1: Apply the migration**

Call `apply_migration` (project_id `ascdypvchlbpfupsssuy`, name `outline_submissions`) with:

```sql
create table outline_submissions (
  id uuid primary key default gen_random_uuid(),
  outline_id text not null references outlines(id) on delete cascade,
  type text not null,
  session text,
  title text not null,
  file_url text,
  external_url text,
  status text not null default 'pending',
  submitted_by uuid not null references auth.users(id),
  submitted_by_email text not null,
  created_at timestamptz not null default now()
);

alter table outline_submissions enable row level security;

create policy "outline_submissions_insert_own" on outline_submissions for insert
  to public with check (submitted_by = auth.uid());

create policy "outline_submissions_select_approved" on outline_submissions for select
  to public using (status = 'approved');

create policy "outline_submissions_select_admin" on outline_submissions for select
  to public using (auth.uid() in (select user_id from admins));

create policy "outline_submissions_admin_update" on outline_submissions for update
  to public using (auth.uid() in (select user_id from admins));

create policy "outline_submissions_admin_delete" on outline_submissions for delete
  to public using (auth.uid() in (select user_id from admins));

insert into storage.buckets (id, name, public) values ('outline-attachments', 'outline-attachments', true);

create policy "outline_attachments_public_select" on storage.objects for select
  to public using (bucket_id = 'outline-attachments');

create policy "outline_attachments_own_insert" on storage.objects for insert
  to public with check (bucket_id = 'outline-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "outline_attachments_admin_delete" on storage.objects for delete
  to public using (bucket_id = 'outline-attachments' and auth.uid() in (select user_id from admins));
```

- [ ] **Step 2: Verify the table exists with RLS enabled**

Call `list_tables` (project_id `ascdypvchlbpfupsssuy`, schemas `["public"]`, verbose `true`) and confirm `public.outline_submissions` exists with the columns above and `rls_enabled: true`.

- [ ] **Step 3: Verify the table policies**

Call `execute_sql` (project_id `ascdypvchlbpfupsssuy`) with:
```sql
select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'outline_submissions' order by policyname;
```
Expected: 5 rows (`outline_submissions_admin_delete`/`DELETE`, `outline_submissions_admin_update`/`UPDATE`, `outline_submissions_insert_own`/`INSERT`, `outline_submissions_select_admin`/`SELECT`, `outline_submissions_select_approved`/`SELECT`).

- [ ] **Step 4: Verify the bucket and its policies**

Call `execute_sql` (project_id `ascdypvchlbpfupsssuy`) with:
```sql
select id, public from storage.buckets where id = 'outline-attachments';
```
Expected: one row, `public = true`.

```sql
select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'outline_attachments%' order by policyname;
```
Expected: 3 rows (`outline_attachments_admin_delete`/`DELETE`, `outline_attachments_own_insert`/`INSERT`, `outline_attachments_public_select`/`SELECT`).

No commit for this task — it's a database change, not a file change.

---

### Task 2: Data layer — `src/data/outlineSubmissions.js`

**Files:**
- Create: `src/data/outlineSubmissions.js`
- Create: `src/data/outlineSubmissions.test.js`

**Interfaces:**
- Consumes: `outline_submissions` table from Task 1.
- Produces: `SUBMISSION_TYPES` (`['Past Question', 'Lecture Notes', 'Other']`); `groupSubmissionsByType(rows)` → `[{ type, items }]`, one entry per non-empty type in `SUBMISSION_TYPES` order; `validateSubmissionDraft({ title, mode, hasFile, externalUrl })` → error string or `null`; `fetchApprovedSubmissions(outlineId)`, `useApprovedSubmissionsQuery(outlineId)` (queryKey `['outline_submissions', 'approved', outlineId]`); `fetchAllSubmissions()`, `useAllSubmissionsQuery()` (queryKey `['outline_submissions', 'all']`).

- [ ] **Step 1: Write the failing tests**

Create `src/data/outlineSubmissions.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { groupSubmissionsByType, validateSubmissionDraft } from './outlineSubmissions'

const fixture = [
  { id: 'a', type: 'Past Question', title: '2023 exam', session: '2023/2024' },
  { id: 'b', type: 'Past Question', title: '2022 exam', session: '2022/2023' },
  { id: 'c', type: 'Lecture Notes', title: 'Week 1 notes', session: null },
  { id: 'd', type: 'Other', title: 'Extra reading', session: null },
]

describe('groupSubmissionsByType', () => {
  it('groups rows under each known type, in SUBMISSION_TYPES order', () => {
    const groups = groupSubmissionsByType(fixture)
    expect(groups.map((g) => g.type)).toEqual(['Past Question', 'Lecture Notes', 'Other'])
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('omits a type entirely when it has no matching rows', () => {
    const groups = groupSubmissionsByType(fixture.filter((r) => r.type !== 'Other'))
    expect(groups.map((g) => g.type)).toEqual(['Past Question', 'Lecture Notes'])
  })

  it('returns an empty array for no rows', () => {
    expect(groupSubmissionsByType([])).toEqual([])
  })
})

describe('validateSubmissionDraft', () => {
  it('requires a title', () => {
    expect(validateSubmissionDraft({ title: '', mode: 'file', hasFile: true, externalUrl: '' })).toBe(
      'A title is required.'
    )
    expect(validateSubmissionDraft({ title: '   ', mode: 'file', hasFile: true, externalUrl: '' })).toBe(
      'A title is required.'
    )
  })

  it('requires a file when mode is file', () => {
    expect(validateSubmissionDraft({ title: 'x', mode: 'file', hasFile: false, externalUrl: '' })).toBe(
      'Choose a file to upload.'
    )
  })

  it('requires a link when mode is link', () => {
    expect(validateSubmissionDraft({ title: 'x', mode: 'link', hasFile: false, externalUrl: '  ' })).toBe(
      'Paste a link.'
    )
  })

  it('returns null when a file submission is complete', () => {
    expect(validateSubmissionDraft({ title: 'x', mode: 'file', hasFile: true, externalUrl: '' })).toBeNull()
  })

  it('returns null when a link submission is complete', () => {
    expect(
      validateSubmissionDraft({ title: 'x', mode: 'link', hasFile: false, externalUrl: 'https://x.com' })
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- outlineSubmissions.test.js`
Expected: FAIL — `src/data/outlineSubmissions.js` does not exist yet.

- [ ] **Step 3: Create `src/data/outlineSubmissions.js` with the pure functions and Supabase queries**

```js
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export const SUBMISSION_TYPES = ['Past Question', 'Lecture Notes', 'Other']

export function groupSubmissionsByType(rows) {
  return SUBMISSION_TYPES.map((type) => ({ type, items: rows.filter((r) => r.type === type) })).filter(
    (group) => group.items.length > 0
  )
}

export function validateSubmissionDraft({ title, mode, hasFile, externalUrl }) {
  if (!title || !title.trim()) return 'A title is required.'
  if (mode === 'file' && !hasFile) return 'Choose a file to upload.'
  if (mode === 'link' && !(externalUrl || '').trim()) return 'Paste a link.'
  return null
}

export async function fetchApprovedSubmissions(outlineId) {
  const { data, error } = await supabase
    .from('outline_submissions')
    .select('*')
    .eq('outline_id', outlineId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export function useApprovedSubmissionsQuery(outlineId) {
  return useQuery({
    queryKey: ['outline_submissions', 'approved', outlineId],
    queryFn: () => fetchApprovedSubmissions(outlineId),
    enabled: Boolean(outlineId),
  })
}

export async function fetchAllSubmissions() {
  const { data, error } = await supabase
    .from('outline_submissions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export function useAllSubmissionsQuery() {
  return useQuery({ queryKey: ['outline_submissions', 'all'], queryFn: fetchAllSubmissions })
}
```

No test for the Supabase-backed functions (`fetchApprovedSubmissions`/`useApprovedSubmissionsQuery`/`fetchAllSubmissions`/`useAllSubmissionsQuery`) — matches the existing convention where `fetchEventPhotos`/`useEventPhotosQuery` in `src/data/eventPhotos.js` are also untested; only the pure functions alongside them get unit tests.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- outlineSubmissions.test.js`
Expected: PASS, all tests green.

- [ ] **Step 5: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add src/data/outlineSubmissions.js src/data/outlineSubmissions.test.js
git commit -m "$(cat <<'EOF'
feat: add outline_submissions data layer

Pure helpers (groupSubmissionsByType, validateSubmissionDraft) get
unit tests; the Supabase query/hook pair follows the untested
fetchEventPhotos/useEventPhotosQuery convention already used for
event_photos.
EOF
)"
```

---

### Task 3: `ContributeForm` component

**Files:**
- Create: `src/components/outlines/ContributeForm.jsx`

**Interfaces:**
- Consumes: `SUBMISSION_TYPES`, `validateSubmissionDraft` (Task 2's `src/data/outlineSubmissions.js`); `useAuth` (`src/lib/AuthContext.jsx`); `useToast` (`src/lib/ToastContext.jsx`); `outline-attachments` bucket + `outline_submissions` table from Task 1.
- Produces: `ContributeForm` component — props `{ outlineId, onSubmitted }`, calls `onSubmitted()` after a successful insert.

- [ ] **Step 1: Create `src/components/outlines/ContributeForm.jsx`**

```jsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import { SUBMISSION_TYPES, validateSubmissionDraft } from '../../data/outlineSubmissions'
import Button from '../ui/Button'
import FormField from '../ui/FormField'

const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export default function ContributeForm({ outlineId, onSubmitted }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [type, setType] = useState(SUBMISSION_TYPES[0])
  const [session, setSession] = useState('')
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState('file')
  const [file, setFile] = useState(null)
  const [externalUrl, setExternalUrl] = useState('')
  const [formError, setFormError] = useState('')

  const submitMutation = useMutation({
    mutationFn: async () => {
      const validationError = validateSubmissionDraft({ title, mode, hasFile: Boolean(file), externalUrl })
      if (validationError) throw new Error(validationError)

      let file_url = null
      if (mode === 'file') {
        if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
          throw new Error('Please choose a PDF, JPG, or PNG file.')
        }
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('File must be smaller than 10MB.')
        }
        const path = `${user.id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`
        const { error: uploadError } = await supabase.storage.from('outline-attachments').upload(path, file)
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('outline-attachments').getPublicUrl(path)
        file_url = data.publicUrl
      }

      const { error: insertError } = await supabase.from('outline_submissions').insert({
        outline_id: outlineId,
        type,
        session: session.trim() || null,
        title: title.trim(),
        file_url,
        external_url: mode === 'link' ? externalUrl.trim() : null,
        submitted_by: user.id,
        submitted_by_email: user.email,
      })
      if (insertError) throw insertError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline_submissions', 'approved', outlineId] })
      toast.success('Thanks — this is awaiting review.')
      setType(SUBMISSION_TYPES[0])
      setSession('')
      setTitle('')
      setMode('file')
      setFile(null)
      setExternalUrl('')
      setFormError('')
      onSubmitted?.()
    },
    onError: (error) => {
      setFormError(error.message)
    },
  })

  function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    submitMutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Type" type="select" value={type} onChange={(e) => setType(e.target.value)} options={SUBMISSION_TYPES} />
      <FormField
        label="Session (optional)"
        value={session}
        onChange={(e) => setSession(e.target.value)}
        placeholder="e.g. 2023/2024"
      />
      <FormField
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. 2023 second semester exam"
        required
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('file')}
          className={[
            'rounded-full px-4 py-1.5 text-sm font-semibold border transition-colors',
            mode === 'file'
              ? 'bg-green-900 text-white border-green-900'
              : 'bg-surface text-ink border-hairline hover:bg-surface-low',
          ].join(' ')}
        >
          Upload a file
        </button>
        <button
          type="button"
          onClick={() => setMode('link')}
          className={[
            'rounded-full px-4 py-1.5 text-sm font-semibold border transition-colors',
            mode === 'link'
              ? 'bg-green-900 text-white border-green-900'
              : 'bg-surface text-ink border-hairline hover:bg-surface-low',
          ].join(' ')}
        >
          Paste a link
        </button>
      </div>

      {mode === 'file' ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-hairline bg-surface-low p-6 text-center transition-colors hover:bg-hairline/20">
          <span className="material-symbols-outlined text-3xl text-ink-muted">upload_file</span>
          <span className="text-sm font-semibold text-ink-muted">{file ? file.name : 'Click to choose a file'}</span>
          <span className="text-xs text-ink-muted">PDF, JPG, PNG up to 10MB</span>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
      ) : (
        <FormField
          label="Link"
          type="url"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="https://drive.google.com/…"
        />
      )}

      {formError && <span className="text-xs text-danger">{formError}</span>}

      <Button variant="primary" type="submit" loading={submitMutation.isPending}>
        Submit for review
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed (this component isn't imported anywhere yet, so the build only checks it's syntactically/type-valid in isolation).

- [ ] **Step 3: Commit**

```bash
git add src/components/outlines/ContributeForm.jsx
git commit -m "$(cat <<'EOF'
feat: add ContributeForm for student outline submissions

Upload-or-link form (PDF/JPG/PNG up to 10MB, or a pasted URL) that
inserts a pending row into outline_submissions. Not wired into any
page yet -- OutlineDetail picks it up next.
EOF
)"
```

---

### Task 4: Wire `OutlineDetail.jsx` — Community contributions card

**Files:**
- Modify: `src/pages/outlines/OutlineDetail.jsx`
- Modify: `DESIGN_SYSTEM.md`

**Interfaces:**
- Consumes: `useApprovedSubmissionsQuery`, `groupSubmissionsByType` (Task 2); `ContributeForm` (Task 3); `useAuth` (`src/lib/AuthContext.jsx`).

- [ ] **Step 1: Reorder hooks so `course` and the new queries are computed before any early return**

React's rules of hooks require every hook to run on every render — the current file computes `course` and calls hooks in between three early `return` statements, which would break if new hooks were added after them. Replace the top of the file:

```jsx
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonText } from '../../components/ui/Skeleton'
import { LEVELS, SEMESTER_LABELS, useOutlinesQuery, getCourse } from '../../data/outlines'

export default function OutlineDetail() {
  const { level, semester, code } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useOutlinesQuery()

  if (!LEVELS.includes(level) || !SEMESTER_LABELS[semester]) return <Navigate to="/outlines" replace />

  if (isError && !data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this outline right now." onRetry={refetch} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <div className="h-4 w-48 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-4 h-3 w-32 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-2 h-8 w-2/3 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-3 h-4 w-56 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-6">
          <SkeletonText lines={3} />
        </div>
        <div className="mt-6 rounded-lg border border-hairline bg-surface p-6 shadow-md">
          <div className="h-3 w-32 animate-pulse rounded-sm bg-hairline" />
          <div className="mt-4">
            <SkeletonText lines={4} />
          </div>
        </div>
      </div>
    )
  }

  const course = getCourse(data ?? [], level, semester, code)
  if (!course) return <Navigate to={`/outlines/${level}/${semester}`} replace />
```

with:

```jsx
import { useState } from 'react'
import { useParams, Navigate, useNavigate, Link } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonText } from '../../components/ui/Skeleton'
import { LEVELS, SEMESTER_LABELS, useOutlinesQuery, getCourse } from '../../data/outlines'
import { useApprovedSubmissionsQuery, groupSubmissionsByType } from '../../data/outlineSubmissions'
import { useAuth } from '../../lib/AuthContext'
import ContributeForm from '../../components/outlines/ContributeForm'

export default function OutlineDetail() {
  const { level, semester, code } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [contributing, setContributing] = useState(false)
  const { data, isLoading, isError, refetch } = useOutlinesQuery()
  const course = getCourse(data ?? [], level, semester, code)
  const submissionsQuery = useApprovedSubmissionsQuery(course?.id)
  const groups = groupSubmissionsByType(submissionsQuery.data ?? [])

  if (!LEVELS.includes(level) || !SEMESTER_LABELS[semester]) return <Navigate to="/outlines" replace />

  if (isError && !data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this outline right now." onRetry={refetch} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <div className="h-4 w-48 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-4 h-3 w-32 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-2 h-8 w-2/3 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-3 h-4 w-56 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-6">
          <SkeletonText lines={3} />
        </div>
        <div className="mt-6 rounded-lg border border-hairline bg-surface p-6 shadow-md">
          <div className="h-3 w-32 animate-pulse rounded-sm bg-hairline" />
          <div className="mt-4">
            <SkeletonText lines={4} />
          </div>
        </div>
      </div>
    )
  }

  if (!course) return <Navigate to={`/outlines/${level}/${semester}`} replace />
```

- [ ] **Step 2: Insert the Community contributions card**

Replace:

```jsx
        </Card>
      )}

      <div className="mt-8">
```

with:

```jsx
        </Card>
      )}

      <Card className="mt-6" eyebrow="Community contributions" padded>
        <div className="flex flex-col gap-4">
          {!user ? (
            <p className="text-sm text-ink-muted">
              <Link
                to="/login"
                className="font-semibold text-green-900 no-underline hover:text-orange-500 hover:underline"
              >
                Sign in
              </Link>{' '}
              to contribute a past question, notes, or other material for this course.
            </p>
          ) : contributing ? (
            <ContributeForm outlineId={course.id} onSubmitted={() => setContributing(false)} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted">
                Have a past question or notes for this course? Share it with other students.
              </p>
              <Button variant="secondary" size="sm" onClick={() => setContributing(true)}>
                Contribute
              </Button>
            </div>
          )}

          {groups.length === 0 ? (
            <p className="text-sm text-ink-muted">No contributions yet — be the first to add one.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <div key={group.type}>
                  <div className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">
                    {group.type}
                  </div>
                  <ul className="mt-1.5 space-y-1.5">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <a
                          href={item.file_url || item.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-green-900 hover:underline"
                        >
                          {item.title}
                          {item.session ? ` (${item.session})` : ''}
                          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="mt-8">
```

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 4: Update the Outlines line in `DESIGN_SYSTEM.md`**

Find (the `**Outlines**` bullet):
```
- **Outlines** — drill-down flow: level picker (`src/pages/Outlines.jsx`, 5 tiles for 100–500 Level) → semester picker (`src/pages/outlines/OutlineLevel.jsx`, First/Second Semester) → course `Table` (`src/pages/outlines/OutlineCourses.jsx`, code/title/units + "View outline" per row) → detail (`src/pages/outlines/OutlineDetail.jsx`, description + topics-covered `Card`). Routes: `/outlines`, `/outlines/:level`, `/outlines/:level/:semester`, `/outlines/:level/:semester/:code`. Sample course data lives in `src/data/outlines.js` — swap for Supabase once outlines are scoped for Admin CRUD. Shared `Breadcrumbs` component (`src/components/Breadcrumbs.jsx`) is used across all three sub-pages.
```
Replace with:
```
- **Outlines** — drill-down flow: level picker (`src/pages/Outlines.jsx`, 5 tiles for 100–500 Level) → semester picker (`src/pages/outlines/OutlineLevel.jsx`, First/Second Semester) → course `Table` (`src/pages/outlines/OutlineCourses.jsx`, code/title/units + "View outline" per row) → detail (`src/pages/outlines/OutlineDetail.jsx`, description + topics-covered `Card`, plus a "Community contributions" `Card` where signed-in students upload a file or paste a link via `src/components/outlines/ContributeForm.jsx`; admins moderate submissions at `/admin/submissions`). Routes: `/outlines`, `/outlines/:level`, `/outlines/:level/:semester`, `/outlines/:level/:semester/:code`. Sample course data lives in `src/data/outlines.js` — swap for Supabase once outlines are scoped for Admin CRUD. Shared `Breadcrumbs` component (`src/components/Breadcrumbs.jsx`) is used across all three sub-pages.
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/outlines/OutlineDetail.jsx DESIGN_SYSTEM.md
git commit -m "$(cat <<'EOF'
feat: show community contributions on the outline detail page

Signed-out visitors see a sign-in prompt; signed-in students see a
Contribute button that expands ContributeForm. Approved submissions
list below, grouped by type. Hooks were reordered so course/query
state is computed before OutlineDetail's existing early returns,
keeping hook call order stable across renders.
EOF
)"
```

---

### Task 5: Admin moderation page + routing

**Files:**
- Create: `src/pages/admin/AdminSubmissions.jsx`
- Modify: `src/pages/Admin.jsx`
- Modify: `src/App.jsx`
- Modify: `ADMIN.md`

**Interfaces:**
- Consumes: `useAllSubmissionsQuery` (Task 2's `src/data/outlineSubmissions.js`); `useOutlinesQuery` (`src/data/outlines.js`); `useToast` (`src/lib/ToastContext.jsx`).

- [ ] **Step 1: Create `src/pages/admin/AdminSubmissions.jsx`**

```jsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useOutlinesQuery } from '../../data/outlines'
import { useAllSubmissionsQuery } from '../../data/outlineSubmissions'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'

function assertRowsChanged(rows) {
  if (!rows || rows.length === 0) {
    throw new Error('No changes were saved — your account may not have admin access to make this change.')
  }
}

export default function AdminSubmissions() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [tab, setTab] = useState('pending')

  const outlinesQuery = useOutlinesQuery()
  const outlineById = new Map((outlinesQuery.data ?? []).map((o) => [o.id, o]))

  const submissionsQuery = useAllSubmissionsQuery()
  const rows = submissionsQuery.data ?? []
  const pendingRows = rows.filter((r) => r.status === 'pending')
  const historyRows = rows.filter((r) => r.status !== 'pending')
  const visibleRows = tab === 'pending' ? pendingRows : historyRows

  const approveMutation = useMutation({
    mutationFn: async (row) => {
      const { data, error } = await supabase
        .from('outline_submissions')
        .update({ status: 'approved' })
        .eq('id', row.id)
        .select()
      if (error) throw error
      assertRowsChanged(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline_submissions'] })
      toast.success('Submission approved.')
    },
    onError: (error) => toast.error(error.message),
  })

  const rejectMutation = useMutation({
    mutationFn: async (row) => {
      const { data, error } = await supabase
        .from('outline_submissions')
        .update({ status: 'rejected' })
        .eq('id', row.id)
        .select()
      if (error) throw error
      assertRowsChanged(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline_submissions'] })
      toast.success('Submission rejected.')
    },
    onError: (error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (row) => {
      if (row.file_url) {
        const path = row.file_url.split('/outline-attachments/')[1]
        if (path) await supabase.storage.from('outline-attachments').remove([decodeURIComponent(path)])
      }
      const { data, error } = await supabase.from('outline_submissions').delete().eq('id', row.id).select()
      if (error) throw error
      assertRowsChanged(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline_submissions'] })
      toast.success('Submission deleted.')
    },
    onError: (error) => toast.error(error.message),
  })

  if (submissionsQuery.isError && !submissionsQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load submissions right now." onRetry={submissionsQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Submissions' }]} />

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-ink-900">Submissions</h1>
        <p className="text-ink-muted">Review student-contributed past questions, notes, and other materials.</p>
      </div>

      <div className="mt-6 flex gap-2 border-b border-hairline">
        <button
          type="button"
          onClick={() => setTab('pending')}
          className={[
            'px-4 py-2 text-sm font-semibold border-b-2 -mb-px',
            tab === 'pending' ? 'border-green-900 text-green-900' : 'border-transparent text-ink-muted',
          ].join(' ')}
        >
          Pending{pendingRows.length > 0 ? ` (${pendingRows.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={[
            'px-4 py-2 text-sm font-semibold border-b-2 -mb-px',
            tab === 'history' ? 'border-green-900 text-green-900' : 'border-transparent text-ink-muted',
          ].join(' ')}
        >
          Approved / rejected
        </button>
      </div>

      {submissionsQuery.isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={5} rows={5} />
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="fact_check"
            title={tab === 'pending' ? 'No pending submissions' : 'No history yet'}
            description={
              tab === 'pending'
                ? 'New student contributions will show up here.'
                : 'Approved and rejected submissions will show up here.'
            }
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {visibleRows.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface p-4 shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">
                  {outlineById.get(row.outline_id)?.code ?? row.outline_id} &middot; {row.type}
                  {row.session ? ` · ${row.session}` : ''}
                </div>
                <a
                  href={row.file_url || row.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-ink-900 hover:underline"
                >
                  {row.title}
                </a>
                <div className="text-xs text-ink-muted">Submitted by {row.submitted_by_email}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                {tab === 'pending' ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => approveMutation.mutate(row)}
                      loading={approveMutation.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => rejectMutation.mutate(row)}
                      loading={rejectMutation.isPending}
                    >
                      Reject
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteMutation.mutate(row)}
                    loading={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the "Submissions" section to `src/pages/Admin.jsx`**

Replace:
```jsx
  {
    path: '/admin/outlines',
    label: 'Outlines',
    icon: 'menu_book',
    category: 'Academics',
    description: 'Maintain course outlines by level and semester.',
  },
  {
    path: '/admin/timetables',
```
with:
```jsx
  {
    path: '/admin/outlines',
    label: 'Outlines',
    icon: 'menu_book',
    category: 'Academics',
    description: 'Maintain course outlines by level and semester.',
  },
  {
    path: '/admin/submissions',
    label: 'Submissions',
    icon: 'fact_check',
    category: 'Academics',
    description: 'Review and approve student-contributed course materials.',
  },
  {
    path: '/admin/timetables',
```

Also replace the header description:
```jsx
          Exco-only workspace for managing news, events, resources, opportunities, excos, outlines, and
          timetables.
```
with:
```jsx
          Exco-only workspace for managing news, events, resources, opportunities, excos, outlines,
          timetables, and student submissions.
```

- [ ] **Step 3: Add the route in `src/App.jsx`**

Add the lazy import next to the other admin imports:
```js
const AdminOutlines = lazy(() => import('./pages/admin/AdminOutlines'))
const AdminTimetables = lazy(() => import('./pages/admin/AdminTimetables'))
```
becomes:
```js
const AdminOutlines = lazy(() => import('./pages/admin/AdminOutlines'))
const AdminSubmissions = lazy(() => import('./pages/admin/AdminSubmissions'))
const AdminTimetables = lazy(() => import('./pages/admin/AdminTimetables'))
```

Add the route inside the `<Route element={<ProtectedRoute />}>` block, right after the Outlines admin route:
```jsx
            <Route path="admin/outlines" element={<AdminOutlines />} />
            <Route path="admin/timetables" element={<AdminTimetables />} />
```
becomes:
```jsx
            <Route path="admin/outlines" element={<AdminOutlines />} />
            <Route path="admin/submissions" element={<AdminSubmissions />} />
            <Route path="admin/timetables" element={<AdminTimetables />} />
```

- [ ] **Step 4: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 5: Update `ADMIN.md`**

Replace:
```
Sign in at `/login`, then click **Admin** in the navbar (it only shows up once you're
signed in). That takes you to `/admin`, which links out to six sections:

- **News** — the department news cards shown on the homepage and `/news`.
- **Opportunities** — the deadline-sorted table on `/opportunities`.
- **Events** — entries on the `/events` page. Each row also has a **Gallery** icon
  that opens a page for uploading and removing that event's photo gallery (separate
  from the single cover photo shown on the events list).
- **Resources** — drive links / files on `/resources`.
- **Excos** — the "Meet the Excos" grid on the homepage (name, role, photo, order).
- **Outlines** — course outline entries on `/outlines`.
```
with:
```
Sign in at `/login`, then click **Admin** in the navbar (it only shows up once you're
signed in). That takes you to `/admin`, which links out to seven sections:

- **News** — the department news cards shown on the homepage and `/news`.
- **Opportunities** — the deadline-sorted table on `/opportunities`.
- **Events** — entries on the `/events` page. Each row also has a **Gallery** icon
  that opens a page for uploading and removing that event's photo gallery (separate
  from the single cover photo shown on the events list).
- **Resources** — drive links / files on `/resources`.
- **Excos** — the "Meet the Excos" grid on the homepage (name, role, photo, order).
- **Outlines** — course outline entries on `/outlines`.
- **Submissions** — student-contributed past questions/notes waiting for approval
  before they show up on a course's outline page.
```

Then replace:
```
## Image uploads

News photos, Event cover/gallery photos, and Exco photos are capped at **5MB**, image
files only. If an upload is rejected, it's almost always the file size or the file
type — resize/compress or pick a `.jpg`/`.png`.

## If the admin forms don't cover something
```
with:
```
## Image uploads

News photos, Event cover/gallery photos, and Exco photos are capped at **5MB**, image
files only. If an upload is rejected, it's almost always the file size or the file
type — resize/compress or pick a `.jpg`/`.png`.

## Outline contribution uploads

Students can attach a file (PDF/JPG/PNG, up to **10MB**) or paste a link when
contributing a past question or notes to a course outline. Submissions start as
**pending** and won't be visible to other students until approved from
**Admin → Submissions**.

## If the admin forms don't cover something
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/AdminSubmissions.jsx src/pages/Admin.jsx src/App.jsx ADMIN.md
git commit -m "$(cat <<'EOF'
feat: add admin moderation queue for outline submissions

New /admin/submissions page: a Pending tab (approve/reject) and an
Approved/rejected history tab (delete, including the storage file if
one was uploaded). Built as a bespoke page rather than
AdminResourceManager, matching how AdminEventGallery already broke
from the generic manager for a workflow it doesn't fit.
EOF
)"
```

---

### Task 6: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including the new `outlineSubmissions.test.js` tests from Task 2.

- [ ] **Step 2: Seed a temporary pending + approved submission**

The contribute/approve flows need a real logged-in session this verification pass doesn't have credentials for, so seed rows directly via `execute_sql` (project_id `ascdypvchlbpfupsssuy`) to verify the *display* paths end-to-end:

```sql
select id, code from outlines order by code limit 1;
select id, email from auth.users limit 1;
```
then, using the returned ids:
```sql
insert into outline_submissions (outline_id, type, session, title, external_url, status, submitted_by, submitted_by_email) values
  ('<outline-id>', 'Past Question', '2023/2024', 'Test approved item', 'https://example.com/approved.pdf', 'approved', '<user-id>', '<user-email>'),
  ('<outline-id>', 'Lecture Notes', null, 'Test pending item', 'https://example.com/pending.pdf', 'pending', '<user-id>', '<user-email>');
```

- [ ] **Step 3: Start the dev server and verify the public course page**

Run: `npm run dev` (background), open the seeded course's outline detail page (`/outlines/<level>/<semester>/<code>`). Confirm:
- The "Community contributions" card shows a "Past Question" group with "Test approved item (2023/2024)" linking to the external URL.
- "Test pending item" does **not** appear anywhere on the page (it's pending — RLS should hide it from the public `select`).
- If not signed in: a "Sign in to contribute" link is shown instead of the Contribute button.

- [ ] **Step 4: Verify the admin moderation queue**

Open `/admin/submissions` (requires a real admin login — flag this to the user if unavailable). Confirm:
- The Pending tab shows "Test pending item" with the course code, type, and submitter email.
- Approving it moves it to the "Approved / rejected" tab and it now appears on the public course page.
- Rejecting or deleting a test row removes it from the relevant view.

- [ ] **Step 5: Clean up the seeded data**

```sql
delete from outline_submissions where title in ('Test approved item', 'Test pending item');
```

- [ ] **Step 6: Confirm other Outlines/Admin pages are unaffected**

Open `/outlines` drill-down for a course with no submissions — confirm it shows "No contributions yet — be the first to add one." and the rest of the page (topics, texts, existing Downloads links) is unchanged. Open `/admin` → News/Events/Resources/Opportunities/Excos/Outlines/Timetable — confirm each still renders exactly as before.

- [ ] **Step 7: Stop the dev server**

Kill the `npm run dev` process started in Step 3.

- [ ] **Step 8: Flag the remaining manual check to the user**

Report to the user: the authenticated student flow (sign in → open a course → Contribute → upload a real file or paste a link → confirm the toast and that it does *not* appear publicly until approved) and the authenticated admin flow (Approve/Reject buttons, and Delete removing an uploaded file from Storage) both need a spot-check with real credentials, since this verification pass could only test the display paths via seeded/direct SQL data, not the authenticated upload/moderate flows.
