# News video: preview length and repeat — design

2026-10-29 · status: approved by the owner, not yet implemented.

## Why

A card preview runs for a hardcoded three seconds (`PREVIEW_SECONDS` in `src/lib/newsVideo.js`) and never
loops. An admin posting a short vertical explainer cannot say "show this for six seconds" or "keep it
looping while they look at it", which is the whole reason to put a video on a card in the first place.

## Decisions, and why

| # | Decision | Reason |
|---|---|---|
| 1 | A **site-wide default** *and* a **per-post override** | Owner's choice when asked. One setting alone either forces every post to be identical or makes a site-wide change impossible. |
| 2 | **Repeat replaces the timer** — it is not a second cap | "5 seconds, but looping" reads as a bug when the card restarts mid-read, and a magic `0` makes the form teach its own vocabulary. With repeat on, the only stops are the ones already in the UI: hover-off, tap-toggle, scroll-out. |
| 3 | Range **2–30 seconds**, fallback **3** | Owner's range. Teaser territory — long enough to show a beat, short enough that a grid of twenty cards cannot quietly stream hundreds of megabytes. |
| 4 | The default lives on **Admin > News → Design tab**, beside *Show on Home* | Owner's choice. That tab already edits `content_settings` through `contentLooks.js`, is admin-write and MFA-restricted, and is exactly where someone configuring how news looks would look. |
| 5 | **Card preview only**; the article keeps its normal player | Owner's choice. Stopping an article video after N seconds would feel broken to a reader who pressed play; "preview" stays preview. |
| 6 | **NULL on a post means "inherit"** | Otherwise changing the site default would leave every existing post frozen at the value it was created with, and a post could not say "site default says loop, I don't". |

## Data

One migration, `supabase/migrations/<timestamp>_news_video_preview_tuning.sql`:

```sql
alter table public.news
  add column video_preview_seconds integer,
  add column video_loop boolean;
alter table public.news
  add constraint news_video_preview_seconds_check
    check (video_preview_seconds is null or video_preview_seconds between 2 and 30);

alter table public.content_settings
  add column news_video_preview_seconds integer not null default 3
    check (news_video_preview_seconds between 2 and 30),
  add column news_video_loop boolean not null default false;
```

`video_loop` needs no constraint — a nullable boolean already has exactly the three states required
(inherit / on / off).

`apply_change_request`'s `news` branch gains both columns: in the insert, and in the update each guarded
on `payload ? '…'` like the existing five, so a queued edit submitted before this migration leaves the
values alone instead of writing NULL over them.

`content_settings` is **not** in the review queue — it is written directly by the Design tab, the same
way `news_on_home` is.

## Pure logic

Stays in `src/lib/newsVideo.js`, so the admin form, the cards, the studio preview and any future reader
judge a row the same way. The module remains free of `window` and the Supabase client.

```js
MIN_PREVIEW_SECONDS = 2
MAX_PREVIEW_SECONDS = 30
PREVIEW_SECONDS = 3          // now the FALLBACK, not the only answer — name kept, comment changed

resolveVideo(item, { enabled, storageBase, defaults })
  // → { kind, url, preview, position, duration, previewSeconds, loop }
```

- `previewSeconds`: post value when it is an integer in 2–30, else `defaults.seconds` when it is valid,
  else `3`; the final value is clamped regardless, so a hand-edited row cannot reach a renderer.
- `loop`: `typeof item.video_loop === 'boolean'` wins, else `Boolean(defaults?.loop)`.
- Both settle *inside* `resolveVideo`, the module's one judge, so no surface can disagree.

`src/data/news.js`'s `resolveNewsVideo(item, enabled, defaults)` passes the defaults through. Cards read
them from the existing `useContentSettingsQuery()` — anon-readable (`select('*')` from id 1), already
what `usePageLook` depends on, so the new columns arrive without a new hook.

## Card behaviour

In `VideoOverlay` (`src/components/content/ContentCards.jsx`):

- `<video loop={video.loop} …>`.
- The stop countdown is armed at `video.previewSeconds`, still by `onPlaying` — never at mount, which is
  the bug PR #177 fixed: a preview is three seconds *of playing*, not of buffering.
- **Repeat on → no seconds timer.** Stop triggers are then the whole rule:

  | Preview style | Loop off | Loop on |
  |---|---|---|
  | `auto` | start once when the card scrolls in, run `previewSeconds` | start when it scrolls in, **stop when it scrolls out**, restart on re-entry |
  | `hover` | run `previewSeconds` | run until the pointer leaves (mouse only) |
  | `tap` | tap plays `previewSeconds` | tap starts, tap again stops |
  | `none` | never plays | never plays |

  The `auto`-exit case is the load-bearing one: the observer must keep watching while looping, or a card
  scrolled past keeps streaming a 30MB file on a phone with nothing on screen to show it. With loop off
  the observer still disconnects after its first fire, as today.
- The `NEVER_STARTED_MS` safety net stays: a phone that refuses autoplay unmounts after 8s rather than
  parking an element on the card.
- YouTube cards are unchanged — badges and no player, because an iframe inside a `<Link>` is invalid
  HTML. Loop and length mean nothing there, so their controls are not shown either.

## Admin

**Per-post — `VideoUploadField`, beside the existing "Card preview" select:**

| Control | Widget | Values → column |
|---|---|---|
| Preview length | number box, 2–30, placeholder `Site default (N)` — `N` is the live default | blank → `null` (inherit) |
| Repeat | select, matching the panel's other controls | *Use site default* → `null`, *Repeat until they leave* → `true`, *Play once* → `false` |

Three states on repeat is what makes "the site says loop, this post doesn't" expressible. Both controls
render only when `kind === 'file'`. Out of range is flagged inline while typing and settled to `null` in
the payload — the same rule the duration field already applies — so a typo degrades to "inherit" rather
than failing the save. The DB constraint and the resolver clamp are the last two lines of defence, never
the first.

The placeholder shows the **live** site default (fetched by `AdminResourceForm` from
`useContentSettingsQuery` and passed down), not the literal 3 — otherwise the panel would promise a
default it is not going to use. The two columns are the `video` field's sixth and seventh companion
columns: `newsAdminConfig` gains `secondsField`/`loopField`, `buildFormState` seeds them, and
`buildPayload` emits them, exactly as both already do for `previewField` and `positionField`.
The whole field remains gated on the `news_video` flag **and** ownership, unchanged.

**Site default — `ContentDesign`, news tab:** a number box and a Repeat checkbox beside *Show on Home*,
writing `news_video_preview_seconds` / `news_video_loop`. They join `SETTINGS_FIELDS` in
`src/data/contentLooks.js` with a patch helper beside `lookOnHomePatch`. Shown only when `news_video` is
on, and only on the news tab — events has no video.

## Testing

- **`newsVideo.test.js`**
  - The migration guard currently finds its migration with `find(…)` — the **first** file containing
    `video_kind` and `apply_change_request`. This migration is a second such file, so the guard would
    silently keep asserting against the stale function. It must take the **last** match, and
    `VIDEO_COLUMNS` grows to seven.
  - New: clamp (2 and 30 are inclusive, 1/31/`'six'` settle away), the fallback chain (post set, post
    null with a default, both null), and the loop tri-state including `"false"` from a JSON payload.
- **`contentLooks.test.js`**: the patch helper emits exactly the two new columns, alongside the
  existing `lookOnHomePatch` assertion.
- **Source scan** (repo style, like `iconFont.test.js`): the preview `<video>` carries `loop={video.loop}`
  and its countdown uses `video.previewSeconds`, so neither can silently drift back to the constant.

## Out of scope

The article page player, YouTube cards, the production CSP, audio, and anything about *uploading* video.
No change to the `news_video` flag's meaning.

## Verification limits

The migration has not been run anywhere yet, and no preview has been seen playing — length and loop need
a deploy and a real handset to confirm, same as the rest of this feature.
