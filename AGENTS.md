# AGENTS.md

Notes for AI agents working in this repository. Human-facing docs are `README.md`,
`ADMIN.md` (admin how-to) and `DESIGN_SYSTEM.md` (tokens and components).

## Commands

```bash
npm run dev      # vite dev server
npm run build    # production build
npm run lint     # oxlint (warnings are tolerated, errors are not; exit 0 required)
npm test         # vitest run (single pass, no watch)
```

There is no separate typecheck step and no separate `vitest.config` — Vitest runs on defaults.
TypeScript is **not** used; the project is plain JSX. Never claim a typecheck passed.

If the dev server dies with `Uncaught ReferenceError: __DEFINES__ is not defined`, the Vite
dependency cache is stale, not a code bug. Fix with
`Remove-Item -Recurse -Force node_modules/.vite` then `npm run dev -- --force`.

## Layout

| Path | What lives there |
|---|---|
| `src/pages` | Route components. `admin/` subfolder is the admin area. |
| `src/components` | Shared UI, grouped by feature. `ui/` holds primitives (Button, FormField, ErrorState…), `calendar/` the `/calendar` components plus `CalendarDesignControls.jsx` for the studio. |
| `src/lib` | Framework-free helpers and hooks (`quizSound.js`, `supabaseClient.js`, `useCountUp`…). |
| `src/data` | Supabase reads/writes and react-query hooks (`quiz.js`, `admins.js`…). |
| `api/_lib/handlers` | Vercel serverless request handlers, one per action. |
| `api/_lib/*.js` | **Pure, dependency-free logic shared by the server and the browser.** |
| `supabase/migrations` | The schema. SQL files, applied in order, are the source of truth. |
| `scripts/manual` | Builds the in-app user manual content. |

### The `api/_lib` sharing rule (important)

Files directly under `api/_lib/` are imported by *both* serverless handlers and client pages,
using a relative path out of `src`:

```js
import { sanitizeTheme } from '../../api/_lib/quizTheme.js'   // from src/pages/admin/
import { rankPlayers } from '../data/quiz'                   // src -> src/data
```

So anything in `api/_lib/*.js` must stay pure: no `window`, no Supabase client, no Node built-ins.
Validation and normalisation belong here so the studio, the projector, the phones and the API all
clean a value the same way. Anything that needs I/O goes in `api/_lib/handlers/`.

## Conventions

- **Styling** is Tailwind v4 with the tokens defined in `src/index.css`: `bg-surface`,
  `bg-surface-low`, `text-ink-900`, `text-ink-muted`, `border-hairline`, `accent-orange-500`,
  `text-brand-orange`, `bg-brand`. Do not invent raw hex colours in JSX. `DESIGN_SYSTEM.md` has the
  full list plus the component recipes.
- **Icons** are Material Symbols. Any name used in a `material-symbols-outlined` span **must** be in
  the `icon_names=` list in `index.html`, in alphabetical order. `src/lib/iconFont.test.js` fails the
  build otherwise, and an unloaded icon renders as literal text on the page.
- **Tests** are colocated next to the thing they cover (`src/lib/quizSound.test.js`,
  `api/_lib/quizBracket.test.js`). Test pure functions and rules directly; anything touching
  `AudioContext`, `localStorage` or `supabase` needs a guard or a fake.
- **Comments** explain *why*, not *what*. The codebase is comment-heavy on non-obvious intent
  (throttling, sanitising, a workaround) and silent on the obvious. Match that.
- No `console.log` left behind. No commented-out code.

## Academic calendar

- **`api/_lib/calendarDates.js` exists because `new Date('2026-10-05')` is UTC midnight.** It reads back as the
  4th anywhere with a negative UTC offset, so the event lands on the wrong day. Never reintroduce that call: build a
  day from `new Date(year, monthIndex - 1, day)` only, and read a day back with `toDayKey` rather than
  `toISOString()` (also UTC). Nigeria is UTC+1 and would never notice the bug, which is exactly why it survives.
- **All four `api/_lib/calendar*.js` modules are pure and shared browser/server** — `calendarDates.js`,
  `calendarTheme.js`, `calendarPaste.js`, `calendarMerge.js`. The `src/pages` code imports them by relative path out
  of `src`, so they must stay free of `window`, the Supabase client and Node built-ins. `calendarMerge.js` imports
  `parseEventDate` from `src/data/events.js` — the legacy fallback is deliberately *reused*, not reimplemented, so
  there is only one answer to "what day is this event".
- **`academic_calendar.starts_at` / `ends_at` are `date`, never `timestamptz`.** Every senate item is all-day; a
  timestamp means inventing a midnight that never existed and re-rendering it through each viewer's timezone, so the
  bug is unrepresentable with a `date`. Timed items go on `events.starts_at`, which *is* a `timestamptz`. Do not
  "fix" the senate columns to be consistent.
- **`starts_at IS NULL` is a real state — "to be determined", not a bug.** Two senate rows print it. Such a row
  never enters a day cell (an undated item has no cell); it appears only in the TBA panel. Same for an `events` row
  with no `starts_at` and no parseable `date` — `groupEventsByTime` files those in `tba`, not `upcoming`, where they
  used to sit forever.
- **The paste parser never drops a line silently.** A line it cannot read comes back as a `warning` carrying its line
  number, its raw text and a reason. 28 rows imported where the admin believed they imported 30 is worse than a
  refusal, so if you touch `calendarPaste.js`, keep the reverse test: mangle one date in a known-good fixture and
  assert exactly one warning and no data loss.
- **The four calendar admin screens are four tabs on one route, not four routes.** `/admin/calendar?tab=`
  (`dates` | `paste` | `design` | `session`) is the only route, behind one Admin → Calendar tile. The tab list is
  data in `src/lib/adminCalendarTabs.js` so the shell and the tests read the same source, and the three non-default
  bodies are `React.lazy` — the Design Studio pulls the whole control set plus a live grid, and an admin who only
  edits dates should not pay for it. Adding a fifth screen means a new tab there and a new body, not a new route.
- **`calendar-reminders` has no Vercel function of its own.** It is registered in the `ACTIONS` map at
  `api/system.js` and reached through the `/api/system?action=calendar-reminders` rewrite in `vercel.json`. That is a
  deliberate function budget, not an oversight — do not promote it to its own `api/*.js` entry point.
- **The reminder dedupe key must keep the recipient.** `dedupeKey = academic-reminder:<id>:<starts_at>:<email>`.
  `email_outbox.dedupe_key` is `unique` and `enqueueEmails` upserts with `ignoreDuplicates`, so a key without the
  address collapses the whole fan-out to one row: one student gets the exam reminder and the rest silently get
  nothing, while `queued` still reports success. Every other multi-recipient producer already appends the address.
- "Is today" is read out of an `Intl.DateTimeFormat` pinned to `Africa/Lagos`, not off the host clock — Vercel runs
  UTC and the two disagree for five hours a day, which would send exam reminders a day early for part of each day.
- The `calendar` key in `feature_flags` is the kill switch: nav item, footer link and route all disappear without a
  deploy, and the reminder worker honours it too.

## Known open bugs

Both predate the calendar, are out of scope, and are still open:

- `page_banners` has no `curriculum` row, so `updatePageBanner` matches zero rows and that page's title/subtitle
  edits silently do nothing (`src/pages/admin/AdminPageBanners.jsx:11-26`).
- `outlines.past_questions_name` and `lecturer_notes_name` are read by `src/lib/outlinePdf.js:165-166`, rendered by
  `OutlineDetail.jsx:128,139` and edited by `outlinesAdminConfig.js:29,31`, but have **no DDL anywhere** — they were
  added through the dashboard and a rebuild from `supabase/history` + `supabase/migrations` would lose them.

## Domain notes

- **The live quiz is all synthesised.** `src/lib/quizSound.js` generates every music loop and sound
  effect with the Web Audio API. There are no audio files in `public/` and nothing to license. If you
  add a loop or a sound, it goes in that module and must be registered in **both** `STYLES`/`EFFECTS`
  and the display lists (`THEME_MUSIC` in `api/_lib/quizTheme.js`, `EFFECT_GROUPS` in `quizSound.js`).
  Tests assert those lists agree, so a half-registered sound fails `npm test`.
- **Browser audio needs a gesture.** Every `play()`/`startMusic()` no-ops until `unlock()` has been
  called from a real click or tap. Do not "fix" a silent sound by removing that guard.
- **Audio must never break the game.** Unsupported, blocked or closed audio contexts fail silently by
  design. Keep it that way.
- **A quiz's `theme` (jsonb) is a design-time draft.** Each game copies it into `quiz_sessions.theme`
  when it starts, so editing a quiz never restyles a game already running. New theme fields need a
  default in `DEFAULT_THEME` and a fallback in the matching `clean*` function, or a hand-edited row
  can put junk on the projector.
- **Phones get effects only, never music**, and each player opts in on their own device. Do not read
  `theme.sound.music` from `src/pages/PlayQuiz.jsx`.

## Before you say you are done

1. `npm test` — all suites pass.
2. `npm run lint` — exit 0. Pre-existing warnings are fine; do not add new ones.
3. `npm run build` — succeeds.
4. If the change touches audio, the theme shape, or a quiz screen, say plainly that the result has
   **not** been heard or seen in a real game. That check needs a Supabase login and cannot be faked.
5. The same applies to the calendar: rendering, dark mode across the swatch set, and reminder delivery
   are **unverified without a real session and a Supabase login**. Say so rather than implying the page was
   looked at.
