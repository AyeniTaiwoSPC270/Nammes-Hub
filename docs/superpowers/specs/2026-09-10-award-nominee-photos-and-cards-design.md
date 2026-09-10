# Award nominee photos, campaign cards, and winner cards — design

Date: 2026-09-10

## Context

The Materials Horizon Awards voting subsystem ([[2026-09-04-awards-voting-design]]) currently
has admins upload the nominee's photo during curation, after nominations close. Last cycle
showed two gaps: nominators are in a better position to supply a good photo of who they're
nominating than an admin reconstructing it later, and once someone is shortlisted, students
want to actively campaign for them (a "VOTE [NAME]" poster, shared on WhatsApp/social) and,
after results are revealed, want a shareable "winner" card for the department's Instagram/status
— both currently done by hand in Canva/PowerPoint outside the app.

This spec moves photo capture to nomination time and adds a small image-generation subsystem
that produces both card types on demand.

## Goals

- A student submitting a nomination uploads a photo of the person they're nominating,
  required per category, alongside the existing free-text name field.
- During curation, admin still has final say on the shortlisted photo — pre-filled from the
  nominators' submissions (with a picker across the group's variants), but replaceable.
- Once a nominee is shortlisted and voting is open, anyone can generate and share/download a
  "campaign" card for that nominee (photo + name + category + season branding + a "VOTE" call
  to action).
- Once a season is revealed, anyone can download a "winner" card per category, generated from
  the actual vote tally — not a client-editable claim.
- Both card types render server-side as real PNG files so quality doesn't depend on the
  visitor's browser/fonts.

## Non-goals

- No per-nominee public page or deep link — sharing is done via the generated photo itself,
  plus a plain link back to `/awards`, not a link to an individual nominee's own URL. Avoids
  new public routes and any pre-reveal signal about who's popular.
- No rich link-preview / Open Graph image support for shared links — would require restructuring
  this Vite SPA for server-rendered per-route meta tags, which is a much larger change than this
  feature justifies. Consistent with how these posters are actually used: shared as a photo, not
  a pasted link people expect to unfurl.
- No automatic cleanup of a nomination's previous photo when the nominee's name/photo is edited
  before nominations close — an orphaned file in storage is harmless and low-volume, matching
  this app's existing "small department" pragmatism (same reasoning as the original spec's
  no-rate-limiting non-goal).
- No tie-breaking UI for the winner card — if a category tie ever happens, the endpoint renders
  whichever tied nominee it encounters first; an admin can deal with a genuine tie out of band.
  Not worth building UI for an edge case this department has never hit.
- The actual visual template (the ornate frame / branded background you have examples of) is not
  built in this pass — this spec builds the mechanism with placeholder styling. The real template
  art gets swapped in once you bring back a Stitch design, same as every other page in this app.
- No retroactive photo requirement for nominations submitted before this ships — the column is
  nullable at the DB level; "required" is enforced only in the nomination form going forward.

## Architecture

### Data: `award_nominations.photo_url` + storage policy change

```sql
alter table award_nominations add column photo_url text;
```

Nullable at the DB level (existing rows have none); the nomination form enforces "required"
client-side, same as every other required-field pattern in this app (RLS is the real gate for
security-relevant rules, but "did you attach a photo" isn't a security rule — it's UX).

Storage bucket `award-nominee-photos` currently restricts `insert`/`delete` to `admins`. New
policy:

```sql
create policy award_nominee_photos_insert_authenticated
  on storage.objects for insert
  with check (bucket_id = 'award-nominee-photos' and auth.role() = 'authenticated');
```

`select` stays public, `delete` stays admin-only (a nominator can't delete a photo once
uploaded — if it needs removing, that's a moderation action, same as nomination text already
being admin-deletable-only). This mirrors the "small department, low threat model" reasoning
throughout the original awards spec: any signed-in user being able to write to this bucket is an
acceptable trade for not building a per-nomination-context storage policy.

### Nomination form changes

`AwardNomineePhotoUploadField` moves from `src/components/admin/` to `src/components/awards/`
(it's no longer admin-only) and gains a `required` prop that swaps its label copy between
"Click to upload photo (optional)" (curation context) and a required variant with validation
styling (nomination context).

`NominationCategoryField` (used in `Awards.jsx`'s `nominating` phase) gains this field per
category. The existing "answered" / progress-bar logic (`answeredCount`, save-button disabled
state) extends to require both a non-empty name *and* a `photo_url` before a category counts as
complete, and before "Save nominations" is enabled.

`upsertNomination` (`src/data/awardNominations.js`) gains a `photoUrl` parameter, written on both
insert and update.

### Curation changes

`groupNominationsByText` already groups raw nominations by normalized name; it's extended to
also collect the distinct `photo_url`s within each group (small, in-memory, no schema change).
`AdminAwardCurate.jsx`'s "Add as nominee" flow shows these as small thumbnail chips — clicking
one sets the draft photo — defaulting to the most recently submitted one in the group. The
existing `AwardNomineePhotoUploadField` (now shared) stays available underneath for admin
override, unchanged behavior otherwise.

### Card generation: `api/award-card.js`

A new Vercel serverless function (Node runtime, matching every other file in `api/`), using a
new dependency `@napi-rs/canvas` to composite: a background template, the nominee's photo (fetched
from its public Supabase Storage URL, drawn into a fixed photo box, cropped to cover), and text
(name, category title, season title, and a "VOTE" or "WINNER" label) — colors pulled from this
app's existing palette (`DESIGN_SYSTEM.md`).

- `GET /api/award-card?type=campaign&nomineeId=<uuid>`
  Looks up the nominee (`award_nominees`), its category, and season via `supabaseAdmin` (all
  public-select data already). Renders the campaign template. Available any time the nominee
  exists — the endpoint itself doesn't gate on season phase (the UI only exposes the button
  during `voting`, but the endpoint being reachable a bit before/after that isn't a security
  concern — this is a public poster, not privileged data).
- `GET /api/award-card?type=winner&categoryId=<uuid>`
  Looks up the category and season; if the season's `phase` isn't `revealed`, returns `404`
  (results aren't public yet, matching the RLS rule on `award_votes`). Otherwise queries
  `award_votes` for that category via `supabaseAdmin` (bypassing RLS, which is fine —
  `supabaseAdmin` already bypasses RLS by design in every other `api/*` handler), tallies votes
  per `nominee_id` itself, and renders whichever nominee actually has the most votes. **The
  request never supplies a nominee id for this type — the endpoint decides the winner**, so
  there's no query parameter to spoof.

Both responses: `Content-Type: image/png`, `Cache-Control: public, max-age=3600` — the same
nominee/category produces the same image barring a photo change or (for winner cards) a vote
change, and an hour of staleness is an acceptable trade for not regenerating on every request.

### Public UI: share & download

- During `voting` phase, `NomineeOption` gets a small share icon button. On click: fetch the
  campaign card PNG, then `navigator.share({ files: [...] })` where supported (mobile), falling
  back to a plain `<a download>` otherwise. A separate "copy link" action copies the plain
  `/awards` URL (window.location origin + `/awards`) — not a per-nominee URL.
- On the revealed results page (`ResultsSummary`), each category's winner row gets a "Download
  result card" button that fetches and downloads the winner card PNG.

## Error handling

- Nomination form: missing photo blocks save the same way a missing name already does (button
  disabled, no separate error message needed — matches existing pattern).
- Photo upload failures (wrong type, too large, storage error) reuse the existing inline error
  pattern already in `AwardNomineePhotoUploadField`.
- `api/award-card.js`: `400` for a missing/invalid `type` or id param, `404` if the nominee/
  category doesn't exist or (for `winner`) the season isn't `revealed` yet, `500` with a logged
  error (matching `webhook-welcome.js`'s `console.error` pattern) if the photo fetch or canvas
  render fails — never a broken image with no explanation.
- Share/download buttons surface a toast error (existing `useToast` pattern) if the card fetch
  fails, instead of failing silently.

## Testing

- Vitest: the winner-tally function (`award_votes` rows in, winning `nominee_id` out, including
  a deterministic tie-break) is pure logic — unit-tested the same way as `chartMath.test.js`.
  The extended `groupNominationsByText` (now also collecting distinct photos per group) gets a
  test for that grouping behavior.
- Manual, against the dev server + live Supabase project: submit a nomination with a required
  photo (and confirm submission is blocked without one); curate, using the photo-group picker;
  vote; generate and download a campaign card for a nominee; reveal a season; generate and
  download a winner card, and confirm the winner it renders matches the actual tally regardless
  of what `nomineeId`-shaped values are tried against the `campaign` endpoint for that category.
