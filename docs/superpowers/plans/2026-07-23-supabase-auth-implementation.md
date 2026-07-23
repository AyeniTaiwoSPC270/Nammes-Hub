# Real Supabase Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four fake (setTimeout-simulated) auth pages — Signup, Login, Forgot password, Reset password — with real Supabase Auth calls, and give the Navbar minimal signed-in/signed-out state.

**Architecture:** A single `AuthProvider` (React Context) wraps the app and subscribes once to Supabase's `onAuthStateChange`, exposing a `useAuth()` hook. Each auth page calls the matching Supabase Auth method directly (`signUp`, `signInWithPassword`, `resetPasswordForEmail`, `updateUser`) inside its existing `handleSubmit`, keeping all existing client-side validation and UI states (loading, error, success panels) — only the fake network simulation is replaced.

**Tech Stack:** React 19, react-router-dom 7, `@supabase/supabase-js` 2 (already a dependency), Vite 8, Tailwind v4. No test framework is set up in this project; verification is manual via the running dev server in Chrome (per the spec's own testing section).

## Global Constraints

- No custom database tables/migrations — Supabase's built-in `auth.users` + `user_metadata.full_name` covers everything (spec non-goal: no `profiles` table).
- No server-side enforcement of the `.edu.ng` email restriction — client-side check only, unchanged from current behavior.
- Email confirmation is required before sign-in (Supabase's default project setting — do not disable it).
- No new pages and no new visual patterns — only wire existing UI (`AuthCard`, `Button`, `FormField`, existing panel states) to real backend calls.
- Do not touch Outlines, Resources, News, Opportunities, or Admin — out of scope.
- `.env` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only, and is already gitignored — never commit it.

---

## File Structure

- Create: `src/lib/AuthContext.jsx` — `AuthProvider` component + `useAuth()` hook (session state, single subscription for the whole app).
- Modify: `src/main.jsx` — wrap `<App />` in `<AuthProvider>`.
- Modify: `src/components/Navbar.jsx` — read `useAuth()`, show signed-in state (email + Sign out) or the existing Sign in link, in both desktop and mobile nav.
- Modify: `src/pages/Signup.jsx` — real `supabase.auth.signUp`, add a "check your email" success panel.
- Modify: `src/pages/Login.jsx` — real `supabase.auth.signInWithPassword`.
- Modify: `src/pages/ForgotPassword.jsx` — real `supabase.auth.resetPasswordForEmail`.
- Modify: `src/pages/ResetPassword.jsx` — replace `?token=` query-param check with a Supabase session check; real `supabase.auth.updateUser`.
- Create: `.env` (gitignored, not committed) — Supabase project credentials.
- No changes to `src/lib/supabaseClient.js` (already correct) or any `ui/` component.

---

### Task 1: Initialize git repository

This project has no git history yet. Every later task ends with a commit, so this has to exist first.

**Files:**
- Create: `.git/` (via `git init`)

- [ ] **Step 1: Initialize the repository**

Run: `git init` (from the project root, `C:\Users\FEYISAYO ATINUKE\Downloads\Nammes Hub`)
Expected: `Initialized empty Git repository in .../Nammes Hub/.git/`

- [ ] **Step 2: Stage everything respecting .gitignore**

Run: `git add -A`

- [ ] **Step 3: Verify .env, node_modules, and dist are NOT staged**

Run: `git status`
Expected: no `.env`, no `node_modules/`, no `dist/` in the listed files (they're covered by `.gitignore`). If any appear, stop and fix `.gitignore` before continuing — do not commit them.

- [ ] **Step 4: Commit the baseline**

```bash
git commit -m "chore: initial commit of NAMMES Hub project state"
```

- [ ] **Step 5: Verify**

Run: `git log --oneline` → expect exactly one commit. Run: `git status` → expect "nothing to commit, working tree clean".

---

### Task 2: Provision a Supabase project and configure `.env`

No Supabase project exists for this app yet. This task creates one via the Supabase MCP integration and wires its credentials into local env vars, so every later task can make real network calls.

**Files:**
- Create: `.env` (project root, gitignored)

**Interfaces:**
- Produces: a running Supabase project reachable at the URL/anon key written into `.env`, which `src/lib/supabaseClient.js` (unchanged) already reads via `import.meta.env.VITE_SUPABASE_URL` / `import.meta.env.VITE_SUPABASE_ANON_KEY`.

- [ ] **Step 1: Start Supabase MCP authentication**

Call `mcp__plugin_supabase_supabase__authenticate`. It returns an authorization URL — share it with the user and ask them to open it and approve access in their browser.

- [ ] **Step 2: Complete authentication**

Once the user provides the callback URL from their browser's address bar (`http://localhost:<port>/callback?code=...&state=...`), call `mcp__plugin_supabase_supabase__complete_authentication` with `callback_url` set to that full URL.

- [ ] **Step 3: Discover the project-management tools**

Call `ToolSearch` with query `"supabase create project"` (and separately `"supabase project api keys"` if needed) to find the now-available tool names for listing organizations, creating a project, and reading a project's API keys — these are assigned by the remote MCP server and aren't fixed ahead of time.

- [ ] **Step 4: Create the project**

Using the discovered tool, create a new Supabase project named `nammes-hub`. If the account has more than one organization, ask the user which one to use before creating it. Note the returned project ref/ID.

- [ ] **Step 5: Wait for the project to become active**

New Supabase projects take roughly 1-2 minutes to provision. Poll the project status (via the discovered "get project" tool) until it reports active/healthy before continuing.

- [ ] **Step 6: Retrieve the project URL and anon key**

Using the discovered "get API keys" tool for that project, fetch the project's API URL and the `anon`/`public` key (not the `service_role` key — that one must never go into client-side env vars).

- [ ] **Step 7: Confirm email confirmation is enabled**

Check the project's Auth settings (via MCP, or note for the user to check in the Supabase dashboard under Authentication → Sign In / Providers → Email) — "Confirm email" should be ON. This is Supabase's default for new projects, so it should already be correct; just don't turn it off.

- [ ] **Step 8: Write `.env`**

Create `.env` in the project root (same directory as `.env.example`):

```
VITE_SUPABASE_URL=<project_url_from_step_6>
VITE_SUPABASE_ANON_KEY=<anon_key_from_step_6>
```

- [ ] **Step 9: Verify**

Restart the dev server (`npm run dev`) and check its output / the browser console at `http://localhost:5173/` for the `"Missing Supabase env vars"` warning logged by `src/lib/supabaseClient.js:7`. It must NOT appear.

- [ ] **Step 10: Commit**

`.env` itself is gitignored and must not be committed. Nothing to stage for this task — skip the commit step.

---

### Task 3: `AuthProvider` / `useAuth()` session context

**Files:**
- Create: `src/lib/AuthContext.jsx`
- Modify: `src/main.jsx`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabaseClient.js` (default export named `supabase`, a configured Supabase client).
- Produces: `AuthProvider` (React component, takes `{ children }`) and `useAuth()` hook returning `{ session, user, loading }` where `session` is Supabase's `Session | null`, `user` is `session?.user ?? null`, `loading` is `boolean`. Both exported from `src/lib/AuthContext.jsx`. Task 4 (Navbar) and later Signup/Login/etc. tasks do NOT need `useAuth()` directly (they call `supabase.auth.*` methods themselves), but Task 4 depends on this hook existing.

- [ ] **Step 1: Create the context file**

Create `src/lib/AuthContext.jsx`:

```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

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

- [ ] **Step 2: Wrap the app in `AuthProvider`**

Modify `src/main.jsx` (full file):

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 3: Verify the app still renders unchanged**

Run `npm run dev` if not already running. Using the browser, navigate to `http://localhost:5173/`. Confirm:
- The homepage renders exactly as before (hero, news, Exco grid) — `AuthProvider` should be invisible at this point since nothing reads `useAuth()` yet.
- No console errors (check via the browser's console tools).

- [ ] **Step 4: Commit**

```bash
git add src/lib/AuthContext.jsx src/main.jsx
git commit -m "feat: add AuthProvider/useAuth session context"
```

---

### Task 4: Navbar signed-in state

**Files:**
- Modify: `src/components/Navbar.jsx`

**Interfaces:**
- Consumes: `useAuth()` from `src/lib/AuthContext.jsx` (Task 3) → `{ user, loading }`. `supabase` from `src/lib/supabaseClient.js` → `supabase.auth.signOut()`.

- [ ] **Step 1: Replace the Navbar with signed-in-aware version**

Modify `src/components/Navbar.jsx` (full file):

```jsx
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

const links = [
  { to: '/', label: 'Home' },
  { to: '/outlines', label: 'Outlines' },
  { to: '/events', label: 'Events' },
  { to: '/resources', label: 'Resources' },
  { to: '/news', label: 'News' },
  { to: '/opportunities', label: 'Opportunities' },
]

function navLinkClass({ isActive }) {
  return [
    'rounded-full px-4 py-2 text-sm font-semibold no-underline',
    isActive ? 'bg-green-100 text-green-700' : 'text-ink hover:text-green-700',
  ].join(' ')
}

const authLinkClass = 'text-sm font-semibold text-green-700 no-underline hover:text-green-900'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    setOpen(false)
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-white/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-6 px-4 py-3.5 sm:px-8">
        <NavLink to="/" className="inline-flex items-center gap-2 whitespace-nowrap no-underline">
          <img src="/logo.png" alt="" className="h-8 w-8" />
          <span className="font-display text-lg font-semibold text-green-900">NAMMES Hub</span>
        </NavLink>

        <nav className="hidden sm:flex items-center gap-2">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {!loading && (
          <div className="hidden sm:flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-ink-muted">{user.email}</span>
                <button type="button" onClick={handleSignOut} className={authLinkClass}>
                  Sign out
                </button>
              </>
            ) : (
              <NavLink to="/login" className={authLinkClass}>
                Sign in
              </NavLink>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="flex flex-col gap-1 p-2 sm:hidden"
        >
          <span className="block h-0.5 w-5.5 bg-green-900" />
          <span className="block h-0.5 w-5.5 bg-green-900" />
          <span className="block h-0.5 w-5.5 bg-green-900" />
        </button>
      </div>

      {open && (
        <nav className="fixed inset-x-0 top-[60px] flex flex-col gap-0.5 border-b border-hairline bg-white px-4 py-2 shadow-md sm:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => [navLinkClass({ isActive }), 'px-4 py-3'].join(' ')}
            >
              {link.label}
            </NavLink>
          ))}
          {!loading &&
            (user ? (
              <>
                <span className="px-4 py-2 text-sm text-ink-muted">{user.email}</span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={[navLinkClass({ isActive: false }), 'px-4 py-3 text-left'].join(' ')}
                >
                  Sign out
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                onClick={() => setOpen(false)}
                className={({ isActive }) => [navLinkClass({ isActive }), 'px-4 py-3'].join(' ')}
              >
                Sign in
              </NavLink>
            ))}
        </nav>
      )}
    </header>
  )
}
```

- [ ] **Step 2: Verify signed-out state is unchanged**

Navigate to `http://localhost:5173/`. Confirm the Navbar still shows a "Sign in" link in the same place/style as before (no user is signed in yet, since Task 5-8 haven't wired real accounts). Check both desktop width and a narrow/mobile viewport (resize or use device toolbar) to confirm the mobile dropdown also shows "Sign in".

- [ ] **Step 3: Commit**

```bash
git add src/components/Navbar.jsx
git commit -m "feat: show signed-in state and sign out in Navbar"
```

---

### Task 5: Wire Signup to real Supabase Auth

**Files:**
- Modify: `src/pages/Signup.jsx`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabaseClient.js` → `supabase.auth.signUp({ email, password, options: { data, emailRedirectTo } })` resolving to `{ data, error }`.

- [ ] **Step 1: Replace the fake handler with a real one and add a confirmation panel**

Modify `src/pages/Signup.jsx` (full file):

```jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Button from '../components/ui/Button'
import FormField from '../components/ui/FormField'
import { supabase } from '../lib/supabaseClient'

export default function Signup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = {}
    if (!email.endsWith('.edu.ng')) {
      nextErrors.email = 'Use your university email (@unilag.edu.ng)'
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

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/login?created=1`,
      },
    })

    setBusy(false)

    if (error) {
      setErrors({ email: error.message })
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <AuthCard>
        <div className="flex w-[340px] max-w-[92vw] flex-col gap-4 rounded-[8px] bg-white p-8 shadow-md sm:max-w-[90vw]">
          <h2 className="text-[22px]">Check your email</h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            We&rsquo;ve sent a confirmation link to <span className="font-medium text-ink">{email}</span>. Click it
            to activate your account, then sign in.
          </p>
          <Button variant="primary" type="button" onClick={() => navigate('/login')}>
            Back to sign in
          </Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <form
        onSubmit={handleSubmit}
        className="flex w-[340px] max-w-[92vw] flex-col gap-4 rounded-[8px] bg-white p-8 shadow-md sm:max-w-[90vw]"
      >
        <h2 className="text-[22px]">Create account</h2>

        <FormField label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Okafor" />
        <FormField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@unilag.edu.ng"
          error={errors.email}
        />
        <FormField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          helper={!errors.password ? 'At least 8 characters' : undefined}
          error={errors.password}
        />
        <FormField
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
        />

        <Button variant="primary" type="submit" loading={busy}>
          Create account
        </Button>
        <Button variant="ghost" type="button" onClick={() => navigate('/')}>
          Cancel
        </Button>

        <p className="text-center text-sm text-ink-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-green-700 no-underline hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
```

- [ ] **Step 2: Verify client-side validation still works with no network call**

Navigate to `http://localhost:5173/signup`. Submit with a non-`.edu.ng` email → confirm the email field shows "Use your university email (@unilag.edu.ng)" and no request was made (check network tools if available). Submit with a short password → confirm the password error shows. Submit with mismatched passwords → confirm the confirm-password error shows.

- [ ] **Step 3: Verify a real signup**

Fill in a real, reachable `*.edu.ng` (or your test domain) email you can check, a valid name, and a matching 8+ character password. Submit. Confirm:
- The form is replaced by the "Check your email" panel showing that exact email.
- Ask the user to check that inbox for a Supabase confirmation email and confirm it arrived (this step requires the user, since the agent has no inbox access).

- [ ] **Step 4: Commit**

```bash
git add src/pages/Signup.jsx
git commit -m "feat: wire Signup to real Supabase Auth signUp"
```

---

### Task 6: Wire Login to real Supabase Auth

**Files:**
- Modify: `src/pages/Login.jsx`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabaseClient.js` → `supabase.auth.signInWithPassword({ email, password })` resolving to `{ data, error }`. Also implicitly consumes Task 3's `AuthProvider` (already wrapping the app), which will pick up the new session automatically via `onAuthStateChange` — this task does not call `useAuth()` directly.

- [ ] **Step 1: Replace the fake handler with a real one**

Modify `src/pages/Login.jsx` (full file):

```jsx
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Button from '../components/ui/Button'
import FormField from '../components/ui/FormField'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const justCreated = searchParams.get('created') === '1'
  const justReset = searchParams.get('reset') === '1'

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setBusy(false)

    if (signInError) {
      setError('Wrong email or password')
      return
    }

    navigate('/')
  }

  return (
    <AuthCard>
      <form
        onSubmit={handleSubmit}
        className="flex w-[340px] max-w-[92vw] flex-col gap-4 rounded-[8px] bg-white p-8 shadow-md sm:max-w-[90vw]"
      >
        <h2 className="text-[22px]">Sign in</h2>

        {justCreated && (
          <p className="rounded-sm bg-success-bg px-3 py-2 text-sm text-success">
            Account created — sign in below.
          </p>
        )}
        {justReset && (
          <p className="rounded-sm bg-success-bg px-3 py-2 text-sm text-success">
            Password reset — sign in with your new password.
          </p>
        )}

        <FormField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@unilag.edu.ng"
        />
        <div className="flex flex-col gap-1.5">
          <FormField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error || undefined}
          />
          <Link to="/forgot-password" className="self-end text-xs text-green-700 no-underline hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button variant="primary" type="submit" loading={busy}>
          Sign in
        </Button>
        <Button variant="ghost" type="button" onClick={() => navigate('/')}>
          Cancel
        </Button>

        <p className="text-center text-sm text-ink-muted">
          Don&rsquo;t have an account?{' '}
          <Link to="/signup" className="text-green-700 no-underline hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
```

- [ ] **Step 2: Verify wrong-password handling**

Navigate to `http://localhost:5173/login`. Submit with a made-up email/password combination. Confirm the password field shows "Wrong email or password" and the page stays on `/login`.

- [ ] **Step 3: Verify successful sign-in (after Task 5's test account is confirmed)**

Using the email from Task 5 Step 3 (after the user has clicked its confirmation link), sign in with the correct password. Confirm:
- Navigation lands on `/`.
- The Navbar (Task 4) now shows that email address and a "Sign out" control instead of "Sign in".

- [ ] **Step 4: Commit**

```bash
git add src/pages/Login.jsx
git commit -m "feat: wire Login to real Supabase Auth signInWithPassword"
```

---

### Task 7: Wire Forgot password to real Supabase Auth

**Files:**
- Modify: `src/pages/ForgotPassword.jsx`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabaseClient.js` → `supabase.auth.resetPasswordForEmail(email, { redirectTo })` resolving to `{ data, error }`.

- [ ] **Step 1: Replace the fake handler with a real one**

Modify `src/pages/ForgotPassword.jsx` (full file):

```jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Button from '../components/ui/Button'
import FormField from '../components/ui/FormField'
import { supabase } from '../lib/supabaseClient'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setBusy(false)
    setSent(true)
  }

  if (sent) {
    return (
      <AuthCard>
        <div className="flex w-[340px] max-w-[92vw] flex-col gap-4 rounded-[8px] bg-white p-8 shadow-md sm:max-w-[90vw]">
          <h2 className="text-[22px]">Check your email</h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            If an account exists for <span className="font-medium text-ink">{email}</span>, we&rsquo;ve sent a link
            to reset your password.
          </p>
          <Button variant="primary" type="button" onClick={() => navigate('/login')}>
            Back to sign in
          </Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <form
        onSubmit={handleSubmit}
        className="flex w-[340px] max-w-[92vw] flex-col gap-4 rounded-[8px] bg-white p-8 shadow-md sm:max-w-[90vw]"
      >
        <h2 className="text-[22px]">Forgot password</h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          Enter your email and we&rsquo;ll send you a link to reset your password.
        </p>

        <FormField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@unilag.edu.ng"
        />

        <Button variant="primary" type="submit" loading={busy}>
          Send reset link
        </Button>
        <Button variant="ghost" type="button" onClick={() => navigate('/login')}>
          Cancel
        </Button>

        <p className="text-center text-sm text-ink-muted">
          Remembered it?{' '}
          <Link to="/login" className="text-green-700 no-underline hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
```

- [ ] **Step 2: Verify the non-leaking confirmation**

Navigate to `http://localhost:5173/forgot-password`. Submit with an email that has no account. Confirm the same "Check your email" panel shows (no error revealing the account doesn't exist). Submit again with the confirmed test account's email from Task 5. Confirm the same panel shows, and ask the user to check that inbox for a real "reset password" email.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ForgotPassword.jsx
git commit -m "feat: wire Forgot password to real Supabase Auth resetPasswordForEmail"
```

---

### Task 8: Wire Reset password to real Supabase Auth

**Files:**
- Modify: `src/pages/ResetPassword.jsx`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabaseClient.js` → `supabase.auth.getSession()` resolving to `{ data: { session } }`, and `supabase.auth.updateUser({ password })` resolving to `{ data, error }`.

- [ ] **Step 1: Replace the `?token=` check with a real session check, and the fake handler with a real one**

Modify `src/pages/ResetPassword.jsx` (full file):

```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Button from '../components/ui/Button'
import FormField from '../components/ui/FormField'
import { supabase } from '../lib/supabaseClient'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
      setChecking(false)
    })
  }, [])

  if (checking) {
    return <AuthCard>{null}</AuthCard>
  }

  if (!hasSession) {
    return (
      <AuthCard>
        <div className="flex w-[340px] max-w-[92vw] flex-col gap-4 rounded-[8px] bg-white p-8 shadow-md sm:max-w-[90vw]">
          <h2 className="text-[22px]">Link expired</h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            This password reset link is invalid or has expired. Request a new one to continue.
          </p>
          <Button variant="primary" type="button" onClick={() => navigate('/forgot-password')}>
            Request a new link
          </Button>
        </div>
      </AuthCard>
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = {}
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

    const { error } = await supabase.auth.updateUser({ password })

    setBusy(false)

    if (error) {
      setErrors({ password: error.message })
      return
    }

    navigate('/login?reset=1')
  }

  return (
    <AuthCard>
      <form
        onSubmit={handleSubmit}
        className="flex w-[340px] max-w-[92vw] flex-col gap-4 rounded-[8px] bg-white p-8 shadow-md sm:max-w-[90vw]"
      >
        <h2 className="text-[22px]">Reset password</h2>
        <p className="text-sm leading-relaxed text-ink-muted">Choose a new password for your account.</p>

        <FormField
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          helper={!errors.password ? 'At least 8 characters' : undefined}
          error={errors.password}
        />
        <FormField
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
        />

        <Button variant="primary" type="submit" loading={busy}>
          Reset password
        </Button>
      </form>
    </AuthCard>
  )
}
```

- [ ] **Step 2: Verify the "link expired" state**

Navigate directly to `http://localhost:5173/reset-password` (no query params, no prior recovery link click). Confirm the "Link expired" panel shows.

- [ ] **Step 3: Verify a real reset**

Ask the user to click the "reset password" email link from Task 7 Step 2 (opens `/reset-password` with a recovery session established via URL hash). Confirm the real new-password form shows (not "Link expired"). Submit a new 8+ character password. Confirm it redirects to `/login?reset=1` and the green "Password reset" banner shows.

- [ ] **Step 4: Verify sign-in with the new password**

On the resulting `/login?reset=1` page, sign in with the same email and the new password. Confirm it succeeds and lands on `/`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ResetPassword.jsx
git commit -m "feat: wire Reset password to real Supabase Auth session + updateUser"
```

---

### Task 9: End-to-end verification pass

No new code — this is a full run-through of the spec's testing checklist with everything wired together, to catch anything the per-task checks missed (e.g. interaction between sign-out and route state).

**Files:** none.

- [ ] **Step 1: Fresh signup → confirm → login → Navbar state**

Using a new (previously unused) `.edu.ng` test email: sign up, see the "check your email" panel, have the user click the confirmation link, land on `/login?created=1` with the green banner, sign in, confirm redirect to `/` and Navbar shows the signed-in email.

- [ ] **Step 2: Sign out**

Click "Sign out" in the Navbar. Confirm it reverts to the "Sign in" link and any protected UI state (none exists yet, but re-check Navbar specifically) resets.

- [ ] **Step 3: Forgot/reset password round trip**

From `/login`, click "Forgot password?", request a reset for the same test account, have the user click the email link, set a new password, confirm redirect to `/login?reset=1`, sign in with the new password.

- [ ] **Step 4: Wrong password**

On `/login`, attempt sign-in with the correct email but a wrong password. Confirm "Wrong email or password" shows and no navigation occurs.

- [ ] **Step 5: Mobile viewport check**

Resize the browser (or use device emulation) to a mobile width. Repeat the sign-in/sign-out check via the hamburger menu's dropdown to confirm the mobile nav shows the same signed-in/out state as desktop.

- [ ] **Step 6: Final commit**

If any fixes were needed during this pass, commit them individually with descriptive messages (`fix: ...`) following the same pattern as prior tasks. If nothing needed fixing, no commit is needed for this task.

---

## Self-Review Notes

- **Spec coverage:** Session architecture (Task 3), Navbar signed-in state (Task 4), Signup with email-confirmation panel (Task 5), Login (Task 6), Forgot password non-leaking confirmation (Task 7), Reset password session-based flow (Task 8), Supabase project setup (Task 2), manual verification checklist matching the spec's testing section (Tasks 5-9) — all covered.
- **Placeholder scan:** No TBD/TODO; Task 2's MCP tool-discovery steps name concrete actions (ToolSearch queries) rather than guessing tool names that don't exist yet in this transcript.
- **Type/signature consistency:** `useAuth()` return shape (`{ session, user, loading }`) defined once in Task 3 and consumed identically in Task 4; no other task calls `useAuth()` directly (Login/Signup/etc. rely on `AuthProvider`'s subscription picking up state changes automatically, not on reading the hook themselves) — verified consistent.
- **Scope:** Single subsystem (auth), matches the approved spec exactly; no Outlines/Resources/Admin touched.
