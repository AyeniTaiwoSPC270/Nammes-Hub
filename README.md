# NAMMES Hub

The official web platform for the Department of Mathematics (NAMMES) at the University of Lagos. It brings
department news, events, course outlines, resources, awards, forms and an interactive quiz / CBT system into one
site, with an admin area so the executives can run it without touching code.

## Features

**For students**
- News, events (with photo galleries), opportunities with deadlines, and meet-the-excos pages
- Course outlines, curriculum, timetables and a resources library, organised by level and semester
- CGPA calculator with PDF export
- Department awards: nominate, vote, and see the revealed winners
- Forms: fill in department forms and surveys
- **Quizzes**: live host-run games, head-to-head battles and brackets (with bots), public practice mode,
  community quizzes anyone can import, and timed **CBT practice exams**
- Student-contributed past questions and notes (reviewed before publishing)

**For admins** (`/admin`): see [ADMIN.md](ADMIN.md)
- Manage all site content, users, contact messages, forms, quizzes, CBT exams and award seasons
- Email broadcasts and editable email templates, handbook builder
- Security page (MFA enforcement, audit log), system health checks and error log

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
  components/     Shared UI, grouped by feature (admin, quiz, cbt, awards, forms, ...)
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
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md): colours, type, components
- [docs/IMPROVEMENTS.md](docs/IMPROVEMENTS.md): review findings and the plan to address them
- [supabase/history/README.md](supabase/history/README.md): rebuilding the database
