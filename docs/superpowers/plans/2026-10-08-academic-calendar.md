# Academic Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public `/calendar` merging the senate-approved academic calendar with departmental events, plus a Design Studio, admin paste import, and reminder emails.

**Architecture:** A new `academic_calendar` table holds the senate's all-day dates as `date` columns (never `timestamptz` — see spec §2). The existing `events` table gains nullable `starts_at timestamptz` / `ends_at` / `kind` / `remind_days`, so nothing existing breaks and `events.date` text keeps working. Four pure modules in `api/_lib/` do the real work — timezone-safe date keys, theme sanitising, the paste parser, and the source merge — so the studio, the public grid, and the reminder handler all resolve a value identically. A `calendar_settings` singleton and a `calendar_looks` table back the studio and the single active session. Reminders reuse the existing `email_outbox`, `pg_cron` → signed-webhook → worker pattern, and `email_templates`, and dispatch through the existing `api/system.js` ACTIONS map so no new Vercel function is added.

**Tech Stack:** React 19, react-router-dom v7, Tailwind v4 design tokens, Supabase (Postgres + Storage), `@tanstack/react-query`, Resend, pg_cron, Vitest, oxlint, Vercel serverless (Node).

**Spec:** `docs/superpowers/specs/2026-10-08-academic-calendar-design.md`

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/20261009090000_calendar.sql` | `academic_calendar`, `calendar_settings`, `calendar_looks`, `events` columns, RLS, narrow grants, `calendar` flag, MFA policies, delete audit trigger |
| `supabase/migrations/20261009091000_calendar_seed.sql` | the 26 senate rows, `calendar` page_banners row |
| `supabase/migrations/20261009120000_calendar_reminders.sql` | `academic_reminder` template row, `run_calendar_reminders()`, `pg_cron` schedule |
| `supabase/rollbacks/2026*_calendar*.rollback.sql` | undo scripts, matching repo convention |
| `api/_lib/calendarDates.js` | day keys, month grid, overlap — **pure, timezone-safe** |
| `api/_lib/calendarDates.test.js` | boundaries, DST, no day drift |
| `api/_lib/calendarTheme.js` | `DEFAULT_THEME`, `sanitizeTheme`, `themeVars`, `KIND_ORDER`, `SWATCHES` |
| `api/_lib/calendarTheme.test.js` | defaults on missing fields, hex rejection |
| `api/_lib/calendarPaste.js` | `parseCalendarPaste(text, { session })` → `{ rows, warnings }` |
| `api/_lib/calendarPaste.test.js` | every real line of the source PDF as a fixture |
| `api/_lib/calendarMerge.js` | `mergeCalendarSources` — pure |
| `api/_lib/calendarMerge.test.js` | month-boundary spans, `starts_at` precedence, TBA exclusion |
| `api/_lib/handlers/calendar-reminders.js` | POST-only signed handler, enqueues via `emailQueue.js` |
| `api/_lib/handlers/calendar-reminders.test.js` | 405, auth, dedupe, TBA/past skips |
| `api/system.js` | register `calendar-reminders` in `ACTIONS` (modify) |
| `api/_lib/emailDesign.js` | register `academic_reminder` in `SYSTEM_EMAILS` (modify) |
| `vercel.json` | rewrite `/api/calendar-reminders` (modify) |
| `src/data/calendar.js` | queries, hooks, mutations for all three tables |
| `src/data/events.js` | TBA bucketing fix (modify) |
| `src/data/events.test.js` | cover the fix (modify) |
| `src/pages/Calendar.jsx` | the public page |
| `src/components/calendar/MonthGrid.jsx` | month grid with spanning bars |
| `src/components/calendar/AgendaList.jsx` | month-grouped agenda |
| `src/components/calendar/NextUpStrip.jsx` | next upcoming items |
| `src/components/calendar/CalendarLegend.jsx` | kind legend |
| `src/components/calendar/DaySheet.jsx` | day detail on mobile |
| `src/components/calendar/TbaPanel.jsx` | undated rows |
| `src/components/calendar/SourceFilter.jsx` | Events / Academic pills |
| `src/components/calendar/CalendarDesignControls.jsx` | studio controls, built on `admin/forms/DesignControls.jsx` |
| `src/App.jsx` | lazy route + admin routes (modify) |
| `src/components/Navbar.jsx` | `Academics` nav item, flag-aware (modify) |
| `src/components/Footer.jsx` | calendar link (modify) |
| `src/pages/Home.jsx` | rescoped empty state (modify) |
| `src/pages/admin/AdminCalendar.jsx` | entries, via `AdminResourceManager` |
| `src/pages/admin/AdminCalendarPaste.jsx` | paste → parse → preview → commit |
| `src/pages/admin/AdminCalendarDesign.jsx` | the Design Studio |
| `src/pages/admin/AdminCalendarSession.jsx` | active session + archive |
| `src/pages/admin/config/academicCalendarConfig.js` | field config for `AdminResourceManager` |
| `src/pages/Admin.jsx` | four new tiles (modify) |
| `src/pages/admin/AdminPageBanners.jsx` | add `calendar` to `PAGES` (modify) |
| `src/pages/admin/AdminEmailTemplates.jsx` | register the reminder template (modify) |
| `index.html` | new icons, **alphabetical** (modify) |
| `README.md`, `DESIGN_SYSTEM.md`, `AGENTS.md` | docs (modify) |

## Review gates

Every task ends with the same two gates. **Neither is skippable.**

**Spec Review** — a fresh subagent checks the task's diff against that task's stated requirement plus the spec. It confirms nothing in the requirement is unimplemented, nothing outside it was added (YAGNI), and every error path the requirement names actually returns. Output: pass, or a list of gaps.

**Code Review** — a second fresh subagent reviews against `AGENTS.md` and codebase convention. It checks: `api/_lib/*.js` purity (no `window`, no Supabase client, no Node built-ins in files `src/` imports); icons present in `icon_names=`; Tailwind tokens not raw hex in JSX; **every `DEFAULT_THEME` key has a fallback in `sanitizeTheme`**; comments explain why; no `console.log`; no commented-out code; tests colocated. Output: pass, or a list of violations.

Plus `npm test && npm run lint && npm run build` must exit 0 at the end of every task. There is no typecheck step and none may be claimed.

---

## Sequence

```
T1 Schema ──┬─ T2 Seed ─────────────────────────────┐
            ├─ T7 Data layer + Home ──┬─ T8 Public page
            │                          │
            ├─ T9 Admin entries ──────┼─ T10 Paste
            │                          ├─ T11 Design studio
            └─ T12 Reminder emails     │
             │
T3 calendarDates ── T6 calendarMerge ──┤
T4 calendarTheme ───────────────────────┤
T5 calendarPaste ───────────────────────┘
```

**T3, T4 and T5 are independent, pure, and fully testable** — no I/O, same shape as `quizBracket.js`. They can be dispatched in parallel.

---

## T1 — Schema, RLS, grants, flag

**Files:** `supabase/migrations/20261009090000_calendar.sql`, `supabase/rollbacks/20261009090000_calendar.rollback.sql`, and the MFA-list edit inside the same migration.

- [ ] Create `academic_calendar` exactly as spec §3.1, including both `check` constraints and the `(session, starts_at)` index.
- [ ] Add the four nullable columns to `events`.
- [ ] Create `calendar_settings` singleton (`id smallint primary key default 1`, `check (id = 1)`) and seed it with `active_session = '2026/2027'`, `default_view = 'month'`, all kinds and both sources enabled, `reminder_enabled = true`, `reminder_default_days = 3`.
- [ ] Create `calendar_looks` (text PK minted client-side — narrower than `email_styles`, which uses a uuid PK + `created_by`).
- [ ] RLS on all three: public `select`; **insert, update and delete all owner-only**, matching the *current* `events` posture (`history/04_...sql:286-294`, `20260929100000:5`), not its original any-admin definition. Non-owner admins use the review queue.
- [ ] `revoke all … from anon, authenticated` on all three, then grant narrowly. Revoking **anon only is not enough** — `least_privilege_grants.sql:23` covers anon alone, so `authenticated` otherwise inherits the platform default `grant all`, `TRUNCATE` included, and `TRUNCATE` is not subject to RLS.
- [ ] Insert the `calendar` key into `feature_flags`.
- [ ] Add `academic_calendar_audit_del` on delete, matching `events_audit_del` (`20260929120000_audit_log.sql:65`).
- [ ] Add a `before update` touch trigger on `academic_calendar` and `calendar_settings` so `updated_at` is maintained — the Design Studio writes whole rows and nothing client-side would bump it. Copy `cbt_touch` (`20261002100000_cbt_exams.sql:85-94`). No EXECUTE grant needed: functions are private to service_role by default and triggers don't need it from the caller.
- [ ] Add `academic_calendar`, `calendar_settings`, `calendar_looks` to the MFA enforcement policy set, copying the `do $$` loop at `20260929150000_admin_mfa_enforcement.sql:24-38`. If skipped, the tables silently skip MFA enforcement.
- [ ] Write the rollback, including the touch triggers and function.
- [ ] `npm test && npm run lint && npm run build`

**Review focus:** `starts_at` is `date`, not `timestamptz`. Nullable `starts_at` survives every `check`. **No `authenticated` grant wider than the precedent** — `revoke from anon` alone leaves the platform default `ALL` in place, `TRUNCATE` included. Rollback is complete and reversible in order.

## T2 — Seed the 26 senate rows

**Files:** `supabase/migrations/20261009091000_calendar_seed.sql`, rollback.

- [ ] Insert all 26 rows from spec §4, verbatim titles and notes.
- [ ] Orientation Programme and Matriculation Ceremony get `starts_at IS NULL`.
- [ ] 2027-03-08 appears once, `semester = 2`.
- [ ] No BCOS, Senate, Board of Studies, Inaugural Lecture, Results-upload or DLI row.
- [ ] Set `remind_days` on the rows that deserve one: exams 7, resumption 1, registration close 3, lectures end 3, semester end 7. Leave breaks, convocation and the TBAs null. `s1-01` (the fees bill) gets 3 because it is a deadline with a penalty; `s2-01` (registration opens) gets none because there is nothing to lose by ignoring it — comment that asymmetry where it sits.
- [ ] Cross-check every date against the weekday the source prints beside it. Where the source gives only a bare day number or no weekday, say so in the file rather than implying full attestation.
- [ ] Insert the `calendar` `page_banners` row (title only, no seeded image).
- [ ] `npm test && npm run lint && npm run build`

**Review focus:** every date matches the PDF. Cross-check all 26 against spec §4 line by line — this is the one task where a wrong date is invisible until a student is late for an exam.

## T3 — `calendarDates.js`

**Files:** `api/_lib/calendarDates.js`, `api/_lib/calendarDates.test.js`.

- [ ] `toDayKey` / `fromDayKey` / `isSameDay` / `addDays` / `addMonths` / `monthGrid` / `rangesOverlap` / `eachDay`.
- [ ] `fromDayKey` builds `new Date(y, m, d)` **only**. Never `new Date(string)`.
- [ ] Tests: month end, year end, 29 Feb, a DST transition, `weekStart` Mon vs Sun, `rangesOverlap` half-open boundaries.

**Review focus:** grep the file for `new Date('` — any hit is a bug. Test that a key round-trips identically in any timezone.

## T4 — `calendarTheme.js`

**Files:** `api/_lib/calendarTheme.js`, `api/_lib/calendarTheme.test.js`.

- [ ] `KIND_ORDER`, `SWATCHES` (8, mapped to existing tokens), `DEFAULT_THEME`, `sanitizeTheme`, `themeVars`.
- [ ] `sanitizeTheme` clamps every field and **falls back for every `DEFAULT_THEME` key**, per the `AGENTS.md` rule.
- [ ] Off-list hex resolves to the kind's seeded swatch.
- [ ] `themeVars` emits only the properties `formTheme.js:419` already uses.
- [ ] Tests: `{}`, partial input, garbage in every field, off-list hex, every key has a fallback.

**Review focus:** grep for any `DEFAULT_THEME` key absent from `sanitizeTheme`. That is the specific failure this repo has been bitten by before.

## T5 — `calendarPaste.js`  ← highest risk

**Files:** `api/_lib/calendarPaste.js`, `api/_lib/calendarPaste.test.js`.

- [ ] Handle all eight shapes in spec §5.2.
- [ ] Normalise U+FFFD and en-dash to a plain dash before parsing.
- [ ] Lift `(...)` trailing content into `note`; strip it from the title.
- [ ] `To be determined` → `starts_at: null`.
- [ ] **Unparseable lines produce a `warning` and never vanish.**
- [ ] Pure: no I/O, no Date from a bare timestamp string.
- [ ] Tests: **every line of the source PDF is a fixture**, plus the reverse — the PDF's own text with one date mangled yields exactly one warning and no data loss.

**Review focus:** that reverse test. A parser that silently drops a line an admin believed they imported is worse than one that refuses. Also confirm it does not mutate its input.

## T6 — `calendarMerge.js`

**Files:** `api/_lib/calendarMerge.js`, `api/_lib/calendarMerge.test.js`.

- [ ] `mergeCalendarSources({ academic, events }, { from, to })` → unified items with `source`, `kind`, `startsAt`, `endsAt`, `allDay`, `href`.
- [ ] `events.starts_at` wins; `parseEventDate` fallback; TBA rows excluded from the grid and returned separately.
- [ ] Span inclusion by overlap, not by day iteration.
- [ ] Tests: span crossing a month boundary, single-day vs range, TBA, an event with neither `starts_at` nor a parseable `date`.

**Review focus:** overlap is by `rangesOverlap`, not by day iteration. Boundary semantics, which the implementation derived and which this plan originally got wrong: the visible range is half-open on `to`, so an item whose only day is `to` is excluded, an item *starting* on `to` is excluded, and an item *ending* on `to` is **included** — it still covers every day before it, and excluding it would hide an exam week that ran most of the month.

## T7 — Data layer + Home copy

**Files:** `src/data/calendar.js`, `src/data/events.js` (modify), `src/data/events.test.js` (modify), `src/pages/Home.jsx:188-193` (modify).

- [ ] Queries and hooks for all three tables; mutations for entries, settings and looks.
- [ ] Fix the TBA bucketing: an event with no `starts_at` and no parseable `date` leaves the upcoming bucket.
- [ ] Rescope the Home empty state to the spec §10 copy.
- [ ] Tests: the existing `src/data/events.test.js:14-56` contract still passes, plus new coverage for the fix.

**Review focus:** Home claims only what Home queries. The pre-existing event tests must still be **present and passing**, but one of them changes expectation on purpose: an unparseable date used to bucket as `upcoming`, which is the bug. That test should be repointed at the new `tba` bucket with a comment saying the old behaviour was wrong — a silently rewritten assertion is the thing to watch for, not the edit itself. Every other test in `src/data/events.test.js` must be untouched and green.

## T8 — Public `/calendar`

**Files:** `src/pages/Calendar.jsx`, all of `src/components/calendar/*`, `src/App.jsx`, `src/components/Navbar.jsx`, `src/components/Footer.jsx`, `src/pages/admin/AdminPageBanners.jsx`, `index.html` (icons).

- [ ] Route, lazy import, inside `<Layout />`. Nav in `Academics` above `Outlines`. Footer link.
- [ ] `usePageBanner('calendar')`, plus the `calendar` key in `PAGES`.
- [ ] Grid, agenda, `NextUpStrip`, legend, day sheet, TBA panel, source filter.
- [ ] Bars span their weeks; today ringed; `+N more` without cell-height shift; agenda default at narrow widths.
- [ ] Grid keyboard navigable.
- [ ] `feature_flags.calendar` off → nav item and route both gone.
- [ ] Add any new icons to `index.html` **alphabetically**.
- [ ] `npm test && npm run lint && npm run build`

**Review focus:** an empty month reads as intentional. Mobile at 360px. Raw hex nowhere in JSX.

## T9 — Admin entries + session

**Files:** `src/pages/admin/AdminCalendar.jsx`, `src/pages/admin/config/academicCalendarConfig.js`, `src/pages/admin/AdminCalendarSession.jsx`, `src/pages/Admin.jsx`, `src/App.jsx`.

- [ ] Entries screen is `AdminResourceManager` unchanged, with `groupField: 'semester'`.
- [ ] `reviewGated: true`, matching `eventsAdminConfig.js:16`.
- [ ] Config uses only field types `src/lib/adminFields.js:46` handles. `remind_days` is `number`.
- [ ] Session screen sets the active session and archives the previous.
- [ ] Four admin tiles, non-owner visible.
- [ ] `npm test && npm run lint && npm run build`

**Review focus:** add, edit **and** delete all work, with delete owner-gated. The user was explicit about this.

## T10 — Admin paste

**Files:** `src/pages/admin/AdminCalendarPaste.jsx`.

- [ ] Textarea → parse → editable preview with a per-row kind dropdown and reminder lead time → commit.
- [ ] Warnings render and are never hidden.
- [ ] Partial failure leaves no half-written set.
- [ ] Bounded insert; no unbounded loop over pasted input.
- [ ] `npm test && npm run lint && npm run build`

**Review focus:** nothing is committed until the admin commits, and a failure part-way through does not leave the calendar in a mixed state.

## T11 — Design Studio

**Files:** `src/pages/admin/AdminCalendarDesign.jsx`, `src/components/calendar/CalendarDesignControls.jsx`.

- [ ] Accents, grid, defaults, page, looks — built on `admin/forms/DesignControls.jsx` primitives, not re-invented.
- [ ] Closed swatch list; Advanced hex falls back to a swatch.
- [ ] Named looks: save, rename, delete, switch active.
- [ ] Live preview against a real month.
- [ ] `npm test && npm run lint && npm run build`

**Review focus:** dark mode survives **every** preset. `themeVars` only emits known properties. No hand-rolled input that duplicates `DesignControls`.

## T12 — Reminder emails

**Files:** `api/_lib/handlers/calendar-reminders.js`, `api/_lib/handlers/calendar-reminders.test.js`, `api/system.js`, `vercel.json`, `api/_lib/emailDesign.js`, `src/pages/admin/AdminEmailTemplates.jsx`, `supabase/migrations/20261009120000_calendar_reminders.sql`, rollback.

- [ ] POST only, `Cache-Control: no-store`, signed via `isWebhookAuthentic` exactly as `email-worker.js:24-31`.
- [ ] `dedupeKey = academic-reminder:<id>:<starts_at>:<email>`. The recipient is **required**: `email_outbox.dedupe_key` is unique and enqueue upserts with `ignoreDuplicates`, so a key without the address collapses the whole batch to one row and one student gets the reminder while the rest silently get nothing.
- [ ] Decide "is today" in `Africa/Lagos` via `Intl.DateTimeFormat` + `formatToParts`, not off the host clock — Vercel runs UTC and the two disagree for five hours a day.
- [ ] Register in `ACTIONS` and add the `vercel.json` rewrite — **no new Vercel function.**
- [ ] `pg_cron` schedule copying `run_email_worker` (`20260929180000_email_outbox.sql:71-95`), and the header note that the schedule is switched on separately after deploy.
- [ ] `academic_reminder` template row, registered in `SYSTEM_EMAILS` so it is designable in the existing email studio.
- [ ] `npm test && npm run lint && npm run build`

**Review focus:** this runs on a schedule and emails real users. `dedupeKey` correctness, auth, and the flag/opt-out checks. Review it twice.

## T13 — Docs + final gate

**Files:** `README.md`, `DESIGN_SYSTEM.md`, `AGENTS.md` (modify).

- [ ] Document the calendar, the studio, the paste flow, and the new `api/_lib` modules.
- [ ] Correct `DESIGN_SYSTEM.md:3` and `:166-170`, which claim there is no dark mode. There is.
- [ ] Full `npm test && npm run lint && npm run build`.
- [ ] State plainly that rendering, dark mode and reminder delivery are **unverified without a real session and Supabase login**.

---

## Definition of done

- [ ] 26 senate rows correct against the source PDF
- [ ] `/calendar` renders month grid ⇄ agenda, filters, next-up, TBA panel
- [ ] Admin can add, edit and delete entries, and paste a whole calendar
- [ ] Studio changes kinds, grid, defaults, page skin and named looks, dark mode intact
- [ ] Reminders enqueue with a dedupe key that cannot double-send
- [ ] `calendar` flag hides the feature without a deploy
- [ ] Home's empty state no longer claims a calendar is empty when it isn't
- [ ] `npm test`, `npm run lint`, `npm run build` all exit 0