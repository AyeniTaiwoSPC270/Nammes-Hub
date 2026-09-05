# Transactional email and admin broadcasting via Resend — design

Date: 2026-09-05

## Context

NAMMES Hub has no email capability today beyond Supabase Auth's default confirmation/reset emails. The user wants to integrate [Resend](https://resend.com) on the new domain `nammeshub.com.ng` for two things: automatic transactional email (welcome on signup, alerts when new News/Events publish) and a manual broadcast tool admins can use to email all users, e.g. announcements. This is the app's first server-side code — everything today is a static Vite SPA (deployed to Vercel with a plain SPA rewrite, no `api/` functions) backed by Supabase for data/auth, per [[2026-09-05-admin-users-roles-review-queue-design]] and the admin-CMS pattern before it.

Sending real email needs two secrets that can never live in client code: the Resend API key, and a Supabase **service-role** key (to read `auth.users` emails — `profiles` doesn't store email; only `auth.users` does).

## Goals

- Welcome email sent automatically once per new account.
- New-content alert email sent automatically when a News article or Event becomes publicly live (whether inserted directly by the owner or via `apply_change_request` approving a regular admin's submission — both paths perform a real `INSERT`).
- An `/admin/broadcasts` page where any admin composes a subject + body and sends it to all opted-in users, with a send history log.
- A per-user opt-out toggle (`/account` page) covering new-content alerts and broadcasts. The welcome email is unconditional (one-time, sent before the user has had any chance to set a preference).
- Domain verification for `nammeshub.com.ng` in Resend (SPF/DKIM), provisioned via the Vercel Marketplace Resend integration so `RESEND_API_KEY` is auto-injected into the Vercel project.
- Once the sending domain is verified and healthy, point Supabase Auth's SMTP at Resend so password-reset/confirmation emails also send from `nammeshub.com.ng`.

## Non-goals

- No email notification for review-queue approve/reject decisions in this pass (explicitly out of scope, unlike the earlier review-queue spec's blanket "no email system" — this spec adds the system, but that specific trigger stays deferred).
- No per-recipient send log (success/failure per address) — only an aggregate `recipient_count` on each broadcast. Can be added later if delivery debugging needs it.
- No Resend Audiences/native-Broadcasts product usage — recipient lists and opt-out state live entirely in `profiles`, sent via Resend's plain batch send API. Keeps a single source of truth instead of syncing two systems.
- No audience segmentation (by class, role, etc.) for broadcasts — always all opted-in users.
- No retry/queueing infrastructure for failed sends — failures are logged and surfaced, not automatically retried.

## Architecture

New `api/` folder of Vercel Functions (Node.js runtime) — the project's first server-side code, living alongside the existing static SPA on the same Vercel project:

- `api/webhook-welcome.js` — sends the welcome email.
- `api/webhook-new-content.js` — sends the new-content alert.
- `api/send-broadcast.js` — sends an admin-composed broadcast.
- `api/lib/resend.js` / `api/lib/supabaseAdmin.js` — shared helpers (Resend client, service-role Supabase client, batch-chunking utility).

The two `webhook-*` endpoints are invoked by **Supabase Database Webhooks** (configured in the Supabase dashboard — not application code) firing on `INSERT public.profiles` and `INSERT public.news` / `INSERT public.events`. Each call carries a shared-secret header (`WEBHOOK_SHARED_SECRET`) that the endpoint validates before doing anything, so the endpoints can't be triggered by arbitrary internet traffic.

`send-broadcast.js` is instead called directly by the admin UI, authenticated with the caller's Supabase access token (`Authorization` header); the function verifies the token and checks the caller has an `admins` row (service-role query) before sending.

Env vars on the Vercel project (none `VITE_`-prefixed, so none reach the client bundle): `RESEND_API_KEY` (from the marketplace install), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SHARED_SECRET`.

## Data model

```sql
-- opt-out toggle: covers new-content alerts and broadcasts; welcome email always sends
alter table public.profiles
  add column email_notifications_enabled boolean not null default true;

-- audit log of manual broadcasts
create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  sent_by uuid not null references auth.users(id),
  recipient_count int not null,
  created_at timestamptz not null default now()
);
```

`broadcasts` has one SELECT policy (any admin can see send history, matching the `admins_select_admin_all` pattern) and no client-facing INSERT policy — rows are written only by `send-broadcast.js` using the service-role key, after a successful (or partially successful) Resend send.

## Triggers

- **Welcome** — Database Webhook on `INSERT public.profiles` → `webhook-welcome.js`. Fires once per new account, unconditional.
- **New content** — Database Webhooks on `INSERT public.news` and `INSERT public.events` → `webhook-new-content.js`. Queries `profiles` (joined to `auth.users` for email) where `email_notifications_enabled = true`, sends via Resend's batch send endpoint, chunked at 100 recipients per call (Resend's batch limit).
- **Broadcast** — admin UI calls `send-broadcast.js` directly. Same opted-in audience query and chunked batch send, then writes one `broadcasts` row.

## Frontend

- **`/account`** (new page — nothing like it exists today): one toggle, "Email notifications," bound to `profiles.email_notifications_enabled` via a new `src/data/notificationPrefs.js` (same shape as `src/data/profiles.js`: fetch + mutate wrapper). Linked from the Navbar user menu next to "Sign out."
- **`/admin/broadcasts`** (new admin page, listed in `ADMIN_SECTIONS` for any admin — not owner-gated): subject + body form, live "Send to N recipients" count, send button, and a history list backed by the `broadcasts` table. New `src/data/broadcasts.js`: `sendBroadcast({ subject, body })` (calls `api/send-broadcast.js` with the caller's access token) and `fetchBroadcastHistory()`.

## Error handling

- `webhook-welcome.js` / `webhook-new-content.js`: a Resend failure is logged (Vercel function logs) and swallowed — these are fire-and-forget triggers off a Database Webhook with no retry-into-transaction semantics, so a failed send must never appear to fail the underlying insert.
- `send-broadcast.js`: a total send failure surfaces to the admin UI as an error toast (matching existing error patterns) and does **not** write a `broadcasts` row. A partial batch failure (e.g. 2 of 5 chunks fail) still writes the row with the actual successful `recipient_count` and returns a "sent to N of M" warning to the UI.
- All webhook endpoints reject requests missing or mismatching `WEBHOOK_SHARED_SECRET` with 401, before touching Resend or Supabase.

## Testing

- `src/data/notificationPrefs.js` and `src/data/broadcasts.js` get `*.test.js` following the existing mocked-Supabase pattern (`profiles.test.js`, `changeRequests.test.js`, etc.).
- `api/*.js` functions get unit tests around their pure parts (audience-query construction, batch-chunking logic) with Resend and Supabase clients mocked.
- Actual end-to-end sends (welcome on real signup, alert on real News/Event publish, a real broadcast) are manually verified against a live Resend send in the dev/preview environment — consistent with this project's existing approach of manual verification for integration-level flows (no Supabase-mocking infra for those).

## Rollout order

1. Install the Resend Vercel Marketplace integration; verify the `nammeshub.com.ng` sending domain (SPF/DKIM DNS records at the registrar — manual step).
2. Migration: `profiles.email_notifications_enabled`, `broadcasts` table + RLS.
3. Ship the `api/` functions; configure the two Supabase Database Webhooks pointing at them.
4. `/account` page with the notification toggle.
5. `/admin/broadcasts` page.
6. Once the domain is confirmed healthy, switch Supabase Auth's SMTP settings to Resend so password-reset/confirmation emails also send from `nammeshub.com.ng`.
