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

Several files under `api/_lib/` are **server-only** and break that rule on purpose, because a canvas draws no
picture in a browser bundle: `quizCardRender.js`, `awardCardRender.js` and `fonts.js`. Others break it for other
reasons — `quiz.js`, `handbookBuild.js`, `supabaseAdmin.js`, `resend.js` and `authz.js` reach for `node:` built-ins,
a service key or `puppeteer`. Nothing in `src/` may import any of them, and the list has to be checked rather than
assumed when adding to `api/_lib/`. `fonts.js` is the one place the five font files are registered, shared by both
renderers and by `patternFonts.test.js`, which checks the backdrop glyph table against them — a second copy would
let a font be deleted while the test kept checking a set no card used. The pure ones that a browser page imports
directly are the four `calendar*.js` modules, `quizTheme.js`, `calendarMerge.js` and — since the fifth studio —
`contentTheme.js`.

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

## Saved design presets

Five studios let an admin keep a design under a name and put it back later. Each has its **own** table and its **own**
data module, and that is deliberate — do not merge them into one shared "presets" table.

| Studio | Table | Data module | UI |
|---|---|---|---|
| Calendar | `calendar_looks` | `src/data/calendar.js` | `AdminCalendarDesign.jsx` (first) |
| Email | `email_styles` | `src/data/emailStudio.js` | `AdminBroadcasts.jsx` |
| Quiz look | `quiz_looks` | `src/data/quiz.js` | `SavedLooks.jsx` |
| Form appearance | `form_looks` | `src/data/formLooks.js` | `SavedFormLooks.jsx` |
| Events / News | `content_looks` + `content_settings` | `src/data/contentLooks.js` | `ContentDesign.jsx` |

- **One concept, five implementations.** The designs have different shapes (swatch ids vs a capped jsonb with per-mark
  motion vs design-plus-blocks), different sanitisers and different owners (calendar is owner-write, the other four
  admin-write). A shared table would need a `kind` column and a per-kind sanitiser, so it buys a dispatch switch and
  costs a coupling between five unrelated sanitisers. `calendar_looks` is the model to copy for a sixth.
- **Applying a preset is not saving it.** Every one of these fills a draft; the studio's own Save is what commits it.
  The only exception is email, where a saved style is chosen at send time rather than applied to a form. Do not make a
  preset apply straight to a quiz or a form — one stray click should not restyle either.
- **Quiz looks drop their pictures; form looks keep theirs.** This is the one behavioural difference between the two new
  modules and it is forced by the storage, not chosen. A quiz's backdrop, logo and sponsor are `<quizId>/<uuid>.webp`
  paths inside that quiz's own storage folder, so `sanitizeTheme(look.design, { quizId })` at apply time strips them
  (and `cleanPattern`/`cleanMotion` then settle `image`→`none` and `pan`→`off`, so nothing animates a missing photo).
  A form's page background and header are whole `https` urls (`safeImageUrl`), which are the picture wherever they are.
  `formLooks.test.js` asserts that `safeImageUrl` still accepts them, so if the uploader changes, that test fails and
  the question reopens.
- **A look is saved *with* its pictures and cleaned *without* a `quizId`.** Stripping on save would stop a look ever
  returning to the quiz it was made on, which is the common case.

## Events & News design

- **The look is a join of two tables, never a column on `events` or `news`.** `content_settings.<page>_look_id` names the design
  and `content_looks.design` carries it, so making one live is two writes. This is the whole reason: `apply_change_request`
  enumerates `events`/`news` columns explicitly (`20261009100000_calendar_review_queue.sql:37-67`), so a `theme` column added to
  either would be silently dropped from every queued non-owner edit. `content_looks.page` then stops a news design being made
  live on `/events`, where `layout.featured` would mean nothing.
- **`sanitizeTheme(input, page)` is page-aware and is the only judge.** `/news` has a lead story and `/events` has none — events
  are grouped by date, not by importance — so `layout.featured` is settled to `'none'` on events rather than trusted. The page
  comes from the row, never from the payload, so a design copied out of the other page's row cannot move itself across.
- **Tailwind classes cannot carry a setting, so the whole look is CSS custom properties.** `grid-cols-3` is a static string.
  `themeVars` emits `--content-*` on a wrapper and the `.content-*` rules in `src/index.css` are the entire consumption.
  `themeVars` reads the page off `theme.layout.page` rather than taking an argument, so no call site can pass a news page
  alongside an events theme.
- **The accent works by repointing three tokens**, `--color-brand`, `--color-brand-orange` and `--color-green-900`. The middle
  one is the load-bearing one: `src/index.css:27-32` exists precisely to say `--color-brand-orange` is the "text, borders and
  icons on a page surface" accent, which is what a card's category label and its Read more link are. Leave it out and the
  studio's headline control changes nothing a visitor can see. The guard against a token being repointed onto *itself* is the
  custom-property cycle check copied from `calendarTheme.js:200-206`.
- **Every card is one component, in `src/components/content/ContentCards.jsx`.** Before this there were four renderers that
  did not agree — hand-written markup in `Events.jsx` and `News.jsx`, `ui/Card` on Home's news, and a fourth inline copy at
  `Home.jsx:204-217`. The studio's preview is only worth anything if it renders the same components the page does, which is the
  `quizCharacterArt.js` lesson applied to markup. Adding a fourth copy of a card is the regression to watch for.
- **`layout.imageAspect` has a per-page default** (`tall` for events, `wide` for news) because the two card sets have always had
  different proportions and one default would restyle a page on day one. It stays editable on both. Every other default is
  pinned to what these cards rendered before the studio existed.
- **Home opts in per page and only for its own block.** `content_settings.<page>_on_home` defaults to false, and Home also renders
  awards, opportunities and announcements. An accent that spread to those would be a bug report, so the toast says which block is
  affected rather than leaving the admin to work out why the whole page changed.
- **`content_looks` is admin-write, not owner-write like `calendar_looks`.** A design is presentation, not content, and
  `form_looks` is the closer precedent. `content_settings` is in the MFA restrictive loop for the same reason every other
  admin-writable settings singleton is.
- **Only `--color-brand` is redefined in `.dark`.** Every other accent token is a fixed hex, so `sand` is invisible in light mode
  and `success`/`warning`/`danger` are dim in dark. This is the site's existing position, shared with the calendar studio — do
  not "fix" it here, because adding tokens to the `.dark` block changes every page.

## Quiz question types

`api/_lib/quizTypes.js` is the only list of question types. The five hand-synced copies that used to exist
(`quizGrading.js`, `quizCustom.js`, `quizQuestions.js`, `cbt/ExamEditor.jsx`, `quizCsv.js`) all read it, and
`quizTypes.test.js` asserts they still agree. **Add a type there first**, then let the failure tell you the consumers.

- **A type needs a branch on every surface it claims to support.** `quizTypeRenderers.test.js` source-scans the five
  renderers, the same shape as the `index.css` keyframe scan. A type that grades differently from a single index —
  currently `order` and `diagram` — must appear literally in each renderer that draws it. `multiple`, `truefalse`
  and `poll` are reached through `isChoiceType`, and `numeric`/`text` fall through to the typed box, so they do not.
- **`cbt: false` and `custom: false` are decisions, not omissions.** `diagram` is out of CBT because the exam question
  view renders no images at all, and both `order` and `diagram` are out of a community set because an ordering answer
  needs a scored round the host decides and a diagram needs an upload the importer has nowhere to put.
- **An ordering question has no answer column.** The authored order of `options text[]` *is* the answer, presented
  shuffled through the existing `optionOrder`. A `correct_order` column would duplicate state that already exists and
  could disagree with it. Credit is positional — a step counts only if it is in the right place — and stored in
  `credit` at grading time, because `points_awarded` has by then been through speed, streak, comeback and multiplier
  and cannot be read back as a fraction.
- **`computeAward` rounds partial credit explicitly.** `points_awarded` is an integer column and `points_multiplier`
  is `check (in (1, 2))`, so a third of a question at 2× does not divide evenly. The test asserts the rounding rather
  than tolerating whatever it produces.
- **Units are per-question aliases, never a global registry.** `normaliseUnit` folds case, spacing and `µ`/`μ` to `u`,
  but it does *not* strip prefixes: `N` and `kN` stay distinct strings, so they cannot match. A registry that
  canonicalised `kN` to `N` is how `2500 N` ends up accepted against an answer of `2.5 kN`. Aliases never scale a
  value — the number is graded bare, which is also what keeps the existing tolerance code working unchanged.
- **Diagram coordinates are normalised, not pixels, and carry the picture's shape.** `processQuizImage` downscales to
  1280px on upload, so a stored pixel does not survive a re-upload at a different size. `letterboxRect`/`toNormalized`/
  `toRenderedPoint` are the one mapping, used by the editor, the full client and `/play/low`; get it wrong and every diagram
  grades wrong on every handset while looking right in the editor. A normalised **circle** additionally needs to know
  whether the picture is wider than it is tall, which is why each region stores `ar` (width/height, captured by
  `QuestionCard` when the marker is placed): without it `hypot(dx, dy)` accepts a region twice as far across as it is
  drawn on any landscape image, and every square test still passes. `quizGrading.test.js` round-trips the letterbox
  through both a wide and a tall box and grades one landscape and one portrait picture.
- **A diagram's regions are the answer, so they leave only with the reveal.** `quiz-state.js` must never put
  `diagramTargets` on an open question: grading is server-side, so a phone holding the regions before it has tapped is
  holding the mark. The projector draws them on the reveal and not before, for the same reason. The one thing `low: 1`
  may never subtract is this too.
- **An ordering question's steps are shown through the same shuffle as its answers.** `shownOptions` serves `order`
  (not just choice types) and `buildQuestionSet` freezes a step order for it; when either was missing, the phone was sent
  `options: []` — an unanswerable question — while the projector numbered the authored order, which is the answer.
- **One `awardPoints`, three surfaces.** The hosted game, practice and battle each rolled their own arithmetic and
  drifted: two of them gated the base on `correct`, so a partially-right ordering scored nothing there and full credit in
  a hosted game. `awardPoints(full, graded)` is the only place that decides it — `credit` is the fraction of the question
  that landed, and a type that cannot be partial reports 1 for a graded answer, so a partial answer is exactly the case
  where credit sits strictly between 0 and 1.
- **The three record RPCs carry `p_order smallint[]` and `p_credit numeric`.** A submission that changed one of their
  signatures needs `drop function if exists` for the old one, or Postgres keeps the old overload and the new columns
  are silently never written.

## Rejoin and low data

- **Resume is allowed past `locked` and `full`, but never past a blocked nickname.** The first two are about new
  arrivals; the third is the host looking at a name in a room full of people and removing it. Token comparison is
  `safeEqual` (`timingSafeEqual`), because `quiz-join` is now the one endpoint that answers "is this token mine?".
- **`left_at` is inert.** The rejoin migration adds it and a partial index, but **nothing writes it** — `kick` still
  deletes. Durable rejoin is the `localStorage` token plus resume, nothing else. Making `left_at` meaningful means
  turning `kick` into a soft delete, and the delete is exactly what fails a kicked player's token lookup, so every
  roster, player-count, team and CSV query would then need `left_at is null`. That is a separate change.
- **The low-data flag may only ever subtract.** `low: 1` on `quiz-state` drops the explanation and the next-picture
  preload, and stops the backdrop and the reveal character on the phone. It must never change what a player knows
  about the game; `quiz-state.test.js` asserts the answer and score still arrive.
- **`/play/low` is a second client, not a mode of `/play`.** It shares the server and the pure grading module and
  nothing else — no backdrop, no cast, no sounds, no theme. `playLow.test.js` source-scans it for exactly that and
  fails the first time somebody imports something to make it nicer. Measured at 32.6 KB gzipped against the 60 KB
  target, with `/play` at 8.8 KB for its own chunk plus a much larger shared one.

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
- **`api/_lib/quizCharacterArt.js` is the only place a quiz character is drawn**, and it returns SVG
  **strings**, not React elements — a Vercel function cannot load a `.jsx` file, which is the failure
  recorded in `api/_lib/characterSvg.js`. The browser injects the string into its own `<svg>` with
  `dangerouslySetInnerHTML`; the card parses the same string with `@napi-rs/canvas`. Neither side can
  disagree about what a character looks like. Two things undo this: adding a `react-dom/server` call
  to a serverless function, or drawing a character anywhere else.
- **Nothing admin-authored may reach that markup.** Every part is a key in one of the six lists in the
  same module, and the colour is a validated `#rrggbb`; a character's `name` is never drawn into the
  SVG at all. The serialiser's escaping has to match React's exactly (`'` is `&#x27;`), because the
  drawing moved here out of a React component and a character rendering one glyph differently is a
  bug nobody would notice.
- **`Character.jsx` must keep a real `<svg>` root.** The root carries `qz-char`, `qz-mood-*` and the
  four move classes that `characters.css` animates, plus the `aria-hidden` / `aria-label` the caller
  asked for; only the inside comes from the module. A wrapper element would move those classes off the
  element the stylesheet targets. It must also never import `characters.css` — `characterSvg.test.js`
  checks both of these.
- **`avatar_id` has one stable meaning.** 0–49 is always a built-in; 50–61 is slot 0–11 of that
  quiz's cast. Resolve ids through `characterSpec` and build available ids through `castIds`; never
  add a second avatar-spec column, renumber cast slots, or reuse a retired slot. Deleted character rows
  scrub their authored data but retain a `deleted_at` slot reservation; live rosters omit those rows.
- **The cast roster is the `roster` op on `/api/quiz?action=cast`.** Send `{ op: 'roster', code }` or
  `{ op: 'roster', quizId }`; `roster` is not a top-level quiz action.
- **Hosted games snapshot `quiz_sessions.characters` at start.** Editing a quiz cannot restyle a
  running hosted game. Battles and practice use the quiz's live cast, matching their live theme rules.
- **`sanitizeCast` is the custom-character boundary.** It cleans specs and moves the same way in the
  editor, API and phones, and rejects duplicate or out-of-range slots rather than repairing them.
- **A quiz's `theme` (jsonb) is a design-time draft.** Each game copies it into `quiz_sessions.theme`
  when it starts, so editing a quiz never restyles a game already running. New theme fields need a
  default in `DEFAULT_THEME` and a fallback in the matching `clean*` function, or a hand-edited row
  can put junk on the projector.
- **Backdrop motion is screens-only, and the result card never reads it.** `backdropMotion`,
  `backdropMotionSpeed` and `backdropMotionOnPhones` move `QuizBackdrop` in the browser; the card is a
  static PNG drawn on canvas, so it stays still by design and `PREVIEW_THEME_KEYS` needs no entry for
  them. The eight styles live in `THEME_BACKDROP_MOTION`, with their keyframes in `index.css` named
  `qz-bd-<style>` — a test source-scans the stylesheet so a style cannot be added without one.
- **`resolveMotion` runs when drawing, never when saving.** A per-mark style (float, cascade, twinkle)
  becomes `MOTION_MARKLESS_STANDIN` on a pattern that draws no marks, and `pan` needs a picture. Both
  are resolved in `QuizBackdrop`, so switching pattern and switching back gives the admin the style they
  picked. `cleanMotion` separately settles `pan` to `off` on a non-image pattern, the same defence
  `cleanPattern` gives `image` with no upload. Phones never draw the uploaded picture or a substitute for
  it, so an `image` pattern resolves to `off` on phones even when their motion toggle is enabled.
- **`MOTION_DISTANCE` is not the bleed.** CSS translate percentages are measured against the layer after
  it has grown, and Orbit moves vertically and rotates. `MOTION_BLEED` separately grows all four edges
  far enough to cover those excursions; keep its value larger than the translation distance.
- **Per-mark backdrop styles animate the CSS `translate` property, never `transform`.** Every mark
  carries an inline `transform: rotate(…) scale(…)`, and an animation writing `transform` silently
  discards it. `translate` composes with it. Twinkle is the one style that moved a mark's opacity onto
  its field container, because an animation beats an inline value and a mark that kept its own would
  never fade.
- **Motion is unverified without a real session.** Whether any of the eight styles looks right, whether
  a ping-pong reversal reads as smooth, and whether fifty animated phones hold a battery all need a
  Supabase login and a real room. See `docs/superpowers/specs/2026-10-13-quiz-backdrop-motion-design.md`.
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
