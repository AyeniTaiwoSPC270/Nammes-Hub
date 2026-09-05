# Resend Email & Broadcasting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send transactional email (welcome, new-content alerts) and admin-composed broadcasts via Resend on the `nammeshub.com.ng` domain.

**Architecture:** A new `api/` folder of Vercel Functions (Node.js, zero-config — the project already deploys to Vercel) holds the only code allowed to touch the Resend API key and the Supabase service-role key. Two endpoints are invoked by Supabase Database Webhooks on row inserts (welcome, new-content alert); one is called directly by the admin UI with the caller's Supabase access token (broadcast send). A new Postgres security-definer function centralizes "who is opted in" so every send path shares one audience query.

**Tech Stack:** Vercel Functions (Node.js runtime, `(req, res)` handler style — matches this non-framework Vite project), `resend` npm package, `@supabase/supabase-js` (service-role client), existing React/Vite/Supabase/TanStack Query stack for the frontend pieces.

**Spec:** `docs/superpowers/specs/2026-09-05-resend-email-broadcasting-design.md`

## Global Constraints

- Sending domain is `nammeshub.com.ng` — every `from` address uses it (e.g. `NAMMES Hub <no-reply@nammeshub.com.ng>`).
- No secret (`RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) may be `VITE_`-prefixed or referenced from `src/` — they only exist in `api/` code and Vercel's server-side env vars. (Superseded during execution: the webhook-auth secret ended up living only in Supabase Vault, verified via the `verify_webhook_secret` RPC — see Task 4's deviation note — so it was never a Vercel env var at all in the shipped version.)
- Resend batch sends are chunked at 100 recipients per call (Resend's batch limit).
- Welcome email always sends, unconditional on the opt-out toggle. New-content alerts and broadcasts always respect `profiles.email_notifications_enabled`.
- This codebase's existing test convention (verified across `src/data/*.test.js`): a file gets a `*.test.js` only when it contains pure/derived logic worth unit testing; thin Supabase CRUD wrappers (e.g. `admins.js`) have no test file. Follow this — don't invent hollow tests for passthrough functions.
- No Supabase-mocking test infrastructure exists in this project; integration-level flows (a real webhook firing, a real broadcast send) are verified manually against a real Resend send in a `vercel dev` or preview environment, matching this project's existing approach.

---

### Task 1: Provision Resend (free tier, direct signup)

**Files:** none (dashboard + CLI only)

The Vercel Marketplace listing for Resend (`resend/resend-email`) only offers paid plans ($20/mo Pro, $90/mo Scale) for CLI provisioning — no free tier. Per the user's choice, this uses Resend's own free tier (3,000 emails/month, 100/day) directly, with the API key added to Vercel as a plain env var instead of a marketplace-managed resource.

**Interfaces:**
- Produces: `RESEND_API_KEY` available as a Vercel project env var, consumed by Task 3's `api/_lib/resend.js`. A verified `nammeshub.com.ng` sending domain in Resend, required before any task past Task 4 can actually deliver mail.

- [x] **Step 1: Link the local repo to its Vercel project**

Done — linked to `ayenitaiwospc270s-projects/nammes-hub`.

- [x] **Step 2: Signup, domain verification, and an API key**

Done — user signed up on the free tier, verified `nammeshub.com.ng`, and generated an API key.

- [x] **Step 3: Add the API key as a Vercel env var**

Done for Production, Preview, and Development. (Note for future secret handling: the key was pasted into chat, so it was added via a temp file + stdin redirect — `vercel env add RESEND_API_KEY <env> < tempfile` — rather than `echo "key" | vercel env add ...`, since the latter puts the secret directly in the command line/shell history. The temp file was deleted immediately after.)

- [x] **Step 4: Pull it down locally**

Done — `.env.local` contains `RESEND_API_KEY`.

---

### Task 2: Database migration — opt-out column, broadcasts table, and two Postgres functions

**Files:** none tracked in the repo (this project applies schema changes directly against Supabase, per `ADMIN.md` and every prior spec — no migration files exist in this repo to add to)

**Interfaces:**
- Produces: `public.profiles.email_notifications_enabled` (boolean), `public.broadcasts` table, `public.set_own_email_notifications(enabled boolean)` RPC, `public.get_notification_recipients()` RPC returning `table(email text)`. Consumed by Tasks 5, 6, 7, 8.

- [x] **Step 1: Run this SQL against the project's Supabase database**

Done — applied via the Supabase MCP `apply_migration` tool (project `ascdypvchlbpfupsssuy`, migration name `email_notifications_and_broadcasts`) per the user's choice.

```sql
alter table public.profiles
  add column email_notifications_enabled boolean not null default true;

create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  sent_by uuid not null references auth.users(id),
  recipient_count int not null,
  created_at timestamptz not null default now()
);

alter table public.broadcasts enable row level security;

create policy "broadcasts_admin_select" on public.broadcasts for select
  using (auth.uid() in (select user_id from public.admins));

create or replace function public.set_own_email_notifications(enabled boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set email_notifications_enabled = enabled where user_id = auth.uid();
$$;

create or replace function public.get_notification_recipients()
returns table(email text)
language sql
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.user_id = u.id
  where p.email_notifications_enabled = true and u.email is not null;
$$;

revoke execute on function public.get_notification_recipients() from public, anon, authenticated;
```

`broadcasts` has no client-facing INSERT policy — only `api/send-broadcast.js` (Task 6) writes to it, using the service-role key, which bypasses RLS. `get_notification_recipients()` is revoked from `anon`/`authenticated` because it returns every opted-in user's email — only the service role (used exclusively from `api/` code) may call it.

- [x] **Step 2: Verify**

Done — confirmed via `information_schema` that `profiles.email_notifications_enabled` (boolean, default `true`), `public.broadcasts`, `set_own_email_notifications`, and `get_notification_recipients` all exist.

---

### Task 3: Shared backend helpers (`api/_lib/`)

**Files:**
- Create: `api/_lib/resend.js`
- Create: `api/_lib/supabaseAdmin.js`
- Create: `api/_lib/chunk.js`
- Test: `api/_lib/chunk.test.js`
- Modify: `package.json` (add `resend` dependency)
- Modify: `.env.example` (add `WEBHOOK_SHARED_SECRET`)

The `_lib` (underscore-prefixed) directory name is required — Vercel treats every other file directly under `api/` as its own routable function, and excludes underscore-prefixed subdirectories from that.

**Interfaces:**
- Produces: `getResendClient(): Resend`, `FROM_ADDRESS: string` from `resend.js`; `getSupabaseAdmin(): SupabaseClient` from `supabaseAdmin.js`; `chunk(array: T[], size: number): T[][]` from `chunk.js`. Consumed by Tasks 4, 5, 6.

- [x] **Step 1: Install the `resend` package**

Run: `npm install resend`

- [x] **Step 2: Write the failing test for `chunk`**

```js
// api/_lib/chunk.test.js
import { describe, it, expect } from 'vitest'
import { chunk } from './chunk.js'

describe('chunk', () => {
  it('splits an array into groups of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
  it('returns one group when the array is smaller than the size', () => {
    expect(chunk(['a', 'b'], 100)).toEqual([['a', 'b']])
  })
  it('returns an empty array for an empty input', () => {
    expect(chunk([], 10)).toEqual([])
  })
})
```

- [x] **Step 3: Run it to verify it fails**

Run: `npm test -- api/_lib/chunk.test.js`
Expected: FAIL with "Failed to resolve import" or "chunk is not a function"

- [x] **Step 4: Implement `chunk.js`**

```js
// api/_lib/chunk.js
export function chunk(array, size) {
  const result = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}
```

- [x] **Step 5: Run the test to verify it passes**

Run: `npm test -- api/_lib/chunk.test.js`
Expected: PASS

- [x] **Step 6: Write `resend.js`**

```js
// api/_lib/resend.js
import { Resend } from 'resend'

export const FROM_ADDRESS = 'NAMMES Hub <no-reply@nammeshub.com.ng>'

export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Missing RESEND_API_KEY')
  return new Resend(apiKey)
}
```

- [x] **Step 7: Write `supabaseAdmin.js`**

Reuses the same env var names as the existing `scripts/supabaseAdminClient.mjs` (`VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) — these are already set as plain Vercel project env vars (the `VITE_` prefix only controls what the Vite client bundle exposes; `process.env.VITE_SUPABASE_URL` is a normal server-side var here).

```js
// api/_lib/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}
```

- [x] **Step 8: Add `WEBHOOK_SHARED_SECRET` to `.env.example`**

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
WEBHOOK_SHARED_SECRET=
```

Generate the real value with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, set it as a Vercel project env var (`vercel env add WEBHOOK_SHARED_SECRET`), and keep a copy for Task 4/5's Supabase Database Webhook header configuration.

- [x] **Step 9: Commit**

```bash
git add api/_lib package.json package-lock.json .env.example
git commit -m "feat: add shared Resend/Supabase-admin helpers for email backend"
```

---

### Task 4: Welcome email

**Files:**
- Create: `api/webhook-welcome.js`

**Interfaces:**
- Consumes: `getResendClient`, `FROM_ADDRESS` from `api/_lib/resend.js`; `getSupabaseAdmin` from `api/_lib/supabaseAdmin.js`.
- Produces: a deployed `POST /api/webhook-welcome` endpoint.

- [x] **Step 1: Write the handler**

```js
// api/webhook-welcome.js
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { getResendClient, FROM_ADDRESS } from './_lib/resend.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const record = req.body?.record
  if (!record?.user_id) {
    res.status(400).json({ error: 'Missing record.user_id' })
    return
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data: isValidSecret } = await supabaseAdmin.rpc('verify_webhook_secret', {
    candidate: req.headers['x-webhook-secret'] || '',
  })
  if (!isValidSecret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(record.user_id)
  if (error || !data?.user?.email) {
    console.error('webhook-welcome: could not resolve email', error)
    res.status(200).json({ sent: false })
    return
  }

  try {
    await getResendClient().emails.send({
      from: FROM_ADDRESS,
      to: data.user.email,
      subject: 'Welcome to NAMMES Hub',
      html: `<p>Hi ${record.full_name || 'there'},</p><p>Welcome to NAMMES Hub — glad to have you.</p>`,
    })
    res.status(200).json({ sent: true })
  } catch (sendError) {
    console.error('webhook-welcome: send failed', sendError)
    res.status(200).json({ sent: false })
  }
}
```

A send failure returns `200` deliberately — this endpoint is called by a fire-and-forget trigger with no retry-into-transaction semantics, so a failed email must never look like a failed signup to Postgres.

- [x] **Step 2: Deploy and wire up the trigger**

**Deviation from the original plan:** rather than a dashboard-configured Supabase Database Webhook with a static `WEBHOOK_SHARED_SECRET` compared against a Vercel env var, this ships as a hand-rolled equivalent — a `pg_net`-based Postgres trigger, with the secret generated inside Postgres (via `pgcrypto`) and stored in Supabase Vault, never touching a Vercel env var. The endpoint verifies the secret by calling `verify_webhook_secret(candidate)` (a `SECURITY DEFINER` SQL function that checks the candidate against `vault.decrypted_secrets` and returns a boolean) instead of comparing against `process.env`. This removes the sync problem of keeping two copies of the same secret in agreement, at the cost of not showing up in Supabase's dashboard "Database → Webhooks" tab — it's SQL-only, inspectable via `pg_trigger`/`pg_proc`.

Applied via Supabase MCP `apply_migration` (project `ascdypvchlbpfupsssuy`):

```sql
-- migration: email_webhook_triggers
create extension if not exists pg_net;

select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'webhook_shared_secret',
  'Shared secret sent as x-webhook-secret to the Vercel email endpoints'
);

create or replace function public.notify_email_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
  target_url text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'webhook_shared_secret';
  target_url := case TG_TABLE_NAME
    when 'profiles' then 'https://www.nammeshub.com.ng/api/webhook-welcome'
    else 'https://www.nammeshub.com.ng/api/webhook-new-content'
  end;
  perform net.http_post(
    url := target_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'record', to_jsonb(NEW))
  );
  return NEW;
end;
$$;

create trigger profiles_notify_welcome after insert on public.profiles
  for each row execute function public.notify_email_webhook();
create trigger news_notify_new_content after insert on public.news
  for each row execute function public.notify_email_webhook();
create trigger events_notify_new_content after insert on public.events
  for each row execute function public.notify_email_webhook();
```

```sql
-- migration: verify_webhook_secret_function
create or replace function public.verify_webhook_secret(candidate text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'webhook_shared_secret' and decrypted_secret = candidate
  );
$$;

revoke execute on function public.verify_webhook_secret(text) from public, anon, authenticated;
```

Then pushed `master` to GitHub, triggering Vercel's git-integration production deploy.

- [x] **Step 3: Manually verify**

Done, with a detour: a real signup at 16:24 UTC hit this endpoint but failed with "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" (per Vercel logs) — `SUPABASE_SERVICE_ROLE_KEY` had never actually been added as a Vercel project env var (only ever lived in local `.env` files for the seed scripts). Added it (all 3 environments) and redeployed. Re-verified by calling `net.http_post` directly against the deployed endpoint (same payload shape the trigger sends) targeting the owner's own existing account — avoids burning more of Supabase's auth email rate limit on throwaway signups. Confirmed: no error in logs, and the user confirmed receipt of the welcome email.

- [x] **Step 4: Commit**

Done — batched with Tasks 5/6 into `347cd68` ("feat: add Resend email endpoints..."), then the secret-verification approach was refactored in `602e694`.

---

### Task 5: New-content alert

**Files:**
- Create: `api/webhook-new-content.js`

**Interfaces:**
- Consumes: `getResendClient`, `FROM_ADDRESS`, `getSupabaseAdmin`, `chunk` (Task 3); `get_notification_recipients()` Postgres function (Task 2).
- Produces: a deployed `POST /api/webhook-new-content` endpoint, table-agnostic (handles both `news` and `events`).

- [x] **Step 1: Write the handler**

```js
// api/webhook-new-content.js
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { getResendClient, FROM_ADDRESS } from './_lib/resend.js'
import { chunk } from './_lib/chunk.js'

const LABEL_BY_TABLE = { news: 'News', events: 'Events' }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const { table, record } = req.body ?? {}
  const label = LABEL_BY_TABLE[table]
  if (!label || !record?.title) {
    res.status(400).json({ error: 'Unsupported table or missing record.title' })
    return
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data: isValidSecret } = await supabaseAdmin.rpc('verify_webhook_secret', {
    candidate: req.headers['x-webhook-secret'] || '',
  })
  if (!isValidSecret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { data: recipients, error } = await supabaseAdmin.rpc('get_notification_recipients')
  if (error) {
    console.error('webhook-new-content: could not load recipients', error)
    res.status(200).json({ sent: 0 })
    return
  }

  const emails = recipients.map((r) => r.email)
  const resend = getResendClient()
  const singular = label.slice(0, -1)
  let sent = 0
  for (const batch of chunk(emails, 100)) {
    try {
      await resend.batch.send(
        batch.map((email) => ({
          from: FROM_ADDRESS,
          to: email,
          subject: `New ${singular}: ${record.title}`,
          html: `<p>A new ${label.toLowerCase()} item was just published on NAMMES Hub: <strong>${record.title}</strong></p><p><a href="https://nammeshub.com.ng/${table}">View it here</a></p>`,
        })),
      )
      sent += batch.length
    } catch (sendError) {
      console.error('webhook-new-content: batch send failed', sendError)
    }
  }

  res.status(200).json({ sent })
}
```

- [x] **Step 2: Trigger wiring**

Covered by Task 4 Step 2's single migration — `news_notify_new_content` and `events_notify_new_content` triggers were created there in the same migration as the `profiles` one.

- [x] **Step 3: Manually verify (partial)**

Verified via a direct `net.http_post` call against the deployed endpoint (same payload shape the `news` trigger sends: `{table: 'news', record: {title: ...}}`), with user consent since it emails every real opted-in user, not just the owner. No error in logs; user confirmed receipt of the "New News: ..." email. **Not yet verified:** a real insert through the actual News admin UI (vs. this direct simulation), the `events` table path specifically (same handler/trigger function, untested separately), and opt-out suppression (flipping `email_notifications_enabled` to `false` and confirming no email). Revisit if a real News/Event publish doesn't email as expected.

- [x] **Step 4: Commit**

Done — see Task 4 Step 4 (batched together).

---

### Task 6: Broadcast send endpoint

**Files:**
- Create: `api/send-broadcast.js`

**Interfaces:**
- Consumes: `getResendClient`, `FROM_ADDRESS`, `getSupabaseAdmin`, `chunk` (Task 3); `get_notification_recipients()`, `public.broadcasts` (Task 2).
- Produces: a deployed `POST /api/send-broadcast` endpoint expecting `{ subject, body }` JSON and an `Authorization: Bearer <supabase access token>` header; returns `{ recipientCount, sentCount }` on success. Consumed by Task 8's `src/data/broadcasts.js`.

- [x] **Step 1: Write the handler**

```js
// api/send-broadcast.js
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { getResendClient, FROM_ADDRESS } from './_lib/resend.js'
import { chunk } from './_lib/chunk.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' })
    return
  }

  const { subject, body } = req.body ?? {}
  if (!subject?.trim() || !body?.trim()) {
    res.status(400).json({ error: 'subject and body are required' })
    return
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData?.user) {
    res.status(401).json({ error: 'Invalid session' })
    return
  }

  const { data: adminRow } = await supabaseAdmin
    .from('admins')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (!adminRow) {
    res.status(403).json({ error: 'Admin access required' })
    return
  }

  const { data: recipients, error: recipientsError } = await supabaseAdmin.rpc('get_notification_recipients')
  if (recipientsError) {
    res.status(500).json({ error: 'Could not load recipients' })
    return
  }

  const emails = recipients.map((r) => r.email)
  const resend = getResendClient()
  let sentCount = 0
  for (const batch of chunk(emails, 100)) {
    try {
      await resend.batch.send(batch.map((email) => ({ from: FROM_ADDRESS, to: email, subject, html: body })))
      sentCount += batch.length
    } catch (sendError) {
      console.error('send-broadcast: batch send failed', sendError)
    }
  }

  if (emails.length > 0 && sentCount === 0) {
    res.status(502).json({ error: 'Failed to send to any recipients' })
    return
  }

  const { error: insertError } = await supabaseAdmin.from('broadcasts').insert({
    subject,
    body,
    sent_by: userData.user.id,
    recipient_count: sentCount,
  })
  if (insertError) console.error('send-broadcast: failed to record broadcast', insertError)

  res.status(200).json({ recipientCount: emails.length, sentCount })
}
```

A total send failure (`sentCount === 0` with recipients to send to) returns `502` and writes no `broadcasts` row — the frontend must not claim success. A partial failure still writes the row with the real `sentCount` and returns both numbers so the UI can show "sent to N of M."

- [ ] **Step 2: Manually verify — deferred to Task 8**

Getting a valid bearer token requires either `vercel dev` locally or pulling a JWT out of a real browser session — both fiddly to hand the user. Deferred until Task 8 ships the actual `/admin/broadcasts` UI, at which point the user can just click "Send" for a natural end-to-end test instead.

- [x] **Step 3: Commit**

Done — see Task 4 Step 4 (batched together).

---

### Task 7: Email notification preference (`/account`)

**Files:**
- Create: `src/data/notificationPrefs.js`
- Create: `src/pages/Account.jsx`
- Modify: `src/App.jsx` (add route)
- Modify: `src/components/Navbar.jsx` (add "Account" link, desktop + mobile)

No test file for `notificationPrefs.js` — both functions are thin one-line Supabase calls with no derived/pure logic, matching this codebase's existing convention (e.g. `admins.js` has no test file either).

**Interfaces:**
- Consumes: `set_own_email_notifications(enabled boolean)` RPC (Task 2); `useAuth()` from `src/lib/AuthContext.jsx`; `useToast()` from `src/lib/ToastContext.jsx`.
- Produces: `useNotificationPrefQuery(userId)`, `useSetNotificationPrefMutation(userId)` from `notificationPrefs.js`; the `/account` route.

- [x] **Step 1: Write `src/data/notificationPrefs.js`**

```js
// src/data/notificationPrefs.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchNotificationPref(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('email_notifications_enabled')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.email_notifications_enabled ?? true
}

export function useNotificationPrefQuery(userId) {
  return useQuery({
    queryKey: ['profiles', 'notification-pref', userId],
    queryFn: () => fetchNotificationPref(userId),
    enabled: Boolean(userId),
  })
}

export async function setNotificationPref(enabled) {
  const { error } = await supabase.rpc('set_own_email_notifications', { enabled })
  if (error) throw error
}

export function useSetNotificationPrefMutation(userId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (enabled) => setNotificationPref(enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles', 'notification-pref', userId] }),
  })
}
```

- [x] **Step 2: Write `src/pages/Account.jsx`**

```jsx
// src/pages/Account.jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'
import { useNotificationPrefQuery, useSetNotificationPrefMutation } from '../data/notificationPrefs'

export default function Account() {
  const { user, loading } = useAuth()
  const toast = useToast()
  const prefQuery = useNotificationPrefQuery(user?.id)
  const setPrefMutation = useSetNotificationPrefMutation(user?.id)

  if (loading || (user && prefQuery.isLoading)) return null
  if (!user) return <Navigate to="/login" replace />

  const enabled = prefQuery.data ?? true

  function toggle() {
    setPrefMutation.mutate(!enabled, {
      onSuccess: () => toast.success(!enabled ? 'Email notifications turned on.' : 'Email notifications turned off.'),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <div className="mx-auto max-w-[600px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Account</h1>
      <p className="mt-1 text-ink-muted">{user.email}</p>

      <div className="mt-8 flex items-center justify-between gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
        <div>
          <h2 className="font-bold text-ink-900">Email notifications</h2>
          <p className="text-sm text-ink-muted">New News/Events alerts and department broadcasts.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={toggle}
            disabled={setPrefMutation.isPending}
            className="h-5 w-5 accent-green-900"
          />
        </label>
      </div>
    </div>
  )
}
```

- [x] **Step 3: Add the route in `src/App.jsx`**

Add the lazy import near the other top-level pages:

```js
const Account = lazy(() => import('./pages/Account'))
```

Add the route inside the main `<Route element={<Layout />}>` block, alongside `login`/`signup` (not inside `AdminRoute` — any logged-in user, not just admins):

```jsx
<Route path="account" element={<Account />} />
```

- [x] **Step 4: Add an "Account" link in `src/components/Navbar.jsx`**

In the desktop authenticated block (around where `user.email` is rendered, before the "Admin" link):

```jsx
<NavLink to="/account" className={authLinkClass}>
  Account
</NavLink>
```

And the matching entry in the mobile menu's authenticated block, same placement pattern as the existing "Admin" `NavLink` there.

- [ ] **Step 5: Manually verify**

Not yet done — pending deploy. Sign in, visit `/account`, toggle the checkbox, reload, and confirm the state persisted. Visit `/account` while signed out and confirm it redirects to `/login`.

- [x] **Step 6: Commit**

Done — batched with Task 8 into `2ed0e3c` (both new pages touch the same `App.jsx` route registry, so committed together rather than splitting that one file's diff).

---

### Task 8: Admin broadcast composer (`/admin/broadcasts`)

**Files:**
- Create: `src/data/broadcasts.js`
- Create: `src/pages/admin/AdminBroadcasts.jsx`
- Modify: `src/pages/Admin.jsx` (add `ADMIN_SECTIONS` entry)
- Modify: `src/App.jsx` (add route)

No test file for `broadcasts.js`, same reasoning as Task 7 — both functions are thin Supabase/fetch wrappers with no pure logic.

**Interfaces:**
- Consumes: `POST /api/send-broadcast` (Task 6); `public.broadcasts` table (Task 2); `useAuth()`, `useToast()`, `Table`/`Button`/`EmptyState`/`ErrorState`/`SkeletonTable` UI components (existing).
- Produces: the `/admin/broadcasts` route and `ADMIN_SECTIONS` tile.

- [x] **Step 1: Write `src/data/broadcasts.js`**

```js
// src/data/broadcasts.js
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export async function fetchBroadcastHistory() {
  const { data, error } = await supabase
    .from('broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export function useBroadcastHistoryQuery() {
  return useQuery({ queryKey: ['broadcasts', 'history'], queryFn: fetchBroadcastHistory })
}

export async function sendBroadcast({ subject, body }) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  const response = await fetch('/api/send-broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ subject, body }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to send broadcast')
  return result
}
```

- [x] **Step 2: Write `src/pages/admin/AdminBroadcasts.jsx`**

```jsx
// src/pages/admin/AdminBroadcasts.jsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useBroadcastHistoryQuery, sendBroadcast } from '../../data/broadcasts'
import Button from '../../components/ui/Button'
import FormField from '../../components/ui/FormField'
import Table from '../../components/ui/Table'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'

export default function AdminBroadcasts() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const toast = useToast()
  const queryClient = useQueryClient()
  const historyQuery = useBroadcastHistoryQuery()

  const sendMutation = useMutation({
    mutationFn: sendBroadcast,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts', 'history'] })
      setSubject('')
      setBody('')
      toast.success(
        result.sentCount === result.recipientCount
          ? `Sent to ${result.sentCount} recipient(s).`
          : `Sent to ${result.sentCount} of ${result.recipientCount} recipient(s) — check logs for failures.`,
      )
    },
    onError: (error) => toast.error(error.message),
  })

  function handleSubmit(event) {
    event.preventDefault()
    sendMutation.mutate({ subject, body })
  }

  if (historyQuery.isError && !historyQuery.data) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load broadcast history right now." onRetry={historyQuery.refetch} />
      </div>
    )
  }

  const history = historyQuery.data ?? []

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Broadcasts</h1>
      <p className="mt-1 text-ink-muted">Send an email to every opted-in user on NAMMES Hub.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
        <FormField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <FormField label="Body" type="textarea" value={body} onChange={(e) => setBody(e.target.value)} required />
        <Button type="submit" variant="primary" loading={sendMutation.isPending}>
          Send broadcast
        </Button>
      </form>

      <h2 className="mt-10 text-xl font-bold text-ink-900">History</h2>
      {historyQuery.isLoading ? (
        <div className="mt-4">
          <SkeletonTable columns={3} rows={3} />
        </div>
      ) : history.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="campaign" title="No broadcasts yet" description="Sent broadcasts will show up here." />
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-hairline bg-surface shadow-md">
          <Table
            columns={['Subject', 'Recipients', 'Sent']}
            rows={history.map((b) => [b.subject, b.recipient_count, new Date(b.created_at).toLocaleString()])}
          />
        </div>
      )}
    </div>
  )
}
```

- [x] **Step 3: Add the `ADMIN_SECTIONS` entry in `src/pages/Admin.jsx`**

Add to the `ADMIN_SECTIONS` array (any admin, no `ownerOnly`):

```js
{
  path: '/admin/broadcasts',
  label: 'Broadcasts',
  icon: 'campaign',
  category: 'Engagement',
  description: 'Send an announcement email to every opted-in user.',
},
```

- [x] **Step 4: Add the route in `src/App.jsx`**

```js
const AdminBroadcasts = lazy(() => import('./pages/admin/AdminBroadcasts'))
```

Inside the `<Route element={<AdminRoute />}>` block:

```jsx
<Route path="admin/broadcasts" element={<AdminBroadcasts />} />
```

- [ ] **Step 5: Manually verify**

Not yet done — pending deploy. Sign in as an admin, visit `/admin/broadcasts`, send a test broadcast, confirm the email arrives and a history row appears. This also serves as Task 6's deferred manual verification.

- [x] **Step 6: Commit**

Done — see Task 7 Step 6 (batched together in `2ed0e3c`).

---

### Task 9: Switch Supabase Auth SMTP to Resend

**Files:** none (dashboard config only)

**Interfaces:** none — this is the final rollout step and doesn't produce anything other tasks depend on.

- [ ] **Step 1: Confirm domain health**

Confirm with the user that `nammeshub.com.ng` has shown "Verified" in Resend for at least a day and that Tasks 4–6's manual sends have been landing in inboxes (not spam).

- [ ] **Step 2: Get SMTP credentials from Resend**

In the Resend dashboard, find the SMTP settings (host, port, username, password/API-key-as-password) for the verified domain.

- [ ] **Step 3: Configure Supabase Auth**

In the Supabase dashboard → Authentication → Settings → SMTP Settings: enable custom SMTP, enter the Resend SMTP credentials from Step 2, set the sender to `no-reply@nammeshub.com.ng`, save.

- [ ] **Step 4: Manually verify**

Trigger a password reset (`/forgot-password`) for a test account and confirm the email now arrives from `nammeshub.com.ng` rather than Supabase's default sending domain.

No commit — this task has no repo changes.

---

## Plan self-review notes

- **Spec coverage:** welcome email (Task 4), new-content alerts for News+Events (Task 5), broadcast tool for any admin (Task 6, 8), opt-out toggle (Task 7), Resend Marketplace provisioning + domain verification (Task 1), Auth SMTP switch (Task 9), `broadcasts` audit table (Task 2, 8) — all spec sections have a task.
- **Type consistency checked:** `getResendClient`/`FROM_ADDRESS`/`getSupabaseAdmin`/`chunk` signatures match between their Task 3 definition and every consuming task (4, 5, 6). `get_notification_recipients()`'s `{ email }` row shape is used consistently in Tasks 5 and 6. `sendBroadcast({ subject, body })`'s return shape (`{ recipientCount, sentCount }`) matches what Task 8's `AdminBroadcasts.jsx` reads.
- **No placeholders:** every step has real code or an exact command; no "add error handling" or "similar to Task N" shortcuts.
