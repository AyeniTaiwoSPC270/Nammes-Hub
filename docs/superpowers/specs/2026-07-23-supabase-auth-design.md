# Real Supabase authentication — design

Date: 2026-07-23

## Context

NAMMES Hub's four auth pages (`Login`, `Signup`, `ForgotPassword`, `ResetPassword`) and the shared `AuthCard` shell were already built from the design handoff, but their form handlers are fake: a `setTimeout` simulates a network call, then does client-side-only validation. No real account is ever created or checked. `src/lib/supabaseClient.js` already exists (creates a Supabase client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) but nothing calls it yet, and no `.env` exists.

Outlines is done; Resources/News/Opportunities/Admin have no design handoff yet and stay out of scope (per `DESIGN_SYSTEM.md`: "don't invent page designs the handoff hasn't specified"). This spec covers only wiring the four existing auth pages to real Supabase Auth, plus minimal signed-in state in the Navbar.

## Goals

- Signup, Login, Forgot password, and Reset password perform real Supabase Auth calls instead of simulated ones.
- Email confirmation is required before an account can sign in (Supabase default).
- Signed-in state is visible in the Navbar with a way to sign out.
- No new pages, no new visual design — only wiring existing UI to a real backend, following the existing component/style patterns.
- A new Supabase project is provisioned for this app (none exists yet).

## Non-goals

- No custom `profiles` table or user profile page (nothing in the app reads one yet — YAGNI).
- No server-side enforcement of the `.edu.ng` email restriction — stays a client-side check, matching current behavior.
- No Admin auth-gating yet (Admin is still a placeholder with no handoff).
- No password strength meter or rate-limiting UI beyond what's already there.

## Architecture

### Session state: `AuthProvider` / `useAuth()`

New file `src/lib/AuthContext.jsx`:
- A `AuthProvider` component that calls `supabase.auth.getSession()` on mount and subscribes to `supabase.auth.onAuthStateChange`, storing `{ session, loading }` in state.
- Exposes a `useAuth()` hook returning `{ session, user: session?.user ?? null, loading }`.
- Wraps `<App />` in `src/main.jsx` (single subscription for the whole app — Navbar and any future consumer, e.g. Admin gating later, read from the same context instead of each subscribing independently).

### Navbar

- Reads `useAuth()`. While `loading`, render the current static "Sign in" link (avoids a flash of the wrong state).
- Signed out: unchanged — "Sign in" link to `/login`.
- Signed in: replace the "Sign in" link with the user's email (truncated if needed) and a "Sign out" action, styled the same as the current link (`text-sm font-semibold text-green-700`, no new visual pattern). "Sign out" calls `supabase.auth.signOut()`.
- Same treatment in both the desktop link and the mobile dropdown.

## Auth flows

### Signup (`src/pages/Signup.jsx`)

1. Keep existing client-side validation (`.edu.ng` domain, password ≥ 8 chars, confirm-password match) — runs before any network call, same as today.
2. On pass, call:
   ```js
   supabase.auth.signUp({
     email,
     password,
     options: {
       data: { full_name: name },
       emailRedirectTo: `${window.location.origin}/login?created=1`,
     },
   })
   ```
3. On Supabase error (e.g. already-registered), surface it inline via the existing `errors` state / `FormField` `error` prop.
4. On success, **do not** navigate to `/login?created=1` immediately (the account isn't usable until the email is confirmed). Instead swap the form for a "check your email to confirm your account" panel, mirroring `ForgotPassword`'s existing `sent` state pattern (same card shell, a message, a "Back to sign in" button).

### Login (`src/pages/Login.jsx`)

1. Call `supabase.auth.signInWithPassword({ email, password })`.
2. On success, `navigate('/')`.
3. On error, show the existing generic `"Wrong email or password"` message (don't surface Supabase's raw error string, to avoid leaking whether the email exists) in the password field's `error` slot, same as today's UI.
4. `justCreated` / `justReset` banners (from `?created=1` / `?reset=1`) are unchanged.

### Forgot password (`src/pages/ForgotPassword.jsx`)

1. Call `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })`.
2. Always show the existing non-leaking "check your email" confirmation on completion (success or failure) — matches current behavior and Supabase's own non-leaking response.

### Reset password (`src/pages/ResetPassword.jsx`)

Reworked: Supabase's client (`detectSessionInUrl: true`, the default) automatically parses the recovery token out of the URL hash on load and establishes a session — there's no `?token=` query param to read anymore.

1. On mount, check `supabase.auth.getSession()`. While checking, render nothing/a neutral loading state (brief).
2. No session → show the existing "Link expired" panel unchanged.
3. Session present → show the existing new-password + confirm form. Keep client-side validation (≥ 8 chars, match). On submit, call `supabase.auth.updateUser({ password })`, then `navigate('/login?reset=1')` on success, or show a Supabase error on failure.

## Supabase project setup

No Supabase project exists yet for this app. Steps:
1. Authenticate to the Supabase MCP integration (OAuth — user approves in browser).
2. Create a new Supabase project for NAMMES Hub via MCP.
3. Retrieve the project URL and anon key, write them into a new `.env` (gitignored, mirrors `.env.example`'s two keys: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. No schema/migrations needed — Supabase's built-in `auth.users` (plus `user_metadata.full_name`) covers everything this spec needs. Email confirmation is on by default, which matches the "require email confirmation" decision.

## Error handling

- Network/unexpected errors from any Supabase call are shown as a generic inline error (existing `FormField error` pattern) — no new error UI component.
- `busy`/`loading` button states are kept exactly as they are today, just driven by the real async call instead of `setTimeout`.

## Testing / verification

No test framework is set up in this project (no existing test files). Verification is manual, via the running dev server + Chrome:
1. Sign up with a `.edu.ng` email → see "check your email" panel → confirm via the real email → land on `/login?created=1`.
2. Sign in with the confirmed account → redirected to `/`, Navbar shows the signed-in state.
3. Sign out from the Navbar → reverts to "Sign in".
4. Forgot password → request reset → follow the email link → land on `/reset-password` with the form (not "link expired") → set new password → redirected to `/login?reset=1` → sign in with new password.
5. Visiting `/reset-password` directly (no token) → "Link expired" panel.
6. Wrong password on Login → "Wrong email or password" shown inline.
