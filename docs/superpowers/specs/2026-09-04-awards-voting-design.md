# Materials Horizon Awards voting — design

Date: 2026-09-04

## Context

Last year's Materials Horizon Awards used a Google Form for voting: no eligibility
check, no protection against duplicate or cross-department votes, and no structured
way to run a nomination phase before the ballot. This spec replaces that with a
purpose-built voting subsystem on NAMMES Hub: an admin-run nomination → curation →
voting → reveal pipeline, restricted to this department's students, with each student
getting exactly one vote per award category.

This is a new subsystem, not an extension of the existing `forms` feature — `forms`
is a general-purpose survey builder (free-text/choice answers, one submission per
form); voting needs per-category candidates, a curation step between raw submissions
and the ballot, live-hidden tallies, and department-restricted one-vote-per-category
enforcement. The two features share patterns (admin CRUD, RLS via the `admins` table,
a security-definer trigger for duplicate-submission checks — see
[[2026-09-04-nammes-forms-design]]) but are separate tables and pages.

## Goals

- Admins run one "award season" at a time (e.g. "Materials Horizon Awards 2026"),
  containing however many categories they define (e.g. Best Dressed, Most Likely to
  Succeed).
- A season moves through five phases, advanced manually by an admin, one-way, no
  auto-timers: `nominating` → `curating` → `voting` → `closed` → `revealed`.
- **Nominating**: signed-in department students submit one free-text nominee name per
  category, editable until nominations close.
- **Curating**: admin-only — raw nominations are grouped by normalized text with
  counts, and the admin builds the official shortlist (`award_nominees`, with an
  optional photo) from them.
- **Voting**: signed-in department students see one ballot with every category and its
  shortlisted nominees, pick one nominee per category, and submit once. Exactly one
  vote per student per category, enforced server-side.
- **Revealed**: admin publishes results; tallies and winners become publicly visible.
  Before that, tallies are admin-only (available to admins as soon as voting opens, for
  monitoring — just not public).
- Eligibility is restricted to this department: a student must have a matric number
  matching this department's format (`240406XXX`) tied to their account, so no other
  department can nominate or vote, and nobody can vote using someone else's matric
  number (it's read from their own account, never typed in at vote/nominate time).

## Non-goals

- No anonymous/no-signin voting or nomination — superseded by the matric-number
  eligibility requirement, which needs a verified account to mean anything. (The
  existing `forms` feature keeps its own independent `require_signin` toggle for
  lower-stakes surveys; this is specific to awards.)
- No automatic fuzzy-matching/deduplication of nomination text (e.g. "Tayo" vs "Taiwo
  A.") — the curation screen groups only exact (normalized) matches; anything closer
  than that is a judgment call the admin makes by eye when building the shortlist.
- No vote editing/take-backs once cast — a vote is final, matching a real ballot.
- No per-category phase timing — the whole season advances together (every category
  nominates, then every category votes, on the same schedule).
- No multiple concurrent active seasons — seasons are listed historically like `forms`,
  but only one is expected to be "live" at a time; nothing in the schema hard-blocks
  running two at once; it's just not a workflow this UI is built around.
- No automated matric-number verification against an external student registry — the
  format check (`240406XXX`) plus per-account uniqueness is the full extent of
  verification, consistent with this app's small-department threat model (same
  reasoning as the forms spec's "no rate limiting/spam heuristics" non-goal).

## Architecture

### Data: a `profiles` table (new, shared foundation) + four award tables

`profiles` doesn't exist yet — signup currently stores `student_id` only in
`auth.users`' metadata (`src/pages/Signup.jsx:47`), unvalidated and not unique, so
nothing today stops two accounts from claiming the same matric number or a
non-department one. This is the one piece of the design that isn't purely additive —
it changes signup.

```sql
-- profiles (new)
user_id uuid primary key references auth.users(id) on delete cascade,
student_id text not null unique check (student_id ~ '^240406[0-9]{3}$'),
full_name text,
created_at timestamptz not null default now()

-- award_seasons
id uuid primary key default gen_random_uuid(),
title text not null,                      -- "Materials Horizon Awards 2026"
phase text not null default 'nominating'
  check (phase in ('nominating', 'curating', 'voting', 'closed', 'revealed')),
created_by uuid not null references auth.users(id),
created_at timestamptz not null default now()

-- award_categories
id uuid primary key default gen_random_uuid(),
season_id uuid not null references award_seasons(id) on delete cascade,
title text not null,                      -- "Best Dressed"
description text,
sort_order int not null default 0

-- award_nominations  (raw free-text submissions, nominating phase)
id uuid primary key default gen_random_uuid(),
category_id uuid not null references award_categories(id) on delete cascade,
submitted_by uuid not null references auth.users(id),
nominee_name text not null,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()

-- award_nominees  (curated shortlist, built by admin from award_nominations)
id uuid primary key default gen_random_uuid(),
category_id uuid not null references award_categories(id) on delete cascade,
name text not null,
photo_url text,
sort_order int not null default 0

-- award_votes
id uuid primary key default gen_random_uuid(),
category_id uuid not null references award_categories(id) on delete cascade,
nominee_id uuid not null references award_nominees(id) on delete cascade,
voter_id uuid not null references auth.users(id),
created_at timestamptz not null default now()
```

`profiles.student_id`'s `unique` + format `check` constraint is the actual enforcement
for "no other department, nobody votes as someone else" — a matric number can only
ever belong to one account, and it's fixed at signup, never re-entered at vote time.

Ballot submission (one `award_votes` row per category, several categories at once)
goes through a single Postgres `rpc` function rather than N separate client-side
inserts, wrapping all rows for that ballot in one transaction — otherwise a network
failure partway through would leave a student with votes in some categories and none
in others, and the duplicate-vote trigger would then read as "already voted" and hide
the incomplete ballot with no way to fix it.

Signup (`src/pages/Signup.jsx`) gains a client-side format check (immediate "this
isn't open to your department" / "this matric number is already registered" errors)
and an insert into `profiles` alongside the existing `auth.signUp` call. The
`profiles` row insert itself is what surfaces the server-side uniqueness/format error
if the client check is bypassed.

**One vote/nomination per student per category is enforced by `before insert`
`security definer` triggers**, exactly like `enforce_one_response_per_person` in the
forms feature ([[2026-09-04-nammes-forms-design]]) — not a unique index (a unique
index on `(category_id, voter_id)` would work here since the rule is unconditional,
but the trigger form is kept consistent with the forms precedent and makes room for
the exception message students actually see, e.g. "You've already voted in this
category"). Critically, it's a trigger and not an RLS insert-policy subquery, because
a subquery in the `award_votes` insert policy that reads `award_votes` itself hits the
same `infinite recursion detected in policy for relation` error the forms feature
already ran into and fixed — the trigger runs as the function owner, bypassing RLS for
its own lookup, so it doesn't re-enter the policy chain.

### RLS

- `award_seasons`, `award_categories`, `award_nominees`: public `select`;
  `insert`/`update`/`delete` restricted to `admins` — same pattern as `forms`/`events`.
- `profiles`: `select`/`insert` own row only (`auth.uid() = user_id`); no `update` (a
  matric number shouldn't be editable after registration — if it's wrong, that's an
  admin fixing it directly via the Supabase table editor, not a self-service flow); no
  public read (matric numbers aren't exposed to other students).
- `award_nominations`:
  - `insert`: `auth.uid() = submitted_by` **and** the season is in `nominating`
    phase **and** the submitter has a `profiles` row (department check happens
    implicitly — only department accounts have one). Checked via a policy that joins
    `award_categories` → `award_seasons` on `category_id`, no self-reference.
  - `insert` trigger: blocks a second row for the same `(category_id, submitted_by)`.
  - `update`: own row, only while the season is still `nominating`.
  - `select`: `admins` (for curation) or your own row (confirmation of what you
    submitted).
  - No `delete` for submitters (admins only, for moderating an inappropriate entry).
- `award_votes`:
  - `insert`: `auth.uid() = voter_id`, season in `voting` phase, submitter has a
    `profiles` row. Same join-based policy shape as nominations.
  - `insert` trigger: blocks a second row for `(category_id, voter_id)`.
  - No `update`/`delete` for voters — a vote is final.
  - `select`: `admins` always; your own row (a "you voted for X" receipt, not
    tallies); **everyone**, once the parent `award_seasons.phase = 'revealed'` — this
    is the entire mechanism for making results public, no separate results-snapshot
    table needed.
- Storage (nominee photos): reuses the existing image-upload bucket pattern from
  Events/Excos — public `select`, `insert`/`delete` restricted to `admins`.

As with every other write path in this app, the client never gates on "am I an
admin" — RLS is the real gate (see [[2026-08-09-admin-cms-design]]).

### Public-facing UI

- **`/awards`** (new nav-reachable route) — the season landing page, rendering
  differently by the current season's `phase`:
  - `nominating`: a form listing every category with one text field each ("Who do you
    nominate for Best Dressed?"), pre-filled from the student's existing
    `award_nominations` rows if any, editable up to close. Signed-out visitors and
    accounts without a `profiles` row see an inline "sign in with your department
    account to nominate" gate rather than a broken form.
  - `curating` / `closed`: a status message ("Nominations closed — shortlist coming
    soon" / "Voting closed — results coming soon").
  - `voting`: the ballot — every category with its `award_nominees` as selectable
    cards (photo + name where a photo exists, name-only otherwise), one pick per
    category, single submit for the whole ballot. If the student already has
    `award_votes` rows, show a "you've already voted" confirmation instead of the
    ballot (no partial-ballot state — the one-shot trigger means a vote is all
    categories or nothing meaningfully re-editable).
  - `revealed`: results — per category, every nominee with its vote count, winner
    highlighted.
- Eligibility errors (no `profiles` row, i.e. wrong department or unregistered matric
  number) surface as a clear inline message, not a silent RLS failure.

### Admin UI

New "Awards" entry in `ADMIN_SECTIONS` (`src/pages/Admin.jsx`), category `Engagement`
alongside Forms.

- **`/admin/awards`** — list of seasons (bespoke list page like `AdminForms.jsx`, not
  the generic `adminFields.js` CRUD pattern, since seasons nest categories and drive a
  phase state machine that pattern doesn't support): title, phase badge, "New season"
  button.
- **`/admin/awards/:seasonId`** — category management (add/edit/delete/reorder — this
  part *does* fit the plain `adminFields.js` list-column/field pattern, same shape as
  `eventsAdminConfig.js`) plus the phase controls: one button per forward transition
  ("Close nominations", "Open voting", "Close voting", "Reveal results"), each a
  `confirm()`-gated one-way action — no back button, matching a real election.
- **`/admin/awards/:seasonId/categories/:categoryId/curate`** — visible once the
  season is in `curating` (or later): lists `award_nominations` for the category,
  grouped by trimmed/lowercased text with counts, sorted by frequency descending. Each
  group has an "Add as nominee" action that opens the create-nominee form with the
  name pre-filled (editable) and an optional photo upload; admin manually judges
  near-duplicate spellings by eye.
- **`/admin/awards/:seasonId/results`** — tally view (bar breakdown per category,
  built with the `dataviz` skill's chart conventions, same visual family as
  `ResponseSummaryTab.jsx`), available to admins from `voting` phase onward regardless
  of whether results are publicly revealed.

## Error handling

- Signup: matric-number format error and "already registered" error both surface
  inline via the existing `FormField error` pattern, same tone as the current email
  error.
- Nomination/vote submit: a write rejected by RLS or the duplicate trigger (season
  phase changed underneath the user, already voted, no `profiles` row) surfaces as a
  generic inline error, same as every other Supabase error path in this app — not a
  silent failure.
- Phase-transition buttons are `confirm()`-gated (native, like every other destructive
  admin action in this app) since they're one-way.
- Empty states: "No award seasons yet" on `/admin/awards`; "No nominations yet" on the
  curate screen; "No categories yet" on a season with none.

## Testing

- Unit tests (Vitest): matric-number format validation, the phase-transition
  helper (which actions are valid from which phase), and the nomination
  grouping/count logic used on the curate screen — following the pattern in
  `adminFields.test.js`/`chartMath.test.js`.
- DB-level checks exercised with direct SQL against Supabase (not mocked): the
  `profiles.student_id` unique and format constraints, and the duplicate
  vote/nomination triggers (insert twice for the same category/voter, expect the
  second to fail).
- Manual end-to-end pass via the dev server: sign up one department account, one
  non-department-matric account, and a second department account → confirm the
  non-department account is blocked from `/awards` entirely → nominate as both
  department accounts → advance to curating, build a shortlist from the raw
  nominations → open voting → vote as both accounts, confirm a second vote attempt
  from the same account is rejected → close voting → reveal → confirm the results page
  is now publicly visible and matches the admin tally.
