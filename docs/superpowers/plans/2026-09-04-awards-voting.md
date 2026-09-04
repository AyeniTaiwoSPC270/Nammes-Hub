# Materials Horizon Awards Voting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Google Form used for last year's Materials Horizon Awards with a department-restricted voting subsystem: admin-run nominate → curate → vote → reveal pipeline, one vote per student per category, enforced server-side via a verified matric number.

**Architecture:** Five new Postgres tables (`profiles`, `award_seasons`, `award_categories`, `award_nominations`, `award_nominees`, `award_votes`) plus RLS policies, two `SECURITY DEFINER` dedup triggers, one ballot-submission RPC, and a `handle_new_user` trigger that ties every signup to a department-format matric number. React data hooks follow this repo's existing `src/data/*.js` + TanStack Query convention; UI follows the existing public-page / `AdminResourceManager`-adjacent admin-page conventions already used by the `forms` feature.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, Supabase (Postgres + Auth + Storage + RLS), Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-awards-voting-design.md`

## Global Constraints

- Matric number format: `^240406[0-9]{3}$` (this department's prefix), enforced by a Postgres `CHECK` constraint on `profiles.student_id` — copy this regex exactly everywhere it appears (SQL and JS).
- Every DB write path in this app is gated by RLS, never by a client-side "am I allowed" check — see `docs/superpowers/specs/2026-08-09-admin-cms-design.md`.
- Migrations are applied via the Supabase MCP `apply_migration` tool (`project_id: "ascdypvchlbpfupsssuy"`), not local `.sql` files — this project has no `supabase/migrations` directory; every prior schema change (see `nammes_forms_schema`, `fix_form_responses_insert_recursion` in migration history) went in this way.
- Duplicate-submission prevention (one vote/nomination per person per category) is enforced by a `BEFORE INSERT` `SECURITY DEFINER` trigger, never an RLS policy subquery against the same table — a self-referencing RLS subquery on `award_votes`/`award_nominations` will hit `infinite recursion detected in policy for relation` exactly as it did for `form_responses` (see `docs/superpowers/specs/2026-09-04-nammes-forms-design.md`).
- Pure/testable logic (validation, grouping, tallying, phase transitions) gets Vitest coverage in a co-located `*.test.js` file. Everything else (RLS behavior, page rendering, end-to-end flow) is verified manually against the dev server and the live Supabase project — this is the existing convention in this codebase (see `adminFields.test.js`, `chartMath.test.js` vs. everything else).
- Style conventions to match exactly: page wrapper `mx-auto max-w-[…] px-5 py-12 sm:px-6`; page title `text-3xl font-bold text-ink-900`; subtext `text-ink-muted`; cards `rounded-lg border border-hairline bg-surface p-5 shadow-sm`; `Button`/`FormField`/`Badge`/`EmptyState`/`ErrorState`/`SkeletonTable` from `src/components/ui/*`; destructive/irreversible actions gated by native `confirm()`.

---

## Task 1: `profiles` table, matric validation, and signup enforcement

**Files:**
- Create: `src/data/profiles.js`
- Create: `src/data/profiles.test.js`
- Modify: `src/pages/Signup.jsx`

**Interfaces:**
- Produces (consumed by later tasks' RLS policies and by `Awards.jsx`/admin pages):
  - `MATRIC_REGEX` — `RegExp`, `/^240406\d{3}$/`
  - `validateStudentId(value: string) => string | null`
  - `isStudentIdTaken(studentId: string) => Promise<boolean>` (calls RPC `is_student_id_taken`)
  - `fetchOwnProfile(userId: string) => Promise<{ user_id, student_id, full_name, created_at } | null>`
  - `useOwnProfileQuery(userId: string | undefined)` — TanStack Query hook, `queryKey: ['profiles', 'mine', userId]`

- [ ] **Step 1: Apply the `profiles_schema` migration**

Call the Supabase MCP tool with `project_id: "ascdypvchlbpfupsssuy"`, `name: "profiles_schema"`, and this `query`:

```sql
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  student_id text not null unique check (student_id ~ '^240406[0-9]{3}$'),
  full_name text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy profiles_select_own on profiles for select using (auth.uid() = user_id);
create policy profiles_insert_own on profiles for insert with check (auth.uid() = user_id);

create or replace function is_student_id_taken(p_student_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where student_id = p_student_id);
$$;

grant execute on function is_student_id_taken(text) to anon, authenticated;

create or replace function handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (user_id, student_id, full_name)
  values (new.id, new.raw_user_meta_data->>'student_id', new.raw_user_meta_data->>'full_name');
  return new;
exception
  when unique_violation then
    raise exception 'This matric number is already registered to another account.';
  when check_violation then
    raise exception 'Matric number must match the department format (240406XXX).';
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user_profile();
```

- [ ] **Step 2: Verify the migration with a direct SQL check**

Run via `execute_sql` (same `project_id`):

```sql
select column_name, is_nullable, data_type from information_schema.columns where table_name = 'profiles' order by ordinal_position;
```

Expected: rows for `user_id`, `student_id`, `full_name`, `created_at`.

- [ ] **Step 3: Write the failing test for matric validation**

`src/data/profiles.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { MATRIC_REGEX, validateStudentId } from './profiles'

describe('MATRIC_REGEX', () => {
  it('matches a valid department matric number', () => {
    expect(MATRIC_REGEX.test('240406012')).toBe(true)
  })
  it('rejects a different department prefix', () => {
    expect(MATRIC_REGEX.test('240401012')).toBe(false)
  })
  it('rejects the wrong digit count', () => {
    expect(MATRIC_REGEX.test('24040612')).toBe(false)
  })
})

describe('validateStudentId', () => {
  it('requires a value', () => {
    expect(validateStudentId('')).toBe('Matric number is required.')
  })
  it('rejects a non-department format', () => {
    expect(validateStudentId('190402001')).toBe('Use your department matric number (format: 240406XXX).')
  })
  it('accepts a valid department matric number', () => {
    expect(validateStudentId('240406012')).toBeNull()
  })
  it('trims surrounding whitespace before validating', () => {
    expect(validateStudentId('  240406012  ')).toBeNull()
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- profiles.test.js`
Expected: FAIL — `Failed to resolve import "./profiles"`.

- [ ] **Step 5: Implement `src/data/profiles.js`**

```js
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export const MATRIC_REGEX = /^240406\d{3}$/

export function validateStudentId(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return 'Matric number is required.'
  if (!MATRIC_REGEX.test(trimmed)) return 'Use your department matric number (format: 240406XXX).'
  return null
}

export async function isStudentIdTaken(studentId) {
  const { data, error } = await supabase.rpc('is_student_id_taken', { p_student_id: studentId.trim() })
  if (error) throw error
  return data
}

export async function fetchOwnProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data
}

export function useOwnProfileQuery(userId) {
  return useQuery({
    queryKey: ['profiles', 'mine', userId],
    queryFn: () => fetchOwnProfile(userId),
    enabled: Boolean(userId),
  })
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- profiles.test.js`
Expected: PASS (9 tests).

- [ ] **Step 7: Wire matric validation into `Signup.jsx`**

Modify `src/pages/Signup.jsx`. Add the import, add a format + availability check before submit, and surface both as an inline `FormField` error on the matric number field.

Change the import line:

```js
import { supabase } from '../lib/supabaseClient'
```
to:
```js
import { supabase } from '../lib/supabaseClient'
import { validateStudentId, isStudentIdTaken } from '../data/profiles'
```

Change `handleSubmit` (currently builds `nextErrors` synchronously then calls `signUp`) to validate the matric number and check availability before calling `signUp`:

```js
async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const nextErrors = {}
    if (!email.endsWith('.edu.ng')) {
      nextErrors.email = 'Use your university email (@unilag.edu.ng)'
    }
    const studentIdError = validateStudentId(studentId)
    if (studentIdError) {
      nextErrors.studentId = studentIdError
    }
    if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters'
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords don’t match'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setBusy(true)

    if (!studentIdError) {
      const taken = await isStudentIdTaken(studentId)
      if (taken) {
        setBusy(false)
        setErrors({ studentId: 'This matric number is already registered to another account.' })
        return
      }
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, student_id: studentId.trim() },
        emailRedirectTo: `${window.location.origin}/login?created=1`,
      },
    })

    setBusy(false)

    if (error) {
      setFormError(error.message)
      return
    }

    setSent(true)
  }
```

Add `error={errors.studentId}` to the existing Student ID `FormField`:

```jsx
<FormField
  label="Student ID"
  value={studentId}
  onChange={(e) => setStudentId(e.target.value)}
  placeholder="e.g. 240406012"
  error={errors.studentId}
/>
```

(Also update the placeholder from `e.g. 190402001` to `e.g. 240406012` since this app is department-scoped.)

- [ ] **Step 8: Manually verify signup enforcement against the live project**

Run: `npm run dev`, open `/signup`.
- Submit with matric `190402001` → expect inline error "Use your department matric number (format: 240406XXX)." before any network call.
- Submit with a valid, unused matric (e.g. `240406099`) and a fresh `@...edu.ng` email → expect the existing "Check your email" success state.
- Submit again with the **same** matric number and a **different** email → expect inline error "This matric number is already registered to another account." (from the `isStudentIdTaken` pre-check, not a raw Supabase error).

- [ ] **Step 9: Commit**

```bash
git add src/data/profiles.js src/data/profiles.test.js src/pages/Signup.jsx
git commit -m "feat: enforce department matric number on signup via profiles table"
```

---

## Task 2: Award voting schema (seasons, categories, nominations, nominees, votes) + RLS

**Files:**
- No new repo files — this task is entirely a Supabase migration, verified with direct SQL. (Data-layer JS files consuming this schema come in Tasks 4–6.)

**Interfaces:**
- Produces (consumed by every later task): tables `award_seasons(id, title, phase, created_by, created_at)`, `award_categories(id, season_id, title, description, sort_order)`, `award_nominations(id, category_id, submitted_by, nominee_name, created_at, updated_at)`, `award_nominees(id, category_id, name, photo_url, sort_order)`, `award_votes(id, category_id, nominee_id, voter_id, created_at)`.

- [ ] **Step 1: Apply the `award_voting_schema` migration**

Call `apply_migration` with `project_id: "ascdypvchlbpfupsssuy"`, `name: "award_voting_schema"`, `query`:

```sql
create table award_seasons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  phase text not null default 'nominating'
    check (phase in ('nominating', 'curating', 'voting', 'closed', 'revealed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table award_categories (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references award_seasons(id) on delete cascade,
  title text not null,
  description text,
  sort_order int not null default 0
);

create table award_nominations (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references award_categories(id) on delete cascade,
  submitted_by uuid not null references auth.users(id),
  nominee_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table award_nominees (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references award_categories(id) on delete cascade,
  name text not null,
  photo_url text,
  sort_order int not null default 0
);

create table award_votes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references award_categories(id) on delete cascade,
  nominee_id uuid not null references award_nominees(id) on delete cascade,
  voter_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table award_seasons enable row level security;
alter table award_categories enable row level security;
alter table award_nominees enable row level security;
alter table award_nominations enable row level security;
alter table award_votes enable row level security;

create policy award_seasons_select_all on award_seasons for select using (true);
create policy award_seasons_insert_admin on award_seasons for insert with check (exists (select 1 from admins where admins.user_id = auth.uid()));
create policy award_seasons_update_admin on award_seasons for update using (exists (select 1 from admins where admins.user_id = auth.uid()));
create policy award_seasons_delete_admin on award_seasons for delete using (exists (select 1 from admins where admins.user_id = auth.uid()));

create policy award_categories_select_all on award_categories for select using (true);
create policy award_categories_insert_admin on award_categories for insert with check (exists (select 1 from admins where admins.user_id = auth.uid()));
create policy award_categories_update_admin on award_categories for update using (exists (select 1 from admins where admins.user_id = auth.uid()));
create policy award_categories_delete_admin on award_categories for delete using (exists (select 1 from admins where admins.user_id = auth.uid()));

create policy award_nominees_select_all on award_nominees for select using (true);
create policy award_nominees_insert_admin on award_nominees for insert with check (exists (select 1 from admins where admins.user_id = auth.uid()));
create policy award_nominees_update_admin on award_nominees for update using (exists (select 1 from admins where admins.user_id = auth.uid()));
create policy award_nominees_delete_admin on award_nominees for delete using (exists (select 1 from admins where admins.user_id = auth.uid()));

create policy award_nominations_insert on award_nominations for insert with check (
  auth.uid() = submitted_by
  and exists (select 1 from profiles where profiles.user_id = auth.uid())
  and exists (
    select 1 from award_categories c join award_seasons s on s.id = c.season_id
    where c.id = award_nominations.category_id and s.phase = 'nominating'
  )
);
create policy award_nominations_update_own on award_nominations for update using (
  auth.uid() = submitted_by
) with check (
  auth.uid() = submitted_by
  and exists (
    select 1 from award_categories c join award_seasons s on s.id = c.season_id
    where c.id = award_nominations.category_id and s.phase = 'nominating'
  )
);
create policy award_nominations_select on award_nominations for select using (
  auth.uid() = submitted_by or exists (select 1 from admins where admins.user_id = auth.uid())
);
create policy award_nominations_delete_admin on award_nominations for delete using (
  exists (select 1 from admins where admins.user_id = auth.uid())
);

create policy award_votes_insert on award_votes for insert with check (
  auth.uid() = voter_id
  and exists (select 1 from profiles where profiles.user_id = auth.uid())
  and exists (
    select 1 from award_categories c join award_seasons s on s.id = c.season_id
    where c.id = award_votes.category_id and s.phase = 'voting'
  )
);
create policy award_votes_select on award_votes for select using (
  auth.uid() = voter_id
  or exists (select 1 from admins where admins.user_id = auth.uid())
  or exists (
    select 1 from award_categories c join award_seasons s on s.id = c.season_id
    where c.id = award_votes.category_id and s.phase = 'revealed'
  )
);
create policy award_votes_delete_admin on award_votes for delete using (
  exists (select 1 from admins where admins.user_id = auth.uid())
);
```

- [ ] **Step 2: Verify tables and policies were created**

Run via `execute_sql`:

```sql
select tablename, policyname, cmd from pg_policies where tablename like 'award_%' order by tablename, cmd;
```

Expected: `award_seasons`, `award_categories`, `award_nominees` each with 4 policies (select/insert/update/delete); `award_nominations` with insert/update/select/delete; `award_votes` with insert/select/delete.

- [ ] **Step 3: Manually verify the phase-gated insert policy**

Run via `execute_sql` as a sanity check that a `nominating`-phase category is the only kind that accepts a nomination insert (full auth-context testing happens in Task 7's manual pass; this step just confirms the join condition is syntactically correct and returns the expected boolean):

```sql
insert into award_seasons (title, created_by) values ('Test Season', (select id from auth.users limit 1)) returning id;
-- note the returned id as :season_id, then:
insert into award_categories (season_id, title) values ('<season_id>', 'Best Dressed') returning id;
-- confirm the category's season is in 'nominating' phase (the default):
select s.phase from award_categories c join award_seasons s on s.id = c.season_id where c.id = '<category_id>';
-- clean up the test rows:
delete from award_seasons where title = 'Test Season';
```

Expected: `phase` returns `nominating`; the cascade delete removes the test category too (confirm with `select count(*) from award_categories where title = 'Best Dressed';` returning `0`).

No commit for this task (no repo files changed).

---

## Task 3: Duplicate-vote/nomination dedup triggers

**Files:**
- No new repo files — Supabase migration only.

**Interfaces:**
- Produces: enforced invariant "at most one `award_nominations` row per `(category_id, submitted_by)`" and "at most one `award_votes` row per `(category_id, voter_id)`", raising a human-readable exception on violation. Later tasks' insert/update mutations must expect these exceptions to surface as `error.message` from Supabase.

- [ ] **Step 1: Apply the `award_voting_dedup_triggers` migration**

Call `apply_migration` with `project_id: "ascdypvchlbpfupsssuy"`, `name: "award_voting_dedup_triggers"`, `query`:

```sql
create or replace function enforce_one_nomination_per_person()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from award_nominations
    where category_id = new.category_id and submitted_by = new.submitted_by
  ) then
    raise exception 'You have already nominated someone for this category.';
  end if;
  return new;
end;
$$;

create trigger award_nominations_dedup
before insert on award_nominations
for each row execute function enforce_one_nomination_per_person();

create or replace function enforce_one_vote_per_person()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from award_votes
    where category_id = new.category_id and voter_id = new.voter_id
  ) then
    raise exception 'You have already voted in this category.';
  end if;
  return new;
end;
$$;

create trigger award_votes_dedup
before insert on award_votes
for each row execute function enforce_one_vote_per_person();
```

- [ ] **Step 2: Verify the dedup trigger with direct SQL (bypassing RLS as the table owner, since `execute_sql` runs with elevated privileges — this confirms the trigger logic itself, independent of RLS)**

Run via `execute_sql`:

```sql
do $$
declare
  v_user_id uuid;
  v_season_id uuid;
  v_category_id uuid;
begin
  select id into v_user_id from auth.users limit 1;
  insert into award_seasons (title, created_by) values ('Trigger Test', v_user_id) returning id into v_season_id;
  insert into award_categories (season_id, title) values (v_season_id, 'Best Dressed') returning id into v_category_id;

  insert into award_nominations (category_id, submitted_by, nominee_name) values (v_category_id, v_user_id, 'Ada');

  begin
    insert into award_nominations (category_id, submitted_by, nominee_name) values (v_category_id, v_user_id, 'Bola');
    raise exception 'TEST FAILED: second nomination should have been blocked';
  exception
    when others then
      if sqlerrm != 'You have already nominated someone for this category.' then
        raise exception 'TEST FAILED: unexpected error: %', sqlerrm;
      end if;
  end;

  delete from award_seasons where id = v_season_id;
  raise notice 'PASS';
end $$;
```

Expected: `NOTICE: PASS` with no exception surfaced to the caller.

No commit for this task (no repo files changed).

---

## Task 4: Ballot submission RPC (atomic multi-category vote)

**Files:**
- No new repo files — Supabase migration only. (Consumed by `src/data/awardVotes.js` in Task 6.)

**Interfaces:**
- Produces: RPC `submit_award_ballot(p_votes jsonb)` — `p_votes` is a JSON array of `{ "category_id": "<uuid>", "nominee_id": "<uuid>" }`. Inserts one `award_votes` row per element as the calling user (`auth.uid()`), all-or-nothing: if any row is rejected by RLS or the dedup trigger, the whole call fails and no rows are inserted.

- [ ] **Step 1: Apply the `award_voting_ballot_rpc` migration**

Call `apply_migration` with `project_id: "ascdypvchlbpfupsssuy"`, `name: "award_voting_ballot_rpc"`, `query`:

```sql
create or replace function submit_award_ballot(p_votes jsonb)
returns void
language plpgsql
as $$
declare
  v jsonb;
begin
  for v in select * from jsonb_array_elements(p_votes)
  loop
    insert into award_votes (category_id, nominee_id, voter_id)
    values (
      (v->>'category_id')::uuid,
      (v->>'nominee_id')::uuid,
      auth.uid()
    );
  end loop;
end;
$$;

grant execute on function submit_award_ballot(jsonb) to authenticated;
```

Note this function has no `security definer` — it must run as the caller (`security invoker`, the default) so that `auth.uid()` resolves to the voting student and every insert still passes through the RLS policies and dedup trigger from Tasks 2–3. A single call to a `plpgsql` function is one implicit transaction, so an exception partway through the loop rolls back every insert made earlier in the same call — this is what makes the ballot atomic.

- [ ] **Step 2: Verify the function and grant exist**

Run via `execute_sql`:

```sql
select routine_name, security_type from information_schema.routines where routine_name = 'submit_award_ballot';
select grantee, privilege_type from information_schema.role_routine_grants where routine_name = 'submit_award_ballot';
```

Expected: `security_type = 'INVOKER'`; a grant row for `grantee = 'authenticated'`, `privilege_type = 'EXECUTE'`.

Full behavioral verification (auth-context-dependent, since `execute_sql` doesn't run as an authenticated end user) happens in Task 7's manual end-to-end pass.

No commit for this task (no repo files changed).

---

## Task 5: Nominee photo storage bucket

**Files:**
- No new repo files — Supabase migration only. (Consumed by `AwardNomineePhotoUploadField.jsx` in Task 10.)

**Interfaces:**
- Produces: public storage bucket `award-nominee-photos`, readable by anyone, writable only by admins.

- [ ] **Step 1: Apply the `award_nominee_photos_bucket` migration**

Call `apply_migration` with `project_id: "ascdypvchlbpfupsssuy"`, `name: "award_nominee_photos_bucket"`, `query`:

```sql
insert into storage.buckets (id, name, public) values ('award-nominee-photos', 'award-nominee-photos', true);

create policy award_nominee_photos_public_select on storage.objects for select using (bucket_id = 'award-nominee-photos');
create policy award_nominee_photos_admin_insert on storage.objects for insert with check (
  bucket_id = 'award-nominee-photos' and auth.uid() in (select admins.user_id from admins)
);
create policy award_nominee_photos_admin_update on storage.objects for update using (
  bucket_id = 'award-nominee-photos' and auth.uid() in (select admins.user_id from admins)
);
create policy award_nominee_photos_admin_delete on storage.objects for delete using (
  bucket_id = 'award-nominee-photos' and auth.uid() in (select admins.user_id from admins)
);
```

- [ ] **Step 2: Verify the bucket exists**

Run via `execute_sql`: `select id, public from storage.buckets where id = 'award-nominee-photos';`
Expected: one row, `public = true`.

No commit for this task (no repo files changed).

---

## Task 6: Data layer — seasons, categories, nominees, nominations, votes

**Files:**
- Create: `src/data/awardSeasons.js`
- Create: `src/data/awardSeasons.test.js`
- Create: `src/data/awardNominees.js`
- Create: `src/data/awardNominations.js`
- Create: `src/data/awardNominations.test.js`
- Create: `src/data/awardVotes.js`
- Create: `src/data/awardVotes.test.js`

**Interfaces:**
- Consumes: Supabase tables/RPC from Tasks 2–4 (`award_seasons`, `award_categories`, `award_nominees`, `award_nominations`, `award_votes`, RPC `submit_award_ballot`).
- Produces (consumed by all UI tasks, 8–12):
  - From `awardSeasons.js`: `AWARD_PHASES`, `nextPhase(phase)`, `phaseAdvanceLabel(phase)`, `fetchAllSeasons()`, `useAllSeasonsQuery()`, `fetchLatestSeason()`, `useLatestSeasonQuery()`, `fetchSeasonWithCategories(id)`, `useSeasonQuery(id)`, `fetchCategory(id)`, `useCategoryQuery(id)`, `createSeason({ title, createdBy })`, `updateSeasonTitle(id, title)`, `advanceSeasonPhase(id, toPhase)`.
  - From `awardNominees.js`: `fetchNomineesForCategories(categoryIds)`, `useNomineesQuery(categoryIds)`, `createNominee({ categoryId, name, photoUrl })`, `deleteNominee(id)`.
  - From `awardNominations.js`: `fetchMyNominations(seasonId, userId)`, `useMyNominationsQuery(seasonId, userId)`, `upsertNomination({ id, categoryId, userId, nomineeName })`, `fetchNominationsForCategory(categoryId)`, `useCategoryNominationsQuery(categoryId)`, `groupNominationsByText(nominations)`.
  - From `awardVotes.js`: `fetchMyVotes(seasonId, userId)`, `useMyVotesQuery(seasonId, userId)`, `submitBallot(choices)`, `fetchVotesForSeason(seasonId)`, `useSeasonVotesQuery(seasonId)`, `buildTally(votes, nominees)`.

- [ ] **Step 1: Write failing tests for the phase-transition helpers**

`src/data/awardSeasons.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { AWARD_PHASES, nextPhase, phaseAdvanceLabel } from './awardSeasons'

describe('AWARD_PHASES', () => {
  it('lists phases in order', () => {
    expect(AWARD_PHASES).toEqual(['nominating', 'curating', 'voting', 'closed', 'revealed'])
  })
})

describe('nextPhase', () => {
  it('advances through the sequence', () => {
    expect(nextPhase('nominating')).toBe('curating')
    expect(nextPhase('curating')).toBe('voting')
    expect(nextPhase('voting')).toBe('closed')
    expect(nextPhase('closed')).toBe('revealed')
  })
  it('returns null once revealed (no further phase)', () => {
    expect(nextPhase('revealed')).toBeNull()
  })
})

describe('phaseAdvanceLabel', () => {
  it('labels each forward action', () => {
    expect(phaseAdvanceLabel('nominating')).toBe('Close nominations & start curating')
    expect(phaseAdvanceLabel('curating')).toBe('Open voting')
    expect(phaseAdvanceLabel('voting')).toBe('Close voting')
    expect(phaseAdvanceLabel('closed')).toBe('Reveal results')
  })
  it('returns null for the terminal phase', () => {
    expect(phaseAdvanceLabel('revealed')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- awardSeasons.test.js`
Expected: FAIL — `Failed to resolve import "./awardSeasons"`.

- [ ] **Step 3: Implement `src/data/awardSeasons.js`**

```js
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export const AWARD_PHASES = ['nominating', 'curating', 'voting', 'closed', 'revealed']

export function nextPhase(phase) {
  const i = AWARD_PHASES.indexOf(phase)
  return i >= 0 && i < AWARD_PHASES.length - 1 ? AWARD_PHASES[i + 1] : null
}

export function phaseAdvanceLabel(phase) {
  const labels = {
    nominating: 'Close nominations & start curating',
    curating: 'Open voting',
    voting: 'Close voting',
    closed: 'Reveal results',
  }
  return labels[phase] ?? null
}

function sortCategories(season) {
  const categories = (season.award_categories || []).slice().sort((a, b) => a.sort_order - b.sort_order)
  return { ...season, categories }
}

export async function fetchAllSeasons() {
  const { data, error } = await supabase.from('award_seasons').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}
export function useAllSeasonsQuery() {
  return useQuery({ queryKey: ['award_seasons', 'all'], queryFn: fetchAllSeasons })
}

export async function fetchLatestSeason() {
  const { data, error } = await supabase
    .from('award_seasons')
    .select('*, award_categories(*)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? sortCategories(data) : null
}
export function useLatestSeasonQuery() {
  return useQuery({ queryKey: ['award_seasons', 'latest'], queryFn: fetchLatestSeason })
}

export async function fetchSeasonWithCategories(id) {
  const { data, error } = await supabase
    .from('award_seasons')
    .select('*, award_categories(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return sortCategories(data)
}
export function useSeasonQuery(id) {
  return useQuery({ queryKey: ['award_seasons', id], queryFn: () => fetchSeasonWithCategories(id), enabled: Boolean(id) })
}

export async function fetchCategory(id) {
  const { data, error } = await supabase.from('award_categories').select('*').eq('id', id).single()
  if (error) throw error
  return data
}
export function useCategoryQuery(id) {
  return useQuery({ queryKey: ['award_categories', id], queryFn: () => fetchCategory(id), enabled: Boolean(id) })
}

export async function createSeason({ title, createdBy }) {
  const { data, error } = await supabase
    .from('award_seasons')
    .insert({ title, created_by: createdBy })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSeasonTitle(id, title) {
  const { error } = await supabase.from('award_seasons').update({ title }).eq('id', id)
  if (error) throw error
}

export async function advanceSeasonPhase(id, toPhase) {
  const { error } = await supabase.from('award_seasons').update({ phase: toPhase }).eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- awardSeasons.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Implement `src/data/awardNominees.js` (no pure logic to unit test — thin CRUD wrapper)**

```js
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchNomineesForCategories(categoryIds) {
  if (categoryIds.length === 0) return []
  const { data, error } = await supabase
    .from('award_nominees')
    .select('*')
    .in('category_id', categoryIds)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data
}
export function useNomineesQuery(categoryIds) {
  return useQuery({
    queryKey: ['award_nominees', categoryIds],
    queryFn: () => fetchNomineesForCategories(categoryIds),
    enabled: categoryIds.length > 0,
  })
}

export async function createNominee({ categoryId, name, photoUrl }) {
  const { error } = await supabase
    .from('award_nominees')
    .insert({ category_id: categoryId, name, photo_url: photoUrl || null })
  if (error) throw error
}

export async function deleteNominee(id) {
  const { error } = await supabase.from('award_nominees').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 6: Write failing test for nomination grouping**

`src/data/awardNominations.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { groupNominationsByText } from './awardNominations'

describe('groupNominationsByText', () => {
  it('groups exact case/whitespace-insensitive matches and counts them', () => {
    const nominations = [
      { id: '1', nominee_name: 'Taiwo A.' },
      { id: '2', nominee_name: '  taiwo a.  ' },
      { id: '3', nominee_name: 'Chidi' },
    ]
    const groups = groupNominationsByText(nominations)
    expect(groups).toEqual([
      { displayName: 'Taiwo A.', count: 2, ids: ['1', '2'] },
      { displayName: 'Chidi', count: 1, ids: ['3'] },
    ])
  })
  it('sorts groups by count descending', () => {
    const nominations = [
      { id: '1', nominee_name: 'Bola' },
      { id: '2', nominee_name: 'Ada' },
      { id: '3', nominee_name: 'Ada' },
    ]
    const groups = groupNominationsByText(nominations)
    expect(groups[0].displayName).toBe('Ada')
    expect(groups[0].count).toBe(2)
  })
  it('returns an empty array for no nominations', () => {
    expect(groupNominationsByText([])).toEqual([])
  })
})
```

- [ ] **Step 7: Run to verify it fails, then implement `src/data/awardNominations.js`**

Run: `npm test -- awardNominations.test.js` → expect FAIL (module not found).

```js
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchMyNominations(seasonId, userId) {
  const { data, error } = await supabase
    .from('award_nominations')
    .select('*, award_categories!inner(season_id)')
    .eq('award_categories.season_id', seasonId)
    .eq('submitted_by', userId)
  if (error) throw error
  return data
}
export function useMyNominationsQuery(seasonId, userId) {
  return useQuery({
    queryKey: ['award_nominations', 'mine', seasonId, userId],
    queryFn: () => fetchMyNominations(seasonId, userId),
    enabled: Boolean(seasonId) && Boolean(userId),
  })
}

export async function upsertNomination({ id, categoryId, userId, nomineeName }) {
  if (id) {
    const { error } = await supabase
      .from('award_nominations')
      .update({ nominee_name: nomineeName, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('award_nominations')
    .insert({ category_id: categoryId, submitted_by: userId, nominee_name: nomineeName })
  if (error) throw error
}

export async function fetchNominationsForCategory(categoryId) {
  const { data, error } = await supabase
    .from('award_nominations')
    .select('*')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}
export function useCategoryNominationsQuery(categoryId) {
  return useQuery({
    queryKey: ['award_nominations', 'category', categoryId],
    queryFn: () => fetchNominationsForCategory(categoryId),
    enabled: Boolean(categoryId),
  })
}

export function groupNominationsByText(nominations) {
  const groups = new Map()
  for (const n of nominations) {
    const key = n.nominee_name.trim().toLowerCase().replace(/\s+/g, ' ')
    if (!groups.has(key)) groups.set(key, { displayName: n.nominee_name.trim(), count: 0, ids: [] })
    const g = groups.get(key)
    g.count += 1
    g.ids.push(n.id)
  }
  return Array.from(groups.values()).sort((a, b) => b.count - a.count)
}
```

Run: `npm test -- awardNominations.test.js` → expect PASS (3 tests).

- [ ] **Step 8: Write failing test for vote tallying**

`src/data/awardVotes.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildTally } from './awardVotes'

describe('buildTally', () => {
  it('counts votes per nominee and sorts descending', () => {
    const nominees = [
      { id: 'a', name: 'Ada' },
      { id: 'b', name: 'Bola' },
    ]
    const votes = [
      { nominee_id: 'a' },
      { nominee_id: 'a' },
      { nominee_id: 'b' },
    ]
    const tally = buildTally(votes, nominees)
    expect(tally).toEqual([
      { nominee: nominees[0], count: 2 },
      { nominee: nominees[1], count: 1 },
    ])
  })
  it('gives a zero-vote nominee a count of 0, not undefined', () => {
    const nominees = [{ id: 'a', name: 'Ada' }]
    expect(buildTally([], nominees)).toEqual([{ nominee: nominees[0], count: 0 }])
  })
})
```

- [ ] **Step 9: Run to verify it fails, then implement `src/data/awardVotes.js`**

Run: `npm test -- awardVotes.test.js` → expect FAIL (module not found).

```js
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchMyVotes(seasonId, userId) {
  const { data, error } = await supabase
    .from('award_votes')
    .select('*, award_categories!inner(season_id)')
    .eq('award_categories.season_id', seasonId)
    .eq('voter_id', userId)
  if (error) throw error
  return data
}
export function useMyVotesQuery(seasonId, userId) {
  return useQuery({
    queryKey: ['award_votes', 'mine', seasonId, userId],
    queryFn: () => fetchMyVotes(seasonId, userId),
    enabled: Boolean(seasonId) && Boolean(userId),
  })
}

export async function submitBallot(choices) {
  const { error } = await supabase.rpc('submit_award_ballot', { p_votes: choices })
  if (error) throw error
}

export async function fetchVotesForSeason(seasonId) {
  const { data, error } = await supabase
    .from('award_votes')
    .select('*, award_categories!inner(season_id)')
    .eq('award_categories.season_id', seasonId)
  if (error) throw error
  return data
}
export function useSeasonVotesQuery(seasonId) {
  return useQuery({
    queryKey: ['award_votes', 'season', seasonId],
    queryFn: () => fetchVotesForSeason(seasonId),
    enabled: Boolean(seasonId),
  })
}

export function buildTally(votes, nominees) {
  const counts = {}
  nominees.forEach((n) => {
    counts[n.id] = 0
  })
  votes.forEach((v) => {
    if (counts[v.nominee_id] !== undefined) counts[v.nominee_id] += 1
  })
  return nominees
    .map((n) => ({ nominee: n, count: counts[n.id] || 0 }))
    .sort((a, b) => b.count - a.count)
}
```

Run: `npm test -- awardVotes.test.js` → expect PASS (2 tests).

- [ ] **Step 10: Run the full test suite**

Run: `npm test`
Expected: all existing tests plus the new ones pass, no regressions.

- [ ] **Step 11: Commit**

```bash
git add src/data/awardSeasons.js src/data/awardSeasons.test.js src/data/awardNominees.js src/data/awardNominations.js src/data/awardNominations.test.js src/data/awardVotes.js src/data/awardVotes.test.js
git commit -m "feat: add awards voting data layer (seasons, categories, nominations, nominees, votes)"
```

---

## Task 7: Admin — season list, create/edit, category management, phase controls

**Files:**
- Create: `src/pages/admin/AdminAwards.jsx`
- Create: `src/pages/admin/AdminAwardSeason.jsx`
- Create: `src/components/admin/awards/CategoryEditorCard.jsx`
- Modify: `src/pages/Admin.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useAllSeasonsQuery`, `useSeasonQuery`, `createSeason`, `updateSeasonTitle`, `advanceSeasonPhase`, `AWARD_PHASES`, `nextPhase`, `phaseAdvanceLabel` from `src/data/awardSeasons.js` (Task 6); `useAuth` from `src/lib/AuthContext.jsx`; `useToast` from `src/lib/ToastContext.jsx`; `Button`, `FormField`, `Badge`, `EmptyState`, `ErrorState` from `src/components/ui/*`; `Breadcrumbs` from `src/components/Breadcrumbs.jsx`.
- Produces: `CategoryEditorCard({ category, index, total, onChange, onRemove, onMoveUp, onMoveDown })` — a controlled presentational card for one category's `title`/`description`, consumed only within `AdminAwardSeason.jsx`.

- [ ] **Step 1: Implement `src/components/admin/awards/CategoryEditorCard.jsx`**

```jsx
import Button from '../../ui/Button'
import FormField from '../../ui/FormField'

export default function CategoryEditorCard({ category, index, total, onChange, onRemove, onMoveUp, onMoveDown }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">
          Category {index + 1}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" type="button" disabled={index === 0} onClick={onMoveUp}>
            <span className="material-symbols-outlined text-base">arrow_upward</span>
          </Button>
          <Button variant="ghost" size="sm" type="button" disabled={index === total - 1} onClick={onMoveDown}>
            <span className="material-symbols-outlined text-base">arrow_downward</span>
          </Button>
          <Button variant="destructive" size="sm" type="button" onClick={onRemove}>
            <span className="material-symbols-outlined text-base">delete</span>
          </Button>
        </div>
      </div>
      <FormField
        label="Title"
        value={category.title}
        onChange={(e) => onChange({ ...category, title: e.target.value })}
        placeholder="Best Dressed"
        required
      />
      <FormField
        label="Description (optional)"
        type="textarea"
        value={category.description || ''}
        onChange={(e) => onChange({ ...category, description: e.target.value })}
        placeholder="What this award recognizes"
      />
    </div>
  )
}
```

- [ ] **Step 2: Implement `src/pages/admin/AdminAwards.jsx`**

```jsx
import { Link } from 'react-router-dom'
import { useAllSeasonsQuery } from '../../data/awardSeasons'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'

const PHASE_TONE = { nominating: 'new', curating: 'neutral', voting: 'updated', closed: 'neutral', revealed: 'updated' }

export default function AdminAwards() {
  const seasonsQuery = useAllSeasonsQuery()
  const seasons = seasonsQuery.data ?? []

  if (seasonsQuery.isError && !seasonsQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load award seasons right now." onRetry={seasonsQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Awards' }]} />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-900">Awards</h1>
          <p className="text-ink-muted">Run a nominate → curate → vote → reveal award season.</p>
        </div>
        <Link to="/admin/awards/new">
          <Button variant="primary">New season</Button>
        </Link>
      </div>

      {seasonsQuery.isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={3} rows={3} />
        </div>
      ) : seasons.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="how_to_vote"
            title="No award seasons yet"
            description="Create your first award season to start collecting nominations."
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {seasons.map((season) => (
            <div
              key={season.id}
              className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface p-4 shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold text-ink-900">{season.title}</span>
                <Badge tone={PHASE_TONE[season.phase]}>{season.phase}</Badge>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link to={`/admin/awards/${season.id}/edit`}>
                  <Button variant="secondary" size="sm">Manage</Button>
                </Link>
                {season.phase !== 'nominating' && season.phase !== 'curating' && (
                  <Link to={`/admin/awards/${season.id}/results`}>
                    <Button variant="secondary" size="sm">Results</Button>
                  </Link>
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

- [ ] **Step 3: Implement `src/pages/admin/AdminAwardSeason.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import { supabase } from '../../lib/supabaseClient'
import {
  useSeasonQuery,
  createSeason,
  updateSeasonTitle,
  advanceSeasonPhase,
  nextPhase,
  phaseAdvanceLabel,
} from '../../data/awardSeasons'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import FormField from '../../components/ui/FormField'
import Badge from '../../components/ui/Badge'
import ErrorState from '../../components/ui/ErrorState'
import CategoryEditorCard from '../../components/admin/awards/CategoryEditorCard'

function newCategory() {
  return { id: crypto.randomUUID(), title: '', description: '' }
}

function categoryToRow(c, seasonId, position) {
  return {
    season_id: seasonId,
    title: c.title.trim(),
    description: c.description?.trim() || null,
    sort_order: position,
  }
}

async function saveCategories(seasonId, categories) {
  const { data: existing, error: fetchError } = await supabase
    .from('award_categories')
    .select('id')
    .eq('season_id', seasonId)
  if (fetchError) throw fetchError
  const existingIds = new Set((existing ?? []).map((c) => c.id))

  const keepIds = new Set(categories.filter((c) => existingIds.has(c.id)).map((c) => c.id))
  const toDelete = [...existingIds].filter((cid) => !keepIds.has(cid))
  if (toDelete.length > 0) {
    const { error } = await supabase.from('award_categories').delete().in('id', toDelete)
    if (error) throw error
  }

  const indexed = categories.map((c, i) => ({ c, i }))
  const toUpdate = indexed
    .filter(({ c }) => existingIds.has(c.id))
    .map(({ c, i }) => ({ id: c.id, ...categoryToRow(c, seasonId, i) }))
  const toInsert = indexed
    .filter(({ c }) => !existingIds.has(c.id))
    .map(({ c, i }) => categoryToRow(c, seasonId, i))

  if (toUpdate.length > 0) {
    const { error } = await supabase.from('award_categories').upsert(toUpdate)
    if (error) throw error
  }
  if (toInsert.length > 0) {
    const { error } = await supabase.from('award_categories').insert(toInsert)
    if (error) throw error
  }
}

export default function AdminAwardSeason() {
  const { seasonId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()
  const seasonQuery = useSeasonQuery(seasonId)

  const [hydrated, setHydrated] = useState(!seasonId)
  const [title, setTitle] = useState('')
  const [categories, setCategories] = useState([newCategory()])
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (hydrated || !seasonQuery.data) return
    setTitle(seasonQuery.data.title)
    setCategories(
      seasonQuery.data.categories.length > 0
        ? seasonQuery.data.categories.map((c) => ({ id: c.id, title: c.title, description: c.description }))
        : [newCategory()],
    )
    setHydrated(true)
  }, [seasonQuery.data, hydrated])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('A season title is required.')
      const validCategories = categories.filter((c) => c.title.trim())
      if (validCategories.length === 0) throw new Error('Add at least one category.')

      let id = seasonId
      if (id) {
        await updateSeasonTitle(id, title.trim())
      } else {
        const created = await createSeason({ title: title.trim(), createdBy: user.id })
        id = created.id
      }
      await saveCategories(id, validCategories)
      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['award_seasons'] })
      toast.success('Season saved.')
      setFormError('')
      navigate(`/admin/awards/${id}/edit`, { replace: true })
    },
    onError: (error) => setFormError(error.message),
  })

  const advanceMutation = useMutation({
    mutationFn: async () => {
      const to = nextPhase(seasonQuery.data.phase)
      if (!to) return
      await advanceSeasonPhase(seasonId, to)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award_seasons'] })
      toast.success('Phase advanced.')
    },
    onError: (error) => toast.error(error.message),
  })

  function updateCategory(index, next) {
    setCategories((prev) => prev.map((c, i) => (i === index ? next : c)))
  }
  function removeCategory(index) {
    setCategories((prev) => prev.filter((_, i) => i !== index))
  }
  function moveCategory(index, direction) {
    setCategories((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  if (seasonId && seasonQuery.isError && !seasonQuery.data) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this season." onRetry={seasonQuery.refetch} />
      </div>
    )
  }
  if (seasonId && !hydrated) return null

  const phase = seasonQuery.data?.phase
  const locked = Boolean(seasonId) && phase !== 'nominating'
  const advanceLabel = phase ? phaseAdvanceLabel(phase) : null

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Awards', to: '/admin/awards' }, { label: seasonId ? 'Edit' : 'New' }]} />

      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-ink-900">{seasonId ? 'Edit season' : 'New season'}</h1>
        {phase && <Badge tone="new">{phase}</Badge>}
      </div>

      {seasonId && phase !== 'nominating' && phase !== 'revealed' && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-hairline bg-surface-low p-4">
          <p className="flex-1 text-sm text-ink-muted">
            {phase === 'curating' && 'Build the shortlist for each category from the Curate screen, then open voting.'}
            {phase === 'voting' && 'Voting is open. Close it when you’re ready to review the tallies.'}
            {phase === 'closed' && 'Voting is closed. Reveal results when you’re ready to announce winners.'}
          </p>
          <Link to={`/admin/awards/${seasonId}/results`}>
            <Button variant="secondary" size="sm">View tallies</Button>
          </Link>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
        <FormField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Materials Horizon Awards 2026" required />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {locked ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink-muted">Categories are locked once nominations close.</p>
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-hairline bg-surface p-4 shadow-sm">
                <span className="font-semibold text-ink-900">{c.title}</span>
                {seasonId && phase !== 'nominating' && (
                  <Link to={`/admin/awards/${seasonId}/categories/${c.id}/curate`}>
                    <Button variant="secondary" size="sm">Curate</Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            {categories.map((c, i) => (
              <CategoryEditorCard
                key={c.id}
                category={c}
                index={i}
                total={categories.length}
                onChange={(next) => updateCategory(i, next)}
                onRemove={() => removeCategory(i)}
                onMoveUp={() => moveCategory(i, -1)}
                onMoveDown={() => moveCategory(i, 1)}
              />
            ))}
            <Button variant="ghost" type="button" onClick={() => setCategories((prev) => [...prev, newCategory()])}>
              + Add category
            </Button>
          </>
        )}
      </div>

      {formError && <p className="mt-4 text-sm text-danger">{formError}</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        {!locked && (
          <Button variant="primary" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            Save season
          </Button>
        )}
        {seasonId && advanceLabel && (
          <Button
            variant="accent"
            loading={advanceMutation.isPending}
            onClick={() => {
              if (confirm(`${advanceLabel}? This can't be undone.`)) advanceMutation.mutate()
            }}
          >
            {advanceLabel}
          </Button>
        )}
        <Link to="/admin/awards">
          <Button variant="secondary" type="button">Cancel</Button>
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire the "Awards" admin section into `src/pages/Admin.jsx`**

Add to the `ADMIN_SECTIONS` array (after the `forms` entry):

```js
{
  path: '/admin/awards',
  label: 'Awards',
  icon: 'how_to_vote',
  category: 'Engagement',
  description: 'Run nominate, curate, vote, and reveal for department awards.',
},
```

- [ ] **Step 5: Wire routes into `src/App.jsx`**

Add lazy imports (after the `AdminFormResponses` import):

```js
const AdminAwards = lazy(() => import('./pages/admin/AdminAwards'))
const AdminAwardSeason = lazy(() => import('./pages/admin/AdminAwardSeason'))
```

Add routes (inside the `<Route element={<ProtectedRoute />}>` block, after `admin/forms/:id/responses`):

```jsx
<Route path="admin/awards" element={<AdminAwards />} />
<Route path="admin/awards/new" element={<AdminAwardSeason />} />
<Route path="admin/awards/:seasonId/edit" element={<AdminAwardSeason />} />
```

(Routes for `curate` and `results`, referenced by links in this task's pages, are added in Tasks 8 and 9 — they'll 404 until then, which is expected mid-plan.)

- [ ] **Step 6: Manually verify against the dev server**

Run: `npm run dev`, sign in as an admin (per `ADMIN.md`), go to `/admin`.
- Confirm an "Awards" card appears under "Engagement".
- Click through, create a new season "Test Awards 2026" with two categories ("Best Dressed", "Most Likely to Succeed"), save.
- Confirm it redirects to `/admin/awards/:id/edit` and both categories persist on reload.
- Remove one category, reorder the remaining ones, save again, confirm the change persists.
- Click "Close nominations & start curating", confirm the phase badge updates to `curating` and the category editor becomes read-only with a "locked" message.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/AdminAwards.jsx src/pages/admin/AdminAwardSeason.jsx src/components/admin/awards/CategoryEditorCard.jsx src/pages/Admin.jsx src/App.jsx
git commit -m "feat: add admin season/category management and phase controls for awards"
```

---

## Task 8: Admin — nomination curation screen

**Files:**
- Create: `src/components/admin/AwardNomineePhotoUploadField.jsx`
- Create: `src/pages/admin/AdminAwardCurate.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useCategoryQuery` (Task 6, `awardSeasons.js`), `useCategoryNominationsQuery`, `groupNominationsByText` (Task 6, `awardNominations.js`), `useNomineesQuery`, `createNominee`, `deleteNominee` (Task 6, `awardNominees.js`); storage bucket `award-nominee-photos` (Task 5).
- Produces: `AwardNomineePhotoUploadField({ label, url, onChange })` — same contract as `EventImageUploadField`, pointed at the `award-nominee-photos` bucket, usable by any future award-related upload need.

- [ ] **Step 1: Implement `src/components/admin/AwardNomineePhotoUploadField.jsx`**

```jsx
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function AwardNomineePhotoUploadField({ label, url, onChange }) {
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
      <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">{label}</span>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-hairline bg-surface-low p-6 text-center transition-colors hover:bg-hairline/20">
        <span className="material-symbols-outlined text-3xl text-ink-muted">add_photo_alternate</span>
        <span className="text-sm font-semibold text-ink-muted">{uploading ? 'Uploading…' : 'Click to upload photo (optional)'}</span>
        <span className="text-xs text-ink-muted">JPEG, PNG up to 5MB</span>
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

- [ ] **Step 2: Implement `src/pages/admin/AdminAwardCurate.jsx`**

```jsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../lib/ToastContext'
import { useCategoryQuery } from '../../data/awardSeasons'
import { useCategoryNominationsQuery, groupNominationsByText } from '../../data/awardNominations'
import { useNomineesQuery, createNominee, deleteNominee } from '../../data/awardNominees'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import FormField from '../../components/ui/FormField'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import AwardNomineePhotoUploadField from '../../components/admin/AwardNomineePhotoUploadField'

export default function AdminAwardCurate() {
  const { seasonId, categoryId } = useParams()
  const queryClient = useQueryClient()
  const toast = useToast()
  const categoryQuery = useCategoryQuery(categoryId)
  const nominationsQuery = useCategoryNominationsQuery(categoryId)
  const nomineesQuery = useNomineesQuery([categoryId])

  const [addingKey, setAddingKey] = useState(null)
  const [draftName, setDraftName] = useState('')
  const [draftPhotoUrl, setDraftPhotoUrl] = useState('')

  const createMutation = useMutation({
    mutationFn: () => createNominee({ categoryId, name: draftName.trim(), photoUrl: draftPhotoUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award_nominees'] })
      toast.success('Added to the shortlist.')
      setAddingKey(null)
      setDraftName('')
      setDraftPhotoUrl('')
    },
    onError: (error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteNominee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award_nominees'] })
      toast.success('Removed from the shortlist.')
    },
    onError: (error) => toast.error(error.message),
  })

  if (categoryQuery.isError || nominationsQuery.isError) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this category." onRetry={() => { categoryQuery.refetch(); nominationsQuery.refetch() }} />
      </div>
    )
  }
  if (!categoryQuery.data || !nominationsQuery.data) return null

  const groups = groupNominationsByText(nominationsQuery.data)
  const nominees = nomineesQuery.data ?? []
  const shortlistedNames = new Set(nominees.map((n) => n.name.trim().toLowerCase()))

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[
        { label: 'Admin', to: '/admin' },
        { label: 'Awards', to: '/admin/awards' },
        { label: 'Edit', to: `/admin/awards/${seasonId}/edit` },
        { label: 'Curate' },
      ]} />

      <h1 className="text-3xl font-bold text-ink-900">Curate: {categoryQuery.data.title}</h1>
      <p className="text-ink-muted">{nominationsQuery.data.length} raw nomination{nominationsQuery.data.length === 1 ? '' : 's'} submitted.</p>

      <h2 className="mt-8 text-lg font-bold text-ink-900">Shortlist ({nominees.length})</h2>
      {nominees.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon="star" title="No nominees yet" description="Add nominees from the raw submissions below." />
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {nominees.map((n) => (
            <div key={n.id} className="flex items-center justify-between rounded-lg border border-hairline bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-3">
                {n.photo_url && <img src={n.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />}
                <span className="font-semibold text-ink-900">{n.name}</span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm(`Remove ${n.name} from the shortlist?`)) deleteMutation.mutate(n.id)
                }}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-8 text-lg font-bold text-ink-900">Raw submissions</h2>
      {groups.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon="inbox" title="No nominations yet" description="Nothing has been submitted for this category." />
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {groups.map((g) => {
            const key = g.displayName.toLowerCase()
            const alreadyShortlisted = shortlistedNames.has(key)
            const isAdding = addingKey === key
            return (
              <div key={key} className="rounded-lg border border-hairline bg-surface p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink">
                    {g.displayName} <span className="text-xs text-ink-muted">({g.count} mention{g.count === 1 ? '' : 's'})</span>
                  </span>
                  {alreadyShortlisted ? (
                    <span className="text-xs font-semibold text-success">On shortlist</span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setAddingKey(key)
                        setDraftName(g.displayName)
                        setDraftPhotoUrl('')
                      }}
                    >
                      Add as nominee
                    </Button>
                  )}
                </div>
                {isAdding && (
                  <div className="mt-4 flex flex-col gap-3 border-t border-hairline pt-4">
                    <FormField label="Nominee name" value={draftName} onChange={(e) => setDraftName(e.target.value)} required />
                    <AwardNomineePhotoUploadField label="Photo" url={draftPhotoUrl} onChange={setDraftPhotoUrl} />
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        loading={createMutation.isPending}
                        disabled={!draftName.trim()}
                        onClick={() => createMutation.mutate()}
                      >
                        Confirm
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setAddingKey(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Link to={`/admin/awards/${seasonId}/edit`} className="mt-8 inline-block">
        <Button variant="secondary">Back to season</Button>
      </Link>
    </div>
  )
}
```

- [ ] **Step 3: Wire the route into `src/App.jsx`**

Add lazy import (after `AdminAwardSeason`):

```js
const AdminAwardCurate = lazy(() => import('./pages/admin/AdminAwardCurate'))
```

Add route (after `admin/awards/:seasonId/edit`):

```jsx
<Route path="admin/awards/:seasonId/categories/:categoryId/curate" element={<AdminAwardCurate />} />
```

- [ ] **Step 4: Manually verify against the dev server**

The public nomination-submission UI doesn't exist until Task 10, so seed test data directly via `execute_sql` (`project_id: "ascdypvchlbpfupsssuy"`) against the "Test Awards 2026" season created in Task 7 (now in `curating` phase):

```sql
insert into award_nominations (category_id, submitted_by, nominee_name)
select c.id, u.id, v.name
from award_categories c
cross join (select id from auth.users limit 1) u
cross join (values ('Taiwo A.'), ('taiwo a.'), ('Chidi')) as v(name)
where c.title = 'Best Dressed';
```

(This inserts 3 rows via a single `submitted_by`, which the dedup trigger would normally block per-user — fine for seeding a curation-screen test since the goal here is exercising `groupNominationsByText`'s grouping UI, not the dedup trigger, which was already verified directly in Task 3. Delete these rows afterward with `delete from award_nominations where category_id = (select id from award_categories where title = 'Best Dressed');` if you want a clean slate before Task 11.)

Open `/admin/awards/:seasonId/categories/:categoryId/curate` for "Best Dressed" in the browser. Confirm:
- "Raw submissions" shows two groups: "Taiwo A." with 2 mentions, "Chidi" with 1 mention (case/whitespace-insensitive grouping working).
- Clicking "Add as nominee" on "Taiwo A." pre-fills the name field; confirming without a photo adds it to the shortlist, the group now shows "On shortlist" instead of the button, and the shortlist section above lists "Taiwo A." with no photo.
- Uploading a photo on a second "Add as nominee" (e.g. "Chidi") succeeds and the shortlist entry shows the uploaded image.
- "Remove" on a shortlist entry deletes it and it reappears as available to re-add.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AwardNomineePhotoUploadField.jsx src/pages/admin/AdminAwardCurate.jsx src/App.jsx
git commit -m "feat: add admin nomination curation screen"
```

---

## Task 9: Admin — results/tally screen

**Files:**
- Create: `src/components/awards/ResultsSummary.jsx`
- Create: `src/pages/admin/AdminAwardResults.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useSeasonQuery` (Task 6), `useNomineesQuery` (Task 6), `useSeasonVotesQuery`, `buildTally` (Task 6, `awardVotes.js`).
- Produces: `ResultsSummary({ categories, nomineesByCategory, votes })` — presentational, reused by the public revealed-results view in Task 11. `categories`: array of `{ id, title }`. `nomineesByCategory`: `Record<categoryId, nominee[]>`. `votes`: flat array of `{ category_id, nominee_id }`.

- [ ] **Step 1: Implement `src/components/awards/ResultsSummary.jsx`**

```jsx
import { buildTally } from '../../data/awardVotes'

export default function ResultsSummary({ categories, nomineesByCategory, votes }) {
  return (
    <div className="flex flex-col gap-5">
      {categories.map((category) => {
        const nominees = nomineesByCategory[category.id] || []
        const categoryVotes = votes.filter((v) => v.category_id === category.id)
        const tally = buildTally(categoryVotes, nominees)
        const max = Math.max(...tally.map((t) => t.count), 1)
        const winner = tally.length > 0 && tally[0].count > 0 ? tally[0].nominee : null

        return (
          <div key={category.id} className="rounded-lg border border-hairline bg-surface p-5 shadow-sm">
            <h3 className="text-base font-semibold text-ink-900">{category.title}</h3>
            {winner && <p className="mt-1 text-sm text-ink-muted">Winner: <span className="font-semibold text-ink-900">{winner.name}</span></p>}
            {tally.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">No nominees for this category.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2.5">
                {tally.map(({ nominee, count }) => (
                  <div key={nominee.id} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-sm text-ink" title={nominee.name}>{nominee.name}</span>
                    <div className="h-2.5 flex-1 rounded-full bg-hairline">
                      <div className="h-2.5 rounded-full bg-green-700" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="w-6 shrink-0 text-right font-mono text-xs text-ink-muted">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Implement `src/pages/admin/AdminAwardResults.jsx`**

```jsx
import { useParams } from 'react-router-dom'
import { useSeasonQuery } from '../../data/awardSeasons'
import { useNomineesQuery } from '../../data/awardNominees'
import { useSeasonVotesQuery } from '../../data/awardVotes'
import Breadcrumbs from '../../components/Breadcrumbs'
import ErrorState from '../../components/ui/ErrorState'
import ResultsSummary from '../../components/awards/ResultsSummary'

export default function AdminAwardResults() {
  const { seasonId } = useParams()
  const seasonQuery = useSeasonQuery(seasonId)
  const categories = seasonQuery.data?.categories ?? []
  const categoryIds = categories.map((c) => c.id)
  const nomineesQuery = useNomineesQuery(categoryIds)
  const votesQuery = useSeasonVotesQuery(seasonId)

  if (seasonQuery.isError) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this season." onRetry={seasonQuery.refetch} />
      </div>
    )
  }
  if (!seasonQuery.data || !nomineesQuery.data || !votesQuery.data) return null

  const nomineesByCategory = {}
  categoryIds.forEach((id) => {
    nomineesByCategory[id] = nomineesQuery.data.filter((n) => n.category_id === id)
  })

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[
        { label: 'Admin', to: '/admin' },
        { label: 'Awards', to: '/admin/awards' },
        { label: 'Edit', to: `/admin/awards/${seasonId}/edit` },
        { label: 'Results' },
      ]} />
      <h1 className="text-3xl font-bold text-ink-900">Results: {seasonQuery.data.title}</h1>
      <p className="text-ink-muted">{votesQuery.data.length} vote{votesQuery.data.length === 1 ? '' : 's'} cast so far.</p>
      <div className="mt-6">
        <ResultsSummary categories={categories} nomineesByCategory={nomineesByCategory} votes={votesQuery.data} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire the route into `src/App.jsx`**

Add lazy import (after `AdminAwardCurate`):

```js
const AdminAwardResults = lazy(() => import('./pages/admin/AdminAwardResults'))
```

Add route (after the curate route):

```jsx
<Route path="admin/awards/:seasonId/results" element={<AdminAwardResults />} />
```

- [ ] **Step 4: Manually verify against the dev server**

Navigate to `/admin/awards/:seasonId/results` for the test season. Confirm it renders "0 votes cast so far" and one bar-breakdown card per category with "No nominees for this category" (since no nominees exist yet from a signed-out perspective before Task 8's manual nominee was added — if Task 8's nominee exists, confirm it shows with a 0-count bar instead).

- [ ] **Step 5: Commit**

```bash
git add src/components/awards/ResultsSummary.jsx src/pages/admin/AdminAwardResults.jsx src/App.jsx
git commit -m "feat: add admin award results/tally screen"
```

---

## Task 10: Public awards page — nominating phase

**Files:**
- Create: `src/pages/Awards.jsx`
- Create: `src/components/awards/NominationCategoryField.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/Navbar.jsx`

**Interfaces:**
- Consumes: `useAuth` (`src/lib/AuthContext.jsx`), `useOwnProfileQuery` (Task 1), `useLatestSeasonQuery` (Task 6), `useMyNominationsQuery`, `upsertNomination` (Task 6), `useToast`.
- Produces: `NominationCategoryField({ category, value, onChange })` — presentational, one category's nomination text input. `Awards.jsx` — the full public page; this task implements only the `nominating` phase branch plus the not-signed-in / no-profile gates. `curating`/`closed`/`voting`/`revealed` branches are added in Task 11.

- [ ] **Step 1: Implement `src/components/awards/NominationCategoryField.jsx`**

```jsx
import FormField from '../ui/FormField'

export default function NominationCategoryField({ category, value, onChange }) {
  return (
    <FormField
      label={category.title}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={category.description || `Who do you nominate for ${category.title}?`}
    />
  )
}
```

- [ ] **Step 2: Implement `src/pages/Awards.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'
import { useOwnProfileQuery } from '../data/profiles'
import { useLatestSeasonQuery } from '../data/awardSeasons'
import { useMyNominationsQuery, upsertNomination } from '../data/awardNominations'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import NominationCategoryField from '../components/awards/NominationCategoryField'

export default function Awards() {
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const profileQuery = useOwnProfileQuery(user?.id)
  const seasonQuery = useLatestSeasonQuery()
  const season = seasonQuery.data
  const nominationsQuery = useMyNominationsQuery(season?.id, user?.id)

  const [drafts, setDrafts] = useState({})

  useEffect(() => {
    if (!nominationsQuery.data) return
    const next = {}
    nominationsQuery.data.forEach((n) => {
      next[n.category_id] = n.nominee_name
    })
    setDrafts(next)
  }, [nominationsQuery.data])

  const nominationsByCategory = {}
  ;(nominationsQuery.data || []).forEach((n) => {
    nominationsByCategory[n.category_id] = n
  })

  const submitMutation = useMutation({
    mutationFn: async () => {
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
      await Promise.all(jobs)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['award_nominations', 'mine', season.id, user.id] })
      toast.success('Nominations saved — thank you!')
    },
    onError: (error) => toast.error(error.message),
  })

  if (seasonQuery.isError) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load the awards page." onRetry={seasonQuery.refetch} />
      </div>
    )
  }
  if (seasonQuery.isLoading || authLoading) return null

  if (!season) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <EmptyState icon="how_to_vote" title="No award season yet" description="Check back once an award season is announced." />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">{season.title}</h1>
        <p className="mt-4 text-ink-muted">Sign in with your department account to take part.</p>
        <Link to="/login" state={{ from: { pathname: '/awards' } }}>
          <Button variant="primary" className="mt-4">Sign in</Button>
        </Link>
      </div>
    )
  }

  if (!profileQuery.isLoading && !profileQuery.data) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">{season.title}</h1>
        <p className="mt-4 text-ink-muted">
          Your account doesn&rsquo;t have a matric number on file, so it can&rsquo;t take part in this award. Contact
          an exco member to get this fixed.
        </p>
      </div>
    )
  }

  if (season.phase === 'nominating') {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">{season.title}</h1>
        <p className="mt-2 text-ink-muted">Nominate someone for each category. You can change your nominee until nominations close.</p>

        <div className="mt-6 flex flex-col gap-4">
          {season.categories.map((c) => (
            <NominationCategoryField
              key={c.id}
              category={c}
              value={drafts[c.id]}
              onChange={(value) => setDrafts((prev) => ({ ...prev, [c.id]: value }))}
            />
          ))}
        </div>

        <Button variant="primary" className="mt-6" onClick={() => submitMutation.mutate()} loading={submitMutation.isPending}>
          Save nominations
        </Button>
      </div>
    )
  }

  if (season.phase === 'curating') {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">{season.title}</h1>
        <EmptyState icon="hourglass_top" title="Nominations closed" description="The shortlist is being finalized — voting opens soon." />
      </div>
    )
  }

  if (season.phase === 'closed') {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">{season.title}</h1>
        <EmptyState icon="how_to_vote" title="Voting closed" description="Results will be announced soon." />
      </div>
    )
  }

  return null // 'voting' and 'revealed' branches added in Task 11
}
```

- [ ] **Step 3: Wire the route and nav link**

`src/App.jsx` — add lazy import (after `Opportunities`):

```js
const Awards = lazy(() => import('./pages/Awards'))
```

Add route (after `opportunities`, before `forms`):

```jsx
<Route path="awards" element={<Awards />} />
```

`src/components/Navbar.jsx` — add to the `links` array (after `/opportunities`):

```js
{ to: '/awards', label: 'Awards' },
```

- [ ] **Step 4: Manually verify against the dev server**

- Signed out: `/awards` shows the season title and a "Sign in" prompt.
- Signed in as a department test account (from Task 1) with the test season still in `nominating` phase: shows one text field per category, submit saves, reloading the page shows the saved values pre-filled.
- Signed in as an account with no `profiles` row (if one still exists from before this feature; otherwise skip): shows the "matric number on file" message instead of a form.
- Advance the test season to `curating` via `/admin/awards/:id/edit`, reload `/awards`: shows "Nominations closed" instead of the form.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Awards.jsx src/components/awards/NominationCategoryField.jsx src/App.jsx src/components/Navbar.jsx
git commit -m "feat: add public awards page (nominating/curating/closed phases)"
```

---

## Task 11: Public awards page — voting and revealed phases

**Files:**
- Create: `src/components/awards/NomineeOption.jsx`
- Modify: `src/pages/Awards.jsx`

**Interfaces:**
- Consumes: `useNomineesQuery` (Task 6), `useMyVotesQuery`, `submitBallot` (Task 6, `awardVotes.js`), `ResultsSummary` (Task 9).
- Produces: `NomineeOption({ nominee, selected, onSelect })` — presentational selectable card.

- [ ] **Step 1: Implement `src/components/awards/NomineeOption.jsx`**

```jsx
export default function NomineeOption({ nominee, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors',
        selected ? 'border-green-900 bg-surface-low' : 'border-hairline bg-surface hover:bg-surface-low',
      ].join(' ')}
    >
      {nominee.photo_url ? (
        <img src={nominee.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
      ) : (
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-low text-ink-muted">
          <span className="material-symbols-outlined text-2xl">person</span>
        </span>
      )}
      <span className="text-sm font-semibold text-ink-900">{nominee.name}</span>
    </button>
  )
}
```

- [ ] **Step 2: Extend `src/pages/Awards.jsx` with the voting and revealed branches**

Add imports (alongside the existing ones):

```js
import { useNomineesQuery } from '../data/awardNominees'
import { useMyVotesQuery, useSeasonVotesQuery, submitBallot } from '../data/awardVotes'
import NomineeOption from '../components/awards/NomineeOption'
import ResultsSummary from '../components/awards/ResultsSummary'
```

Add state and queries inside the component (alongside the existing `drafts` state):

```js
const [selections, setSelections] = useState({})
const categoryIds = season?.categories.map((c) => c.id) ?? []
const nomineesQuery = useNomineesQuery(categoryIds)
const myVotesQuery = useMyVotesQuery(season?.id, user?.id)
const seasonVotesQuery = useSeasonVotesQuery(season?.phase === 'revealed' ? season.id : undefined)
```

Add the ballot submit mutation (alongside `submitMutation`):

```js
const voteMutation = useMutation({
  mutationFn: async () => {
    const choices = Object.entries(selections).map(([category_id, nominee_id]) => ({ category_id, nominee_id }))
    await submitBallot(choices)
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['award_votes', 'mine', season.id, user.id] })
    toast.success('Your vote has been recorded — thank you!')
  },
  onError: (error) => toast.error(error.message),
})
```

Replace the final `return null // 'voting' and 'revealed' branches added in Task 11` with:

```jsx
  if (season.phase === 'voting') {
    if (!nomineesQuery.data || !myVotesQuery.data) return null

    if (myVotesQuery.data.length > 0) {
      return (
        <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-6">
          <h1 className="text-3xl font-bold text-ink-900">{season.title}</h1>
          <EmptyState icon="check_circle" title="You've already voted" description="Thanks for taking part — results will be announced soon." />
        </div>
      )
    }

    const votableCategories = season.categories.filter(
      (c) => nomineesQuery.data.filter((n) => n.category_id === c.id).length > 0,
    )
    const allAnswered = votableCategories.every((c) => selections[c.id])

    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">{season.title}</h1>
        <p className="mt-2 text-ink-muted">Pick one nominee per category, then submit your whole ballot.</p>

        <div className="mt-6 flex flex-col gap-6">
          {votableCategories.map((c) => (
            <div key={c.id}>
              <h2 className="text-lg font-bold text-ink-900">{c.title}</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {nomineesQuery.data
                  .filter((n) => n.category_id === c.id)
                  .map((n) => (
                    <NomineeOption
                      key={n.id}
                      nominee={n}
                      selected={selections[c.id] === n.id}
                      onSelect={() => setSelections((prev) => ({ ...prev, [c.id]: n.id }))}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="primary"
          className="mt-6"
          disabled={!allAnswered}
          loading={voteMutation.isPending}
          onClick={() => voteMutation.mutate()}
        >
          Submit ballot
        </Button>
      </div>
    )
  }

  if (season.phase === 'revealed') {
    if (!nomineesQuery.data || !seasonVotesQuery.data) return null
    const nomineesByCategory = {}
    categoryIds.forEach((id) => {
      nomineesByCategory[id] = nomineesQuery.data.filter((n) => n.category_id === id)
    })

    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-ink-900">{season.title} — Results</h1>
        <div className="mt-6">
          <ResultsSummary categories={season.categories} nomineesByCategory={nomineesByCategory} votes={seasonVotesQuery.data} />
        </div>
      </div>
    )
  }

  return null
```

- [ ] **Step 3: Manually verify against the dev server, completing the full lifecycle**

Using the test season and two department test accounts (`A` and `B`) from earlier tasks:
1. As account `A`, submit a nomination for each category (Task 10's flow) if not already done.
2. As admin, advance to `curating`, use `/admin/awards/:id/categories/:categoryId/curate` to add at least one nominee per category (Task 8).
3. As admin, advance to `voting`.
4. As account `A`, visit `/awards`: confirm the ballot renders with nominee cards, submit a full ballot, confirm the "already voted" state appears on reload.
5. As account `B`, submit a different ballot.
6. As a **non-department** test account (matric fails the format, or simply an account with no `profiles` row): confirm `/awards` shows the "no matric number on file" gate, not the ballot — this is the department-restriction check called out in the spec.
7. As admin, confirm `/admin/awards/:id/results` shows 2 total votes with correct per-nominee counts.
8. As admin, advance to `closed`, confirm `/awards` shows "Voting closed" for account `A`.
9. As admin, advance to `revealed`, confirm `/awards` now shows the public results page for account `A` (and for a signed-out visitor), matching the admin tally from step 7.

- [ ] **Step 4: Run the full test suite one more time**

Run: `npm test`
Expected: all tests pass, no regressions from the UI changes (UI files have no unit tests per this project's convention, so this just confirms the data-layer tests from Task 6 are still green).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Awards.jsx src/components/awards/NomineeOption.jsx
git commit -m "feat: add public voting ballot and revealed results to awards page"
```

---

## Task 12: Documentation

**Files:**
- Modify: `ADMIN.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Add an Awards section to `ADMIN.md`**

Add a bullet to the admin sections list (after the `Submissions` bullet):

```markdown
- **Awards** — run a department award season end-to-end: create categories, advance the
  season through nominating → curating → voting → closed → revealed, curate raw
  nominations into a shortlist per category (with optional nominee photos), and view
  vote tallies. Only students with a department matric number (`240406XXX`) on their
  account can nominate or vote — this is enforced automatically, not something you
  configure per season.
```

Add a new section near the end (after "Outline contribution uploads", before "If the admin forms don't cover something"):

```markdown
## Fixing a student's matric number

Matric numbers are set once at signup and can't be changed by the student afterward.
If someone made a typo or an account predates the Awards feature and has no matric
number on file at all, fix it directly in the Supabase dashboard's Table Editor: open
the `profiles` table, find their row by `user_id` (cross-reference `auth.users` by
email if needed), and edit `student_id` there. It must match the department format
(`240406XXX`) or the save will be rejected.
```

- [ ] **Step 2: Commit**

```bash
git add ADMIN.md
git commit -m "docs: document the awards admin workflow and matric number fixes"
```

---

## Post-plan cleanup note

The manual "Test Awards 2026" season and its test-account data created while verifying Tasks 7–11 are real rows in the production Supabase project (this app has no separate staging environment). Before considering the feature done, delete the test season from `/admin/awards` (cascades to its categories/nominations/nominees/votes) and, if desired, remove the test student accounts via the Supabase dashboard's Auth users list.
