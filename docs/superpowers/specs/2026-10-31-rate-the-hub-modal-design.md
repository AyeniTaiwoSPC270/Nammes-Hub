# Rate the Hub — design

Date: 2026-10-31
Status: agreed, ready to plan

## Goal

A visitor can rate the Hub and say why, in one screen, whether or not they have an account — and the
admin can read those answers next to everything else they already read. No new admin route.

## Decisions

| Question | Decision |
|---|---|
| Surface | A modal, not a page: five stars, category chips, optional message |
| Trigger | Shown once automatically **and** reopenable from the footer and the Account page |
| Re-ask rule | Rated → never auto-asked again on that device. Dismissed without rating → auto-ask again after 90 days |
| Who sees it | Signed-in members and anonymous visitors; `user_id` null when signed out |
| Where it stores | New table `hub_feedback` |
| How it submits | `api/submit-public.js`, new `type: 'feedback'` — Turnstile and rate limit come free |
| Who reads it | Analytics KPIs for the numbers, the Messages inbox (Feedback filter) for the rows |
| Security | **No anon insert at all.** Admins read and update, enforced in SQL |
| Kill switch | `feature_flags` key `feedback`, seeded **off** |

## Data

```
hub_feedback (
  id          uuid primary key default gen_random_uuid(),
  rating      smallint not null check (rating between 1 and 5),
  category    text check (category in ('design','content','speed','bugs','other')),
  message     text check (length(message) <= 1000),
  user_id     uuid references auth.users(id) on delete set null,
  page_path   text,
  created_at  timestamptz not null default now(),
  handled     boolean not null default false,
  handled_at  timestamptz,
  handled_by  uuid references auth.users(id) on delete set null
)
```

RLS enabled with **no insert policy for `anon` or `authenticated`** — the server's service key is
the only writer, which is the same posture `contact_messages` was deliberately moved to. One
`select` and one `update` policy for admins (`is_admin()`), and matching grants. There is no
anonymous read: an average is computed for the dashboard by `admin_analytics`, which is
`security definer` and re-checks `is_admin()` itself.

`category` and `message` are nullable; `rating` never is. A `feature_flags` row with
`key = 'feedback'`, seeded off.

**No retention purge.** Contact messages age out because they are a reply-based inbox; the average
over time is the entire point of a rating table, so `purge_old_data()` is left alone.

## Server

`api/submit-public.js` grows a `type: 'feedback'` branch:

- `validateFeedback` in `api/_lib/publicSubmission.js`: `rating` is an integer 1–5, `category` is
  one of the five or absent, `message` is at most 1000 characters and trimmed, `page_path` starts
  with `/` and is at most 300 characters.
- The `feedback` flag is read with the same per-key query the handler already runs; off → `503`
  before any write.
- **Identity is resolved, never trusted.** If the client sends its access token, the server calls
  `auth.getUser(token)` and stores the resulting id; no token, or an invalid one, stores `null`.
  The feedback itself is still accepted either way — a stale token must not swallow a rating.
- The client never sends `user_id`.

## The modal

New `src/components/FeedbackModal.jsx`, opened by `src/lib/useFeedbackPrompt.js`.

**Fields.** Five stars (a `star` glyph row, already in `icon_names=`), five category chips —
Design, Content, Speed, Bugs, Other — and a message box that appears once a star is tapped. The
message is optional; a star alone is a complete answer. Category is optional too, so nobody is
blocked from rating quickly. Submit sends `page_path` from `window.location.pathname`.

**Entry points.** The auto prompt, a "Rate the Hub" item in the footer, and one on the Account
page. All three are hidden when the flag is off.

**Remembering — all of it in `src/lib/feedbackStorage.js`, every access inside `try/catch`:**

- `shownAt` — when the auto prompt last appeared.
- `ratedAt` — set the moment a rating is submitted, permanently.

Auto-prompt rules, evaluated on mount: flag off → nothing. `ratedAt` set → nothing, ever again on
this device. Otherwise show if `shownAt` is absent, or if it is more than 90 days old (they
dismissed without rating, so it is fair to ask again). A dismissal writes `shownAt` if it was not
already written by showing it. If storage throws — private mode, quota — the modal simply never
auto-appears; the footer and Account links still work.

## Where the admin reads it

**Analytics** — `admin_analytics()` gains a `feedback` KPI: average rating (one decimal), response
count, and `previous` count for the comparison, in the same shape as the other KPIs. The
dashboard's existing `analytics` flag gates the whole function, so no new guard is needed.

**Ordering with feature 1.** This spec and the Report-a-problem spec both re-declare
`admin_analytics()` and `admin_inbox()`. Whichever migration runs last replaces the other outright,
so it must carry both features' changes — the implementation plan decides which one that is.

**Messages inbox** — the filter becomes **All / Messages / Reports / Feedback**. Feedback rows show
the stars, the category badge, the message, the path and when it arrived, with the same `handled`
tick. `admin_inbox()` gains a `feedback` union source (30-day window, ten per category, like every
other source) and `INBOX_CATEGORIES` gets a `feedback` entry — icon `star`, href
`/admin/messages?filter=feedback`. `star` is already in `icon_names=`.

## Failure modes

| Failure | Behaviour |
|---|---|
| Flag off | No modal, no links, server answers 503 |
| Turnstile missing/invalid | Existing behaviour, unchanged |
| Rating out of range or 1001-char message | 400 from `validateFeedback` |
| Storage unavailable | Auto prompt never fires; manual links still open the modal |
| Two devices from one person | Two rows — deduplication is not attempted and is not worth a fingerprint |
| Spoofed token | Stored as anonymous; the rating still counts |
| Insert fails | Toast, modal stays open with the input intact |

## Testing

- **`api/_lib/publicSubmission.test.js`** (extend): `validateFeedback` accepts 1 and 5, rejects 0
  and 6, rejects a non-integer, accepts an absent category, rejects an unknown one, enforces the
  1000-character cap exactly, and rejects a `page_path` that is not a path.
- **`src/lib/feedbackStorage.test.js`** (new): first visit prompts; after a dismissal it does not
  prompt again within 90 days and does after; after a rating it never prompts again; a throwing
  `localStorage` is caught and treated as "never auto-prompt".
- **Source-scan test** (in the same file): every `localStorage` access in the module sits inside a
  `try` block.
- **`src/data/publicSubmit.js`**: the feedback payload contains no `user_id` key.
- **`supabase/migrations.test.js`** (extend): `hub_feedback` has no insert grant for `anon`, the
  admin select/update policies exist, the `feedback` flag row exists, and `purge_old_data()` has no
  reference to `hub_feedback`.
- **`src/lib/adminInbox.test.js`** (extend): `feedback` registered, `star` in `icon_names=`.

`npm test`, `npm run lint`, `npm run build`.

## Files touched

`supabase/migrations/<ts>_hub_feedback.sql`, `api/submit-public.js`,
`api/_lib/publicSubmission.js` + test, `src/data/publicSubmit.js`, new
`src/components/FeedbackModal.jsx`, new `src/lib/feedbackStorage.js` + test, new
`src/lib/useFeedbackPrompt.js`, `src/components/Footer.jsx`, `src/pages/Account.jsx`,
`src/pages/admin/AdminMessages.jsx`, the `admin_inbox()` re-declaration in the new migration,
`src/lib/adminInbox.js` + test, `supabase/migrations/20261026120000_analytics.sql` (KPI added by
re-declaring `admin_analytics()` in the new migration), a per-key flag hook beside the pattern in
`src/data/news.js`, this spec.

## Out of scope

- Phase 1's form-builder form — the modal replaces it; no form is created.
- A standalone `/admin/feedback` route, or any chart beyond the KPI.
- Editing or replying to feedback from the inbox.
- Per-user rate limiting beyond the existing submit limit; one row per device is not enforced.
- Translating the modal; it is English like the rest of the site.

## Verification limits

Tests, lint and build can be verified locally. The modal's appearance, the auto-prompt timing, the
90-day re-ask, the anonymous submit path, the analytics card and the inbox filter **have not been
seen** — they need a browser, and the flag on a deployed environment.
