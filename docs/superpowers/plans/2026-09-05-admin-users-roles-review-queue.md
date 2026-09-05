# Admin Users, Roles & Review Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/admin/users` page (list all accounts, activity, admin/owner management), a transferable owner role with tightened admin RLS, and a review-queue pipeline gating News/Events/Award-season edits behind owner approval.

**Architecture:** All schema/RLS/function changes are applied directly to the linked Supabase project via the Supabase MCP tools (this repo has no local `supabase/` migrations directory — DB changes have always been applied live, per existing project convention). Frontend changes are React + `@tanstack/react-query`, following this codebase's existing thin-data-module pattern (`src/data/*.js` wraps `supabase-js` calls; only pure functions get Vitest coverage; Supabase-touching flows are verified manually against the dev server).

**Tech Stack:** React 19, react-router-dom 7, @tanstack/react-query 5, Supabase (Postgres + supabase-js), Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-05-admin-users-roles-review-queue-design.md`

## Global Constraints

- Supabase project id for all MCP tool calls: `ascdypvchlbpfupsssuy`.
- No service-role key, no serverless functions — disable is soft/app-level (spec Non-goals).
- Deletes are never gated by the review queue on any table (spec Non-goals) — only inserts/updates to `news`, `events`, `award_seasons`/`award_categories`.
- Opportunities, Excos, Outlines, Timetables, Resources, Forms stay direct-write for any admin — do not touch their RLS or configs.
- The existing `AdminSubmissions` (outline submissions) flow is untouched.
- Follow existing code style exactly: no comments unless explaining non-obvious *why*, no unrelated refactors.
- Run `npm run test` (Vitest) and `npm run lint` (oxlint) after each task that touches JS files.

---

## Task 1: Database — ownership, activity, disable, and the review queue

**Files:**
- No repo files (schema lives in Supabase, applied via MCP tools).

**Interfaces:**
- Produces (used by every later task): `profiles.last_seen_at`, `profiles.is_disabled`, `admins.is_owner`; RPCs `touch_last_seen()`, `admin_set_user_disabled(target uuid, disabled boolean)`, `transfer_ownership(new_owner uuid)`, `submit_change_request(p_entity_type text, p_action text, p_record_id text, p_payload jsonb) returns uuid`, `apply_change_request(p_id uuid)`, `reject_change_request(p_id uuid, p_reason text)`; table `change_requests(id, entity_type, action, record_id, payload, submitted_by, status, reviewed_by, reviewed_at, rejection_reason, created_at)`.

- [ ] **Step 1: Apply the migration**

Call `mcp__plugin_supabase_supabase__apply_migration` with `project_id: "ascdypvchlbpfupsssuy"`, `name: "admin_users_roles_and_review_queue"`, and this `query`:

```sql
-- activity + soft disable
alter table public.profiles
  add column last_seen_at timestamptz,
  add column is_disabled boolean not null default false;

-- ownership
alter table public.admins
  add column is_owner boolean not null default false;

create unique index admins_one_owner_idx on public.admins (is_owner) where is_owner;

create policy admins_select_admin_all on public.admins
  for select
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy admins_insert_admin on public.admins
  for insert
  with check (
    is_owner = false
    or exists (select 1 from public.admins a where a.user_id = auth.uid() and a.is_owner)
  );

create policy admins_delete_admin on public.admins
  for delete
  using (exists (select 1 from public.admins a where a.user_id = auth.uid() and a.is_owner));

create or replace function public.admins_guard_delete() returns trigger
language plpgsql security definer as $$
begin
  if old.is_owner then
    raise exception 'Cannot remove the owner directly. Transfer ownership first.';
  end if;
  if (select count(*) from public.admins) <= 1 then
    raise exception 'Cannot remove the last remaining admin.';
  end if;
  return old;
end;
$$;

create trigger admins_before_delete
  before delete on public.admins
  for each row execute function public.admins_guard_delete();

create policy profiles_select_admin on public.profiles
  for select
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create or replace function public.touch_last_seen() returns void
language plpgsql security definer as $$
begin
  update public.profiles set last_seen_at = now() where user_id = auth.uid();
end;
$$;

create or replace function public.admin_set_user_disabled(target uuid, disabled boolean) returns void
language plpgsql security definer as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'Only admins can do this.';
  end if;
  if exists (select 1 from public.admins where user_id = target and is_owner) then
    raise exception 'The owner cannot be disabled.';
  end if;
  update public.profiles set is_disabled = disabled where user_id = target;
end;
$$;

create or replace function public.transfer_ownership(new_owner uuid) returns void
language plpgsql security definer as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid() and is_owner) then
    raise exception 'Only the current owner can transfer ownership.';
  end if;
  if not exists (select 1 from public.admins where user_id = new_owner) then
    raise exception 'Target user must already be an admin.';
  end if;
  update public.admins set is_owner = false where user_id = auth.uid();
  update public.admins set is_owner = true where user_id = new_owner;
end;
$$;

-- review queue
create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('news', 'events', 'award_season')),
  action text not null check (action in ('insert', 'update')),
  record_id text,
  payload jsonb not null,
  submitted_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

alter table public.change_requests enable row level security;

create policy change_requests_select_own on public.change_requests
  for select using (auth.uid() = submitted_by);

create policy change_requests_select_owner on public.change_requests
  for select using (exists (select 1 from public.admins a where a.user_id = auth.uid() and a.is_owner));

create or replace function public.submit_change_request(p_entity_type text, p_action text, p_record_id text, p_payload jsonb)
returns uuid
language plpgsql security definer as $$
declare
  new_id uuid;
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'Only admins can submit changes.';
  end if;
  insert into public.change_requests (entity_type, action, record_id, payload, submitted_by)
  values (p_entity_type, p_action, p_record_id, p_payload, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.reject_change_request(p_id uuid, p_reason text)
returns void
language plpgsql security definer as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid() and is_owner) then
    raise exception 'Only the owner can review changes.';
  end if;
  update public.change_requests
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = p_reason
    where id = p_id and status = 'pending';
end;
$$;

create or replace function public.apply_change_request(p_id uuid)
returns void
language plpgsql security definer as $$
declare
  req public.change_requests%rowtype;
  target_season_id uuid;
  cat jsonb;
  existing_ids uuid[];
  keep_ids uuid[];
begin
  if not exists (select 1 from public.admins where user_id = auth.uid() and is_owner) then
    raise exception 'Only the owner can review changes.';
  end if;

  select * into req from public.change_requests where id = p_id and status = 'pending';
  if not found then
    raise exception 'No pending request with that id.';
  end if;

  if req.entity_type = 'news' then
    if req.action = 'insert' then
      insert into public.news (id, category, tone, date, title, body, author, badge_tone, badge_label, image_url, image_width_pct)
      values (
        req.payload->>'id', req.payload->>'category', req.payload->>'tone', (req.payload->>'date')::date,
        req.payload->>'title', req.payload->>'body', req.payload->>'author',
        req.payload->>'badge_tone', req.payload->>'badge_label', req.payload->>'image_url',
        (req.payload->>'image_width_pct')::int
      );
    else
      update public.news set
        category = req.payload->>'category', tone = req.payload->>'tone', date = (req.payload->>'date')::date,
        title = req.payload->>'title', body = req.payload->>'body', author = req.payload->>'author',
        badge_tone = req.payload->>'badge_tone', badge_label = req.payload->>'badge_label',
        image_url = req.payload->>'image_url', image_width_pct = (req.payload->>'image_width_pct')::int
      where id = req.record_id;
    end if;

  elsif req.entity_type = 'events' then
    if req.action = 'insert' then
      insert into public.events (id, title, date, tone, meta, description, image_url)
      values (
        req.payload->>'id', req.payload->>'title', req.payload->>'date', req.payload->>'tone',
        req.payload->>'meta', req.payload->>'description', req.payload->>'image_url'
      );
    else
      update public.events set
        title = req.payload->>'title', date = req.payload->>'date', tone = req.payload->>'tone',
        meta = req.payload->>'meta', description = req.payload->>'description', image_url = req.payload->>'image_url'
      where id = req.record_id;
    end if;

  elsif req.entity_type = 'award_season' then
    if req.action = 'insert' then
      insert into public.award_seasons (title, phase, created_by)
      values (req.payload->>'title', 'nominating', req.submitted_by)
      returning id into target_season_id;
    else
      target_season_id := req.record_id::uuid;
      update public.award_seasons set title = req.payload->>'title' where id = target_season_id;
    end if;

    select coalesce(array_agg(id), array[]::uuid[]) into existing_ids
      from public.award_categories where season_id = target_season_id;
    select coalesce(array_agg((c->>'id')::uuid), array[]::uuid[]) into keep_ids
      from jsonb_array_elements(req.payload->'categories') c;

    delete from public.award_categories
      where season_id = target_season_id and not (id = any(keep_ids));

    for cat in select * from jsonb_array_elements(req.payload->'categories')
    loop
      if (cat->>'id')::uuid = any(existing_ids) then
        update public.award_categories set
          title = cat->>'title', description = cat->>'description', sort_order = (cat->>'sort_order')::int
        where id = (cat->>'id')::uuid;
      else
        insert into public.award_categories (id, season_id, title, description, sort_order)
        values ((cat->>'id')::uuid, target_season_id, cat->>'title', cat->>'description', (cat->>'sort_order')::int);
      end if;
    end loop;
  end if;

  update public.change_requests
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id;
end;
$$;

-- tighten direct writes on gated tables to owner-only (regular admins go through the queue)
drop policy news_admin_insert on public.news;
create policy news_admin_insert on public.news
  for insert with check (exists (select 1 from public.admins where user_id = auth.uid() and is_owner));
drop policy news_admin_update on public.news;
create policy news_admin_update on public.news
  for update using (exists (select 1 from public.admins where user_id = auth.uid() and is_owner));

drop policy events_admin_insert on public.events;
create policy events_admin_insert on public.events
  for insert with check (exists (select 1 from public.admins where user_id = auth.uid() and is_owner));
drop policy events_admin_update on public.events;
create policy events_admin_update on public.events
  for update using (exists (select 1 from public.admins where user_id = auth.uid() and is_owner));

drop policy award_seasons_insert_admin on public.award_seasons;
create policy award_seasons_insert_admin on public.award_seasons
  for insert with check (exists (select 1 from public.admins where user_id = auth.uid() and is_owner));
drop policy award_seasons_update_admin on public.award_seasons;
create policy award_seasons_update_admin on public.award_seasons
  for update using (exists (select 1 from public.admins where user_id = auth.uid() and is_owner));

drop policy award_categories_insert_admin on public.award_categories;
create policy award_categories_insert_admin on public.award_categories
  for insert with check (exists (select 1 from public.admins where user_id = auth.uid() and is_owner));
drop policy award_categories_update_admin on public.award_categories;
create policy award_categories_update_admin on public.award_categories
  for update using (exists (select 1 from public.admins where user_id = auth.uid() and is_owner));

-- seed the sole existing account as the first owner
insert into public.admins (user_id, is_owner)
select id, true from auth.users where email = '240406009@live.unilag.edu.ng'
on conflict (user_id) do update set is_owner = true;
```

- [ ] **Step 2: Verify schema**

Call `mcp__plugin_supabase_supabase__execute_sql` with `project_id: "ascdypvchlbpfupsssuy"` and:

```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='profiles' and column_name in ('last_seen_at','is_disabled')
union all
select column_name from information_schema.columns
where table_schema='public' and table_name='admins' and column_name='is_owner';
```

Expected: 3 rows (`last_seen_at`, `is_disabled`, `is_owner`).

- [ ] **Step 3: Verify functions exist**

```sql
select proname from pg_proc where proname in
  ('touch_last_seen','admin_set_user_disabled','transfer_ownership','submit_change_request','apply_change_request','reject_change_request')
order by proname;
```

Expected: all 6 names returned.

- [ ] **Step 4: Verify the seed**

```sql
select a.user_id, a.is_owner, u.email
from public.admins a join auth.users u on u.id = a.user_id;
```

Expected: exactly one row, `is_owner = true`, `email = '240406009@live.unilag.edu.ng'`.

- [ ] **Step 5: Verify tightened RLS**

```sql
select tablename, policyname, qual from pg_policies
where tablename in ('news','events','award_seasons','award_categories') and cmd = 'UPDATE'
order by tablename;
```

Expected: each `qual` now contains `is_owner` (not just `admins`).

---

## Task 2: `src/data/admins.js` — admin/owner data layer

**Files:**
- Create: `src/data/admins.js`

**Interfaces:**
- Produces: `useOwnAdminRowQuery(userId)` → `{ data: { user_id, is_owner } | null }`; `fetchAllAdmins()`, `useAllAdminsQuery()` → array of `{ user_id, is_owner }`; `assignAdmin(userId)`, `revokeAdmin(userId)`, `transferOwnership(newOwnerId)` (all async, throw on Supabase error).

- [ ] **Step 1: Write the module**

```js
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchOwnAdminRow(userId) {
  const { data, error } = await supabase.from('admins').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data
}

export function useOwnAdminRowQuery(userId) {
  return useQuery({
    queryKey: ['admins', 'mine', userId],
    queryFn: () => fetchOwnAdminRow(userId),
    enabled: Boolean(userId),
  })
}

export async function fetchAllAdmins() {
  const { data, error } = await supabase.from('admins').select('*')
  if (error) throw error
  return data
}

export function useAllAdminsQuery() {
  return useQuery({ queryKey: ['admins', 'all'], queryFn: fetchAllAdmins })
}

export async function assignAdmin(userId) {
  const { error } = await supabase.from('admins').insert({ user_id: userId })
  if (error) throw error
}

export async function revokeAdmin(userId) {
  const { error } = await supabase.from('admins').delete().eq('user_id', userId)
  if (error) throw error
}

export async function transferOwnership(newOwnerId) {
  const { error } = await supabase.rpc('transfer_ownership', { new_owner: newOwnerId })
  if (error) throw error
}
```

No test file: every export here is a thin Supabase wrapper with no branching logic, matching this project's existing convention (e.g. `src/data/excos.js` has no `*.test.js`) — only pure functions get unit tests here.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/data/admins.js
git commit -m "feat: add admin/owner data layer"
```

---

## Task 3: Real admin-only route guard

**Files:**
- Create: `src/components/AdminRoute.jsx`
- Delete: `src/components/ProtectedRoute.jsx`
- Modify: `src/App.jsx:5` (import), `src/App.jsx:83` (route wrapper)

**Interfaces:**
- Consumes: `useAuth()` from `src/lib/AuthContext.jsx` (`{ session, user, loading }`), `useOwnAdminRowQuery(userId)` from `src/data/admins.js` (Task 2).
- Produces: `AdminRoute` default export, used by `App.jsx` in place of `ProtectedRoute` for the `/admin/*` subtree.

- [ ] **Step 1: Write `AdminRoute`**

```jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useOwnAdminRowQuery } from '../data/admins'

export default function AdminRoute() {
  const { session, user, loading } = useAuth()
  const location = useLocation()
  const adminRowQuery = useOwnAdminRowQuery(user?.id)

  if (loading || (session && adminRowQuery.isLoading)) return null
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  if (!adminRowQuery.data) return <Navigate to="/" replace />
  return <Outlet />
}
```

- [ ] **Step 2: Wire it into `App.jsx`**

`ProtectedRoute` is only ever referenced at this one call site (verified via `grep -rn "ProtectedRoute" src`), so it's being fully replaced, not just supplemented.

Change line 5:
```jsx
import ProtectedRoute from './components/ProtectedRoute'
```
to:
```jsx
import AdminRoute from './components/AdminRoute'
```

Change line 83:
```jsx
          <Route element={<ProtectedRoute />}>
```
to:
```jsx
          <Route element={<AdminRoute />}>
```

Delete the now-dead `src/components/ProtectedRoute.jsx` file.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`
- Sign in as `240406009@live.unilag.edu.ng` (seeded owner) → visiting `/admin` shows the dashboard.
- Sign up a second throwaway test account, sign in as it, visit `/admin` directly → redirected to `/`.
- Signed out, visit `/admin` directly → redirected to `/login`.

- [ ] **Step 4: Commit**

```bash
git add src/components/AdminRoute.jsx src/App.jsx
git rm src/components/ProtectedRoute.jsx
git commit -m "feat: gate /admin routes to admins only"
```

---

## Task 4: Last-seen tracking & soft account disable

**Files:**
- Modify: `src/lib/AuthContext.jsx` (full rewrite, see below)
- Modify: `src/pages/Login.jsx:10-17` (disabled-message query param), `src/pages/Login.jsx:58-68` (banner)

**Interfaces:**
- Consumes: `touch_last_seen` RPC and `profiles.is_disabled` (Task 1).
- Produces: no interface change — `useAuth()`'s shape (`{ session, user, loading }`) is unchanged, so no other file needs updating.

- [ ] **Step 1: Rewrite `AuthContext.jsx`**

```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

const AuthContext = createContext(undefined)

async function signOutIfDisabled(userId, navigate) {
  const { data } = await supabase.from('profiles').select('is_disabled').eq('user_id', userId).maybeSingle()
  if (!data?.is_disabled) return false
  await supabase.auth.signOut()
  navigate('/login?disabled=1')
  return true
}

function touchLastSeenOnce() {
  if (sessionStorage.getItem('nammes_last_seen_touched')) return
  sessionStorage.setItem('nammes_last_seen_touched', '1')
  supabase.rpc('touch_last_seen')
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const nextSession = data.session
      if (nextSession) {
        const disabled = await signOutIfDisabled(nextSession.user.id, navigate)
        if (disabled) {
          setSession(null)
          setLoading(false)
          return
        }
        touchLastSeenOnce()
      }
      setSession(nextSession)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession) {
        const disabled = await signOutIfDisabled(newSession.user.id, navigate)
        if (disabled) {
          setSession(null)
          setLoading(false)
          return
        }
        touchLastSeenOnce()
      }
      setSession(newSession)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

- [ ] **Step 2: Add the disabled-account banner to `Login.jsx`**

Change line 16-17:
```jsx
  const justCreated = searchParams.get('created') === '1'
  const justReset = searchParams.get('reset') === '1'
```
to:
```jsx
  const justCreated = searchParams.get('created') === '1'
  const justReset = searchParams.get('reset') === '1'
  const justDisabled = searchParams.get('disabled') === '1'
```

Change lines 59-68 (right after the opening `<form onSubmit={handleSubmit} className="flex flex-col gap-4">`) to add a third banner alongside the existing two:
```jsx
        {justCreated && (
          <p className="rounded-sm bg-success-bg px-3 py-2 text-sm text-success">
            Account created. Sign in below.
          </p>
        )}
        {justReset && (
          <p className="rounded-sm bg-success-bg px-3 py-2 text-sm text-success">
            Password reset. Sign in with your new password.
          </p>
        )}
        {justDisabled && (
          <p className="rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">
            This account has been disabled. Contact an admin for help.
          </p>
        )}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. Using a throwaway second test account:
1. While signed in as the owner, run (via `execute_sql`) `update public.profiles set is_disabled = true where user_id = '<test account's user_id>';`.
2. Sign in as the test account (or reload if already signed in) → immediately signed out and redirected to `/login?disabled=1` showing the banner.
3. Re-enable (`is_disabled = false`) and confirm normal sign-in works again.
4. Confirm `profiles.last_seen_at` updates after a fresh sign-in (`select last_seen_at from public.profiles where user_id = '<your user id>';`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/AuthContext.jsx src/pages/Login.jsx
git commit -m "feat: track last-seen and enforce soft account disable"
```

---

## Task 5: `src/data/users.js` — merged user list + active/inactive

**Files:**
- Create: `src/data/users.js`
- Test: `src/data/users.test.js`

**Interfaces:**
- Consumes: `fetchAllAdmins()` from `src/data/admins.js` (Task 2).
- Produces: `isActive(lastSeenAt, now?)` (pure); `fetchAllUsers()`, `useAllUsersQuery()` → array of `{ user_id, student_id, full_name, created_at, last_seen_at, is_disabled, isAdmin, isOwner, active }`; `setUserDisabled(userId, disabled)`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { isActive } from './users'

describe('isActive', () => {
  const now = new Date('2026-09-05T00:00:00Z')

  it('is false when never seen', () => {
    expect(isActive(null, now)).toBe(false)
  })
  it('is true when seen today', () => {
    expect(isActive('2026-09-05T00:00:00Z', now)).toBe(true)
  })
  it('is true exactly at the 14-day boundary', () => {
    expect(isActive('2026-08-22T00:00:00Z', now)).toBe(true)
  })
  it('is false just past the 14-day boundary', () => {
    expect(isActive('2026-08-21T23:59:59Z', now)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/data/users.test.js`
Expected: FAIL — `./users` has no export `isActive` (module doesn't exist yet).

- [ ] **Step 3: Write the module**

```js
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { fetchAllAdmins } from './admins'

const ACTIVE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

export function isActive(lastSeenAt, now = new Date()) {
  if (!lastSeenAt) return false
  return now.getTime() - new Date(lastSeenAt).getTime() <= ACTIVE_WINDOW_MS
}

export async function fetchAllProfiles() {
  const { data, error } = await supabase.from('profiles').select('*')
  if (error) throw error
  return data
}

export async function fetchAllUsers() {
  const [profiles, admins] = await Promise.all([fetchAllProfiles(), fetchAllAdmins()])
  const adminByUserId = new Map(admins.map((a) => [a.user_id, a]))
  return profiles.map((p) => {
    const adminRow = adminByUserId.get(p.user_id)
    return {
      ...p,
      isAdmin: Boolean(adminRow),
      isOwner: Boolean(adminRow?.is_owner),
      active: isActive(p.last_seen_at),
    }
  })
}

export function useAllUsersQuery() {
  return useQuery({ queryKey: ['users', 'all'], queryFn: fetchAllUsers })
}

export async function setUserDisabled(userId, disabled) {
  const { error } = await supabase.rpc('admin_set_user_disabled', { target: userId, disabled })
  if (error) throw error
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/data/users.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/users.js src/data/users.test.js
git commit -m "feat: add merged users list with active/inactive derivation"
```

---

## Task 6: `/admin/users` page

**Files:**
- Create: `src/pages/admin/AdminUsers.jsx`
- Modify: `src/pages/Admin.jsx:14-19` (insert a new `ADMIN_SECTIONS` entry after the Excos entry)
- Modify: `src/App.jsx` (lazy import + route, alongside the other `admin/*` routes)

**Interfaces:**
- Consumes: `useAllUsersQuery`, `setUserDisabled` (Task 5); `assignAdmin`, `revokeAdmin`, `transferOwnership` (Task 2); `useAuth()` for the current user's id.

- [ ] **Step 1: Write the page**

```jsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import { useAllUsersQuery, setUserDisabled } from '../../data/users'
import { assignAdmin, revokeAdmin, transferOwnership } from '../../data/admins'
import Table from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—'
}

export default function AdminUsers() {
  const { user } = useAuth()
  const usersQuery = useAllUsersQuery()
  const queryClient = useQueryClient()
  const toast = useToast()
  const users = usersQuery.data ?? []
  const me = users.find((u) => u.user_id === user.id)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['users', 'all'] })
    queryClient.invalidateQueries({ queryKey: ['admins', 'all'] })
    queryClient.invalidateQueries({ queryKey: ['admins', 'mine', user.id] })
  }

  const assignMutation = useMutation({
    mutationFn: assignAdmin,
    onSuccess: () => {
      invalidate()
      toast.success('Admin access granted.')
    },
    onError: (error) => toast.error(error.message),
  })
  const revokeMutation = useMutation({
    mutationFn: revokeAdmin,
    onSuccess: () => {
      invalidate()
      toast.success('Admin access removed.')
    },
    onError: (error) => toast.error(error.message),
  })
  const disableMutation = useMutation({
    mutationFn: ({ userId, disabled }) => setUserDisabled(userId, disabled),
    onSuccess: (_result, { disabled }) => {
      invalidate()
      toast.success(disabled ? 'Account disabled.' : 'Account enabled.')
    },
    onError: (error) => toast.error(error.message),
  })
  const transferMutation = useMutation({
    mutationFn: transferOwnership,
    onSuccess: () => {
      invalidate()
      toast.success('Ownership transferred.')
    },
    onError: (error) => toast.error(error.message),
  })

  if (usersQuery.isError && !usersQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load users right now." onRetry={usersQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Users</h1>
      <p className="mt-1 text-ink-muted">Every registered account, admin access, and activity.</p>

      {usersQuery.isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={7} rows={5} />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-hairline bg-surface shadow-md">
          <Table
            columns={['Name', 'Matric', 'Joined', 'Last seen', 'Status', 'Role', 'Actions']}
            rows={users.map((u) => [
              u.full_name || '—',
              u.student_id,
              formatDate(u.created_at),
              formatDate(u.last_seen_at),
              <Badge key="status" tone={u.active ? 'updated' : 'neutral'}>
                {u.active ? 'Active' : 'Inactive'}
              </Badge>,
              u.isOwner ? (
                <Badge key="role" tone="restricted">Owner</Badge>
              ) : u.isAdmin ? (
                <Badge key="role" tone="new">Admin</Badge>
              ) : (
                <span key="role" className="text-ink-muted">—</span>
              ),
              <div key="actions" className="flex flex-wrap gap-2">
                {u.user_id !== user.id && !u.isAdmin && (
                  <Button variant="secondary" size="sm" onClick={() => assignMutation.mutate(u.user_id)}>
                    Make admin
                  </Button>
                )}
                {u.user_id !== user.id && u.isAdmin && !u.isOwner && me?.isOwner && (
                  <Button variant="destructive" size="sm" onClick={() => revokeMutation.mutate(u.user_id)}>
                    Remove admin
                  </Button>
                )}
                {u.user_id !== user.id && !u.isOwner && (
                  <Button
                    variant={u.is_disabled ? 'secondary' : 'destructive'}
                    size="sm"
                    onClick={() => disableMutation.mutate({ userId: u.user_id, disabled: !u.is_disabled })}
                  >
                    {u.is_disabled ? 'Enable' : 'Disable'}
                  </Button>
                )}
                {u.user_id !== user.id && u.isAdmin && !u.isOwner && me?.isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Make ${u.full_name || u.student_id} the owner? You will lose owner status.`)) {
                        transferMutation.mutate(u.user_id)
                      }
                    }}
                  >
                    Make owner
                  </Button>
                )}
              </div>,
            ])}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the `ADMIN_SECTIONS` entry**

In `src/pages/Admin.jsx`, insert this object into the `ADMIN_SECTIONS` array right after the Excos entry (after the block ending `description: 'Manage the executive team directory.',\n  },`):

```js
  {
    path: '/admin/users',
    label: 'Users',
    icon: 'group',
    category: 'Directory',
    description: 'View every account and manage admin access.',
  },
```

- [ ] **Step 3: Add the route**

In `src/App.jsx`, add the lazy import near the other admin page imports (after `const AdminExcos = lazy(() => import('./pages/admin/AdminExcos'))`):
```jsx
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
```
And add the route inside the `<Route element={<AdminRoute />}>` block, after `<Route path="admin/excos" element={<AdminExcos />} />`:
```jsx
            <Route path="admin/users" element={<AdminUsers />} />
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. As the owner: `/admin` shows a "Users" tile → `/admin/users` lists the seeded owner (Owner badge, no self-actions) and any test accounts (Make admin / Disable working). Promote a test account, confirm its row now shows an Admin badge and a "Remove admin" button appears for the owner.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/AdminUsers.jsx src/pages/Admin.jsx src/App.jsx
git commit -m "feat: add /admin/users page for account and admin management"
```

---

## Task 7: `src/data/changeRequests.js` — review queue data layer

**Files:**
- Create: `src/data/changeRequests.js`
- Test: `src/data/changeRequests.test.js`

**Interfaces:**
- Produces: `submitChangeRequest(entityType, action, recordId, payload)`; `useMyPendingRequestsQuery(entityType, userId)`; `useAllPendingRequestsQuery()`; `approveChangeRequest(id)`, `rejectChangeRequest(id, reason)`; `computeFieldDiff(before, after)` (pure) → `[{ field, before, after }]` for changed fields only.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { computeFieldDiff } from './changeRequests'

describe('computeFieldDiff', () => {
  it('returns only fields that changed', () => {
    const before = { title: 'Old', body: 'Same', date: '2026-01-01' }
    const after = { title: 'New', body: 'Same', date: '2026-01-01' }
    expect(computeFieldDiff(before, after)).toEqual([{ field: 'title', before: 'Old', after: 'New' }])
  })
  it('treats a missing before as every field changed', () => {
    const after = { title: 'New', body: 'Text' }
    const diff = computeFieldDiff(null, after)
    expect(diff).toEqual(
      expect.arrayContaining([
        { field: 'title', before: null, after: 'New' },
        { field: 'body', before: null, after: 'Text' },
      ]),
    )
    expect(diff).toHaveLength(2)
  })
  it('returns an empty list when nothing changed', () => {
    const row = { title: 'Same' }
    expect(computeFieldDiff(row, row)).toEqual([])
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/data/changeRequests.test.js`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Write the module**

```js
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function submitChangeRequest(entityType, action, recordId, payload) {
  const { data, error } = await supabase.rpc('submit_change_request', {
    p_entity_type: entityType,
    p_action: action,
    p_record_id: recordId,
    p_payload: payload,
  })
  if (error) throw error
  return data
}

export async function fetchMyPendingRequests(entityType, userId) {
  const { data, error } = await supabase
    .from('change_requests')
    .select('*')
    .eq('entity_type', entityType)
    .eq('submitted_by', userId)
    .eq('status', 'pending')
  if (error) throw error
  return data
}

export function useMyPendingRequestsQuery(entityType, userId) {
  return useQuery({
    queryKey: ['change_requests', 'mine', entityType, userId],
    queryFn: () => fetchMyPendingRequests(entityType, userId),
    enabled: Boolean(entityType) && Boolean(userId),
  })
}

export async function fetchAllPendingRequests() {
  const { data, error } = await supabase
    .from('change_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export function useAllPendingRequestsQuery() {
  return useQuery({ queryKey: ['change_requests', 'pending', 'all'], queryFn: fetchAllPendingRequests })
}

export async function approveChangeRequest(id) {
  const { error } = await supabase.rpc('apply_change_request', { p_id: id })
  if (error) throw error
}

export async function rejectChangeRequest(id, reason) {
  const { error } = await supabase.rpc('reject_change_request', { p_id: id, p_reason: reason })
  if (error) throw error
}

export function computeFieldDiff(before, after) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  const changes = []
  for (const key of keys) {
    const beforeValue = before?.[key] ?? null
    const afterValue = after?.[key] ?? null
    if (String(beforeValue ?? '') !== String(afterValue ?? '')) {
      changes.push({ field: key, before: beforeValue, after: afterValue })
    }
  }
  return changes
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/data/changeRequests.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/changeRequests.js src/data/changeRequests.test.js
git commit -m "feat: add review queue data layer"
```

---

## Task 8: Route News/Events writes through the review queue for non-owner admins

**Files:**
- Modify: `src/components/admin/AdminResourceManager.jsx` (full rewrite, see below)

**Interfaces:**
- Consumes: `useOwnAdminRowQuery` (Task 2), `submitChangeRequest`, `useMyPendingRequestsQuery` (Task 7).
- Produces: `AdminResourceManager` now reads an optional `config.reviewGated` boolean — when `true` and the caller isn't owner, creates/edits submit to the queue instead of writing directly. Consumed by Task 9's config changes.

- [ ] **Step 1: Rewrite the component**

```jsx
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import AdminResourceList from './AdminResourceList'
import AdminResourceForm from './AdminResourceForm'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import ErrorState from '../ui/ErrorState'
import { SkeletonTable } from '../ui/Skeleton'
import { generateId } from '../../lib/adminFields'
import { useToast } from '../../lib/ToastContext'
import { useAuth } from '../../lib/AuthContext'
import { useOwnAdminRowQuery } from '../../data/admins'
import { submitChangeRequest, useMyPendingRequestsQuery } from '../../data/changeRequests'

async function loadRows(table, orderBy) {
  let query = supabase.from(table).select('*')
  if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export default function AdminResourceManager({ table, title, config, orderBy, renderRowExtra }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()
  const adminRowQuery = useOwnAdminRowQuery(user?.id)
  const isOwner = Boolean(adminRowQuery.data?.is_owner)
  const gated = Boolean(config.reviewGated) && !isOwner
  const pendingQuery = useMyPendingRequestsQuery(config.reviewGated ? table : null, user?.id)
  const pendingRequests = pendingQuery.data ?? []
  const pendingInserts = pendingRequests.filter((r) => r.action === 'insert')
  const pendingUpdateRecordIds = new Set(pendingRequests.filter((r) => r.action === 'update').map((r) => r.record_id))

  const [editing, setEditing] = useState(null) // null = add-new panel, record = editing that row
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false)
  const [activeGroup, setActiveGroup] = useState('All')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [table],
    queryFn: () => loadRows(table, orderBy),
  })
  const rows = data ?? []

  const groupValues = useMemo(() => {
    if (!config.groupField) return null
    return Array.from(new Set(rows.map((r) => String(r[config.groupField])))).sort()
  }, [rows, config.groupField])

  const filteredRows =
    config.groupField && activeGroup !== 'All'
      ? rows.filter((r) => String(r[config.groupField]) === activeGroup)
      : rows

  useEffect(() => {
    if (config.groupField && activeGroup !== 'All' && !rows.some((r) => String(r[config.groupField]) === activeGroup)) {
      setActiveGroup('All')
    }
  }, [rows, activeGroup, config.groupField])

  function invalidatePending() {
    if (config.reviewGated) queryClient.invalidateQueries({ queryKey: ['change_requests', 'mine', table, user?.id] })
  }

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editing) {
        if (gated) {
          await submitChangeRequest(table, 'update', String(editing.id), payload)
          return null
        }
        const result = await supabase.from(table).update(payload).eq('id', editing.id).select()
        if (result.error) throw result.error
        if (!result.data || result.data.length === 0) {
          throw new Error('No changes were saved — your account may not have admin access to make this change.')
        }
        return result.data
      }
      const id = generateId(payload[config.idField])
      if (gated) {
        await submitChangeRequest(table, 'insert', null, { ...payload, id })
        return null
      }
      const result = await supabase.from(table).insert({ ...payload, id })
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] })
      invalidatePending()
      toast.success(gated ? 'Submitted for review.' : editing ? `${title} updated.` : `${title} added.`)
      setEditing(null)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (row) => {
      const { data: deletedRows, error } = await supabase.from(table).delete().eq('id', row.id).select()
      if (error) throw error
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error('No changes were saved — your account may not have admin access to make this change.')
      }
      return deletedRows
    },
    onSuccess: (_data, row) => {
      queryClient.invalidateQueries({ queryKey: [table] })
      toast.success(`${title} deleted.`)
      if (editing?.id === row.id) setEditing(null)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const { error } =
        config.groupField && activeGroup !== 'All'
          ? await supabase.from(table).delete().in('id', filteredRows.map((r) => r.id))
          : await supabase.from(table).delete().not('id', 'is', null)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] })
      toast.success(
        `${activeGroup === 'All' ? 'All' : `${activeGroup} ${config.groupLabel ?? ''}`.trim()} ${title.toLowerCase()} deleted.`,
      )
      setConfirmingDeleteAll(false)
      setEditing(null)
      setActiveGroup('All')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1 text-sm font-semibold text-green-900 no-underline hover:text-orange-500 hover:underline"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Back to Admin
      </Link>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-900">{title}</h1>
          <p className="mt-1 text-ink-muted">
            Create, edit, and remove {config.title.toLowerCase()} from the public hub.
            {gated && ' Creates and edits need the owner’s approval before they go live.'}
          </p>
        </div>
        <div className="flex gap-3">
          {filteredRows.length > 0 && (
            <Button variant="destructive" onClick={() => setConfirmingDeleteAll(true)}>
              <span className="material-symbols-outlined text-base">delete_sweep</span>
              Delete {activeGroup === 'All' ? 'All' : `${activeGroup} ${config.groupLabel ?? ''}`.trim()}
            </Button>
          )}
          <Button variant="primary" onClick={() => setEditing(null)}>
            <span className="material-symbols-outlined text-base">add</span>
            Add {config.title}
          </Button>
        </div>
      </div>

      {groupValues && groupValues.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {['All', ...groupValues].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveGroup(value)}
              className={[
                'rounded-full px-4 py-2 text-sm font-semibold border transition-colors',
                value === activeGroup
                  ? 'bg-green-900 text-white border-green-900'
                  : 'bg-surface text-ink border-hairline hover:bg-surface-low',
              ].join(' ')}
            >
              {value === 'All' ? 'All' : `${value} ${config.groupLabel ?? ''}`.trim()}
            </button>
          ))}
        </div>
      )}

      {confirmingDeleteAll && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-danger bg-danger-bg p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-danger">
            Delete all {filteredRows.length}{' '}
            {activeGroup !== 'All' ? `${activeGroup} ${config.groupLabel ?? ''} `.trim() + ' ' : ''}
            {config.title.toLowerCase()}? This can&rsquo;t be undone.
          </p>
          <div className="flex shrink-0 gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDeleteAll(false)}
              disabled={deleteAllMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteAllMutation.mutate()}
              loading={deleteAllMutation.isPending}
            >
              Yes, delete all
            </Button>
          </div>
        </div>
      )}

      {isError && !data ? (
        <div className="mt-6">
          <ErrorState message={`Couldn't load ${title.toLowerCase()} right now.`} onRetry={refetch} />
        </div>
      ) : isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={config.listColumns.length + 1} rows={5} />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            {pendingInserts.length > 0 && (
              <div className="mb-4 flex flex-col gap-2 rounded-lg border border-hairline bg-surface-low p-4">
                <h3 className="text-sm font-semibold text-ink-900">Awaiting the owner&rsquo;s approval</h3>
                {pendingInserts.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm text-ink-muted">
                    <span>{r.payload.title || r.payload.id}</span>
                    <Badge tone="new">Pending</Badge>
                  </div>
                ))}
              </div>
            )}
            <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-md">
              <AdminResourceList
                config={config}
                rows={filteredRows}
                onEdit={setEditing}
                onDelete={(row) => deleteMutation.mutate(row)}
                renderRowExtra={(row) => (
                  <>
                    {renderRowExtra && renderRowExtra(row)}
                    {pendingUpdateRecordIds.has(String(row.id)) && <Badge tone="new">Pending review</Badge>}
                  </>
                )}
                emptyLabel={
                  config.groupField && activeGroup !== 'All'
                    ? `${activeGroup} ${config.groupLabel ?? ''} ${config.title.toLowerCase()}`.replace(/\s+/g, ' ').trim()
                    : undefined
                }
              />
            </div>
          </div>

          <div className="rounded-lg border border-hairline bg-surface p-6 shadow-md lg:sticky lg:top-24 lg:col-span-4">
            <h2 className="mb-4 border-b border-hairline pb-3 text-lg font-bold text-ink-900">
              {editing ? `Edit ${config.title}` : `Add ${config.title}`}
            </h2>
            <AdminResourceForm
              key={editing?.id ?? 'new'}
              config={config}
              record={editing ?? undefined}
              onSubmit={(payload) => saveMutation.mutate(payload)}
              onCancel={() => setEditing(null)}
              saving={saveMutation.isPending}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminResourceManager.jsx
git commit -m "feat: route gated resource writes through the review queue"
```

---

## Task 9: Gate News and Events

**Files:**
- Modify: `src/pages/admin/config/newsAdminConfig.js`
- Modify: `src/pages/admin/config/eventsAdminConfig.js`

**Interfaces:**
- Consumes: `config.reviewGated` support added in Task 8.

- [ ] **Step 1: Gate News**

In `src/pages/admin/config/newsAdminConfig.js`, change:
```js
export const newsAdminConfig = {
  title: 'News',
  idField: 'title',
```
to:
```js
export const newsAdminConfig = {
  title: 'News',
  idField: 'title',
  reviewGated: true,
```

- [ ] **Step 2: Gate Events**

In `src/pages/admin/config/eventsAdminConfig.js`, change:
```js
export const eventsAdminConfig = {
  title: 'Events',
  idField: 'title',
```
to:
```js
export const eventsAdminConfig = {
  title: 'Events',
  idField: 'title',
  reviewGated: true,
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. Sign in as a non-owner admin (promote a test account via `/admin/users` from Task 6 first): go to `/admin/news`, add an article → toast reads "Submitted for review", the article does **not** appear in the live list, and it shows under "Awaiting the owner's approval". Confirm the public `/news` page does not show it. Repeat for `/admin/events`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/config/newsAdminConfig.js src/pages/admin/config/eventsAdminConfig.js
git commit -m "feat: gate News and Events behind owner review"
```

---

## Task 10: `/admin/reviews` — the owner's review queue

**Files:**
- Create: `src/pages/admin/AdminReviews.jsx`
- Modify: `src/pages/Admin.jsx` (add a conditional `ADMIN_SECTIONS` entry + filter for non-owners)
- Modify: `src/App.jsx` (lazy import + route)

**Interfaces:**
- Consumes: `useAllPendingRequestsQuery`, `approveChangeRequest`, `rejectChangeRequest`, `computeFieldDiff` (Task 7); `useOwnAdminRowQuery` (Task 2).

- [ ] **Step 1: Write a live-row lookup helper and the page**

```jsx
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useAllPendingRequestsQuery, approveChangeRequest, rejectChangeRequest, computeFieldDiff } from '../../data/changeRequests'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'

const TABLE_BY_ENTITY = { news: 'news', events: 'events', award_season: 'award_seasons' }

async function fetchLiveRow(entityType, recordId) {
  if (!recordId) return null
  const table = TABLE_BY_ENTITY[entityType]
  const { data } = await supabase.from(table).select('*').eq('id', recordId).maybeSingle()
  return data
}

function ReviewCard({ request, onApprove, onReject, busy }) {
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const liveRowQuery = useQuery({
    queryKey: ['change_requests', 'live', request.entity_type, request.record_id],
    queryFn: () => fetchLiveRow(request.entity_type, request.record_id),
  })
  const payload = request.entity_type === 'award_season' ? { title: request.payload.title } : request.payload
  const diff = computeFieldDiff(liveRowQuery.data, payload)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge tone="new">{request.entity_type}</Badge>
          <Badge tone="neutral">{request.action}</Badge>
        </div>
        <span className="text-xs text-ink-muted">{new Date(request.created_at).toLocaleString()}</span>
      </div>
      <div className="flex flex-col gap-1">
        {diff.length === 0 && <p className="text-sm text-ink-muted">No visible field changes.</p>}
        {diff.map((change) => (
          <div key={change.field} className="text-sm">
            <span className="font-semibold text-ink-900">{change.field}: </span>
            <span className="text-danger line-through">{String(change.before ?? '—')}</span>{' '}
            <span className="text-success">{String(change.after ?? '—')}</span>
          </div>
        ))}
      </div>
      {request.entity_type === 'award_season' && (
        <p className="text-xs text-ink-muted">{request.payload.categories?.length ?? 0} category(ies) proposed.</p>
      )}
      {rejecting ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection"
            className="w-full rounded-md border border-hairline bg-surface p-2 text-sm outline-none focus:border-green-900"
          />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" loading={busy} onClick={() => onReject(request.id, reason)}>
              Confirm reject
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="primary" size="sm" loading={busy} onClick={() => onApprove(request.id)}>
            Approve
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setRejecting(true)}>
            Reject
          </Button>
        </div>
      )}
    </div>
  )
}

export default function AdminReviews() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const pendingQuery = useAllPendingRequestsQuery()
  const requests = pendingQuery.data ?? []

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['change_requests'] })
    queryClient.invalidateQueries({ queryKey: ['news'] })
    queryClient.invalidateQueries({ queryKey: ['events'] })
    queryClient.invalidateQueries({ queryKey: ['award_seasons'] })
  }

  const approveMutation = useMutation({
    mutationFn: approveChangeRequest,
    onSuccess: () => {
      invalidate()
      toast.success('Approved and published.')
    },
    onError: (error) => toast.error(error.message),
  })
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => rejectChangeRequest(id, reason),
    onSuccess: () => {
      invalidate()
      toast.success('Rejected.')
    },
    onError: (error) => toast.error(error.message),
  })

  if (pendingQuery.isError && !pendingQuery.data) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load the review queue right now." onRetry={pendingQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Review queue</h1>
      <p className="mt-1 text-ink-muted">Changes admins have submitted for News, Events, and Awards.</p>

      {pendingQuery.isLoading ? (
        <div className="mt-6">
          <SkeletonTable columns={2} rows={3} />
        </div>
      ) : requests.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon="fact_check" title="Nothing pending" description="Submitted changes will show up here." />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {requests.map((request) => (
            <ReviewCard
              key={request.id}
              request={request}
              busy={approveMutation.isPending || rejectMutation.isPending}
              onApprove={(id) => approveMutation.mutate(id)}
              onReject={(id, reason) => rejectMutation.mutate({ id, reason })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Show the tile only to the owner**

In `src/pages/Admin.jsx`, add the import and use it to build the sections list conditionally. Change:
```jsx
import { Link } from 'react-router-dom'
import { usePendingSubmissionsCountQuery } from '../data/outlineSubmissions'
import Badge from '../components/ui/Badge'
```
to:
```jsx
import { Link } from 'react-router-dom'
import { usePendingSubmissionsCountQuery } from '../data/outlineSubmissions'
import { useOwnAdminRowQuery } from '../data/admins'
import { useAuth } from '../lib/AuthContext'
import Badge from '../components/ui/Badge'
```

Add this entry at the end of the `ADMIN_SECTIONS` array (after the Awards entry):
```js
  {
    path: '/admin/reviews',
    label: 'Reviews',
    icon: 'fact_check',
    category: 'Governance',
    description: 'Approve or reject pending News, Events, and Awards edits.',
    ownerOnly: true,
  },
```

Change the component body from:
```jsx
export default function Admin() {
  const pendingCountQuery = usePendingSubmissionsCountQuery()
  const pendingCount = pendingCountQuery.data ?? 0
```
to:
```jsx
export default function Admin() {
  const { user } = useAuth()
  const pendingCountQuery = usePendingSubmissionsCountQuery()
  const pendingCount = pendingCountQuery.data ?? 0
  const adminRowQuery = useOwnAdminRowQuery(user?.id)
  const isOwner = Boolean(adminRowQuery.data?.is_owner)
  const visibleSections = ADMIN_SECTIONS.filter((s) => !s.ownerOnly || isOwner)
```
and change the `{ADMIN_SECTIONS.map((s) => (` line to `{visibleSections.map((s) => (`.

- [ ] **Step 3: Add the route**

In `src/App.jsx`, add the lazy import after `const AdminUsers = lazy(...)` (Task 6):
```jsx
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews'))
```
And the route after `<Route path="admin/users" element={<AdminUsers />} />`:
```jsx
            <Route path="admin/reviews" element={<AdminReviews />} />
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. As the owner, with the pending News/Events items from Task 9's verification still in the queue: `/admin` shows a "Reviews" tile (a non-owner admin does not see it). Open `/admin/reviews`, confirm the diff shows the new title/body etc., Approve one → it now appears on the public site and the queue count drops; Reject another with a reason → it disappears from the queue and does not go live.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/AdminReviews.jsx src/pages/Admin.jsx src/App.jsx
git commit -m "feat: add owner-only review queue page"
```

---

## Task 11: Gate Award season/category setup

**Files:**
- Modify: `src/data/awardSeasons.js` (add `submitSeasonChange`)
- Modify: `src/pages/admin/AdminAwardSeason.jsx` (branch `saveMutation` on ownership)

**Interfaces:**
- Consumes: `submitChangeRequest` (Task 7), `useOwnAdminRowQuery` (Task 2).
- Produces: `submitSeasonChange({ seasonId, title, categories })` in `src/data/awardSeasons.js`.

- [ ] **Step 1: Add `submitSeasonChange` to `awardSeasons.js`**

Add this import at the top of `src/data/awardSeasons.js`:
```js
import { submitChangeRequest } from './changeRequests'
```

Add this function at the end of the file:
```js
export async function submitSeasonChange({ seasonId, title, categories }) {
  const payload = {
    title,
    categories: categories.map((c, i) => ({
      id: c.id,
      title: c.title.trim(),
      description: c.description?.trim() || null,
      sort_order: i,
    })),
  }
  await submitChangeRequest('award_season', seasonId ? 'update' : 'insert', seasonId ?? null, payload)
}
```

- [ ] **Step 2: Branch `AdminAwardSeason.jsx`'s save flow on ownership**

Add these imports in `src/pages/admin/AdminAwardSeason.jsx` alongside the existing ones from `../../data/awardSeasons`:
```jsx
import { useOwnAdminRowQuery } from '../../data/admins'
```
and change:
```jsx
import {
  useSeasonQuery,
  createSeason,
  updateSeasonTitle,
  advanceSeasonPhase,
  nextPhase,
  phaseAdvanceLabel,
} from '../../data/awardSeasons'
```
to:
```jsx
import {
  useSeasonQuery,
  createSeason,
  updateSeasonTitle,
  advanceSeasonPhase,
  nextPhase,
  phaseAdvanceLabel,
  submitSeasonChange,
} from '../../data/awardSeasons'
```

Inside the component, after `const { user } = useAuth()`, add:
```jsx
  const adminRowQuery = useOwnAdminRowQuery(user?.id)
  const isOwner = Boolean(adminRowQuery.data?.is_owner)
```

Change `saveMutation`'s `mutationFn` from:
```jsx
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
```
to:
```jsx
    mutationFn: async () => {
      if (!title.trim()) throw new Error('A season title is required.')
      const validCategories = categories.filter((c) => c.title.trim())
      if (validCategories.length === 0) throw new Error('Add at least one category.')

      if (!isOwner) {
        await submitSeasonChange({ seasonId, title: title.trim(), categories: validCategories })
        return null
      }

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
```

Change `saveMutation`'s `onSuccess` from:
```jsx
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['award_seasons'] })
      toast.success('Season saved.')
      setFormError('')
      navigate(`/admin/awards/${id}/edit`, { replace: true })
    },
```
to:
```jsx
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['award_seasons'] })
      setFormError('')
      if (id) {
        toast.success('Season saved.')
        navigate(`/admin/awards/${id}/edit`, { replace: true })
      } else {
        toast.success('Submitted for review.')
        navigate('/admin/awards', { replace: true })
      }
    },
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. As a non-owner admin: `/admin/awards/new`, fill a title + one category, save → toast "Submitted for review", redirected to `/admin/awards`, no new season visible there or on the public `/awards` page. As the owner: `/admin/reviews` shows the pending `award_season` request with the proposed title; Approve → the season now appears in `/admin/awards` with its category, in the `nominating` phase, and phase-advance/curate actions work normally (those remain direct, ungated, per the spec).

- [ ] **Step 4: Commit**

```bash
git add src/data/awardSeasons.js src/pages/admin/AdminAwardSeason.jsx
git commit -m "feat: gate award season/category setup behind owner review"
```

---

## Final check

- [ ] Run `npm run test` — all suites pass.
- [ ] Run `npm run lint` — no errors.
- [ ] Walk through the spec's non-goals once more against the running app: Opportunities/Excos/Outlines/Timetables/Resources/Forms still save immediately for a non-owner admin; deletes on News/Events/Awards still take effect immediately for any admin; outline submissions review is untouched.
