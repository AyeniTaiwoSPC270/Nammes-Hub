# NAMMES Hub

The official web platform for the Department of Mathematics (NAMMES) at the University of Lagos. It brings
department news, events, course outlines, resources, awards, forms and an interactive quiz / CBT system into one
site, with an admin area so the executives can run it without touching code.

## Features

**For students**
- News, events (with photo galleries), opportunities with deadlines, and meet-the-excos pages
- Course outlines, curriculum, timetables and a resources library, organised by level and semester
- An academic calendar merging the senate's dates with departmental events
- CGPA calculator with PDF export
- Department awards: nominate, vote, and see the revealed winners
- Forms: fill in department forms and surveys
- **Quizzes**: live host-run games, head-to-head battles and brackets (with bots), public practice mode,
  community quizzes anyone can import, and timed **CBT practice exams**
- Student-contributed past questions and notes (reviewed before publishing)

**For admins** (`/admin`): see [ADMIN.md](ADMIN.md)
- Manage all site content, users, contact messages, forms, quizzes, CBT exams and award seasons
- Run the academic calendar: entries, paste import, design studio and session
- Email broadcasts and editable email templates, handbook builder
- Security page (MFA enforcement, audit log), system health checks and error log

## Academic calendar

`/calendar` is one page showing two things that used to live apart: the **senate-approved academic calendar**
(lectures, examinations, registration, breaks, convocation, orientation) and **departmental events**. The `/events`
page is unchanged and still the photo-led grid of departmental events; the calendar is the planner, and the merge is
what makes it useful — a student opening the app mid-lecture sees "Lectures end 15 Jan" rather than an empty list.

- **Two views.** A month grid with multi-day bars spanning their weeks, and a chronological agenda grouped by
  month. The agenda is the default at narrow widths; a reader's own choice holds for the visit and outranks the
  admin's landing default.
- **Next up.** A strip above the grid listing the next few dated items, including one already under way — a
  three-week exam block that opened last week is the single most useful thing the strip can say.
- **Filters.** Source pills (Academic calendar / Departmental events) and a kind legend. A month with nothing in it
  says so in words rather than looking broken, and a month that is only empty because of a filter says *that*.
- **Undated rows.** The senate prints "To be determined" for two items, so a row can legitimately have no date.
  Those appear in a TBA panel and never in a day cell.
- **Design.** The look is admin-set per kind (colour, icon, label) plus grid behaviour, landing defaults and the
  page accent, saved as named "looks". Colours come from a closed swatch list mapped to existing design tokens, so
  the calendar follows the site's light/dark theme. See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md#calendar).
- **Kill switch.** The `calendar` key in `feature_flags` hides the nav item, the footer link and the route, and
  switches the reminder emails off, without a deploy.

### Admin screens

One route with four tabs, reached from a single Admin → Calendar tile. Each tab is visible to every admin; creating
and editing entries go through the owner's review queue exactly as they do for events. The tab lives in the URL
(`?tab=`), so a tab survives a refresh and can be bookmarked or shared.

| Tab | What it does |
|---|---|
| `?tab=dates` (default) | Add, edit and delete senate dates, grouped by semester. Review-gated; delete is owner-only. |
| `?tab=paste` | Paste a whole published calendar as plain text, review the parsed rows, set each row's kind and reminder lead time, then commit. **Nothing is written until you commit**, and a line the parser cannot read comes back as a warning rather than being silently dropped. |
| `?tab=design` | The Design Studio: per-kind accents, grid behaviour, landing defaults, page accent and radius, saved looks, with a live preview against a real month. |
| `?tab=session` | Choose which academic session the public calendar shows, and see how many dates an archive would take off the page. |

An unrecognised `?tab=` falls back to **Dates** rather than rendering nothing.

The reminder template (`academic_reminder`) is designable in the **existing** email studio under Admin → Email
templates — there is no parallel calendar email surface.

### Reminder emails

A scheduled worker emails members ahead of a date, at a lead time set per row (exams 7 days, resumption 1,
lectures end 3, and so on — a single global lead time cannot serve both an exam and a resumption). It runs through
the existing queued-email worker and respects `calendar_settings.reminder_enabled`, the `calendar` feature flag, and
each member's notification preference. The `pg_cron` schedule is switched on separately, after the route is deployed.

## Tech stack

| Area | Choice |
|---|---|
| Frontend | React 19, React Router 7, Vite 8, Tailwind CSS 4, TanStack Query, Motion |
| Backend | Vercel serverless functions in `api/` (Node, ESM) |
| Database, auth, storage | Supabase (Postgres with row-level security, Auth, Storage, Realtime) |
| Email | Resend (queued, sent by an email worker) |
| Bot protection | Cloudflare Turnstile |
| Monitoring | Sentry |
| Tooling | Oxlint, Vitest, GitHub Actions, Dependabot |

## Getting started

Requirements: Node.js 22 and a Supabase project.

```bash
git clone https://github.com/AyeniTaiwoSPC270/Nammes-Hub.git
cd Nammes-Hub
npm ci
cp .env.example .env     # then fill in the values (see below)
npm run dev              # http://localhost:5173
```

`npm run dev` runs only the Vite frontend. The `api/` functions run on Vercel; to exercise them locally, use
`vercel dev` (requires the Vercel CLI and a linked project).

### Environment variables

Copy `.env.example` to `.env`. Never commit `.env` (it is git-ignored, and CI runs gitleaks).

| Variable | Where used | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | Public anon key (safe to expose, protected by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Full-access key for `api/` functions and scripts. **Keep secret.** |
| `RESEND_API_KEY` | Server only | Sends email |
| `VITE_SENTRY_DSN` | Browser | Error reporting |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Build | Source-map upload |
| `VITE_TURNSTILE_SITE_KEY` | Browser | Turnstile widget key |
| `TURNSTILE_SECRET` | Server only | Verifies Turnstile tokens |

### Database setup

The live project predates tracked migrations, so the schema is rebuilt in two stages:

1. Run `supabase/history/01…04` in order in the Supabase SQL editor.
2. Run every file in `supabase/migrations/` in name order.

Details and post-restore steps (restoring data, recreating the webhook secret, setting the owner) are in
[`supabase/history/README.md`](supabase/history/README.md). Add your first admin as described in
[ADMIN.md](ADMIN.md#adding-a-second-admin).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with Oxlint |
| `npm test` | Run the Vitest suite once |

Maintenance scripts live in `scripts/`: `backup-database.mjs`, `backup-storage.mjs`, `verify-backup.mjs`, and
`seed-*.mjs` for loading starter content. They need `SUPABASE_SERVICE_ROLE_KEY` and `VITE_SUPABASE_URL` set.

## Project structure

```
src/
  pages/          Route-level pages (public, quiz, CBT, admin/)
  components/     Shared UI, grouped by feature (admin, quiz, cbt, awards, calendar, forms, ...)
  data/           Supabase data access (queries, mutations) with unit tests
  lib/            Helpers: auth/theme contexts, CGPA maths, PDF export, MFA, error tracking
api/
  *.js            Serverless entry points; some are routers (account, system, quiz)
  _lib/           Shared server logic, handlers/ for routed actions, and tests
supabase/
  history/        Schema as it existed before migrations were tracked
  migrations/     Ordered SQL migrations (RLS, grants, audit log, retention, ...)
  tests/          SQL tests and verification queries
scripts/          Backups, seeding, manual tools
vercel.json       Rewrites that map friendly /api/* paths onto the router functions, plus security headers
```

Routes are declared in `src/App.jsx`. Several `/api/*` URLs (for example `/api/disable-user`) are rewrites to a
router function such as `/api/account?action=disable-user`; see `vercel.json`.

## Testing and CI

`npm test` runs unit tests for server logic (`api/_lib/*.test.js`), data access (`src/data/*.test.js`) and
helpers (`src/lib/*.test.js`). GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request and push to
`master`:

1. `npm run lint`
2. `npm test`
3. `npm audit --omit=dev --audit-level=high`
4. `npm run build`
5. A separate job scans the full history for leaked secrets with gitleaks

Please make sure all of these pass locally before opening a PR.

## Deployment

The app is deployed on Vercel. Set every variable from the table above in the Vercel project settings.
`api/system.js` is configured for a 300 s max duration (handbook builds and email worker) and bundles fonts and
manual assets via `includeFiles` in `vercel.json`. Database changes are applied to Supabase by running new files
from `supabase/migrations/`.

## Security

- Row-level security on tables, least-privilege grants, and owner-only deletes (see `supabase/migrations/`)
- Admin MFA enforcement, an audit log and an error log
- Turnstile on public submission forms; signed webhooks
- Account disable / anonymise / delete flows and data-retention policies
- Security headers set in `vercel.json`

To report a vulnerability, contact the maintainers privately rather than opening a public issue.

## Contributing

1. Branch from `master` (`feat/...`, `fix/...`, `docs/...`).
2. Keep changes focused, add or update tests, and follow the visual rules in
   [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) (use tokens, not raw hex values).
3. Open a pull request; CI must be green.

## Further reading

- [ADMIN.md](ADMIN.md): running the site as an admin, no code needed
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md): colours, dark mode, the calendar theme, type, components
- [AGENTS.md](AGENTS.md): conventions and the rules that are not obvious from the code
- [supabase/history/README.md](supabase/history/README.md): rebuilding the database