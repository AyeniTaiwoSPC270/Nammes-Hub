# AGENTS.md — NAMMES Hub

## What this project is

**NAMMES Hub** is the web hub for the NAMMES association (Department of Metallurgical
and Materials Engineering, University of Lagos). It is a student-facing academic portal
plus a no-code admin CMS for the association's executives.

Live site: `https://www.nammeshub.com.ng`

### Student-facing features
- **Academics** — course outlines drill-down (level → semester → course) with
  student-contributed past questions/notes, timetables (view + PDF/image export), a
  CGPA calculator with trend chart, and a level-organised resources page.
- **Live quiz system** — the largest feature. Hosted live games with join codes,
  teams, power-ups, bots, practice races, a **battle** mode (challenge/duel/knockout
  bracket/Elo rankings), community "make your own quiz" sets, and a quiz **studio**
  for authoring themed questions.
- **CBT practice exams** — separate timed, exam-style papers (question bank with a
  random draw, clock, navigator, server-side grading, review). Distinct from quizzes.
- **Community** — news, events (with photo galleries), opportunities, department
  awards (a full season state machine: nominate → curate → vote → close → reveal),
  and a NAMMES forms builder.
- **Handbook** — a long-form, page-editor-driven handbook rendered to PDF server-side.
- **Account** — Supabase email/password auth, MFA for admins, profile, matric number.

### Admin CMS (`/admin`, ~35 pages)
Add/edit/delete for news, opportunities, events + galleries, resources, excos,
outlines, timetables, forms + responses, submissions review, award seasons, quizzes
and quiz studios, CBT exams, broadcasts, email templates, site links, page banners,
home content, handbook, users/roles, messages, system logs, and security settings.

### Ops
- Email via Resend (welcome, contact, broadcasts, quiz invites) with an outbox/worker.
- Sentry error tracking, Cloudflare Turnstile on public forms, Google Drive file names.
- Weekly database + storage backups, restore drills, audit log, feature-flag kill
  switches, MFA enforcement switch.

---

## Stack

| Layer | Choice |
|---|---|
| Build | Vite 8 (`vite.config.js`), React 19, plain JS + JSX (no TypeScript) |
| Routing | react-router-dom 7, all routes lazy-loaded via `src/lib/lazyRetry.js` |
| Server state | TanStack Query 5 (`src/lib/queryClient.js`) |
| Backend | Supabase (Postgres, Auth, Storage, RLS, Vault, pg_cron) — no separate server |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite`; tokens in `src/index.css` `@theme` |
| API | Vercel serverless functions in `api/` (Node ESM, default-export handlers) |
| Email | Resend |
| Charts | hand-rolled SVG (`src/lib/chartMath.js`) |
| PDF | jsPDF + jspdf-autotable, pdfjs-dist, Puppeteer (handbook build), @napi-rs/canvas |
| Errors | Sentry |
| Lint | oxlint (`.oxlintrc.json`) |
| Tests | vitest (`npm test` → `vitest run`, no config file — defaults to `**/*.test.js`) |
| CI | `.github/workflows/ci.yml` — lint, test, `npm audit --audit-level=high`, build, gitleaks |
| Host | Vercel (`vercel.json` — SPA rewrites, CSP/security headers, function config) |

---

## Commands

```bash
npm install
npm run dev        # vite dev server
npm run build      # production build to dist/
npm run lint       # oxlint
npm test           # vitest run  (73 test files, co-located next to source)
npm run preview    # serve the build
```

Never run a migration or DDL against production to test. Prove it on a Supabase
branch first (see "Database changes").

---

## Repo layout

```
src/
  App.jsx                  Route table. Add every new page here (lazy import + <Route>).
  main.jsx                 Provider stack: Query → Router → Theme → Auth → Toast → Tour
  index.css                Tailwind v4 @theme tokens — the design source of truth
  components/
    Layout, Navbar, Footer, AuthCard, ErrorBoundary, AdminRoute, Breadcrumbs, ...
    ui/                    Button Card Badge Table FormField EmptyState ErrorState
                           Skeleton Toast Toggle Reveal ImageReveal BlurredBackdropImage
    admin/                 AdminLayout, AdminResourceManager/Form/List, upload fields,
                           HandbookEditor, HostQuizModal, ShareFormModal
    quiz/ cbt/ awards/ forms/ outlines/ cgpa/ tour/   feature-scoped components
  pages/                   One file per route. Mirrors the route table in App.jsx
    admin/                 ~35 admin pages
    admin/config/          Per-entity admin field config (used by AdminResourceManager)
    cbt/ outlines/ resources/ timetable/
  data/                    Data-access layer. One module per entity. Exports
                           `fetch<Entity>` + `use<Entity>Query()` + pure helpers.
                           This is the ONLY place components talk to Supabase.
  lib/                     Cross-cutting: supabaseClient, supabaseQueries, queryClient,
                           AuthContext, ThemeContext, ToastContext, TourContext,
                           cgpa*, *Pdf, *Image, quizSound/quizImage, projectorFit,
                           uploadPath, turnstile, mfa, errorTracking, sentryScrub,
                           mathText, lazyRetry, ...
api/                       Vercel functions
  account.js quiz.js system.js award-card.js send-broadcast.js submit-public.js
  health.js drive-file-name.js webhook-{welcome,contact,new-content}.js
  _lib/                    Shared server modules: authz, supabaseAdmin, validate,
                           resend, emailQueue/Templates/Design, quiz* domain logic,
                           awardCard*, publicSubmission, handbookBuild, webhookAuth,
                           turnstileVerify, logError, chunk, googleDrive
  _lib/handlers/           One handler per action (quiz-*, admin-issues, email-worker…)
supabase/
  migrations/              Versioned SQL — the schema source of truth. Timestamp-named.
  rollbacks/               One rollback script per migration. Write it with the migration.
  history/                 Squashed baseline files for a from-scratch rebuild (01..04, 03b)
  tests/                   pgTAP SQL tests (*.test.sql) + grants.verify.sql
  config.toml              Supabase CLI config
scripts/                   Node ESM ops + content tooling (run manually, not in build)
  seed-*.mjs               Seeding for dev data
  backup-database.mjs backup-storage.mjs verify-backup.mjs   Ops runbook scripts
  quizzes/                 Course question banks: src/*.txt → build.mjs → csv/
  flyers/ manual/ tour-mockups/ award-mockups/   Asset & doc generators (canvas/Puppeteer)
docs/
  security/                Audit, RUNBOOK.md (private ops runbook), proposed-hardening.sql
  superpowers/specs/       Feature specs written before code (dated)
  superpowers/plans/       Implementation plans derived from specs (dated)
public/                    Static assets; public/documents/*.pdf are committed deliverables
ADMIN.md                   Non-technical admin guide
DESIGN_SYSTEM.md          Design documentation (see caveat below)
.vercel/ .superpowers/    Tooling state; both git-ignored
```

---

## Architecture rules

### Data access
- **Components never import `supabaseClient` directly.** They import from `src/data/*`.
- Pattern in `src/data/<entity>.js`:
  ```js
  export function fetchEvents() { return fetchTable('events', { orderBy: {...} }) }
  export function useEventsQuery() { return useQuery({ queryKey: ['events'], queryFn: fetchEvents }) }
  export function groupEventsByTime(list, now = new Date()) { /* pure, testable */ }
  ```
- Query keys are plain entity names. Mutations must invalidate the related keys.
- Pure logic (date parsing, grouping, formatting, math) lives in `data/` or `lib/` as
  exported functions so it can be unit tested — **this is the dominant pattern here**.

### API functions (Vercel has a 12-function free-tier limit)
- Related routes share one function; `vercel.json` rewrites the friendly URL to
  `?action=`. Example: `/api/disable-user` → `/api/account?action=disable-user`.
- The pattern, in every shared router (`api/account.js`, `api/quiz.js`, `api/system.js`):
  ```js
  const ACTIONS = { 'disable-user': disableUser, ... }
  export default function handler(req, res) {
    const name = req.query?.action
    const action = typeof name === 'string' && Object.hasOwn(ACTIONS, name) ? ACTIONS[name] : null
    if (!action) { res.status(404).json({ error: 'Not found' }); return }
    return action(req, res)
  }
  ```
- Handlers live in `api/_lib/handlers/`. Shared logic in `api/_lib/`.
- **Adding a new top-level `api/*.js` file costs a function slot.** Prefer adding an
  action to an existing router; if you must add one, update the comment in
  `api/account.js` and check the count.
- Admin-only routes: `getCaller(supabaseAdmin, bearerToken(req))` from
  `api/_lib/authz.js` — it verifies the JWT server-side (not a decode) and returns
  `{ user, isAdmin, isOwner }` or `{ error: [status, message] }`. It also enforces
  the `require_admin_mfa` feature flag. Do not roll your own auth check.

### Security posture (this repo has been audited; see `docs/security/`)
- RLS is the enforcement layer. `supabase/migrations/*.sql` is the source of truth;
  production gets byte-identical SQL.
- Every `SECURITY DEFINER` function: `set search_path = public` (or `''`),
  `revoke execute … from public, anon`, then explicit grants.
- Policies use `TO <role>` (never `auth.role()`), wrap calls as `(select auth.uid())`,
  and UPDATE policies have **both** `USING` and `WITH CHECK`.
- Any new migration must ship with: `supabase/rollbacks/<name>.rollback.sql` and,
  when it changes behaviour, a pgTAP test in `supabase/tests/`.
- Never print, log, or commit secrets. `.env*` is git-ignored. CI runs gitleaks.
- Admin destructive actions in the UI always need a confirmation step.

### Rendering
- Every new route in `src/pages` must be lazy-loaded in `src/App.jsx` via
  `lazyRetry(() => import('./pages/X'))` — this is the performance model of the site.
- Full-screen/immersive routes (`/play`, `/battle`, `/cbt`, `/host`, `/make`,
  `/practice`, `/set/:code`) sit **outside** `<Layout>` so they have no site chrome.
  Everything else is nested under `<Layout>`.
- `AdminRoute` gates `/admin/**`; `AdminLayout` provides the admin sub-nav.

---

## Conventions

- **Plain JavaScript.** No TypeScript. JSX files are `.jsx`; logic modules `.js`.
- **Formatting:** no semicolons, single quotes, 2-space indent, trailing commas only
  where already present. Match the file you're editing.
- **Comments explain *why*, not *what*** — the codebase uses them sparingly and well
  (see `src/data/events.js`, `api/account.js`). Do not add comments to code that is
  self-evident, and do not delete existing ones.
- **Icons:** `material-symbols-outlined` font glyphs (text characters like
  `expand_more`). No SVG icon library, no emoji as structural icons.
- **Colors:** always use the token (`bg-green-900`, `text-ink-muted`) — never inline
  hex. Note some components use Tailwind's *default* `green-100`/`green-700`, which are
  not custom tokens.
- **Theme:** dark mode **is** wired (`ThemeContext` + `public/theme-init.js` apply the
  `.dark` class, the `.dark` block in `index.css` remaps the tokens, and Navbar /
  `PlayQuiz` / `components/quiz/QuizTheme*` expose toggles), even though
  `DESIGN_SYSTEM.md` says "no dark mode". **`DESIGN_SYSTEM.md` is partly stale —
  verify against `src/index.css` and the actual components before trusting it.**
- **Images:** uploads go through the shared `ImageUploadField` / `AvatarUploadField`
  helpers and the `uploadPath` naming scheme. News/event/exco photos cap at 5MB, image
  types only; outline submissions allow PDF/JPG/PNG up to 10MB.
- **Admin CRUD:** simple entities are driven by config in `src/pages/admin/config/*AdminConfig.js`
  through the generic `AdminResourceManager` / `AdminResourceForm` / `AdminResourceList`.
  Prefer extending a config over writing a bespoke admin page.
- **Tests:** co-located `*.test.js` next to the module, pure functions only
  (no component/render tests exist). Vitest defaults; no setup file.
- **Commits:** Conventional Commits with a scope, describing what and why —
  `feat(quiz): …`, `fix(cbt): …`, `docs(handbook): …`. Feature work lands on a
  `feat/*` branch and merges via PR into `master`.

---

## How work is done here

This project follows a **spec → plan → implement** loop, documented under
`docs/superpowers/`:

1. **Spec** in `docs/superpowers/specs/YYYY-MM-DD-feature.md` — what's built, what's
   deliberately out of scope, decisions already made, non-goals.
2. **Plan** in `docs/superpowers/plans/YYYY-MM-DD-feature.md` — task-by-task steps in
   checkbox syntax, with a Goal / Architecture / Global Constraints header.
3. **Implement** task-by-task, then update the spec's "as built" section.

Expect plans to contain explicit **decision gates** that need the owner's answer before
a task runs, and tasks marked **[UI-GATE]** — the owner designs UI externally. If a
task is marked UI-GATE, stop and ask before making visual changes.

---

## Database changes

1. Author `supabase/migrations/<timestamp>_<name>.sql`.
2. Write `supabase/rollbacks/<timestamp>_<name>.rollback.sql`.
3. Add/extend pgTAP tests in `supabase/tests/`.
4. Prove it on a Supabase branch. **Never run unproven DDL against production.**
5. Apply the byte-identical file to production.

Recovery order for a lost project: `supabase/history/01..04` (+ `03b`) then every file
in `supabase/migrations/` in name order, then re-insert backup data (parents first).
Full procedure and kill switches: `docs/security/RUNBOOK.md` (private — don't paste
its contents into public channels).

### Ops scripts

```bash
node --env-file=.env scripts/backup-database.mjs    # -> ./backups/<date>/ (git-ignored)
node scripts/backup-storage.mjs ./storage-backup
node --env-file=.env scripts/verify-backup.mjs      # exit 1 = do not trust the backup
node scripts/seed-news.mjs | seed-events.mjs | seed-excos.mjs | seed-opportunities.mjs
node scripts/seed-outlines.mjs | seed-resources.mjs | seed-test-form.mjs
```

Feature-flag kill switches (`voting`, `nominations`, `uploads`, `broadcasts`,
`public_forms`, `require_admin_mfa`) are toggled in the Supabase SQL editor — see the
runbook.

---

## Before you claim something is done

```bash
npm run lint && npm test && npm run build
```

All three must pass. Then report honestly what you verified and what you didn't.