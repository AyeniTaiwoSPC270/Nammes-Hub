# Auth pages redesign — design

Date: 2026-11-08
Status: agreed from mockups, ready to plan

## Goal

`/login`, `/signup`, `/forgot-password` and `/reset-password` stop looking like a white box with a form
in it. They share one shell that a visitor recognises as NAMMES before typing anything, and the four
screens agree with each other on spacing, labels, alerts and button hierarchy.

## What is wrong today

- `AuthCard` is a centred `max-w-[440px]` card on `bg-surface-low`. Nothing on it is NAMMES except a
  two-word heading.
- Login hand-rolls its two fields (icon inside the input, `rounded-md`); signup and reset use
  `FormField` (no icon, label colours differ); forgot-password hand-rolls a third variant. Three
  label treatments, three input paddings, same form.
- The four routes render inside `Layout`, so the site navbar and footer frame them. The redesign is
  deliberately chrome-free: nothing competes with the task.

## Decisions

| Question | Decision |
|---|---|
| Screens | `/login`, `/signup`, `/forgot-password`, `/reset-password`. `MfaChallenge` keeps its internals and inherits the shell. |
| Shell | Split screen: brand panel at 44%, form column on paper. One panel constant across all four screens. |
| Brand note | Institutional — forest panel, crest on a white plate, three capability bullets, the motto. |
| Site chrome | Navbar and footer hidden on the four routes, including first paint. |
| Way back to the site | The panel's crest + wordmark lockup is a link to `/`. No visible back link anywhere. |
| Mobile (under 1000px) | Green band (crest + wordmark only, no motto) then the form in a bordered card on paper. |
| Panel copy | Constant: headline, lead, three bullets, motto. It does not change between login and reset. |
| Dark mode | Tokens swap; the panel gains a `border-hairline` right edge; the primary button inverts to light-on-dark. |
| Theme toggle | A compact toggle in the form column, because the navbar that normally carries one is gone. |
| Field component | `FormField` gains an `icon` prop. One field implementation for all four screens; no second one. |
| Animation | No `Reveal` on the card — `Layout` already fades the route in, and two stacked entrances read as jank. |
| Data, API, schema | None. No new dependency. |

## The shell

`src/components/AuthShell.jsx` replaces `src/components/AuthCard.jsx`.

```
<div class="min-h-svh grid lg:grid-cols-[44%_1fr] bg-paper">
  <aside>   panel — hidden lg:flex, column layout
  <div>     mobile band — lg:hidden
  <main>    form column — px-4 py-8 sm:px-8, form max-w-[380px] centred vertically
</div>
```

- Panel: `bg-green-900 text-white`, `px-11 py-11`, `flex flex-col`. Lockup (link) → orange rule
  (`h-[3px] w-[42px] bg-orange-500`) → headline (`text-[32px] font-extrabold leading-[1.14] max-w-[15ch]`)
  → lead (`text-sm leading-relaxed text-white/70 max-w-[40ch]`) → three bullets → motto pinned to the
  bottom with `mt-auto`.
- Bullets are `<li>` with a Material Symbol in `text-orange-500` and a `text-sm` label: `library_books`
  “Outlines and course materials by level”, `calendar_month` “Timetable, academic calendar and events”,
  `quiz` “Past questions, practice and live quizzes”.
- Motto: `text-[10px] uppercase tracking-[.24em] text-white/40` — “Excellence · Strength · Build · Order”.
- Form column: `bg-paper`, `flex flex-col`, form `w-full max-w-[380px] mx-auto` inside a vertically
  centred wrapper, `pt-2`. The theme toggle sits in a top row, right-aligned.
- Panel headline: “Everything for the semester, in one place.”
- Panel lead: “Course outlines, the class timetable, past questions, quizzes and results — for
  Metallurgical and Materials Engineering students.”

### Mobile band

96px of `bg-green-900`: the same lockup, no motto, no bullets, no headline. The form follows in a
`bg-surface border border-hairline rounded-lg shadow-md` card with a 16px page gutter, `p-5`.

## Form column, screen by screen

Every screen: eyebrow (orange, uppercase, `text-[10.5px] tracking-[.16em]`) → `h1` (`text-3xl
font-extrabold tracking-tight text-ink-900`) → lede (`text-sm text-ink-muted`) → fields → primary
button (full width, `bg-green-900`, `rounded-md`, 12px padding, arrow when it submits) → the closing
lines below. One secondary link at most, and each screen has its own: create-account on login, sign-in
on signup, back-to-sign-in on forgot, none on reset. The security line appears on login, forgot and
reset; it is not repeated on signup, where the account does not exist yet.

| Screen | Eyebrow / h1 / lede | Fields | Closing |
|---|---|---|---|
| Login | `Member sign in` / `Welcome back` / “Sign in with the email you registered with.” | Email (`mail`), Password (`lock`, revealable) with “Forgot password?” on the label row | “New to NAMMES Hub? Create an account”, then `shield` “Secure institution login” |
| Signup | `New member` / `Create your account` / “Use your matric number and the email you check.” | Full name, Matric number, Email, Password (revealable, rule as helper), Confirm password (revealable, success tick) | “Already have an account? Sign in” |
| Forgot | `Password help` / `Reset your password` / “Enter your email and we'll send a reset link. It expires in an hour.” | Email (`mail`) | “Back to sign in” + security line |
| Reset | `Final step` / `Choose a new password` / “You'll sign in with it from now on.” | New password (revealable, rule as helper), Confirm new password (revealable) | Security line |

Sent and error states keep today's behaviour and strings:

- Login: “Account created. Sign in below.” (success), “Password reset. Sign in with your new
  password.” (success), “This account has been disabled. Contact an admin for help.” (danger),
  “Wrong email or password” (danger, inline under the password field).
- Signup success: `Check your email` block, unchanged.
- Forgot success: “If an account exists for `<email>`, we've sent instructions to reset your
  password.”
- Reset without a session: “Link expired” with “Request a new link”.
- Turnstile widget keeps its place above the primary button on login, signup and forgot.

Eyebrows, the panel headline, the panel lead, the mobile band and the closing lines are new copy.
Everything else is today's string, unchanged.

## Alerts

One `AuthNotice` (`tone="success" | "danger" | "info"`, optional icon) replaces the four hand-written
alert paragraphs. `rounded-sm px-3 py-2 text-sm` with `bg-success-bg text-success`, `bg-danger-bg
text-danger`, wired with `role="status"` for success and `role="alert"` for danger.

## Chrome-free routes

There is already a mechanism, so no route restructure:

- `isChromeFreePath` (`src/lib/ChromeContext.jsx`) gains the four exact paths (`/login`, `/signup`,
  `/forgot-password`, `/reset-password`, optional trailing slash). `resolveChrome` then keeps the
  chrome off from first paint, without any page calling `useSiteChrome`.
- `Layout` picks the route skeleton off `chromeFree`. Auth routes get a third, form-shaped skeleton
  (`AuthRouteSkeleton`) rather than the /forms one, which is a column of 700px cards.
- `WelcomeCarousel` and `SpotlightOverlay` render outside Layout's `bare` guard. Check they stay
  inert on an auth route; if the tour can trigger there, gate both on `bare`.
- The four routes stay inside `Layout`, so scroll reset, the route fade and `MaintenanceGate` (which
  already exempts `/login`) behave exactly as they do now. Nothing moves out of the router tree.

## Dark mode

The panel is unchanged (`green-900` is deliberately not overridden in `.dark`). The form side follows
the tokens, plus three explicit decisions:

- `border-r border-hairline` on the panel, because `#0b2417` against `#0d1310` is otherwise one slab.
- The primary button becomes `bg-ink-900 text-green-900` (light-on-dark). A forest button on a
  near-black page has no edge.
- Labels use `text-brand-orange` rather than `text-orange-600`; the token already resolves to
  `#ff9a5c` in dark mode. This is why `FormField`'s existing label colour is kept rather than copied
  from the mock.

## Accessibility

- `h1` is the page title inside the form column; the panel headline is an `h2`, so the document has
  one `h1` per screen.
- `FormField` wraps its control in a `<label>`, so association is implicit and unchanged.
- The password reveal button keeps `aria-label` + `aria-pressed` (already correct in `FormField`).
- Dangers are `role="alert"`, successes `role="status"`.
- Contrast: white on `green-900` ≈ 16:1; `orange-600` on `paper` ≈ 6.3:1; `orange-500` is used for
  icons and rules on the panel only, never for small text on paper.
- Focus rings stay visible: `focus-visible:ring-2 ring-brand` on the toggle and reveal buttons.

## Icons

Two new names go into `icon_names=` in `index.html`, alphabetically: `library_books` and
`mark_email_read`. Everything else the redesign uses is already loaded (`mail`, `lock`, `visibility`,
`visibility_off`, `arrow_forward`, `shield`, `check_circle`, `error`, `dark_mode`, `light_mode`,
`quiz`, `calendar_month`). `iconFont.test.js` enforces this.

## Files

| File | Change |
|---|---|
| `src/components/AuthShell.jsx` | new — panel, mobile band, form column, theme toggle |
| `src/components/AuthNotice.jsx` | new — the three alert tones |
| `src/components/AuthCard.jsx` | deleted |
| `src/components/ui/FormField.jsx` | gains `icon` (lead symbol inside the field) |
| `src/pages/Login.jsx` | shell + `FormField`; MFA challenge renders inside it |
| `src/pages/Signup.jsx` | shell + copy |
| `src/pages/ForgotPassword.jsx` | shell + copy |
| `src/pages/ResetPassword.jsx` | shell + copy |
| `src/lib/ChromeContext.jsx` | auth paths in `isChromeFreePath` |
| `src/components/Layout.jsx` | auth-shaped skeleton |
| `src/lib/ChromeContext.test.jsx` | auth path assertions |
| `index.html` | two icon names |

## Testing

- `ChromeContext.test.jsx`: each of the four paths is chrome-free, with and without a trailing slash;
  `/account` and `/admin` are not.
- `authShell.test.jsx` (new): `renderToStaticMarkup` of the shell — the panel headline is present, the
  crest image is present, the lockup links to `/`, and the children render inside the form column.
  `ThemeContext` is mocked to a fixed `{ theme: 'light', toggleTheme }`, the pattern
  `hostRevealExplanation.test.jsx` already uses for provider-dependent components. The suite has no
  DOM, so this is markup, not behaviour.
- A source scan asserting the four pages import `AuthShell` and none still import `AuthCard` — the
  same shape as the `quizTypeRenderers` scan, so a page cannot quietly keep the old shell.

## Known gaps

- Rendering, spacing at 390px, and the dark-mode hairline between panel and paper are **unverified
  without a browser**. `npm run build` proves the bundle, not the look.
- Turnstile solving, the MFA code step and any real sign-in need a Supabase session; the redesign
  touches the markup around them, and only a real login proves the flow still completes.
- The panel's height on a 700px-tall laptop window is untested; the content is ~480px, so it should
  fit with the motto still pinned low.
