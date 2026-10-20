# Calendar ICS Feed Design

A public, unauthenticated `.ics` feed at `/api/calendar-ics` that carries the active session's senate dates and the
departmental `events`, so a student can subscribe once and get exam and resumption dates in the calendar app they
already check.

**Status:** draft. **Date:** 2026-10-17. **Plan:** none yet.

Supersedes the line in `docs/superpowers/specs/2026-10-08-academic-calendar-design.md` §1 that puts "ICS/subscribe
feed" out of scope. That exclusion was about the first build; the data model it produced is what makes this cheap.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| `api/_lib/calendarIcs.js` | The **pure** builder: rows in, a valid VCALENDAR string out |
| `api/_lib/handlers/calendar-ics.js` | Reads Supabase, calls the builder, sets headers |
| `api/system.js` action + `vercel.json` rewrite | The one public entry point (`/api/calendar-ics`), riding an existing function |

The public URL is the part the spec is about, and it is `/api/calendar-ics`. The *deployment* entry is
`/api/system?action=calendar-ics`: the Hobby plan allows twelve serverless functions and all twelve are taken, which
is also why `calendar-reminders` has no file of its own. A thirteenth `api/calendar-ics.js` would displace a working
function to serve one read-only GET.
| `/calendar` | An "Add to your calendar" control with the URL and copy/subscribe actions |
| Tests | The builder's date, escaping and folding rules; the handler's headers and kill switch |

### Out

- **Writes of any kind.** The feed is read-only; editing stays on `/admin/calendar`.
- **A database change.** No new table, no new column, no migration. If this spec needs DDL, it has stopped being the
  cheap version.
- **Per-student filtering.** No "only my level", no faculty targeting. A subscribed calendar is a dataset, not a
  screen, and there is no account on a phone that joins with a code.
- **Browser push / web notifications.** The email reminders already cover "tell me".
- **Google Calendar API integration.** A subscribe URL works with every client; an OAuth app is a different project.
- **`VALIDITY`/recurrence rules.** Every row is one range; `RRULE` would misrepresent a calendar that is edited by
  hand each session.

---

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Transport | One serverless endpoint returning `text/calendar; charset=utf-8` | A downloadable file cannot update itself, which is the entire point of subscribing. A stable URL is the feature |
| Builder location | `api/_lib/calendarIcs.js`, pure | Shared-rule file: no Supabase, no `window`, no Node built-ins, so the same function can back a future client-side "export" button |
| Rows included | Active session's `academic_calendar` + all `events` | Matches what `/calendar` shows, so the feed cannot disagree with the page. A feed is not filtered by the studio's view defaults |
| Senate dates | `DTSTART;VALUE=DATE` from the stored `date` **string** | `academic_calendar.starts_at` is a `date`; turning it into a `Date` and back is how a day lands on the wrong side of midnight. The builder formats `YYYY-MM-DD` → `YYYYMMDD` textually, so no timezone can enter |
| Undated rows | **Omitted** | `starts_at IS NULL` means "to be determined". An all-day event with an invented date is a lie that stays in someone's phone for months |
| Departmental events | `DTSTART` in **UTC** (`…Z`) from `starts_at` | `events.starts_at` is a real instant (`timestamptz`); UTC is the one representation every client agrees on without a `VTIMEZONE` block |
| Multi-day rows | `DTEND` = last day **+ 1** | `DTEND` is exclusive in RFC 5545. A seminar on the 5th–7th ends `20261008` |
| Single-day rows | `DTEND` = the next day, explicit | Omitted `DTEND` is legal but client behaviour for all-day items is inconsistent; the explicit exclusive end is one code path for one and many days |
| Event identity | `academic-<id>@nammeshub.com.ng`, `event-<id>@nammeshub.com.ng` | The `id` is the primary key, so an edited title updates the subscriber's copy instead of adding a second entry. A generated UID would duplicate every row on every fetch |
| Revision marker | `LAST-MODIFIED` from `academic_calendar.updated_at` where present | The column and its trigger already exist. `events` has only `created_at`, so its rows carry `DTSTAMP` alone — see §7 |
| `SEQUENCE` | Fixed `0` | Nothing here is a rescheduled meeting; `LAST-MODIFIED` is enough for a new revision, and a wrong `SEQUENCE` is more disruptive than a missing one |
| Past rows | **Included** | A whole-year subscription that silently drops last week's exam looks broken to the student who is checking whether it was last week |
| Kill switch | `feature_flags.calendar` off → **404, `Cache-Control: no-store`** | A valid-but-empty feed would wipe every subscriber's dates. A 404 stops publishing; clients keep their last copy, which is the least destructive way to be "off" |
| Auth | None | The rows are already `select … using (true)` for anon. Adding a token to a feed URL breaks subscribing on every client that hides the URL |
| Caching | `public, max-age=300, stale-while-revalidate=86400` | Subscribers refresh on their own schedule; five minutes bounds how long a corrected exam date stays wrong, and the day of stale-while-revalidate keeps a cold Supabase from making the feed fail |
| `ETag` / `304` | Deferred | Worth doing once the feed exists and is observed; not needed to ship a correct one |

---

## 3. Endpoint contract

```
GET /api/calendar-ics
```

- `200` — `Content-Type: text/calendar; charset=utf-8`, body is one `BEGIN:VCALENDAR … END:VCALENDAR`.
- `404` — the `calendar` feature flag is off. `Cache-Control: no-store`, no body requirements.
- `405` — anything but `GET` or `HEAD`.
- `500` — Supabase read failed. **Never** return a partial calendar: a truncated feed makes clients delete the events
  that did not make it. Fail with no body and `Cache-Control: no-store`; the client keeps its copy.

No query parameters in v1. A `?level=` or `?kind=` would be a filter that can silently change what a student already
has, and no client UI exists to explain it.

`HEAD` returns the same headers with no body, so a health check can prove the feed is alive without downloading it.

---

## 4. What is published

### 4.1 Senate dates

`academic_calendar` rows for `calendar_settings.active_session` — the same value the page reads, so a session staged
for next year does not leak in early.

A row becomes one event:

| Field | From |
|---|---|
| `UID` | `academic-<id>@nammeshub.com.ng` |
| `SUMMARY` | `title` |
| `DESCRIPTION` | `note`, when present |
| `DTSTART;VALUE=DATE` | `starts_at`, textual `YYYYMMDD` |
| `DTEND;VALUE=DATE` | `(ends_at ?? starts_at) + 1 day`, textual |
| `LAST-MODIFIED` | `updated_at`, as UTC `…Z` |
| `TRANSP` | `TRANSPARENT` — a lecture is not a meeting that blocks a room |
| `CATEGORIES` | `kind`, so clients that support categories can colour it |

`starts_at IS NULL` → the row is skipped. `ends_at` before `starts_at` cannot reach here (the table's check
constraint), and the builder still never trusts it: it uses `max(starts_at, ends_at)` for `DTEND`.

### 4.2 Departmental events

`events` rows the calendar can place: `starts_at` non-null, **or** `starts_at` null with a `date` that
`parseEventDate` (`src/data/events.js`) can read. That is the same fallback the page uses, reused rather than
re-implemented — one answer to "what day is this event".

- `starts_at` present → timed event in UTC; `DTEND` from `ends_at` when present, otherwise the start plus one hour
  (clients dislike a zero-length timed event, and "one hour" is a display default, not a claim about the event).
- `starts_at` absent, `date` parseable → all-day event on that day, `DTEND` + 1.
- Both absent / unparseable → **omitted**, the same rows the calendar files under `tba`.

`SUMMARY` is `title`, `DESCRIPTION` is `description` when present, `LOCATION` is `meta` when present (that is where
the current cards put the venue). `UID` is `event-<id>@…`.

---

## 5. Format rules

These are the rules that make the difference between a file a client accepts and one it quietly drops.

1. **Line endings are CRLF.** Every content line, including the last.
2. **Fold at 75 octets, not characters**, with a single space starting the continuation line. A multi-byte character
   must not be split — fold on a character boundary at or before the octet budget. Summary text here is UTF-8 (the
   site uses `·`, `–`, `’`), so this is not hypothetical.
3. **Escape** `\` → `\\`, `;` → `\;`, `,` → `\,`, and newlines → `\n` in `SUMMARY`, `DESCRIPTION`, `LOCATION` and
   `CATEGORIES`. A title like "Matriculation, Main Auditorium" must not end the property early.
4. **No `VTIMEZONE`.** All-day values are dates and timed values are UTC, so there is no local time to describe.
   `X-WR-TIMEZONE:Africa/Lagos` is included as a hint for clients that display one, not as a conversion.
5. **Header block**: `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//NAMMES Hub//Academic Calendar//EN`,
   `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, `X-WR-CALNAME:NAMMES Hub — Academic Calendar`,
   `X-WR-TIMEZONE:Africa/Lagos`, `REFRESH-INTERVAL;VALUE=DURATION:PT6H`.
6. **Empty is valid.** A session with no dated rows still returns a well-formed calendar with no `VEVENT`s.
7. **No `CREATED`.** Nothing needs it and a changing value makes every fetch look like a revision.

---

## 6. The `/calendar` surface

The feed is useless if nobody can find the URL on a phone.

- A secondary button in the calendar's existing header area: **"Add to your calendar"**.
- It opens a small panel (not a new route) with:
  - the subscribe URL, selectable, with a Copy button;
  - a `webcal://` variant for iOS/macOS (same URL, different scheme);
  - one line naming Outlook and Google Calendar as "Add calendar from URL";
  - a `.ics` download link for someone who does not want a subscription — the same endpoint with
    `Content-Disposition: attachment` supplied by a second, tiny handler path, or a client-side blob built from the
    same response. Prefer the client-side blob: it adds no endpoint.
- It obeys the `calendar` flag by not rendering — the whole page is already gated, so this is automatic.
- `aria-label` on the copy button that says what was copied, and a visible "Copied" state. A copy button that does
  nothing visible is the same defect the quiz seat list had.

No link is added to `index.html` as `<link rel="alternate">` in v1: it advertises the feed to feed readers before
anyone has decided the URL is permanent.

---

## 7. Why `events` has no `LAST-MODIFIED`

`academic_calendar` has `updated_at` with a trigger. `events` does not — its DDL in
`supabase/history/01_2026-07-24_to_2026-09-03.sql` ends at `created_at`, and the calendar migration only added
`starts_at`, `ends_at`, `kind` and `remind_days`.

Two options were considered:

1. Add `updated_at` to `events` in this change. Rejected: it drags a migration and a trigger into a feed, and the
   spec's own scope says "no DDL".
2. Emit `DTSTAMP` only for events. Chosen. `DTSTAMP` is required by RFC 5545 anyway, and clients that track revisions
   compare the event's content by `UID`. A relocated event will still replace the old one; it just may need the
   client's next periodic refresh rather than an immediate one.

Recorded so the next reader does not "fix" the missing `LAST-MODIFIED` by reaching for `created_at`, which would
claim every event is older than it is.

---

## 8. Failure modes and abuse

| Situation | Behaviour |
|---|---|
| Supabase unreachable | `500`, `no-store`, no body. Clients keep their last copy |
| Flag off | `404`, `no-store`. Same reason |
| Row with a reversed range | Cannot exist (table check); builder clamps `DTEND` to `starts_at + 1` anyway |
| Title with a newline (from paste) | Escaped as `\n`, never a new content line |
| Someone polls the URL in a loop | Five-minute edge cache absorbs it; no database writes to amplify. If it becomes a problem, a rate limit belongs at the edge, not in the handler |
| `events` grows past a few hundred | Response is linear (~300 bytes per event); 500 events is ~150 KB, still one request a day per subscriber. No pagination |

---

## 9. Tests

Pure builder — `api/_lib/calendarIcs.test.js`:

1. **A senate date is the same day string it was stored as.** Assert `DTSTART;VALUE=DATE:20261005` comes out for
   `"2026-10-05"`, and that the builder never constructs a `Date` for it (the assertion is the absence of `Z` and of
   a time component; a test that sets `TZ` is not reliable on every host).
2. **A TBA row produces no `VEVENT`** but the feed is still well-formed.
3. **A multi-day row's `DTEND` is exclusive** — 5th–7th → `20261008`.
4. **A single-day row's `DTEND` is the next day.**
5. **A timed event is UTC** and its `DTEND` is `ends_at`, or start + 1h when absent.
6. **Escaping**: a title containing `, ; \` and a newline produces one `SUMMARY` line with `\,`, `\;`, `\\`, `\n`.
7. **Folding**: a 200-character summary is split at ≤75 octets per line, continuations start with a space, and a
   multi-byte character is never cut in half (assert the joined, unfolded value equals the input).
8. **UIDs are stable** across two builds of the same rows.
9. **CRLF everywhere**, and the body ends with `END:VCALENDAR\r\n`.
10. **Empty input is a valid calendar**, not an empty string.

Handler — `api/_lib/handlers/calendar-ics.test.js`, with the usual fake client:

11. Sets `text/calendar; charset=utf-8` and the cache header on `200`.
12. Returns `404` with `no-store` when the flag row is disabled.
13. Returns `405` for `POST`; `HEAD` returns headers and no body.
14. A Supabase error returns `500` with no `BEGIN:VCALENDAR`.

Page surface — a source scan in the style of `src/pages/playSeatResume.test.js`:

15. `/calendar` renders the subscribe control and points it at `/api/calendar-ics`.
16. The client-side download builds from the same endpoint rather than a second URL.

---

## 10. Rollout

1. Builder + tests, no endpoint. Reviewable on its own.
2. Handler + entry point, flag-gated off in the test environment? No — the feed is read-only, so it can ship dark only
   in the sense that nothing links to it yet.
3. The `/calendar` control, once the URL is confirmed working in Apple Calendar, Google Calendar and Outlook on a
   real phone.
4. Nothing to migrate, nothing to backfill, no rows to seed.

The one irreversible-ish act is publishing the URL: once students subscribe, the URL must keep working. That argues
for `/api/calendar-ics` (stable, ours) over any host that might change.

---

## 11. Open questions

1. **Canonical host** — `www.nammeshub.com.ng` (the site's canonical) or the apex? Whichever is chosen must not
   redirect: some calendar clients drop a subscription that answers with a 301 to a different host.
2. **Events in the feed at all?** This spec says yes, because the page merges them and a student who subscribes wants
   the departmental seminar too. The alternative — senate dates only — is a smaller feed and a simpler promise.
3. **Past events**: included here so a student can check what happened. If the feed is meant to be forward-looking,
   filtering to `>= today` in Lagos is one line, but it must then also stop publishing a just-finished exam the
   morning after.
4. **`REFRESH-INTERVAL`**: 6h is a hint only; some clients ignore it. No code depends on it.
