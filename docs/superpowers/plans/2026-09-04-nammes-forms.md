# NAMMES Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a general-purpose form builder for NAMMES Hub — admins design forms from a set of question types, students/visitors fill them out, admins review responses three ways (summary, table, individual) and export CSV.

**Architecture:** Three new Supabase tables (`forms`, `form_questions`, `form_responses`, the latter storing answers as a single JSONB blob keyed by question id) plus a `form-uploads` storage bucket, all gated by RLS (public read on forms/questions, admin-only write, response rules driven by per-form settings). A `src/data/forms.js` + `src/data/formResponses.js` pair of query/pure-helper modules feeds a public listing (`/forms`) and fill-out page (`/forms/:id`), and an admin builder (`/admin/forms/:id/edit`) plus a three-tab responses view (`/admin/forms/:id/responses`), all built from this app's existing UI primitives (`Card`, `Button`, `FormField`, `Table`, `Badge`, `EmptyState`, `ErrorState`, `Skeleton*`).

**Tech Stack:** React 19, Vite, react-router-dom v7, @tanstack/react-query v5, @supabase/supabase-js v2, Tailwind v4, Vitest. No new dependencies — CSV export is a hand-rolled string builder, charts are plain divs (no charting library).

**Spec:** `docs/superpowers/specs/2026-09-04-nammes-forms-design.md`

## Global Constraints

- No new npm dependencies — CSV export and summary charts are built from scratch, matching this project's existing `chartMath.js` convention of computing chart data in JS.
- This project tracks no local SQL migrations — schema changes are applied directly against Supabase (dashboard SQL Editor or a connected Supabase MCP tool) and are not committed as files, per `ADMIN.md`'s documented workflow. Any step that changes the live database schema requires explicit user confirmation before applying — this is a shared, hard-to-reverse system.
- RLS is the real security boundary everywhere — the UI never checks "am I an admin" client-side (no such flag exists in this codebase).
- Admin delete actions require a confirmation step — use native `confirm()`, matching every existing admin page (see `AdminSubmissions.jsx`).
- Only pure functions get Vitest coverage. Pages/components are verified manually against the running dev server (`npm run dev`) — this project has no `@testing-library/react` or similar installed, and existing specs (e.g. outline submissions) follow the same manual-verification convention for UI.
- Follow existing component APIs exactly as documented in `DESIGN_SYSTEM.md` and as implemented in `src/components/ui/*` — do not add new props or variants to shared components for this feature.
- Single light theme, no dark mode, no new icon set (Material Symbols only, matching every existing admin page).

---

## Task 1: Database schema, RLS policies, and storage bucket

**Files:** none in the repo — this task applies SQL directly against the project's Supabase database, per this project's existing schema-management convention (see Global Constraints).

**Interfaces:**
- Produces: tables `forms`, `form_questions`, `form_responses` and storage bucket `form-uploads`, all referenced by column name in every later task's Supabase queries.

- [ ] **Step 1: Confirm with the user before applying**

Show the user the full SQL block below and explicitly ask for confirmation before running it — this changes live production schema and is hard to reverse.

- [ ] **Step 2: Apply the SQL**

Run the following against the project's Supabase database — via a connected Supabase MCP tool (`execute_sql` / `apply_migration`) if available and the user has approved that path, otherwise paste it into the Supabase Dashboard → SQL Editor and run it there, then confirm with the user that it completed without error.

```sql
create table forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_accepting_responses boolean not null default true,
  closes_at timestamptz,
  require_signin boolean not null default false,
  one_response_per_person boolean not null default false,
  allow_edit_after_submit boolean not null default false
);

create table form_questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  position int not null,
  type text not null,
  label text not null,
  helper_text text,
  required boolean not null default false,
  options jsonb,
  scale_min int,
  scale_max int,
  scale_min_label text,
  scale_max_label text
);

create table form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  respondent_id uuid references auth.users(id),
  respondent_email text,
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table forms enable row level security;
alter table form_questions enable row level security;
alter table form_responses enable row level security;

create policy "forms_select_all" on forms for select using (true);
create policy "forms_insert_admin" on forms for insert with check (
  exists (select 1 from admins where admins.user_id = auth.uid())
);
create policy "forms_update_admin" on forms for update using (
  exists (select 1 from admins where admins.user_id = auth.uid())
);
create policy "forms_delete_admin" on forms for delete using (
  exists (select 1 from admins where admins.user_id = auth.uid())
);

create policy "form_questions_select_all" on form_questions for select using (true);
create policy "form_questions_insert_admin" on form_questions for insert with check (
  exists (select 1 from admins where admins.user_id = auth.uid())
);
create policy "form_questions_update_admin" on form_questions for update using (
  exists (select 1 from admins where admins.user_id = auth.uid())
);
create policy "form_questions_delete_admin" on form_questions for delete using (
  exists (select 1 from admins where admins.user_id = auth.uid())
);

create policy "form_responses_insert" on form_responses for insert with check (
  exists (
    select 1 from forms
    where forms.id = form_responses.form_id
      and (
        forms.require_signin = false
        or (forms.require_signin = true and auth.uid() = form_responses.respondent_id)
      )
      and (
        forms.one_response_per_person = false
        or not exists (
          select 1 from form_responses existing
          where existing.form_id = form_responses.form_id
            and existing.respondent_id = form_responses.respondent_id
        )
      )
  )
);

create policy "form_responses_select_own" on form_responses for select using (
  auth.uid() = respondent_id
);

create policy "form_responses_select_admin" on form_responses for select using (
  exists (select 1 from admins where admins.user_id = auth.uid())
);

create policy "form_responses_update_own" on form_responses for update using (
  auth.uid() = respondent_id
  and exists (
    select 1 from forms
    where forms.id = form_responses.form_id
      and forms.allow_edit_after_submit = true
      and forms.is_accepting_responses = true
  )
);

create policy "form_responses_delete_admin" on form_responses for delete using (
  exists (select 1 from admins where admins.user_id = auth.uid())
);

insert into storage.buckets (id, name, public) values ('form-uploads', 'form-uploads', true)
on conflict (id) do nothing;

create policy "form_uploads_select_public" on storage.objects for select using (
  bucket_id = 'form-uploads'
);

create policy "form_uploads_insert" on storage.objects for insert with check (
  bucket_id = 'form-uploads'
  and exists (
    select 1 from forms
    where forms.id = ((storage.foldername(name))[1])::uuid
      and (
        forms.require_signin = false
        or (forms.require_signin = true and auth.uid() is not null)
      )
  )
);

create policy "form_uploads_delete_admin" on storage.objects for delete using (
  bucket_id = 'form-uploads' and exists (select 1 from admins where admins.user_id = auth.uid())
);
```

- [ ] **Step 3: Verify**

Run this against the same database and confirm all three rows come back:

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('forms', 'form_questions', 'form_responses');
```

Also confirm the bucket exists: `select id from storage.buckets where id = 'form-uploads';` should return one row.

No commit for this task — nothing in the repo changed.

---

## Task 2: `src/data/forms.js` — question types, validation, form queries

**Files:**
- Create: `src/data/forms.js`
- Test: `src/data/forms.test.js`

**Interfaces:**
- Consumes: `supabase` from `../lib/supabaseClient`, `useQuery` from `@tanstack/react-query`, the `forms`/`form_questions` tables from Task 1.
- Produces (used by every later task):
  - `QUESTION_TYPES: Array<{ value, label, hasOptions, isScale }>`
  - `validateFormDraft({ title }): string | null`
  - `validateQuestionDraft(question): string | null`
  - `validateQuestions(questions): string | null`
  - `validateAnswers(questions, answers): string | null`
  - `isFormOpen(form, now = new Date()): boolean`
  - `fetchOpenForms(): Promise<Form[]>`, `useFormsQuery()`
  - `fetchAllForms(): Promise<Form[]>`, `useAllFormsQuery()`
  - `fetchFormWithQuestions(id): Promise<Form & { questions: Question[] }>`, `useFormQuery(id)`

- [ ] **Step 1: Write the failing test file**

Create `src/data/forms.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  validateFormDraft,
  validateQuestionDraft,
  validateQuestions,
  validateAnswers,
  isFormOpen,
} from './forms'

describe('validateFormDraft', () => {
  it('requires a title', () => {
    expect(validateFormDraft({ title: '' })).toBe('A title is required.')
    expect(validateFormDraft({ title: '   ' })).toBe('A title is required.')
  })
  it('returns null for a valid title', () => {
    expect(validateFormDraft({ title: 'RSVP' })).toBeNull()
  })
})

describe('validateQuestionDraft', () => {
  it('requires a label', () => {
    expect(validateQuestionDraft({ type: 'short_text', label: '' })).toBe('Every question needs a label.')
  })
  it('requires at least one non-blank option for a choice question', () => {
    expect(validateQuestionDraft({ type: 'multiple_choice', label: 'Pick one', options: [] })).toBe(
      'Add at least one option.'
    )
    expect(validateQuestionDraft({ type: 'multiple_choice', label: 'Pick one', options: ['', '  '] })).toBe(
      'Add at least one option.'
    )
  })
  it('accepts a choice question with at least one non-blank option', () => {
    expect(validateQuestionDraft({ type: 'multiple_choice', label: 'Pick one', options: ['A'] })).toBeNull()
  })
  it('requires scale_min less than scale_max for a linear scale', () => {
    expect(
      validateQuestionDraft({ type: 'linear_scale', label: 'Rate it', scale_min: 5, scale_max: 5 })
    ).toBe('Scale minimum must be less than maximum.')
  })
  it('accepts a valid linear scale', () => {
    expect(
      validateQuestionDraft({ type: 'linear_scale', label: 'Rate it', scale_min: 1, scale_max: 5 })
    ).toBeNull()
  })
  it('returns null for a valid short-text question', () => {
    expect(validateQuestionDraft({ type: 'short_text', label: 'Name' })).toBeNull()
  })
})

describe('validateQuestions', () => {
  it('returns the first error found', () => {
    expect(
      validateQuestions([{ type: 'short_text', label: 'Name' }, { type: 'short_text', label: '' }])
    ).toBe('Every question needs a label.')
  })
  it('returns null when every question is valid', () => {
    expect(validateQuestions([{ type: 'short_text', label: 'Name' }])).toBeNull()
  })
})

describe('validateAnswers', () => {
  const questions = [
    { id: 'q1', label: 'Name', required: true },
    { id: 'q2', label: 'Notes', required: false },
    { id: 'q3', label: 'Toppings', required: true },
  ]
  it('flags a missing required answer', () => {
    expect(validateAnswers(questions, { q3: ['A'] })).toBe('"Name" is required.')
  })
  it('flags an empty-array required answer (e.g. unchecked checkboxes)', () => {
    expect(validateAnswers(questions, { q1: 'Ada', q3: [] })).toBe('"Toppings" is required.')
  })
  it('passes when every required question is answered', () => {
    expect(validateAnswers(questions, { q1: 'Ada', q3: ['A'] })).toBeNull()
  })
})

describe('isFormOpen', () => {
  const now = new Date('2026-09-04T12:00:00Z')
  it('is false when is_accepting_responses is false', () => {
    expect(isFormOpen({ is_accepting_responses: false, closes_at: null }, now)).toBe(false)
  })
  it('is false when closes_at is in the past', () => {
    expect(isFormOpen({ is_accepting_responses: true, closes_at: '2026-09-01T00:00:00Z' }, now)).toBe(false)
  })
  it('is true when closes_at is in the future', () => {
    expect(isFormOpen({ is_accepting_responses: true, closes_at: '2026-09-10T00:00:00Z' }, now)).toBe(true)
  })
  it('is true when closes_at is not set', () => {
    expect(isFormOpen({ is_accepting_responses: true, closes_at: null }, now)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/data/forms.test.js`
Expected: FAIL — `./forms` has no exported members (the module doesn't exist yet).

- [ ] **Step 3: Implement `src/data/forms.js`**

```js
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export const QUESTION_TYPES = [
  { value: 'short_text', label: 'Short answer', hasOptions: false, isScale: false },
  { value: 'paragraph', label: 'Paragraph', hasOptions: false, isScale: false },
  { value: 'multiple_choice', label: 'Multiple choice', hasOptions: true, isScale: false },
  { value: 'checkboxes', label: 'Checkboxes', hasOptions: true, isScale: false },
  { value: 'dropdown', label: 'Dropdown', hasOptions: true, isScale: false },
  { value: 'linear_scale', label: 'Linear scale', hasOptions: false, isScale: true },
  { value: 'file_upload', label: 'File upload', hasOptions: false, isScale: false },
  { value: 'date', label: 'Date', hasOptions: false, isScale: false },
  { value: 'time', label: 'Time', hasOptions: false, isScale: false },
]

export function validateFormDraft({ title }) {
  if (!title || !title.trim()) return 'A title is required.'
  return null
}

export function validateQuestionDraft(question) {
  if (!question.label || !question.label.trim()) return 'Every question needs a label.'
  const type = QUESTION_TYPES.find((t) => t.value === question.type)
  if (type?.hasOptions) {
    const options = (question.options || []).filter((o) => o.trim())
    if (options.length === 0) return 'Add at least one option.'
  }
  if (type?.isScale) {
    const min = Number(question.scale_min)
    const max = Number(question.scale_max)
    if (!(min < max)) return 'Scale minimum must be less than maximum.'
  }
  return null
}

export function validateQuestions(questions) {
  for (const q of questions) {
    const error = validateQuestionDraft(q)
    if (error) return error
  }
  return null
}

export function validateAnswers(questions, answers) {
  for (const q of questions) {
    if (!q.required) continue
    const value = answers[q.id]
    const isEmpty =
      value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
    if (isEmpty) return `"${q.label}" is required.`
  }
  return null
}

export function isFormOpen(form, now = new Date()) {
  if (!form.is_accepting_responses) return false
  if (form.closes_at && new Date(form.closes_at) <= now) return false
  return true
}

export async function fetchOpenForms() {
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('is_accepting_responses', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.filter((f) => isFormOpen(f))
}

export function useFormsQuery() {
  return useQuery({ queryKey: ['forms', 'open'], queryFn: fetchOpenForms })
}

export async function fetchAllForms() {
  const { data, error } = await supabase.from('forms').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export function useAllFormsQuery() {
  return useQuery({ queryKey: ['forms', 'all'], queryFn: fetchAllForms })
}

export async function fetchFormWithQuestions(id) {
  const { data, error } = await supabase
    .from('forms')
    .select('*, form_questions(*)')
    .eq('id', id)
    .order('position', { referencedTable: 'form_questions' })
    .single()
  if (error) throw error
  return { ...data, questions: data.form_questions }
}

export function useFormQuery(id) {
  return useQuery({ queryKey: ['forms', id], queryFn: () => fetchFormWithQuestions(id), enabled: Boolean(id) })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/data/forms.test.js`
Expected: PASS, all describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/data/forms.js src/data/forms.test.js
git commit -m "feat: add forms data layer (question types, validation, queries)"
```

---

## Task 3: `src/data/formResponses.js` — response queries, summary/CSV helpers

**Files:**
- Create: `src/data/formResponses.js`
- Test: `src/data/formResponses.test.js`

**Interfaces:**
- Consumes: `supabase`, `useQuery` from `@tanstack/react-query`.
- Produces (used by every later task):
  - `fetchFormResponses(formId): Promise<Response[]>`, `useFormResponsesQuery(formId)`
  - `fetchMyResponse(formId, userId): Promise<Response | null>`, `useMyResponseQuery(formId, userId)`
  - `countResponsesByForm(rows): Record<formId, number>`, `fetchResponseCountsByForm()`, `useResponseCountsQuery()`
  - `formatAnswerForDisplay(question, value): string`
  - `buildResponseSummary(questions, responses): Array<{ question, kind: 'choice' | 'text', counts?, answers? }>`
  - `responsesToCsv(questions, responses): string`
  - `collectFileUploadUrls(questions, responses): string[]`
  - `storagePathFromUrl(url, bucket): string | null`

- [ ] **Step 1: Write the failing test file**

Create `src/data/formResponses.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  countResponsesByForm,
  buildResponseSummary,
  formatAnswerForDisplay,
  responsesToCsv,
  collectFileUploadUrls,
  storagePathFromUrl,
} from './formResponses'

describe('countResponsesByForm', () => {
  it('counts rows per form_id', () => {
    expect(countResponsesByForm([{ form_id: 'a' }, { form_id: 'a' }, { form_id: 'b' }])).toEqual({ a: 2, b: 1 })
  })
  it('returns an empty object for no rows', () => {
    expect(countResponsesByForm([])).toEqual({})
  })
})

describe('formatAnswerForDisplay', () => {
  it('joins a checkbox array with commas', () => {
    expect(formatAnswerForDisplay({ type: 'checkboxes' }, ['A', 'B'])).toBe('A, B')
  })
  it('renders an em dash for an unanswered question', () => {
    expect(formatAnswerForDisplay({ type: 'short_text' }, undefined)).toBe('—')
    expect(formatAnswerForDisplay({ type: 'short_text' }, '')).toBe('—')
  })
  it('stringifies a scalar answer', () => {
    expect(formatAnswerForDisplay({ type: 'linear_scale' }, 4)).toBe('4')
  })
  it('passes through a file_upload URL as-is', () => {
    expect(formatAnswerForDisplay({ type: 'file_upload' }, 'https://x/y.pdf')).toBe('https://x/y.pdf')
  })
})

describe('buildResponseSummary', () => {
  const questions = [
    { id: 'q1', type: 'multiple_choice', options: ['Yes', 'No'] },
    { id: 'q2', type: 'checkboxes', options: ['Red', 'Blue'] },
    { id: 'q3', type: 'linear_scale', scale_min: 1, scale_max: 3 },
    { id: 'q4', type: 'short_text' },
  ]
  const responses = [
    { answers: { q1: 'Yes', q2: ['Red', 'Blue'], q3: 2, q4: 'Great event' } },
    { answers: { q1: 'Yes', q2: ['Red'], q3: 3, q4: 'Loved it' } },
    { answers: { q1: 'No', q2: [], q3: 1 } },
  ]

  it('counts multiple_choice answers per option, in option order', () => {
    const [q1Summary] = buildResponseSummary(questions, responses)
    expect(q1Summary.kind).toBe('choice')
    expect(q1Summary.counts).toEqual([{ option: 'Yes', count: 2 }, { option: 'No', count: 1 }])
  })

  it('flattens and counts checkboxes answers per option', () => {
    const [, q2Summary] = buildResponseSummary(questions, responses)
    expect(q2Summary.counts).toEqual([{ option: 'Red', count: 2 }, { option: 'Blue', count: 1 }])
  })

  it('counts linear_scale answers across the full min-max range', () => {
    const [, , q3Summary] = buildResponseSummary(questions, responses)
    expect(q3Summary.counts).toEqual([
      { option: '1', count: 1 },
      { option: '2', count: 1 },
      { option: '3', count: 1 },
    ])
  })

  it('collects short_text answers as a plain text list, skipping unanswered', () => {
    const [, , , q4Summary] = buildResponseSummary(questions, responses)
    expect(q4Summary.kind).toBe('text')
    expect(q4Summary.answers).toEqual(['Great event', 'Loved it'])
  })
})

describe('responsesToCsv', () => {
  it('writes a header row of "Submitted at" plus question labels', () => {
    const questions = [{ id: 'q1', type: 'short_text', label: 'Name' }, { id: 'q2', type: 'checkboxes', label: 'Toppings' }]
    expect(responsesToCsv(questions, [])).toBe('Submitted at,Name,Toppings')
  })
  it('writes one row per response, joining checkbox answers', () => {
    const questions = [{ id: 'q1', type: 'short_text', label: 'Name' }, { id: 'q2', type: 'checkboxes', label: 'Toppings' }]
    const csv = responsesToCsv(questions, [
      { submitted_at: '2026-09-04T12:00:00.000Z', answers: { q1: 'Ada', q2: ['Red', 'Blue'] } },
    ])
    expect(csv).toBe('Submitted at,Name,Toppings\n2026-09-04T12:00:00.000Z,Ada,"Red, Blue"')
  })
  it('quotes and escapes a value containing a comma or quote', () => {
    const csv = responsesToCsv([{ id: 'q1', type: 'short_text', label: 'Name' }], [
      { submitted_at: '2026-09-04T12:00:00.000Z', answers: { q1: 'Smith, "Ada"' } },
    ])
    expect(csv).toContain('"Smith, ""Ada"""')
  })
})

describe('collectFileUploadUrls', () => {
  it('collects file_upload answer values across all responses', () => {
    const questions = [{ id: 'q1', type: 'file_upload' }, { id: 'q2', type: 'short_text' }]
    const responses = [{ answers: { q1: 'https://x/a.pdf', q2: 'text' } }, { answers: { q1: 'https://x/b.pdf' } }]
    expect(collectFileUploadUrls(questions, responses)).toEqual(['https://x/a.pdf', 'https://x/b.pdf'])
  })
  it('returns an empty array when there are no file_upload questions', () => {
    expect(collectFileUploadUrls([{ id: 'q1', type: 'short_text' }], [{ answers: { q1: 'x' } }])).toEqual([])
  })
})

describe('storagePathFromUrl', () => {
  it('extracts the path after the bucket segment', () => {
    expect(
      storagePathFromUrl('https://x.supabase.co/storage/v1/object/public/form-uploads/abc/file.pdf', 'form-uploads')
    ).toBe('abc/file.pdf')
  })
  it('returns null when the bucket segment is not present', () => {
    expect(storagePathFromUrl('https://x/other-bucket/file.pdf', 'form-uploads')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/data/formResponses.test.js`
Expected: FAIL — `./formResponses` doesn't exist yet.

- [ ] **Step 3: Implement `src/data/formResponses.js`**

```js
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchFormResponses(formId) {
  const { data, error } = await supabase
    .from('form_responses')
    .select('*')
    .eq('form_id', formId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return data
}

export function useFormResponsesQuery(formId) {
  return useQuery({
    queryKey: ['form_responses', formId],
    queryFn: () => fetchFormResponses(formId),
    enabled: Boolean(formId),
  })
}

export async function fetchMyResponse(formId, userId) {
  const { data, error } = await supabase
    .from('form_responses')
    .select('*')
    .eq('form_id', formId)
    .eq('respondent_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export function useMyResponseQuery(formId, userId) {
  return useQuery({
    queryKey: ['form_responses', formId, 'mine', userId],
    queryFn: () => fetchMyResponse(formId, userId),
    enabled: Boolean(formId) && Boolean(userId),
  })
}

export function countResponsesByForm(rows) {
  const counts = {}
  rows.forEach((r) => {
    counts[r.form_id] = (counts[r.form_id] || 0) + 1
  })
  return counts
}

export async function fetchResponseCountsByForm() {
  const { data, error } = await supabase.from('form_responses').select('form_id')
  if (error) throw error
  return countResponsesByForm(data)
}

export function useResponseCountsQuery() {
  return useQuery({ queryKey: ['form_responses', 'counts'], queryFn: fetchResponseCountsByForm })
}

export function formatAnswerForDisplay(question, value) {
  if (value === undefined || value === null || value === '') return '—'
  if (question.type === 'checkboxes' && Array.isArray(value)) return value.join(', ')
  return String(value)
}

function countByOption(options, values) {
  return (options || []).map((option) => ({
    option,
    count: values.filter((v) => String(v) === String(option)).length,
  }))
}

function scaleOptions(question) {
  const opts = []
  for (let i = question.scale_min; i <= question.scale_max; i++) opts.push(String(i))
  return opts
}

export function buildResponseSummary(questions, responses) {
  return questions.map((q) => {
    const rawValues = responses.map((r) => r.answers?.[q.id])
    const values = rawValues.filter((v) => v !== undefined && v !== null && v !== '')

    if (q.type === 'multiple_choice' || q.type === 'dropdown') {
      return { question: q, kind: 'choice', counts: countByOption(q.options, values) }
    }
    if (q.type === 'checkboxes') {
      const flat = values.flatMap((v) => (Array.isArray(v) ? v : [v]))
      return { question: q, kind: 'choice', counts: countByOption(q.options, flat) }
    }
    if (q.type === 'linear_scale') {
      return { question: q, kind: 'choice', counts: countByOption(scaleOptions(q), values.map(String)) }
    }
    return { question: q, kind: 'text', answers: values.map(String) }
  })
}

function csvEscape(value) {
  const str = String(value ?? '')
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function responsesToCsv(questions, responses) {
  const header = ['Submitted at', ...questions.map((q) => q.label)]
  const lines = [header.map(csvEscape).join(',')]
  responses.forEach((r) => {
    const row = [
      r.submitted_at,
      ...questions.map((q) => {
        const display = formatAnswerForDisplay(q, r.answers?.[q.id])
        return display === '—' ? '' : display
      }),
    ]
    lines.push(row.map(csvEscape).join(','))
  })
  return lines.join('\n')
}

export function collectFileUploadUrls(questions, responses) {
  const fileQuestionIds = questions.filter((q) => q.type === 'file_upload').map((q) => q.id)
  const urls = []
  responses.forEach((r) => {
    fileQuestionIds.forEach((qid) => {
      const value = r.answers?.[qid]
      if (value) urls.push(value)
    })
  })
  return urls
}

export function storagePathFromUrl(url, bucket) {
  const marker = `/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/data/formResponses.test.js`
Expected: PASS, all describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/data/formResponses.js src/data/formResponses.test.js
git commit -m "feat: add form responses data layer (queries, summary, CSV)"
```

---

## Task 4: `AdminForms.jsx` — admin form list

**Files:**
- Create: `src/pages/admin/AdminForms.jsx`
- Modify: `src/App.jsx` — add lazy import + route
- Modify: `src/pages/Admin.jsx` — add `ADMIN_SECTIONS` entry

**Interfaces:**
- Consumes: `useAllFormsQuery`, `isFormOpen`, `fetchFormWithQuestions` (`../../data/forms`); `useResponseCountsQuery`, `fetchFormResponses`, `collectFileUploadUrls`, `storagePathFromUrl` (`../../data/formResponses`); `supabase`; `useToast`; UI components `Breadcrumbs`, `Button`, `Badge`, `EmptyState`, `ErrorState`, `SkeletonTable`.
- Produces: route `/admin/forms`, linking to `/admin/forms/new`, `/admin/forms/:id/edit`, `/admin/forms/:id/responses` (built in later tasks).

- [ ] **Step 1: Create `src/pages/admin/AdminForms.jsx`**

```jsx
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useAllFormsQuery, isFormOpen, fetchFormWithQuestions } from '../../data/forms'
import {
  useResponseCountsQuery,
  fetchFormResponses,
  collectFileUploadUrls,
  storagePathFromUrl,
} from '../../data/formResponses'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'

function assertRowsChanged(rows) {
  if (!rows || rows.length === 0) {
    throw new Error('No changes were saved — your account may not have admin access to make this change.')
  }
}

export default function AdminForms() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const formsQuery = useAllFormsQuery()
  const countsQuery = useResponseCountsQuery()
  const forms = formsQuery.data ?? []
  const counts = countsQuery.data ?? {}

  const deleteMutation = useMutation({
    mutationFn: async (form) => {
      const fullForm = await fetchFormWithQuestions(form.id)
      const responses = await fetchFormResponses(form.id)
      const fileUrls = collectFileUploadUrls(fullForm.questions, responses)
      const paths = fileUrls.map((url) => storagePathFromUrl(url, 'form-uploads')).filter(Boolean)
      if (paths.length > 0) await supabase.storage.from('form-uploads').remove(paths)
      const { data, error } = await supabase.from('forms').delete().eq('id', form.id).select()
      if (error) throw error
      assertRowsChanged(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] })
      queryClient.invalidateQueries({ queryKey: ['form_responses'] })
      toast.success('Form deleted.')
    },
    onError: (error) => toast.error(error.message),
  })

  function handleDelete(form) {
    if (!confirm(`Delete "${form.title}"? This removes all its questions and responses.`)) return
    deleteMutation.mutate(form)
  }

  if (formsQuery.isError && !formsQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load forms right now." onRetry={formsQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Forms' }]} />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-900">Forms</h1>
          <p className="text-ink-muted">Build forms and review responses.</p>
        </div>
        <Link to="/admin/forms/new">
          <Button variant="primary">New form</Button>
        </Link>
      </div>

      {formsQuery.isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={4} rows={5} />
        </div>
      ) : forms.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="checklist"
            title="No forms yet"
            description="Create your first form to start collecting responses."
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {forms.map((form) => (
            <div
              key={form.id}
              className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface p-4 shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink-900">{form.title}</span>
                  <Badge tone={isFormOpen(form) ? 'updated' : 'neutral'}>
                    {isFormOpen(form) ? 'Accepting' : 'Closed'}
                  </Badge>
                </div>
                <div className="text-xs text-ink-muted">
                  {counts[form.id] ?? 0} response{(counts[form.id] ?? 0) === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link to={`/admin/forms/${form.id}/edit`}>
                  <Button variant="secondary" size="sm">Edit</Button>
                </Link>
                <Link to={`/admin/forms/${form.id}/responses`}>
                  <Button variant="secondary" size="sm">Responses</Button>
                </Link>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(form)}
                  loading={deleteMutation.isPending}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire the route in `src/App.jsx`**

Add near the other admin lazy imports:

```js
const AdminForms = lazy(() => import('./pages/admin/AdminForms'))
```

Add inside the `<Route element={<ProtectedRoute />}>` block, alongside the other `admin/*` routes:

```jsx
<Route path="admin/forms" element={<AdminForms />} />
```

- [ ] **Step 3: Add the section to `src/pages/Admin.jsx`**

Add an entry to the `ADMIN_SECTIONS` array (after the `outlines`/`submissions` entries, before `timetables`, or wherever reads naturally):

```js
{
  path: '/admin/forms',
  label: 'Forms',
  icon: 'checklist',
  category: 'Engagement',
  description: 'Build forms and review responses — RSVPs, surveys, applications.',
},
```

- [ ] **Step 4: Manual verification**

Run `npm run dev`, sign in as an admin, and go to `/admin`. Confirm:
- A "Manage Forms" card appears and links to `/admin/forms`.
- `/admin/forms` shows the empty state ("No forms yet") since no forms exist yet.
- "New form" links to `/admin/forms/new` (will 404 until Task 5 — expected at this point).

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/AdminForms.jsx src/App.jsx src/pages/Admin.jsx
git commit -m "feat: add admin forms list page"
```

---

## Task 5: `QuestionEditorCard.jsx` + `AdminFormEditor.jsx` — the form builder

**Files:**
- Create: `src/components/admin/forms/QuestionEditorCard.jsx`
- Create: `src/pages/admin/AdminFormEditor.jsx`
- Modify: `src/App.jsx` — add lazy imports + routes

**Interfaces:**
- Consumes: `QUESTION_TYPES`, `useFormQuery`, `validateFormDraft`, `validateQuestions` (`../../data/forms`); `useAuth`, `useToast`, `supabase`; UI components `Breadcrumbs`, `Button`, `FormField`, `ErrorState`.
- Produces: routes `/admin/forms/new` and `/admin/forms/:id/edit`, both rendered by `AdminFormEditor`. `QuestionEditorCard` props: `{ question, index, total, onChange, onRemove, onMoveUp, onMoveDown }`.

- [ ] **Step 1: Create `src/components/admin/forms/QuestionEditorCard.jsx`**

```jsx
import { QUESTION_TYPES } from '../../../data/forms'
import Button from '../../ui/Button'
import FormField from '../../ui/FormField'

export default function QuestionEditorCard({ question, index, total, onChange, onRemove, onMoveUp, onMoveDown }) {
  const type = QUESTION_TYPES.find((t) => t.value === question.type) ?? QUESTION_TYPES[0]

  function update(patch) {
    onChange({ ...question, ...patch })
  }

  function updateOption(i, value) {
    const options = [...(question.options || [])]
    options[i] = value
    update({ options })
  }

  function addOption() {
    update({ options: [...(question.options || []), ''] })
  }

  function removeOption(i) {
    update({ options: (question.options || []).filter((_, oi) => oi !== i) })
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <input
          value={question.label}
          onChange={(e) => update({ label: e.target.value })}
          placeholder="Question"
          className="flex-1 rounded-md border border-hairline bg-surface px-3 py-2 text-base font-semibold text-ink focus:outline-none focus:border-green-900"
        />
        <select
          value={question.type}
          onChange={(e) => {
            const nextType = QUESTION_TYPES.find((t) => t.value === e.target.value)
            update({ type: e.target.value, options: nextType?.hasOptions ? [''] : null })
          }}
          className="rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink"
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <input
        value={question.helper_text || ''}
        onChange={(e) => update({ helper_text: e.target.value })}
        placeholder="Helper text (optional)"
        className="rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink-muted focus:outline-none focus:border-green-900"
      />

      {type.hasOptions && (
        <div className="flex flex-col gap-2">
          {(question.options || []).map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={option}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="flex-1 rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-green-900"
              />
              <button type="button" onClick={() => removeOption(i)} className="text-ink-muted hover:text-danger">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          ))}
          <Button variant="ghost" size="sm" type="button" onClick={addOption}>+ Add option</Button>
        </div>
      )}

      {type.isScale && (
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Minimum"
            type="number"
            value={question.scale_min ?? 1}
            onChange={(e) => update({ scale_min: Number(e.target.value) })}
          />
          <FormField
            label="Maximum"
            type="number"
            value={question.scale_max ?? 5}
            onChange={(e) => update({ scale_max: Number(e.target.value) })}
          />
          <FormField
            label="Minimum label (optional)"
            value={question.scale_min_label || ''}
            onChange={(e) => update({ scale_min_label: e.target.value })}
          />
          <FormField
            label="Maximum label (optional)"
            value={question.scale_max_label || ''}
            onChange={(e) => update({ scale_max_label: e.target.value })}
          />
        </div>
      )}

      <div className="flex items-center justify-between border-t border-hairline pt-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={question.required} onChange={(e) => update({ required: e.target.checked })} />
          Required
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            className="p-1.5 text-ink-muted hover:text-ink-900 disabled:opacity-30"
            aria-label="Move up"
          >
            <span className="material-symbols-outlined text-lg">arrow_upward</span>
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={onMoveDown}
            className="p-1.5 text-ink-muted hover:text-ink-900 disabled:opacity-30"
            aria-label="Move down"
          >
            <span className="material-symbols-outlined text-lg">arrow_downward</span>
          </button>
          <button type="button" onClick={onRemove} className="p-1.5 text-ink-muted hover:text-danger" aria-label="Remove question">
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/pages/admin/AdminFormEditor.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import { useFormQuery, validateFormDraft, validateQuestions } from '../../data/forms'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import FormField from '../../components/ui/FormField'
import ErrorState from '../../components/ui/ErrorState'
import QuestionEditorCard from '../../components/admin/forms/QuestionEditorCard'

function assertRowsChanged(rows) {
  if (!rows || rows.length === 0) {
    throw new Error('No changes were saved — your account may not have admin access to make this change.')
  }
}

function newQuestion() {
  return {
    id: crypto.randomUUID(),
    type: 'short_text',
    label: '',
    helper_text: '',
    required: false,
    options: null,
    scale_min: 1,
    scale_max: 5,
    scale_min_label: '',
    scale_max_label: '',
  }
}

function questionToRow(q, formId, position) {
  return {
    form_id: formId,
    position,
    type: q.type,
    label: q.label.trim(),
    helper_text: q.helper_text?.trim() || null,
    required: Boolean(q.required),
    options: q.options ? q.options.map((o) => o.trim()).filter(Boolean) : null,
    scale_min: q.type === 'linear_scale' ? Number(q.scale_min) : null,
    scale_max: q.type === 'linear_scale' ? Number(q.scale_max) : null,
    scale_min_label: q.scale_min_label?.trim() || null,
    scale_max_label: q.scale_max_label?.trim() || null,
  }
}

async function saveQuestions(formId, questions) {
  const { data: existing, error: fetchError } = await supabase.from('form_questions').select('id').eq('form_id', formId)
  if (fetchError) throw fetchError
  const existingIds = new Set((existing ?? []).map((q) => q.id))

  const keepIds = new Set(questions.filter((q) => existingIds.has(q.id)).map((q) => q.id))
  const toDelete = [...existingIds].filter((qid) => !keepIds.has(qid))
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase.from('form_questions').delete().in('id', toDelete)
    if (deleteError) throw deleteError
  }

  const indexed = questions.map((q, i) => ({ q, i }))
  const toUpdate = indexed.filter(({ q }) => existingIds.has(q.id)).map(({ q, i }) => ({ id: q.id, ...questionToRow(q, formId, i) }))
  const toInsert = indexed.filter(({ q }) => !existingIds.has(q.id)).map(({ q, i }) => questionToRow(q, formId, i))

  if (toUpdate.length > 0) {
    const { error: updateError } = await supabase.from('form_questions').upsert(toUpdate)
    if (updateError) throw updateError
  }
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('form_questions').insert(toInsert)
    if (insertError) throw insertError
  }
}

export default function AdminFormEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()
  const formQuery = useFormQuery(id)

  const [hydrated, setHydrated] = useState(!id)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isAcceptingResponses, setIsAcceptingResponses] = useState(true)
  const [closesAt, setClosesAt] = useState('')
  const [requireSignin, setRequireSignin] = useState(false)
  const [oneResponsePerPerson, setOneResponsePerPerson] = useState(false)
  const [allowEditAfterSubmit, setAllowEditAfterSubmit] = useState(false)
  const [questions, setQuestions] = useState([newQuestion()])
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (hydrated || !formQuery.data) return
    const form = formQuery.data
    setTitle(form.title)
    setDescription(form.description || '')
    setIsAcceptingResponses(form.is_accepting_responses)
    setClosesAt(form.closes_at ? form.closes_at.slice(0, 16) : '')
    setRequireSignin(form.require_signin)
    setOneResponsePerPerson(form.one_response_per_person)
    setAllowEditAfterSubmit(form.allow_edit_after_submit)
    setQuestions(form.questions.length > 0 ? form.questions : [newQuestion()])
    setHydrated(true)
  }, [formQuery.data, hydrated])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const titleError = validateFormDraft({ title })
      if (titleError) throw new Error(titleError)
      const questionsError = validateQuestions(questions)
      if (questionsError) throw new Error(questionsError)

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        is_accepting_responses: isAcceptingResponses,
        closes_at: closesAt || null,
        require_signin: requireSignin,
        one_response_per_person: requireSignin ? oneResponsePerPerson : false,
        allow_edit_after_submit: allowEditAfterSubmit,
      }

      let formId = id
      if (formId) {
        const { data, error } = await supabase.from('forms').update(payload).eq('id', formId).select()
        if (error) throw error
        assertRowsChanged(data)
      } else {
        const { data, error } = await supabase.from('forms').insert({ ...payload, created_by: user.id }).select().single()
        if (error) throw error
        formId = data.id
      }

      await saveQuestions(formId, questions)
      return formId
    },
    onSuccess: (formId) => {
      queryClient.invalidateQueries({ queryKey: ['forms'] })
      toast.success('Form saved.')
      setFormError('')
      navigate(`/admin/forms/${formId}/edit`, { replace: true })
    },
    onError: (error) => setFormError(error.message),
  })

  function updateQuestion(index, next) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? next : q)))
  }

  function removeQuestion(index) {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  function moveQuestion(index, direction) {
    setQuestions((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  if (id && formQuery.isError && !formQuery.data) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this form." onRetry={formQuery.refetch} />
      </div>
    )
  }

  if (id && !hydrated) return null

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Forms', to: '/admin/forms' }, { label: id ? 'Edit' : 'New' }]} />

      <h1 className="text-3xl font-bold text-ink-900">{id ? 'Edit form' : 'New form'}</h1>

      <div className="mt-6 flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
        <FormField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Form title" required />
        <FormField
          label="Description (optional)"
          type="textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this form for?"
        />

        <div className="grid grid-cols-1 gap-3 border-t border-hairline pt-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={isAcceptingResponses} onChange={(e) => setIsAcceptingResponses(e.target.checked)} />
            Accepting responses
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={requireSignin} onChange={(e) => setRequireSignin(e.target.checked)} />
            Require sign-in to respond
          </label>
          <label className={['flex items-center gap-2 text-sm', requireSignin ? 'text-ink' : 'text-ink-muted opacity-50'].join(' ')}>
            <input
              type="checkbox"
              checked={oneResponsePerPerson}
              disabled={!requireSignin}
              onChange={(e) => setOneResponsePerPerson(e.target.checked)}
            />
            Limit to one response per person
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={allowEditAfterSubmit} onChange={(e) => setAllowEditAfterSubmit(e.target.checked)} />
            Allow editing a response after submit
          </label>
        </div>

        <FormField
          label="Closes at (optional)"
          type="datetime-local"
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
          helper="Leave blank to keep the form open until you close it manually."
        />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {questions.map((q, i) => (
          <QuestionEditorCard
            key={q.id}
            question={q}
            index={i}
            total={questions.length}
            onChange={(next) => updateQuestion(i, next)}
            onRemove={() => removeQuestion(i)}
            onMoveUp={() => moveQuestion(i, -1)}
            onMoveDown={() => moveQuestion(i, 1)}
          />
        ))}
        <Button variant="ghost" type="button" onClick={() => setQuestions((prev) => [...prev, newQuestion()])}>
          + Add question
        </Button>
      </div>

      {formError && <p className="mt-4 text-sm text-danger">{formError}</p>}

      <div className="mt-6 flex gap-3">
        <Button variant="primary" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
          Save form
        </Button>
        <Link to="/admin/forms">
          <Button variant="secondary" type="button">Cancel</Button>
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire the routes in `src/App.jsx`**

Add near the other admin lazy imports:

```js
const AdminFormEditor = lazy(() => import('./pages/admin/AdminFormEditor'))
```

Add inside the `<Route element={<ProtectedRoute />}>` block:

```jsx
<Route path="admin/forms/new" element={<AdminFormEditor />} />
<Route path="admin/forms/:id/edit" element={<AdminFormEditor />} />
```

- [ ] **Step 4: Manual verification**

Run `npm run dev`, sign in as an admin, go to `/admin/forms/new`. Confirm:
- You can set a title, add a "Multiple choice" question with two options, add a "Linear scale" question, mark one required.
- Moving a question up/down reorders it; removing a question removes it.
- Saving with an empty title shows the "A title is required." error inline and does not save.
- Saving a valid form succeeds (toast "Form saved."), redirects to `/admin/forms/:id/edit` with a real id in the URL, and reloading that URL shows the same title/questions you entered (confirms round-trip through Supabase).
- Going back to `/admin/forms` shows the new form in the list with "Accepting" badge and 0 responses.
- Editing the form again, removing one question and adding a new one, then saving, reloads with the correct final question set (confirms the update/insert/delete split in `saveQuestions` works, not just create).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/forms/QuestionEditorCard.jsx src/pages/admin/AdminFormEditor.jsx src/App.jsx
git commit -m "feat: add form builder (question editor + admin form editor page)"
```

---

## Task 6: `Forms.jsx` — public form listing

**Files:**
- Create: `src/pages/Forms.jsx`
- Modify: `src/App.jsx` — add lazy import + route
- Modify: `src/components/Navbar.jsx` — add nav link

**Interfaces:**
- Consumes: `useFormsQuery` (`../data/forms`); UI components `Card`, `EmptyState`, `ErrorState`, `SkeletonCard`.
- Produces: route `/forms`, linking to `/forms/:id` (built in Task 8).

- [ ] **Step 1: Create `src/pages/Forms.jsx`**

```jsx
import { Link } from 'react-router-dom'
import { useFormsQuery } from '../data/forms'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { SkeletonCard } from '../components/ui/Skeleton'

export default function Forms() {
  const formsQuery = useFormsQuery()
  const forms = formsQuery.data ?? []

  if (formsQuery.isError && !formsQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load forms right now." onRetry={formsQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-[.04em] font-semibold text-ink-muted">Forms</span>
        <h1 className="text-3xl font-bold text-ink-900 sm:text-4xl">Open forms</h1>
        <p className="max-w-2xl text-ink-muted">Event registrations, surveys, and applications currently accepting responses.</p>
      </div>

      {formsQuery.isLoading ? (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : forms.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon="checklist" title="No open forms right now" description="Check back later for new surveys and sign-ups." />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <Link key={form.id} to={`/forms/${form.id}`} className="no-underline">
              <Card eyebrow="Open" title={form.title} interactive>
                {form.description}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire the route in `src/App.jsx`**

Add near the other lazy imports:

```js
const Forms = lazy(() => import('./pages/Forms'))
```

Add inside the top-level `<Route element={<Layout />}>` block, alongside `events`/`resources`/etc. (before the `<Route element={<ProtectedRoute />}>` block):

```jsx
<Route path="forms" element={<Forms />} />
```

- [ ] **Step 3: Add the nav link in `src/components/Navbar.jsx`**

In the `links` array, add an entry after `opportunities` and before `contact`:

```js
{ to: '/forms', label: 'Forms' },
```

- [ ] **Step 4: Manual verification**

Run `npm run dev`. Confirm:
- "Forms" appears in the desktop nav and the mobile hamburger menu, linking to `/forms`.
- `/forms` shows the empty state if the only form created so far in Task 5 has `is_accepting_responses` on (it should show up as a card) — toggle it off in the editor and confirm it disappears from `/forms` but the row still exists in `/admin/forms`.
- Clicking a form card links to `/forms/:id` (will 404 until Task 8 — expected at this point).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Forms.jsx src/App.jsx src/components/Navbar.jsx
git commit -m "feat: add public forms listing page"
```

---

## Task 7: `QuestionField.jsx` — fill-out question renderer

**Files:**
- Create: `src/components/forms/QuestionField.jsx`

**Interfaces:**
- Consumes: `supabase` (for file uploads to the `form-uploads` bucket).
- Produces: `QuestionField` component, props `{ question, value, onChange, error }` — `value`/`onChange` shape depends on `question.type` (string for short_text/paragraph/dropdown/date/time, string|number for linear_scale, array for checkboxes, string URL for file_upload after upload completes). Consumed by `FormDetail.jsx` in Task 8.

- [ ] **Step 1: Create `src/components/forms/QuestionField.jsx`**

```jsx
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export default function QuestionField({ question, value, onChange, error }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setUploadError('Please choose a PDF, JPG, or PNG file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File must be smaller than 10MB.')
      return
    }
    setUploadError('')
    setUploading(true)
    const path = `${question.form_id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const { error: uploadErr } = await supabase.storage.from('form-uploads').upload(path, file)
    setUploading(false)
    if (uploadErr) {
      setUploadError(uploadErr.message)
      return
    }
    const { data } = supabase.storage.from('form-uploads').getPublicUrl(path)
    onChange(data.publicUrl)
  }

  function toggleCheckbox(option) {
    const current = Array.isArray(value) ? value : []
    onChange(current.includes(option) ? current.filter((o) => o !== option) : [...current, option])
  }

  const controlClass = [
    'rounded-md border px-3 py-2.5 text-base bg-surface text-ink transition-colors duration-150',
    'focus:outline-none focus:border-green-900',
    error ? 'border-danger' : 'border-hairline',
  ].join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-ink-900">
        {question.label}
        {question.required && <span className="text-danger"> *</span>}
      </label>
      {question.helper_text && <span className="text-xs text-ink-muted">{question.helper_text}</span>}

      {question.type === 'short_text' && (
        <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} className={controlClass} />
      )}

      {question.type === 'paragraph' && (
        <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={4} className={controlClass} />
      )}

      {question.type === 'multiple_choice' && (
        <div className="flex flex-col gap-2">
          {(question.options || []).map((option, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name={question.id} checked={value === option} onChange={() => onChange(option)} />
              {option}
            </label>
          ))}
        </div>
      )}

      {question.type === 'checkboxes' && (
        <div className="flex flex-col gap-2">
          {(question.options || []).map((option, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={(value || []).includes(option)} onChange={() => toggleCheckbox(option)} />
              {option}
            </label>
          ))}
        </div>
      )}

      {question.type === 'dropdown' && (
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={controlClass}>
          <option value="" disabled>Choose an option</option>
          {(question.options || []).map((option, i) => (
            <option key={i} value={option}>{option}</option>
          ))}
        </select>
      )}

      {question.type === 'linear_scale' && (
        <div className="flex items-center gap-3">
          {question.scale_min_label && <span className="text-xs text-ink-muted">{question.scale_min_label}</span>}
          {Array.from(
            { length: question.scale_max - question.scale_min + 1 },
            (_, i) => question.scale_min + i
          ).map((n) => (
            <label key={n} className="flex flex-col items-center gap-1 text-sm text-ink">
              <input type="radio" name={question.id} checked={String(value) === String(n)} onChange={() => onChange(n)} />
              {n}
            </label>
          ))}
          {question.scale_max_label && <span className="text-xs text-ink-muted">{question.scale_max_label}</span>}
        </div>
      )}

      {question.type === 'file_upload' && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-hairline bg-surface-low p-6 text-center transition-colors hover:bg-hairline/20">
          <span className="material-symbols-outlined text-3xl text-ink-muted">upload_file</span>
          <span className="text-sm font-semibold text-ink-muted">
            {uploading ? 'Uploading…' : value ? 'File uploaded — click to replace' : 'Click to choose a file'}
          </span>
          <span className="text-xs text-ink-muted">PDF, JPG, PNG up to 10MB</span>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
      )}

      {question.type === 'date' && (
        <input type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} className={controlClass} />
      )}

      {question.type === 'time' && (
        <input type="time" value={value || ''} onChange={(e) => onChange(e.target.value)} className={controlClass} />
      )}

      {uploadError && <span className="text-xs text-danger">{uploadError}</span>}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
```

- [ ] **Step 2: Manual verification (deferred)**

This component has no route of its own — it's exercised end-to-end once `FormDetail.jsx` exists in Task 8. Skip standalone verification here; Task 8's manual verification covers every question type through this component.

- [ ] **Step 3: Commit**

```bash
git add src/components/forms/QuestionField.jsx
git commit -m "feat: add question field renderer for the fill-out flow"
```

---

## Task 8: `FormDetail.jsx` — public fill-out page

**Files:**
- Create: `src/pages/FormDetail.jsx`
- Modify: `src/App.jsx` — add lazy import + route

**Interfaces:**
- Consumes: `useFormQuery`, `isFormOpen`, `validateAnswers` (`../data/forms`); `useMyResponseQuery`, `formatAnswerForDisplay` (`../data/formResponses`); `useAuth`, `useToast`, `supabase`; `QuestionField` (Task 7); UI components `Button`, `ErrorState`, `EmptyState`.
- Produces: route `/forms/:id`.

- [ ] **Step 1: Create `src/pages/FormDetail.jsx`**

```jsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'
import { useFormQuery, isFormOpen, validateAnswers } from '../data/forms'
import { useMyResponseQuery, formatAnswerForDisplay } from '../data/formResponses'
import QuestionField from '../components/forms/QuestionField'
import Button from '../components/ui/Button'
import ErrorState from '../components/ui/ErrorState'
import EmptyState from '../components/ui/EmptyState'

export default function FormDetail() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const formQuery = useFormQuery(id)
  const myResponseQuery = useMyResponseQuery(id, user?.id)

  const [answers, setAnswers] = useState({})
  const [editing, setEditing] = useState(false)
  const [formError, setFormError] = useState('')

  const form = formQuery.data

  const submitMutation = useMutation({
    mutationFn: async () => {
      const validationError = validateAnswers(form.questions, answers)
      if (validationError) throw new Error(validationError)

      if (myResponseQuery.data) {
        const { error: updateError } = await supabase
          .from('form_responses')
          .update({ answers, updated_at: new Date().toISOString() })
          .eq('id', myResponseQuery.data.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('form_responses').insert({
          form_id: id,
          respondent_id: user?.id ?? null,
          respondent_email: user?.email ?? null,
          answers,
        })
        if (insertError) throw insertError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form_responses', id, 'mine'] })
      toast.success('Response submitted — thank you!')
      setFormError('')
      setEditing(false)
    },
    onError: (error) => setFormError(error.message),
  })

  if (formQuery.isError && !formQuery.data) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this form." onRetry={formQuery.refetch} />
      </div>
    )
  }

  if (formQuery.isLoading || authLoading || !form) return null

  if (!isFormOpen(form)) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <EmptyState icon="event_busy" title="This form is closed" description="It isn't accepting responses anymore." />
      </div>
    )
  }

  if (form.require_signin && !user) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">{form.title}</h1>
        <p className="mt-4 text-ink-muted">Sign in to respond to this form.</p>
        <Link to="/login" state={{ from: { pathname: `/forms/${id}` } }}>
          <Button variant="primary" className="mt-4">Sign in</Button>
        </Link>
      </div>
    )
  }

  const existingResponse = myResponseQuery.data
  if (form.one_response_per_person && existingResponse && !editing) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">{form.title}</h1>
        <p className="mt-2 text-ink-muted">
          You&rsquo;ve already responded to this form{form.allow_edit_after_submit ? '.' : ' — thank you!'}
        </p>
        <div className="mt-6 flex flex-col gap-4">
          {form.questions.map((q) => (
            <div key={q.id}>
              <div className="text-sm font-semibold text-ink-900">{q.label}</div>
              <div className="text-sm text-ink-muted">{formatAnswerForDisplay(q, existingResponse.answers?.[q.id])}</div>
            </div>
          ))}
        </div>
        {form.allow_edit_after_submit && (
          <Button
            variant="secondary"
            className="mt-6"
            onClick={() => {
              setAnswers(existingResponse.answers || {})
              setEditing(true)
            }}
          >
            Edit response
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">{form.title}</h1>
      {form.description && <p className="mt-2 text-ink-muted">{form.description}</p>}

      <div className="mt-6 flex flex-col gap-6">
        {form.questions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            value={answers[q.id]}
            onChange={(value) => setAnswers((prev) => ({ ...prev, [q.id]: value }))}
          />
        ))}
      </div>

      {formError && <p className="mt-4 text-sm text-danger">{formError}</p>}

      <Button variant="primary" className="mt-6" onClick={() => submitMutation.mutate()} loading={submitMutation.isPending}>
        Submit
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Wire the route in `src/App.jsx`**

Add near the other lazy imports:

```js
const FormDetail = lazy(() => import('./pages/FormDetail'))
```

Add inside the top-level `<Route element={<Layout />}>` block, next to the `forms` route from Task 6 (not inside `ProtectedRoute` — sign-in is gated inline per-form, not by the route):

```jsx
<Route path="forms/:id" element={<FormDetail />} />
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`. Using the form built in Task 5 (make sure it has at least one question of each type — go back and add short answer, paragraph, multiple choice, checkboxes, dropdown, linear scale, file upload, date, and time questions so every renderer path in `QuestionField` gets exercised), confirm as a signed-out visitor on an open, non-require-signin form:
- Every question type renders correctly and is fillable, including a file upload that succeeds and shows "File uploaded — click to replace".
- Submitting with a required question left blank shows the exact `"<label>" is required.` error and does not submit.
- Submitting a complete response shows the success toast.

Then, with `require_signin` turned on for that form (edit it in `/admin/forms/:id/edit`):
- Signed out, visiting `/forms/:id` shows the "Sign in to respond" prompt instead of the form.
- Signed in, the form renders normally and can be submitted.

Then, with `one_response_per_person` also turned on:
- Submitting once, then revisiting `/forms/:id` as the same signed-in user shows the read-only "You've already responded" view with your answers, not the fillable form again.
- With `allow_edit_after_submit` off, no "Edit response" button appears. Turning it on and revisiting shows the button, and clicking it lets you change and resubmit your answers (confirm the update path, not a duplicate row, by checking `/admin/forms/:id/responses` — table view exists starting Task 9, or check the Supabase Table Editor directly for now).

Finally, toggle `is_accepting_responses` off and confirm `/forms/:id` shows the "This form is closed" state instead of erroring or 404ing.

- [ ] **Step 4: Commit**

```bash
git add src/pages/FormDetail.jsx src/App.jsx
git commit -m "feat: add public form fill-out page"
```

---

## Task 9: `ResponseTableTab.jsx` + `ResponseIndividualTab.jsx`

**Files:**
- Create: `src/components/admin/forms/ResponseTableTab.jsx`
- Create: `src/components/admin/forms/ResponseIndividualTab.jsx`

**Interfaces:**
- Consumes: `formatAnswerForDisplay` (`../../../data/formResponses`); UI components `Table`, `Button`.
- Produces: `ResponseTableTab`/`ResponseIndividualTab` components, both with props `{ questions, responses }`. Consumed by `AdminFormResponses.jsx` in Task 11.

- [ ] **Step 1: Create `src/components/admin/forms/ResponseTableTab.jsx`**

```jsx
import Table from '../../ui/Table'
import { formatAnswerForDisplay } from '../../../data/formResponses'

export default function ResponseTableTab({ questions, responses }) {
  const columns = ['Submitted', ...questions.map((q) => q.label)]
  const rows = responses.map((r) => [
    new Date(r.submitted_at).toLocaleString(),
    ...questions.map((q) => formatAnswerForDisplay(q, r.answers?.[q.id])),
  ])
  return <Table columns={columns} rows={rows} />
}
```

- [ ] **Step 2: Create `src/components/admin/forms/ResponseIndividualTab.jsx`**

```jsx
import { useState } from 'react'
import Button from '../../ui/Button'
import { formatAnswerForDisplay } from '../../../data/formResponses'

export default function ResponseIndividualTab({ questions, responses }) {
  const [index, setIndex] = useState(0)
  const response = responses[index]
  if (!response) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-muted">
          Response {index + 1} of {responses.length} · {new Date(response.submitted_at).toLocaleString()}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
            Previous
          </Button>
          <Button variant="secondary" size="sm" disabled={index === responses.length - 1} onClick={() => setIndex((i) => i + 1)}>
            Next
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5">
        {questions.map((q) => (
          <div key={q.id}>
            <div className="text-sm font-semibold text-ink-900">{q.label}</div>
            <div className="text-sm text-ink-muted">{formatAnswerForDisplay(q, response.answers?.[q.id])}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Manual verification (deferred)**

Neither component has its own route — both are exercised through `AdminFormResponses.jsx` in Task 11, which is where they get verified against real response data.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/forms/ResponseTableTab.jsx src/components/admin/forms/ResponseIndividualTab.jsx
git commit -m "feat: add response table and individual view tabs"
```

---

## Task 10: `ResponseSummaryTab.jsx`

**Files:**
- Create: `src/components/admin/forms/ResponseSummaryTab.jsx`

**Interfaces:**
- Consumes: `buildResponseSummary` (`../../../data/formResponses`).
- Produces: `ResponseSummaryTab` component, props `{ questions, responses }`. Consumed by `AdminFormResponses.jsx` in Task 11.

Chart design notes (per the `dataviz` skill): each question's breakdown is a single implicit series (one question's own answer counts), so this uses one hue — the app's existing primary brand color `green-700` (already verified accessible on white per `DESIGN_SYSTEM.md`'s accessibility checklist) — not a multi-hue categorical palette, so the palette validator doesn't apply here (it validates adjacent-hue confusability across a categorical series set, and there's only one hue in play). Bars are thin (`h-2.5`), fully rounded (matching this app's pill aesthetic), on a muted `bg-hairline` track, with the count value direct-labeled at the end of every bar — appropriate here since option counts per question are low-cardinality (typically 2-8), not a dense point cloud where labeling everything would clutter. No legend, since a single series needs none.

- [ ] **Step 1: Create `src/components/admin/forms/ResponseSummaryTab.jsx`**

```jsx
import { buildResponseSummary } from '../../../data/formResponses'

export default function ResponseSummaryTab({ questions, responses }) {
  const summary = buildResponseSummary(questions, responses)

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-muted">
        {responses.length} response{responses.length === 1 ? '' : 's'}
      </p>
      {summary.map(({ question, kind, counts, answers }) => (
        <div key={question.id} className="rounded-lg border border-hairline bg-surface p-5 shadow-sm">
          <h3 className="text-base font-semibold text-ink-900">{question.label}</h3>

          {kind === 'choice' ? (
            counts.every((c) => c.count === 0) ? (
              <p className="mt-4 text-sm text-ink-muted">No answers yet.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2.5">
                {(() => {
                  const max = Math.max(...counts.map((c) => c.count), 1)
                  return counts.map(({ option, count }) => (
                    <div key={option} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-sm text-ink" title={option}>{option}</span>
                      <div className="h-2.5 flex-1 rounded-full bg-hairline">
                        <div className="h-2.5 rounded-full bg-green-700" style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                      <span className="w-6 shrink-0 text-right font-mono text-xs text-ink-muted">{count}</span>
                    </div>
                  ))
                })()}
              </div>
            )
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-xs text-ink-muted">{answers.length} answer{answers.length === 1 ? '' : 's'}</p>
              {answers.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md bg-surface-low p-3">
                  {answers.map((a, i) => (
                    <p key={i} className="border-b border-hairline py-1.5 text-sm text-ink last:border-0">{a}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Manual verification (deferred)**

No route of its own — verified in Task 11 against real response data.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/forms/ResponseSummaryTab.jsx
git commit -m "feat: add response summary tab with per-question bar breakdowns"
```

---

## Task 11: `AdminFormResponses.jsx` — responses view shell + CSV export

**Files:**
- Create: `src/pages/admin/AdminFormResponses.jsx`
- Modify: `src/App.jsx` — add lazy import + route

**Interfaces:**
- Consumes: `useFormQuery` (`../../data/forms`); `useFormResponsesQuery`, `responsesToCsv` (`../../data/formResponses`); `ResponseSummaryTab`, `ResponseTableTab`, `ResponseIndividualTab` (Tasks 9-10); UI components `Breadcrumbs`, `Button`, `ErrorState`, `EmptyState`, `SkeletonTable`.
- Produces: route `/admin/forms/:id/responses`.

- [ ] **Step 1: Create `src/pages/admin/AdminFormResponses.jsx`**

```jsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useFormQuery } from '../../data/forms'
import { useFormResponsesQuery, responsesToCsv } from '../../data/formResponses'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import ResponseSummaryTab from '../../components/admin/forms/ResponseSummaryTab'
import ResponseTableTab from '../../components/admin/forms/ResponseTableTab'
import ResponseIndividualTab from '../../components/admin/forms/ResponseIndividualTab'

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'table', label: 'Table' },
  { id: 'individual', label: 'Individual' },
]

export default function AdminFormResponses() {
  const { id } = useParams()
  const [tab, setTab] = useState('summary')
  const formQuery = useFormQuery(id)
  const responsesQuery = useFormResponsesQuery(id)

  const form = formQuery.data
  const responses = responsesQuery.data ?? []

  function handleExport() {
    const csv = responsesToCsv(form.questions, responses)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${form.title.replace(/\s+/g, '-').toLowerCase()}-responses.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if ((formQuery.isError && !form) || (responsesQuery.isError && !responsesQuery.data)) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState
          message="Couldn't load responses right now."
          onRetry={() => {
            formQuery.refetch()
            responsesQuery.refetch()
          }}
        />
      </div>
    )
  }

  if (formQuery.isLoading || responsesQuery.isLoading || !form) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <SkeletonTable columns={4} rows={5} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Forms', to: '/admin/forms' }, { label: form.title }]} />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-ink-900">{form.title} — Responses</h1>
        <Button variant="secondary" onClick={handleExport} disabled={responses.length === 0}>
          Export CSV
        </Button>
      </div>

      <div className="mt-6 flex gap-2 border-b border-hairline">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'px-4 py-2 text-sm font-semibold border-b-2 -mb-px',
              tab === t.id ? 'border-green-900 text-green-900' : 'border-transparent text-ink-muted',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {responses.length === 0 ? (
          <EmptyState icon="inbox" title="No responses yet" description="Responses will show up here once people start submitting." />
        ) : tab === 'summary' ? (
          <ResponseSummaryTab questions={form.questions} responses={responses} />
        ) : tab === 'table' ? (
          <ResponseTableTab questions={form.questions} responses={responses} />
        ) : (
          <ResponseIndividualTab questions={form.questions} responses={responses} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the route in `src/App.jsx`**

Add near the other admin lazy imports:

```js
const AdminFormResponses = lazy(() => import('./pages/admin/AdminFormResponses'))
```

Add inside the `<Route element={<ProtectedRoute />}>` block:

```jsx
<Route path="admin/forms/:id/responses" element={<AdminFormResponses />} />
```

- [ ] **Step 3: Manual verification (full end-to-end pass)**

Run `npm run dev`. Using the multi-question-type form from Task 8 with a handful of submitted responses (submit 2-3 as different users/anonymous, mixing answers):

- `/admin/forms/:id/responses` loads with the **Summary** tab active by default: choice-type questions (multiple choice, checkboxes, dropdown, linear scale) show a horizontal bar per option with the count labeled at the end and bar widths proportional to the largest option; short answer/paragraph questions show an answer count and a scrollable list of the actual text answers; an unanswered choice question shows "No answers yet."
- Switching to **Table** shows one row per response, one column per question, with checkbox answers comma-joined and unanswered cells showing "—" — wrapped so it doesn't push the page into horizontal overflow on a narrow window.
- Switching to **Individual** shows one response at a time with working Previous/Next (disabled at the ends).
- **Export CSV** downloads a file; opening it (in a spreadsheet app or a text editor) shows a header row of "Submitted at" + question labels, one row per response, and a comma/quote-containing answer properly quoted.
- Deleting the form from `/admin/forms` (Task 4's delete) removes it from the list, and re-checking the Supabase Table Editor confirms `form_questions` and `form_responses` rows are gone (cascade) and any uploaded file's storage object under `form-uploads` is gone too.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/AdminFormResponses.jsx src/App.jsx
git commit -m "feat: add admin responses view (summary/table/individual tabs, CSV export)"
```

---

## Self-Review Notes

- **Spec coverage:** question types (Task 2/7), per-form settings (Tasks 1/5/8), public listing + fill-out + gating states (Tasks 6/8), admin list/builder/responses/export (Tasks 4/5/9-11), RLS (Task 1), storage cleanup on delete (Task 4) — every spec section maps to a task.
- **Deviation from the written spec, called out explicitly:** the spec described question-save as "delete-and-reinsert on save" and a table-level unique index for `one_response_per_person`. Both were refined during planning for correctness — delete-and-reinsert would silently break historical `answers` JSONB keys (which reference question ids) on every edit; a blanket unique index can't see the per-form `one_response_per_person` flag and would over-block. Task 5 uses an update/insert/delete diff that preserves existing question ids, and Task 1's RLS insert policy scopes the one-response check to forms that opted in. The spec document was updated to match (see the `2026-09-04-nammes-forms-design.md` commit history) before this plan was written.
- **Type/name consistency checked:** `QUESTION_TYPES` (Task 2) is the single source every later task imports from (Tasks 5, 7) rather than re-declaring the type list. `formatAnswerForDisplay`/`buildResponseSummary`/`responsesToCsv`/`collectFileUploadUrls`/`storagePathFromUrl` (Task 3) are each used by name-identical imports in Tasks 4, 8, 9, 10, 11 — no renaming drift.
