# Home "Next up" Design

Home answers "what is coming up" from `events` alone, so during a week of lectures and exams with no departmental
event it says there is nothing on. This puts the calendar's own Next-up strip on Home, behind an admin opt-in, using
the same merge and the same component the calendar page already draws.

**Status:** draft. **Date:** 2026-10-17. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| `calendar_settings.next_up_on_home` | One additive boolean, default `false`, with the column grant extended |
| `CalendarDesignControls` | A toggle, next to the existing "Next up" control |
| `src/lib/calendarNextUp.js` | The `endsAt >= today` + limit rule, extracted from two copies |
| `src/pages/Home.jsx` | A strip above "Upcoming Events", using `NextUpStrip` and `mergeCalendarSources` |

### Out

- **Opportunity deadlines in the strip.** See §3.
- **Replacing the "Upcoming Events" block.** It is content-studio controlled (`content_settings.events_on_home`) and
  stays exactly as it is.
- **A new card renderer.** The strip must be `NextUpStrip`; a fifth calendar card is the regression the content
  studio already paid for once (`ContentCards.jsx`).
- **A new default.** The column starts `false`; Home changes for nobody until an admin turns it on.
- **Server-side "today".** The page uses the browser's day, as `/calendar` already does — see §6.

---

## 2. What Home says today

`src/pages/Home.jsx:56` builds `previewEvents` from `groupEventsByTime(...).upcoming.slice(0, 3)` — the `events` table
only. The empty-state copy was already rescoped for that (`Home.jsx:178`: "Scoped to what Home knows. Home queries only
`events`, so the old sentence claimed a calendar…"), which is honest but leaves the hole:

- Tuesday of exam week, no seminar booked → "No upcoming events", while `/calendar` is showing an exam block.
- The same student is told there is nothing to do on the page they open first.

`NextUpStrip` (`src/components/calendar/NextUpStrip.jsx`) already solves the presentation, including the
"Happening now" label for a multi-week block and the event links. `mergeCalendarSources`
(`api/_lib/calendarMerge.js:195`) already turns both tables into one ordered list. This spec is mostly wiring.

---

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Renderer | Reuse `NextUpStrip` | One calendar card, one place its date logic can be wrong. The component is pure props |
| Opt-in | `calendar_settings.next_up_on_home`, default **false** | The content studio's rule: Home opts in per block, because Home also carries awards, opportunities and news. An admin who restyles the calendar should not wake up to a new band on Home |
| Control location | Calendar Design Studio, beside the existing `theme.highlight.nextUp` | Both answer "show next up"; hiding one in `/admin/banners` would make the pair impossible to reason about |
| Independence from the page strip | Separate setting | `theme.highlight.nextUp` is a control for `/calendar`. Coupling them means turning the calendar strip off silently removes a Home block, and vice versa |
| Kill switch | `useCalendarFlag()` | A flag that hides `/calendar` while Home publishes its dates is not a kill switch |
| Empty behaviour | Render **nothing** | Unlike "Upcoming Events", this block is additive; an empty "Next up" heading is noise. The events block is where "nothing on" is said |
| Item cap | 4 (the calendar's `NEXT_UP_COUNT`) | Same strip, same grid, and Home has more blocks below it |
| Opportunities | **Out of scope** | `NextUpStrip` colours by `--cal-<kind>` and labels by start date; a deadline has neither. A second block is a second feature, not a fifth item |
| Duplicated rule | Extract to `src/lib/calendarNextUp.js` | `Calendar.jsx:134` and `AdminCalendarDesign.jsx:209` currently hold the same one-line filter; Home would be the third copy |

---

## 4. The setting

```sql
alter table public.calendar_settings
  add column if not exists next_up_on_home boolean not null default false;

-- The update grant on this table is column-scoped (20261009090000_calendar.sql:159-161), so a new
-- column is not writable until it is named here. Forgetting this is a save that changes nothing.
grant update (next_up_on_home) on public.calendar_settings to authenticated;
```

Three client-side allow-lists must grow with it, or the column is writable but unreachable:

1. `SETTINGS_FIELDS` in `src/data/calendar.js:16` (the `cleanPatch` allow-list — a field not in it is silently dropped).
2. `src/data/calendar.js`'s settings query already reads `*`, so no read change.
3. The Design Studio's settings form, which must show the toggle's current value from the settings row rather than from
   the saved look.

`calendar_settings` is already in the MFA restrictive loop; nothing about that changes.

---

## 5. The strip

```jsx
// Only when the admin opted in and the calendar itself is live.
const showNextUp = calendarEnabled && Boolean(settingsQuery.data?.next_up_on_home)
```

- Queries: `useEventsQuery()` is already on Home. `useAcademicCalendarQuery(activeSession, enabled)` gains
  `enabled = showNextUp`, so the flag being off costs no request — Home's payload for every visitor who never opted in
  stays exactly as it is today.
- Range: `from = todayKey`, `to = toDayKey(addMonths(today, 12))`. A year is enough to answer "next up"; the calendar
  page uses a padded range around its own month for a different question.
- Items: `selectNextUp(merged.items, todayKey, { enabled: showNextUp, limit: 4 })`, where the helper is
  `items.filter((item) => item.endsAt >= todayKey).slice(0, limit)` — the exact rule both existing call sites use,
  including the comment about a three-week block that began last week.
- Placement: directly above the "Upcoming Events" section, in the same container width, so the page reads
  "what is happening" then "what is booked".

The helper does **not** decide whether the strip is enabled — that is the setting and the flag. Keeping the two apart
means the component can be tested with plain arrays.

---

## 6. "Today" on the client

`/calendar` reads `toDayKey(new Date())` from the browser clock (`Calendar.jsx:53,62`), with a comment explaining why
not `toISOString()`. Home does the same, because it renders in the same browser and two blocks on the same site
disagreeing about the date would be worse than the timezone edge case.

The server-side Lagos day (`Africa/Lagos` via `Intl.DateTimeFormat`, used by `calendar-reminders`) stays on the server.
A student abroad seeing their own "today" is the existing behaviour of the calendar page, not a new decision.

---

## 7. Tests

`src/lib/calendarNextUp.test.js`:

1. Items ending after today are kept, ordered as the merge produced them.
2. An item that ended yesterday is dropped; one that ends today is kept ("Happening now" for a range).
3. The limit is applied after filtering, not before.
4. `enabled: false` returns `[]` regardless of items.

Source scans, in the existing style:

5. Home imports `NextUpStrip` and `mergeCalendarSources`, and contains no new calendar card markup (no
   `--cal-` style block, no `NextUpStrip` copy).
6. Home gates the strip on `useCalendarFlag()` **and** `next_up_on_home`; a source scan is the only cheap way to prove
   two conditions are both present.
7. The academic query is passed `enabled`, so an opt-out visitor issues no calendar request.
8. `SETTINGS_FIELDS` includes `next_up_on_home` (the save path is where a new setting silently dies).

Verification for the SQL is the rebuild rehearsal: add the column and the grant to a scratch database, flip the
toggle, save, and read the row back.

---

## 8. Rollout

1. Migration (column + grant), then `SETTINGS_FIELDS` and the studio toggle.
2. Extract `selectNextUp` and switch `/calendar` and the studio to it — a pure refactor with their existing tests
   covering it.
3. Home's strip, still dark because the default is `false`.
4. An admin turns it on and checks a real phone: the strip appears with the exam block, and disappears when the
   `calendar` flag is turned off.

---

## 9. Open questions

1. **Should the toggle default to true for the two weeks around exams?** Tempting, and rejected: a date-dependent
   default is a setting nobody can reason about. The admin flips it.
2. **Does the strip need its own copy when the events block also shows the same event?** The merge de-duplicates
   nothing. If an event is both "next up" and in "Upcoming Events", it appears twice on Home. Filtering the events
   block's list against the strip's ids is the fix, but it changes a content-studio block's contents — worth deciding
   explicitly rather than by accident.
