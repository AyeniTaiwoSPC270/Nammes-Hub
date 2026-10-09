# Academic Calendar Design

A public calendar page at `/calendar` that merges the senate-approved academic calendar (lectures, exams, registration, breaks, convocation) with the existing departmental events, plus a Design Studio that lets an admin restyle and reconfigure it.

**Status:** approved. **Date:** 2026-10-08. **Plan:** `docs/superpowers/plans/2026-10-08-academic-calendar.md`

Source document: `SENATE-PROPOSED-ACADEMIC-CALENDAR-2026-2027.pdf` (University of Lagos, approved by Senate 30 September 2026).

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| `academic_calendar` rows | The senate's dates, student-relevant only |
| Existing `events` | Departmental events, now carrying real timestamps |
| `/calendar` | Month grid ⇄ agenda, filters, next-up strip, TBA panel |
| Admin entries | Add / edit / delete, owner review-gated like every other resource |
| Admin paste | Parse a whole pasted calendar, review it, commit it |
| Design Studio | Per-kind colour/icon/label, grid behaviour, defaults, page re-skin, named looks |
| Reminder emails | A few days ahead, via the existing outbox and one new `pg_cron` |
| Home empty state | Rescoped so it stops claiming there is nothing on a calendar it never queries |

### Out

- **Timetables, news, CBT exams.** Different tables, different date shapes, different lifecycles.
- **Recurring Senate / Board of Studies / Inaugural Lectures / Results upload.** Staff-only. See §3.4.
- **Faculty targeting.** The Education core-course exam rows stay visible to everyone with a note explaining who they are for. Building per-user faculty filtering for one row is not worth it.
- **Student event submission.** Admin only, as today.
- **Browser push notifications, PDF export, ICS/subscribe feed, a site-wide design studio.**

---

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Data | Senate calendar + `events` | Two domains, two lifecycles, one merged grid |
| Senate dates | `date`, **not** `timestamptz` | Every senate item is all-day. A `timestamptz` means inventing a midnight that never existed and round-tripping it through each viewer's timezone; Nigeria is UTC+1 so anything rendered west of Greenwich shows the event on the wrong day. `date` has no timezone, so the bug is unrepresentable rather than defended against |
| `events.starts_at` | `timestamptz`, nullable | Departmental events genuinely can have a clock time, so this one is honest as a timestamp |
| RLS on new tables | **Owner-only writes, public read** | Matching the current `events` posture, which is narrower than its original definition — see §3.4 |
| `events.date` | **Kept and still rendered** | Existing rows must not change. `starts_at` wins when present; `parseEventDate` (`src/data/events.js:18`) remains the fallback |
| Views | Month grid ⇄ agenda | Planners browse by month, phones read by agenda |
| Staff-only senate rows | **Skipped** | Students cannot act on a Senate meeting |
| Admin entry | Paste **and** row-by-row | One paste replaces ~26 rows; rows handle corrections |
| Sessions | One active, archivable | The app models no session entity anywhere; one row does not need a table |
| Grid | Colour+icon per kind, source filter, multi-day bars, TBA surfaced | An exam week should read at a glance |
| Reminders | Email, per-row lead time | Exam reminders want 7 days, resumption wants 1. A global lead time cannot do both |
| Studio controls | Kinds, grid, defaults, page re-skin, named looks | The email studio is the working precedent for a design surface |
| Admin layout | **Separate routes** | Chosen over a single tabbed page |
| Colour choice | Curated swatches + advanced hex | The swatch list is closed; an off-list hex falls back to a swatch rather than shipping an unreadable calendar |
| Events page | **Kept as-is**, `/calendar` added alongside | Existing photo-led card grid is not replaced |
| Kill switch | `calendar` key in `feature_flags` | Emergency off without a deploy, matching voting/broadcasts/uploads |
| Nav placement | `Academics` group, above `Outlines` | The calendar's main payload is now academic dates. Side effect: it joins the `dataTour: 'nav-academics'` flow |

---

## 3. Data model

### 3.1 `academic_calendar`

```sql
create table public.academic_calendar (
  id text primary key,
  session text not null,
  semester int not null check (semester in (1, 2)),
  title text not null,
  kind text not null check (kind in
    ('lectures','exams','registration','break','convocation','orientation','other')),
  starts_at date,          -- NULL means "to be determined"
  ends_at date,            -- NULL means single day
  note text,               -- '(13 Weeks)', '(Lectures Continue)', 'Faculty of Education only'
  remind_days int check (remind_days is null or remind_days between 0 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A range may not end before it starts. Both columns may be NULL, so this only bites once both
  -- ends are known. The paste parser (T5) must reject a reversed range with a readable message first;
  -- this is the backstop, not the first line of defence.
  constraint academic_calendar_range_ordered
    check (starts_at is null or ends_at is null or ends_at >= starts_at)
);
```

`starts_at` is nullable on purpose: two senate rows print "To be determined". Modelling that as a sentinel date would corrupt every comparison; modelling it as NULL makes "no date yet" a first-class state the UI must handle anyway.

A row with `starts_at IS NULL` is **never** shown in the grid — an undated item has no cell. It appears only in the TBA panel.

Both writable tables carry a `before update` trigger that sets `updated_at`, the same pattern `cbt_touch` uses (`20261002100000_cbt_exams.sql:85-94`). The Design Studio writes whole rows through supabase-js and nothing on the client would remember to bump the timestamp.

### 3.2 `events` additions

```sql
alter table public.events
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add column kind text,
  add column remind_days int check (remind_days is null or remind_days between 0 and 30);
```

All nullable, all additive. Existing rows keep rendering exactly as they do today.

One thing does change, deliberately: `groupEventsByTime` returns a **third** `tba` bucket rather than only `{ upcoming, past }`. See §10.1 — an event with neither `starts_at` nor a parseable `date` used to be filed under `upcoming` and stayed there forever.

`events.kind` is intentionally **not** constrained to the `academic_calendar.kind` vocabulary: an event is not a senate date, and forcing the same set would make the check a lie.

There is no `visible` column. An earlier draft had one, but a `select … using (true)` policy makes it decorative — it would read as a feature while every anon visitor still saw the row. Hiding a row is a policy change, not a column.

### 3.3 Settings and looks

`calendar_settings` is a **singleton row** (`id smallint primary key default 1` with `check (id = 1)`), mirroring the `site_content` pattern (`supabase/history/03b_site_content_created_in_dashboard.sql:4-15`). It holds `active_session`, `active_look_id`, `default_view`, `default_kinds`, `default_sources`, `reminder_enabled`, `reminder_default_days`.

`calendar_looks` mirrors `email_styles`: `id`, `name`, `design jsonb`, `created_at`. This is what gives the studio its named saved looks.

### 3.4 RLS, grants, MFA

`academic_calendar` follows the **current** `events` posture, which is narrower than its original definition: public `select`, but **insert, update and delete are all owner-only**. Insert and update were tightened to owner in `supabase/history/04_...sql:286-294`; delete in `20260929100000_owner_only_deletes.sql:5`. Non-owner admins are not locked out — they go through the existing review queue, which is the `gated` branch of `AdminResourceManager` (`src/components/admin/AdminResourceManager.jsx:86,98`).

`calendar_settings` and `calendar_looks` are public-read, owner-write.

Two grants are easy to forget here. `20260929071000_least_privilege_grants.sql:23` sets `alter default privileges … revoke all on tables from anon`, so **new tables are private to anon until granted by name** — without the explicit grants the calendar renders empty for logged-out visitors while looking correct in the admin. And all three tables must be added to the MFA enforcement list (`20260929150000_admin_mfa_enforcement.sql:24-38`), or they silently skip MFA enforcement.

---

## 4. Seed data — 26 rows

Extracted from the PDF and filtered to student-relevant items.

**Excluded as staff-only (6):** BCOS result considerations (2027-03-23, 2027-08-10), Senate meetings (2027-03-31, 2027-08-25), and all **four** statutory programmes the senate lists as recurring rather than dated — Faculty Board of Studies/Examiners (2nd Wednesday monthly), Inaugural Lectures (1st and 3rd Wednesday monthly), Senate Meeting (last Wednesday monthly), and Uploading of Results (two weeks after examinations).

**Excluded as out of scope (1):** DLI Residential Programme (2027-07-12 → 2027-08-07). A Distance Learning Institute cohort on its own admission track. Easiest to paste back in if NAMMES runs it for its own members.

**Deduplicated (1):** 2027-03-08 resumption appears on both PDF pages. One row.

### First semester (`semester = 1`)

| Dates | Title | Kind | Note |
|---|---|---|---|
| 2026-10-05 | Payment of Fees & Online Registration for Returning Students | registration | |
| 2026-10-19 | Resumption and Commencement of Lectures | lectures | |
| 2026-12-04 | End of Registration of Courses for All Students | registration | |
| **—** | **Orientation Programme for Fresh Students** | orientation | (1 week); date to be announced |
| **—** | **Matriculation Ceremony** | orientation | date to be announced |
| 2026-12-07 → 2026-12-20 | Editing of Registered Courses | registration | (2 weeks) |
| 2026-12-21 → 2027-01-03 | Christmas/New Year Break | break | (2 weeks) |
| 2027-01-04 | Resumption from Christmas/New Year Break | lectures | |
| 2027-01-15 | Lectures End | lectures | (13 weeks) |
| 2027-01-18 → 2027-01-22 | Lecture Free Week / GST Examinations | exams | |
| 2027-01-25 → 2027-02-12 | Undergraduate Examinations in All Faculties | exams | (3 weeks) |
| 2027-02-15 → 2027-02-20 | Examinations in Core Courses, Faculty of Education | exams | (1 week); Faculty of Education only |
| 2027-02-20 | End of First Semester / Opening of Second Semester Registration Portal | registration | |
| 2027-02-22 → 2027-02-26 | 57th Convocation Ceremonies | convocation | (1 week) |
| 2027-02-22 → 2027-03-06 | First Semester Break | break | (2 weeks) |

### Second semester (`semester = 2`)

| Dates | Title | Kind | Note |
|---|---|---|---|
| 2027-02-22 | Online Registration of Courses Commences | registration | |
| 2027-03-08 | Resumption and Commencement of Lectures | lectures | |
| 2027-03-28 | End of Registration of Courses | registration | (5 weeks) |
| 2027-04-05 → 2027-05-02 | Hall and Faculty Week | lectures | (4 weeks); lectures continue |
| 2027-04-12 → 2027-04-25 | Editing of Registered Courses | registration | (2 weeks) |
| 2027-06-04 | Lectures End | lectures | (13 weeks) |
| 2027-06-07 → 2027-06-11 | Lecture Free Week / GST Examinations | exams | (1 week) |
| 2027-06-14 → 2027-07-03 | Undergraduate Examinations in All Faculties | exams | (3 weeks) |
| 2027-07-05 → 2027-07-10 | Examinations in Core Courses, Faculty of Education | exams | (1 week); Faculty of Education only |
| 2027-07-10 | End of Second Semester / Students Depart | lectures | |
| 2027-09-13 | Proposed Date of Resumption, 2027/2028 Session | lectures | |

15 + 11 = **26**.

---

## 5. Pure shared logic — `api/_lib/`

Per `AGENTS.md` these must be dependency-free: no `window`, no Supabase client, no Node built-ins. Each gets a colocated test.

| File | Exports |
|---|---|
| `calendarDates.js` | `toDayKey`, `fromDayKey`, `addDays`, `addMonths`, `monthGrid`, `isSameDay`, `rangesOverlap`, `eachDay` |
| `calendarTheme.js` | `DEFAULT_THEME`, `sanitizeTheme`, `themeVars`, `KIND_ORDER`, `SWATCHES` |
| `calendarPaste.js` | `parseCalendarPaste(text, { session })` → `{ rows, warnings }` |
| `calendarMerge.js` | `mergeCalendarSources({ academic, events }, { from, to })` |

### 5.1 `calendarDates` is timezone-safe by construction

`fromDayKey('2026-10-05')` must build `new Date(2026, 9, 5)` — local time. It must never call `new Date('2026-10-05')`, which is UTC midnight and lands on the previous day for any negative UTC offset. The existing `parseEventDate` has exactly this hazard; this module does not copy it.

### 5.2 The parser handles the real document

Every line of the source PDF is a test fixture. Shapes it must survive:

| Shape | Example from the PDF |
|---|---|
| Single date, trailing asterisk | `Monday, October 5, 2026* Payment of Fees & Online Registration…` |
| Range spanning months, weekday on both ends | `Monday, December 7 - Sunday, December 20, 2026 Editing of Registered Courses (2 weeks)` |
| Range crossing a year | `Monday, December 21, 2026 - Sunday, January 3, 2027 Christmas/New Year break (2 weeks)` |
| No comma after weekday, en-dash separator | `Monday February 22 – Saturday March 6, 2027 First Semester break` |
| Extraction mojibake | `Monday, February 15 � Saturday February 20, 2027 …` — the en-dash survives as U+FFFD and must be normalised to a dash |
| Multi-space column separator | `Friday, December 4, 2026     End of Registration of Courses for all Students` |
| Parenthetical duration | `(13 Weeks)`, `(2 weeks)`, `(Lectures Continue)` → lifted into `note` |
| Undated | `To be determined Orientation Programme for Fresh Students` → `starts_at: null` |

**A line the parser cannot read becomes a `warning`, never a silently dropped row.** A parser that quietly discards a date an admin believed they had imported is worse than one that refuses.

### 5.3 `sanitizeTheme` rules

Every field in `DEFAULT_THEME` has a matching fallback in `sanitizeTheme` — the `AGENTS.md` rule, and the reason a hand-edited row cannot put junk on the projector. Colours resolve against a closed swatch list; a hex outside it falls back to the swatch the kind was seeded with rather than being passed through.

`themeVars` emits only the CSS custom properties `formTheme.js:419` already knows how to apply, so the re-skin stays dark-mode safe.

---

## 6. Public page — `/calendar`

`src/pages/Calendar.jsx`, lazy route inside `<Layout />`, banner from the existing `usePageBanner('calendar')` behind a new `calendar` page key.

Components under `src/components/calendar/`: `MonthGrid`, `AgendaList`, `NextUpStrip`, `CalendarLegend`, `DaySheet`, `TbaPanel`, `SourceFilter`.

- **Month grid** — multi-day entries render as bars spanning their weeks rather than repeating on every day. Today gets a ring. A cell shows `maxPerDay` items then `+N more` without changing cell height.
- **Agenda** — chronological, grouped by month. This is the default at narrow widths.
- **NextUpStrip** — the next few upcoming items above the grid. This is the thing `/events` structurally cannot show: a student opening the app during lectures sees "Lectures end 15 Jan", not an empty state.
- **TbaPanel** — the two undated rows, always reachable.
- **Source filter** — Events / Academic pills.
- Items sourced from `events` link to `/events/:id`. Academic items have no detail page in v1.
- A month with nothing in it says so plainly rather than looking broken.

When `feature_flags.calendar` is off, both the nav item and the route disappear.

---

## 7. Admin — separate routes

| Route | Purpose |
|---|---|
| `/admin/calendar?tab=dates` | Entries. Grouped by semester. Add/edit/delete. `reviewGated` like `eventsAdminConfig.js:16` |
| `/admin/calendar?tab=paste` | Paste, parse, preview, correct the kind and reminder lead time per row, commit |
| `/admin/calendar?tab=design` | Design Studio |
| `/admin/calendar?tab=session` | Active session, archive the previous one |

**Amended 2026-10-09.** These were four separate routes and are now four tabs on one route behind one Admin →
Calendar tile. The tab is in the URL so it survives a refresh and can be bookmarked; an unrecognised `?tab=` falls
back to `dates`. The list is `CALENDAR_TABS` in `src/lib/adminCalendarTabs.js`, and the three non-default bodies
are `React.lazy` — the Design Studio pulls the whole control set plus a live grid, and an admin who only edits
dates should not pay for it.

The entries screen reuses `AdminResourceManager` unchanged. Its config uses only field types `src/lib/adminFields.js:46` already handles.

The paste screen must show its warnings and must not half-write on partial failure.

---

## 8. Design Studio

Modeled on the email studio: a pure `sanitizeTheme` in `api/_lib/`, controls built from the existing `src/components/admin/forms/DesignControls.jsx` primitives (`ControlSection`, `Slider`, `Segmented`, `ToggleIcon`) rather than re-inventing them, presets, and named looks backed by `calendar_looks`.

- **Accents** — per kind: label, icon, colour. Curated swatches mapped to existing tokens (`brand`, `brand-orange`, `success`, `warning`, `danger`, `info`, `muted`, `ink`), with an **Advanced** disclosure for a hex field.
- **Grid** — week start (Mon/Sun), density, weekends on/off, items per day before `+N more`.
- **Defaults** — landing view, kinds and sources pre-enabled.
- **Page** — accent, surface, radius, font.
- **Looks** — save, rename, delete, switch active.

Re-skinning uses the CSS-variable approach from `src/lib/formTheme.js:419`, applied to a wrapper element. This is the only page-level re-skin precedent in the codebase and it is dark-mode safe, which matters because the app **does** have dark mode — `DESIGN_SYSTEM.md:3` and `:166-170` still claim it does not, and T13 corrects that.

---

## 9. Reminder emails

- A new `academic_reminder` row in `email_templates`, registered in `SYSTEM_EMAILS` (`api/_lib/emailDesign.js:340`) so it is designable in the **existing** email studio rather than a parallel surface.
- A new `api/_lib/handlers/calendar-reminders.js`, registered in the `ACTIONS` map at `api/system.js:7`. **No new Vercel function** — the repo has a deliberate function budget.
- A new `pg_cron` schedule copying `run_email_worker` (`20260929180000_email_outbox.sql:71-95`) exactly: Vault secret, HMAC over `"<ts>.<table>.<key>"`, `net.http_post` to a signed rewrite.
- `dedupeKey` = `academic-reminder:<id>:<starts_at>:<email>` — **the recipient is part of the key, and it has to be.** `email_outbox.dedupe_key` is `unique` (`20260929180000_email_outbox.sql:13`) and `enqueueEmails` upserts with `ignoreDuplicates: true`, so a key without the address would collide across every member: the batch would collapse to a single row, one student would get the exam reminder and the rest would silently get nothing, and `queued` would still report success. Every other multi-recipient producer in the repo already appends the address — `new-content:<table>:<id>:<email>` (`api/webhook-new-content.js:59`), `broadcast:<batchId>:<email>` (`api/send-broadcast.js:145`).
- Skips rows with `starts_at IS NULL`, rows already past, rows with `remind_days IS NULL`, and rows outside the active session. Honours `calendar_settings.reminder_enabled`.
- Honours `feature_flags.calendar` and `profiles.email_notifications_enabled` via `get_notification_recipients()`.

### 9.1 "Is today" is decided in Africa/Lagos, not on the host clock

`starts_at` is a `date` with no zone, so "the reminder day" has to be anchored somewhere definite. Vercel runs UTC and the audience is in UTC+1, which means the two disagree for five hours a day — a tick at 23:30 UTC is already tomorrow in Lagos. Reading the host clock would send exam reminders a day early for part of every day.

So today is read out of an `Intl.DateTimeFormat` pinned to `timeZone: 'Africa/Lagos'` via `formatToParts`, the lead time is subtracted as wall-clock day arithmetic (which cannot drift across a month end or a DST change), and the two are compared as day-key strings. Going the other way for display — turning a `starts_at` into readable text — uses UTC, the one zone under which a y/m/d tuple is that y/m/d; handing a local-midnight `Date` to a Lagos formatter prints yesterday for any host east of Greenwich.

---

## 10. Home page

`src/pages/Home.jsx:188-193` currently reads *"Nothing on the calendar right now. Past events are still on the events page."* That was loose before — no calendar page existed. After this ships it becomes false: Home queries only `events`, so a week with no departmental events but lectures running would print that sentence while the calendar is full.

The fix is not rewording. It is **scoping the sentence to what Home actually knows**:

> **No upcoming events**
> Lectures, exams and registration dates are on the calendar.

Home stays events-only. Surfacing the next lecture on Home is a one-line reuse of `NextUpStrip` and is explicitly deferred.

### 10.1 The TBA bucketing fix

`groupEventsByTime` (`src/data/events.js:30-34`) buckets an **unparseable date as upcoming**. An event with `date = 'TBA'` therefore sits in Home's upcoming list forever and never scrolls away — and once real date columns exist, an event with `starts_at = null` and no parseable `date` should not be pinned there at all. Those leave the upcoming bucket and surface in the TBA panel instead.

The existing tested contract in `src/data/events.test.js:14-56` had to change, because an unparseable date filing itself under `upcoming` **is** the bug. That one test is repointed at the new `tba` bucket with a comment recording that the old behaviour was wrong; every other assertion in the file stays as it was.

---

## 11. Tests

| File | Covers |
|---|---|
| `api/_lib/calendarDates.test.js` | Month and year boundaries, DST, no day drift, week start |
| `api/_lib/calendarTheme.test.js` | Defaults on missing fields, hex rejection, `themeVars` output |
| `api/_lib/calendarPaste.test.js` | Every shape in §5.2, TBAs, warnings never silent |
| `api/_lib/calendarMerge.test.js` | Spans across a month boundary, `starts_at` precedence, TBA exclusion |

New icons must be added to `icon_names=` in `index.html` **in alphabetical order** or `src/lib/iconFont.test.js:44-47` fails and the glyph silently renders as text. Likely additions: `school`, `edit_note`, `beach_access`, `event_note`. Already loaded: `palette`, `tune`, `event`, `assignment`, `groups`, `workspace_premium`, `calendar_month`.

---

## 12. Risks

1. **The parser is the only genuinely risky component.** If paste cannot read the real document, the admin flow is theatre. Every real line becomes a fixture.
2. **MFA list.** `academic_calendar` must be added to `20260929150000_admin_mfa_enforcement.sql:30` or it skips MFA enforcement.
3. **Unverifiable without a session.** No Supabase login and no real browser here. Calendar rendering, dark mode across presets, and reminder delivery are unverified until someone runs a real session. This will be stated plainly at the end rather than claimed as working.

## 13. Pre-existing bugs noted, not fixed

Both are real and both are out of scope. Recorded here so they are not lost.

- `page_banners` has no `curriculum` row, so `updatePageBanner` matches zero rows and that page's title/subtitle edits silently do nothing (`src/pages/admin/AdminPageBanners.jsx:11-26`).
- `outlines.past_questions_name` and `lecturer_notes_name` are read by `src/lib/outlinePdf.js:165-166`, rendered by `OutlineDetail.jsx:128,139` and edited by `outlinesAdminConfig.js:29,31`, but have **no DDL anywhere** — they were added through the dashboard.