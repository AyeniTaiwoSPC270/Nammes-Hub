# News video posts — design

Date: 2026-10-26
Status: agreed, ready to plan

## Goal

An admin can publish a news post that carries a **video**, the same way a post can already carry an
image: a cover picture on the cards, the video playing on the article page, and no change to how a
post without a video behaves.

## Decisions

| Question | Decision |
|---|---|
| Where video comes from | **Both**: an uploaded MP4 (≤50MB) *or* a YouTube link (YouTube only) |
| Where it shows | Article page, `/news` grid card, Home news block |
| Image vs video | **C** — the video has its own cover image; `image_url` is that cover |
| Who sets video | **Owner only.** The review queue keeps working for text+images and must not be able to erase a video |
| Preview on the card | Per-post choice: `auto` / `tap` / `hover` / `none`, default `tap` |
| Position in article | Per-post: `top` or `bottom` |
| File limit | 50MB, `video/mp4` only |
| Link embeds | YouTube only, click-to-load facade |
| Duration badge | Read from the file for uploads; typed by the admin for links |
| Kill switch | `feature_flags` key `news_video` |
| Missing cover | Warn loudly in the form, still allow saving |
| Architecture | **A** — flat columns on `news` (agreed over a sidecar table or jsonb) |

## Data & storage

Five nullable columns on `news`, so no existing row changes:

| column | type | values |
|---|---|---|
| `video_kind` | text | `file` \| `youtube` |
| `video_url` | text | `news-videos` public URL, or a YouTube URL |
| `video_preview` | text | `auto` \| `tap` \| `hover` \| `none`, default `tap` |
| `video_position` | text | `top` \| `bottom`, default `top` |
| `video_duration` | text | `4:12` |

The cover is `image_url`, unchanged. `image_width_pct` keeps applying to the picture only — a video
renders at the full width of the article column.

New `news-videos` bucket: public read, `file_size_limit = 52428800` (50MB),
`allowed_mime_types = ['video/mp4']`, policies mirroring `news-images` (any admin may insert; only
the owner may update or delete), matching the posture set in
`20261022100000_authorization_hardening.sql`.

**`apply_change_request` gains the five columns in both its `insert` and `update` statements for the
`news` branch.** This is load-bearing: that function rewrites every column it names from the payload,
so a column it does *not* know is set to `NULL` — an approved edit by a non-owner admin would
silently strip the video off a live post.

A `feature_flags` row with `key = 'news_video'`.

## Admin form

One new field type, `video`, declared in `newsAdminConfig.js` alongside the existing `image` field:

- Empty by default; a post with no video behaves exactly as it does today.
- Once present it exposes: kind (upload / YouTube link), the file-or-URL input, **Preview style**,
  **Position**, **Duration**.
- Uploads: the browser reads the duration off the file and fills the field; if it cannot, the field
  stays editable by hand.
- Links: duration is typed. URLs are validated against `youtube.com` / `youtu.be`; anything else is
  rejected with "Only YouTube links are supported — upload the file instead."
- The cover image field stays visible and unchanged. With a video set and no cover, a warning reads
  *"No cover image — this card will use a placeholder tile."* Saving is not blocked.
- The whole control is hidden when the `news_video` flag is off.

## Public rendering

The three card components share `src/components/content/ContentCards.jsx`, so the overlay is added
once and reaches `/news`, the featured lead card, Home, and the Design Studio preview (which renders
these same components).

- Cover image as today, with a play control, a `VIDEO` chip and a `duration` chip over it. The chip
  is text — no icon is added to `index.html`; `play_arrow` is already loaded.
- No cover → a dark tile with a play button, never an empty box.
- Preview styles:
  - `none` — static.
  - `tap` — the card is a `<Link>`, so the play control is a real `<button>` layered above it that
    calls `preventDefault()`; the preview plays muted inline for 3 seconds, and tapping the rest of
    the card still opens the article.
  - `hover` — starts on pointer enter, stops and restores the cover on leave. No-op on touch.
  - `auto` — `IntersectionObserver`, once per card per page load, 3 seconds, then stops, so a
    full grid cannot stream indefinitely.
- Every preview is muted and `playsInline`, with `preload="metadata"`. Eager full-file preload is
  never used.
- For `youtube` the card draws the badges and **no play control**: the card is an `<Link>`, and an
  iframe inside an anchor is invalid HTML, so the player lives on the article page. There the facade
  shows the cover (or `i.ytimg.com`) and builds the `youtube-nocookie.com/embed/<id>` iframe only on a
  real click. No third-party request of any kind happens on the list pages.

### Article page

- `position: top` → video directly under the byline and the cover image is *not* repeated above it
  (the card already used the cover to get the reader here).
- `position: bottom` → cover image, body, then video.
- Uploads: `<video controls playsInline preload="metadata" poster={cover}>`.
- `video_preview` is a card-only setting: the article always shows the full player.

## Kill switch

`feature_flags` key `news_video`, read with the same per-key query pattern as
`src/data/calendar.js`. Off → cards and article render exactly as today, the admin controls are
hidden, and no video bytes are requested.

## Failure modes

| Failure | Behaviour |
|---|---|
| File over 50MB | Rejected before upload starts, with the actual size in the message |
| Not `video/mp4` | Rejected client-side; the bucket's `allowed_mime_types` is the backstop |
| Upload fails | Field keeps its previous value, error toast, row untouched |
| Duration unreadable | Field stays blank and manual |
| Video URL later breaks | `onError` swaps the player for the cover image; cards keep their chips |
| `kind=youtube` but not a YouTube URL | Treated as no video at render — falls back to the cover |
| `kind=file` but URL outside `news-videos` | Ignored at render (the payload never points the site at arbitrary media) |
| Flag off | Everything reverts on the next refetch |
| Post deleted | Files remain in storage — same as `news-images` today; not a new policy |

## Testing

`npm test`, `npm run lint`, `npm run build`. No component-DOM stack is introduced; the repo has none.

- **`src/lib/newsVideo.test.js`** (new, pure): `parseYouTubeId` accepts real YouTube shapes and
  rejects look-alike hosts (`youtube.com.evil.example`), duration format/parse round-trip, the
  bucket-URL guard, and `cardVideoState()` returning `null` when the flag is off.
- **`src/lib/adminFields.test.js`** (extend): `buildFormState`/`buildPayload` for the `video` type —
  empty → all-null, populated → all five columns.
- **Migration guard test**: the `news` branch of `apply_change_request` in
  `supabase/migrations/*.sql` names all five columns in *both* statements. This fails the suite if a
  sixth media column is ever added and the queue is forgotten.

## Files touched

`supabase/migrations/*_news_video.sql`, `src/pages/admin/config/newsAdminConfig.js`,
`src/lib/adminFields.js` + test, new `src/components/admin/VideoUploadField.jsx`,
`src/components/admin/AdminResourceForm.jsx`, new `src/lib/newsVideo.js` + test,
`src/components/content/ContentCards.jsx`, `src/pages/NewsDetail.jsx`, a per-key flag hook beside
the pattern in `src/data/calendar.js`, this spec.

## Out of scope

- Vimeo, TikTok, Instagram and every other platform — YouTube only, everything else is uploaded.
- Transcoding, adaptive bitrate, captions/transcripts.
- Video in broadcasts/emails, video on `/events`.
- Storage cleanup on post delete (images have none either).
- Any change to the review queue beyond the column list.

## Verification limits

Code and tests can be verified locally. Rendering, the muted previews, upload behaviour and dark-mode
appearance **have not been seen** — they need a Supabase login, a real video file and a browser.
