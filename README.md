# NAMMES Hub

The official website of the **National Association of Metallurgical and Materials Engineering Students (NAMMES), University of Lagos**.

Students keep asking the same questions: where is the course outline, when is the exam, what happened to that link? NAMMES Hub puts the answers in one place and lets the executives run it without touching code.

**Live site:** [www.nammeshub.com.ng](https://www.nammeshub.com.ng)

---

## What it does

**For students**

- **Academics:** course outlines by level and semester, the programme curriculum, class and exam timetables, a resources library, and a CGPA calculator with PDF export
- **Academic calendar:** the senate's dates and departmental events merged on one page
- **Community:** news, events with photo galleries, opportunities (scholarships and internships) sorted by deadline, and the executive council
- **Awards:** nominate, vote, and see the revealed winners
- **Forms:** department forms and surveys
- **Quizzes:** live host-run games, head-to-head battles and brackets (with bots), public practice mode, and timed CBT practice exams
- **Contributions:** students can submit past questions and notes, which an admin reviews before they appear

**For executives** (`/admin`)

- Manage all content, users, contact messages, forms, quizzes, CBT exams and award seasons
- Email broadcasts and editable email templates
- An approval queue: admin edits to News, Events and Awards are published only after the owner approves them
- Admin two-factor login, an audit log, an error log and system health checks

The admin guide is in [ADMIN.md](ADMIN.md). A full member and admin handbook is available from the site footer.

## Tech stack

| Area | Choice |
|---|---|
| Frontend | React 19, React Router 7, Vite, Tailwind CSS 4, TanStack Query |
| Backend | Vercel serverless functions (`api/`, Node, ESM) |
| Database, auth, storage | Supabase: Postgres with row-level security, Auth, Storage, Realtime |
| Email | Resend, through a queued email worker |
| Bot protection | Cloudflare Turnstile |
| Monitoring | Sentry |
| Tooling | Oxlint, Vitest, GitHub Actions, Dependabot |

## Getting started

You need Node.js 22 and a Supabase project.

```bash
git clone https://github.com/AyeniTaiwoSPC270/Nammes-Hub.git
cd Nammes-Hub
npm ci
cp .env.example .env    # fill in the values below
npm run dev             # http://localhost:5173
```

`npm run dev` starts only the frontend. The functions in `api/` run on Vercel. To try them locally, use `vercel dev` (needs the Vercel CLI and a linked project).

### Environment variables

Never commit `.env`. It is git-ignored, and CI scans the history for leaked secrets.

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | Public anon key (safe to expose; access is controlled by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Full-access key for `api/` and scripts. **Keep secret.** |
| `RESEND_API_KEY` | Server only | Sends email |
| `VITE_SENTRY_DSN` | Browser | Error reporting |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Build | Source-map upload |
| `VITE_TURNSTILE_SITE_KEY` | Browser | Turnstile widget key |
| `TURNSTILE_SECRET` | Server only | Verifies Turnstile tokens |

### Database setup

The live database was created before migrations were tracked, so it is rebuilt in two stages:

1. Run `supabase/history/01…04` in order in the Supabase SQL editor.
2. Run every file in `supabase/migrations/` in name order.

Restore steps and first-admin setup are in [`supabase/history/README.md`](supabase/history/README.md) and [ADMIN.md](ADMIN.md#adding-a-second-admin).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with Oxlint |
| `npm test` | Run the Vitest suite once |

Maintenance scripts live in `scripts/`: `backup-database.mjs`, `backup-storage.mjs`, `verify-backup.mjs`, and `seed-*.mjs` for loading starter content. They need `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Project structure

```
src/
  pages/        Route-level pages (public, quiz, CBT, admin)
  components/   Shared UI, grouped by feature
  data/         Supabase data access, with unit tests
  lib/          Helpers: auth and theme contexts, CGPA maths, PDF export, MFA
api/
  *.js          Serverless entry points; some are routers (account, system, quiz)
  _lib/         Shared server logic, routed handlers, and tests
supabase/
  history/      Schema as it was before migrations were tracked
  migrations/   Ordered SQL migrations (RLS, grants, audit log, retention)
  tests/        SQL tests and verification queries
scripts/        Backups, seeding, manual tools
```

Routes are declared in `src/App.jsx`. Several `/api/*` URLs are rewrites to a router function (for example `/api/disable-user` maps to `/api/account?action=disable-user`). See `vercel.json`.

## Testing and CI

`npm test` covers server logic, data access and helpers. GitHub Actions runs on every pull request and push to `master`: lint, tests, a dependency audit, a production build, and a gitleaks secret scan of the full history.

## Security

- Row-level security and least-privilege grants, with owner-only deletes
- Two-factor login for admins, which the owner can require
- An audit log and an error log
- Turnstile on public forms and signed webhooks
- Account disable, anonymise and delete flows, plus data-retention policies
- Security headers set in `vercel.json`

To report a vulnerability, contact the maintainers privately through the [Contact page](https://www.nammeshub.com.ng) rather than opening a public issue.

## Contributing

1. Branch from `master` (`feat/...`, `fix/...`, `docs/...`).
2. Keep changes focused, add or update tests, and follow [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) (use design tokens, not raw hex values).
3. Open a pull request. CI must pass.

## Further reading

- [ADMIN.md](ADMIN.md): running the site as an admin, no code needed
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md): colours, dark mode, type, components
- [AGENTS.md](AGENTS.md): conventions that are not obvious from the code
- [supabase/history/README.md](supabase/history/README.md): rebuilding the database

## Credits

Built and maintained by [Ayeni Taiwo](https://github.com/AyeniTaiwoSPC270), Assistant General Secretary, NAMMES UNILAG 2026/27, with the executive council (The Aegis 26/27).
