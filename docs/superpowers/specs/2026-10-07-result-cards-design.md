# Result Cards Design

Shareable result cards for NAMMES Hub quizzes. A server-rendered 1080×1920 PNG the player previews, shares through the native share sheet, or saves.

**Status:** approved. **Date:** 2026-10-07. **Plan:** `docs/superpowers/plans/2026-10-07-result-cards.md`

---

## 1. Scope

### In

| Mode | Card variant | Entry point |
|---|---|---|
| Live hosted quiz | Personal | Player phone finished screen |
| Live hosted quiz | Board | Projector final results, admin game report |
| Practice | Personal (practice) | Player finish screen |
| Battle | Duel | Player `FinalBoard` |
| — | Card designer | New **Card** tab in `/admin/quizzes/:id/studio` |

### Out

- **CBT.** No card. `cbt_attempts` has no nickname, no `avatar_id`, no durable per-attempt identifier, and a 24-hour result TTL (`api/_lib/cbt.js:11`). The existing text-only share in `src/components/cbt/ResultView.jsx:11-28` stays as is.
- A public results **page**. Cards are images fetched from the API, not a new route.
- Server-rendered card for a **custom set** (`/set/:code`).

---

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Render | `@napi-rs/canvas` on the server | Matches `api/_lib/awardCardRender.js`. Fonts and layout are exact, no new dependency |
| Format | 1080×1920 | Instagram/WhatsApp status |
| Character | The real cartoon character | Reuses the 50 in `src/components/quiz/Character.jsx` |
| Card content | Personal, no other players' names | Nothing to leak, no consent question |
| Branding | Follows `quizzes.theme` | Card matches the in-game look |
| Interaction | Preview modal → Share / Save | Matches `src/lib/shareCard.js` |
| Auth | Player's existing `quiz_player_tokens` secret | Only that player's card is fetchable |
| Card settings | New `card` jsonb column | `theme` already has a hard 4000-byte check |
| Studio | Tab inside the existing studio | No new route |

---

## 3. Data model

### 3.1 Migration `supabase/migrations/20261007140000_quiz_cards.sql`

```sql
-- Result cards: per-quiz card design settings, and a share code so a finished practice run keeps a card link.
-- A separate column from `theme`, not a key inside it: theme already has a hard pg_column_size < 4000 check
-- (20260930190000_quiz_theme.sql) and a card background path plus flags would eat that budget.
-- quiz_sessions copies the settings when a game starts, exactly as it copies theme, so editing a quiz never
-- restyles a game that has already been played.

alter table public.quizzes
  add column card jsonb not null default '{}'::jsonb
  check (jsonb_typeof(card) = 'object' and pg_column_size(card) < 4000);

alter table public.quiz_sessions
  add column card jsonb not null default '{}'::jsonb
  check (jsonb_typeof(card) = 'object' and pg_column_size(card) < 4000);

alter table public.quiz_practice_runs
  add column share_code text unique
  check (share_code is null or share_code ~ '^[A-Z0-9]{8}$');

create index quiz_practice_runs_share_code_idx
  on public.quiz_practice_runs (share_code) where share_code is not null;
```

**Why a separate column.** `quizzes.theme` and `quiz_sessions.theme` both carry `check (jsonb_typeof(theme) = 'object' and pg_column_size(theme) < 4000)` (`supabase/migrations/20260930190000_quiz_theme.sql`). A background image path and seven flags would consume that budget and risk failing an unrelated save. A separate column also means `sanitizeTheme` never has to know about cards.

**Why sessions get it too.** A game copies `quizzes.card` into `quiz_sessions.card` at create time, alongside the existing `theme` copy at `api/_lib/handlers/quiz-create.js:107-119`. Editing a quiz must never restyle a game that has already been played.

**`share_code` format.** 8 chars from `[A-Z0-9]`, minted once when a practice run finishes. Reusing the battle code shape (`^[A-Z0-9]{6}$`, `supabase/migrations/20261001170000_quiz_battles.sql:14`) but a different length so the two are never confused in a URL.

### 3.2 `quizzes.card` shape

```json
{
  "accent": "#ff5a1f",
  "background": "<quizId>/card-<uuid>.jpg",
  "showCharacter": true,
  "showTitle": true,
  "showPlacement": true,
  "showAccuracy": true,
  "showStreak": true,
  "showTeam": true
}
```

---

## 4. Server modules

### 4.1 `api/_lib/quizCard.js` — settings, pure

Sits under `api/_lib/` so the studio, the API and the renderer all clean a value the same way, per the sharing rule in `AGENTS.md`. No `window`, no Supabase client, no Node built-ins. Colocated test `api/_lib/quizCard.test.js`.

```js
export const DEFAULT_CARD = Object.freeze({
  accent: null,
  background: null,
  showCharacter: true,
  showTitle: true,
  showPlacement: true,
  showAccuracy: true,
  showStreak: true,
  showTeam: true,
})

export function sanitizeCard(input, { quizId } = {}) { /* ... */ }
```

`sanitizeCard` reuses `isHexColor` from `api/_lib/quizTheme.js` and `isQuizImagePath` from `api/_lib/quizImage.js` to scope the background path to the quiz's own folder. Every bad or missing value falls back to its default, and `sanitizeCard(sanitizeCard(x)) === sanitizeCard(x)`.

**Rule from `AGENTS.md` honoured:** every field in `DEFAULT_CARD` has a default *and* a fallback branch in `sanitizeCard`. No new field may be added with a default but no fallback.

Any flag that is not literal `false` stays on, so a hand-edited row can only ever hide a line, never show junk.

**`isQuizImagePath(path, undefined)` returns `true` for any string** (`api/_lib/quizImage.js:17`). Every caller must pass `quizId`, or a hand-edited row could point the renderer at an arbitrary path.

### 4.2 `api/_lib/characterSvg.js` — the character, server-only

Turns the browser component into a static SVG string:

```js
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import Character from '../../src/components/quiz/Character.jsx'

export function characterSvg(id, { mood = 'happy', size = 100 } = {}) {
  const markup = renderToStaticMarkup(createElement(Character, { id, mood }))
  return markup.replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"`)
}
```

One change to `src/components/quiz/Character.jsx`: move `import './characters.css'` (line 2) to `src/components/quiz/QuizParts.jsx`. Node cannot parse CSS, and every browser consumer of `Character` (`src/pages/PlayQuiz.jsx:9`, `PlayPractice.jsx:6`, `PlayBattle.jsx:6`, `CharacterGallery.jsx:3`) already loads `QuizParts`, so the stylesheet still arrives everywhere it did before.

`@napi-rs/canvas` parses a standalone SVG, and `xmlns` is what makes the string standalone. The animation classes (`qz-i-*`, `qz-w-*`, `qz-h-*`) mean nothing without `characters.css` attached, which is exactly right for a still card.

This module breaks the `api/_lib` purity rule on purpose — it imports React and `src/` — the same way `awardCardRender.js` does: server-only, and nothing in `src/` imports it.

**Known risk.** No existing file in `api/` imports from `src/`. `react-dom/server` inside a Vercel serverless function is supported but is new ground for this repo. If bundling fails, the fallback is extracting the shapes from `Character.jsx` into a plain `src/data/quizCharacterShapes.js` module that both sides import — roughly 636 lines moved, and the only option that restores the purity rule. Decide at build time, not in advance.

### 4.3 `api/_lib/quizCardRender.js` — the PNG

Follows `api/_lib/awardCardRender.js`:

- `ensureFonts()` registers `PlayfairDisplay-Bold.ttf`, `PublicSans-Regular.ttf`, `PublicSans-Bold.ttf` from `api/_lib/fonts/`, plus `DejaVuSans.ttf` and `DejaVuSans-Bold.ttf` for the maths backdrop glyphs (π, Σ, √, ∞ …). Guarded by a module-level `fontsRegistered` flag.
- `createCanvas(1080, 1920)`, returns `canvas.toBuffer('image/png')`.
- Reuses `roundRect` and the gradient approach copied from `awardCardRender.js:56-64`.

Three exported functions:

```js
export async function renderPersonalCard(payload)  // { card, theme, quiz, me }
export async function renderBoardCard(payload)     // { card, theme, quiz, ranked, teams }
export async function renderDuelCard(payload)      // { card, theme, quiz, sides, winnerSlot, forfeit, questionCount }
```

Shared internals: `drawBackdrop`, `drawCharacter`, `drawRankBand`, `drawFooter`, `fittedFont` (shrinks type until it fits its box, so a 20-character nickname never runs off the card), `palette`.

**Palette precedence.** The studio's `card.accent` first, then `theme.accent`, then `THEME_LOOKS[look].accent`, then the site's orange. The same precedence `themeAccent` uses, so a card never disagrees with the screens it was shared from.

**Emoji is not available.** The bundled fonts have no emoji glyphs, so 🥇🥈🥉 render as nothing. Rank 1 gets a drawn gold band and a `#1 CROWNED` label; ranks 2 and 3 get drawn silver and bronze bands. `MEDALS` in `PlayQuiz.jsx:22` is not reused here.

**The background image** replaces the pattern rather than sitting under it — two busy layers read as noise. Fetched with the `isAllowedImageUrl` + `AbortSignal.timeout(5000)` + 5MB cap pattern from `api/award-card.js:18-31`. A failed fetch falls back to the drawn pattern; a card must never 500 because a photo 404'd.

The loader is passed to each render function as `loadBackground`, not held in module state: a serverless instance is reused across requests, so a module-level loader set inside a handler is a cross-request race.

**The score is drawn in an accent on a dark background, which is the opposite of what the live screens do with one.** Measured contrast between each look's accent and its own background: classic 3.32, midnight 2.56, sunrise 2.29, forest 1.82, royal 1.91, candy 1.72, ocean 1.70, mono 1.35. Only `classic` clears 3:1, so `palette()` returns an `onBackground` that falls back to white where the accent cannot be read. `contrastRatio(a, b)` is added to `quizTheme.js` for this, reusing its existing luminance helpers.

**Contrast is measured against the gradient, not a background photo.** A photo at 0.45 alpha lifts the backdrop, which can push white under 3:1 on several looks. If photo backdrops are used on cards, darken behind the text or measure the blended colour.

**Board rows are capped, and the cap is computed not fixed.** A 150-player game draws the podium three, then as many rows as clear the footer, then "and N more". `rowsThatFit(from)` derives the count from where the rows start, because team standings take that space first: a fixed cap of 14 overran the footer both with a full table and again once teams were added. Both were found by rendering the card and looking at it, not by a test.

The rows carry the number 11 for a plain board and fewer once teams are present. Do not raise it back to a fixed constant without re-checking a rendered team board.

### 4.4 `api/quiz-card.js` — the endpoint

`GET` only, mirroring `api/award-card.js`. A top-level `api/` file, so Vercel serves `/api/quiz-card` with no `vercel.json` change.

```
GET /api/quiz-card?session=<uuid>&token=<playerToken>   → personal (live)
GET /api/quiz-card?session=<uuid>&view=board            → board    (admin bearer)
GET /api/quiz-card?practice=<shareCode>                 → personal (practice)
GET /api/quiz-card?battle=<code>                        → duel
GET /api/quiz-card?preview=<quizId>                     → personal (sample data, admin optional)
```

Resolution, all with the service-role client:

| Query | Chain |
|---|---|
| `token` | `hashToken(token)` → `quiz_player_tokens.player_id` → `quiz_players` → `quiz_sessions` |
| `session` + `view=board` | `getCaller` + `bearerToken` from `api/_lib/authz.js`, requires `isAdmin` |
| `practice` | `quiz_practice_runs.share_code` → quiz + answers |
| `battle` | `quiz_battles.code` → `quiz_battle_sides` (both rows) + `quizzes` |

Guards, in order:

1. `req.method !== 'GET'` → 405
2. Rate limit. Player variants key on `hashToken(token)`; board and preview on `clientIp(req)`. Copy the factory shape from `api/_lib/handlers/quiz-join.js:7-17`. The board branch is limited **before** `getCaller`, because verifying a JWT with Supabase is the expensive step and a flood of forged ones would otherwise cost a network round trip each. The preview branch needs no token but is the most expensive call (fonts, a React render, a 1080×1920 encode), so it is limited too.
3. `isUuid` on any uuid query param (`api/_lib/validate.js:5`)
4. Unknown token → 401 `Unknown player. Rejoin the game.` — the same message and status `quiz-state.js:39` uses, so the phone handles it identically.
5. Live game not `finished` → 410 `This game is not finished yet.` CBT uses 410 for its expired result (`quiz-cbt.js:287-294`); matching that keeps the "your thing is gone" status consistent. A battle still in progress is 409 instead, matching `quiz-host.js:59`.
6. Prune undefined/null/empty from stats before rendering, so a hidden stat is absent rather than blank.

Headers:

| Variant | `Cache-Control` |
|---|---|
| every error response (400/401/403/405/409/410/429) | `no-store` — a shared cache must not replay "unknown player" or "run is gone" |
| `token`, `practice`, `battle`, `preview` | `no-store` — the URL is a bearer secret, so a cached copy must not outlive the tab |
| `session&view=board` | `private, max-age=300` — a finished game's board never changes, but it carries every player's nickname and score, so **not** a shared cache: `public, s-maxage=…` would let anyone who knew the session id read it from the edge without passing the admin check |

Always `Content-Type: image/png`.

**The preview endpoint is public.** An `<img>` cannot send an `Authorization` header and the preview URL is just the quiz id, so anyone who knows a quiz id can fetch it. It renders only sample data — no player information — so nothing leaks. This is noted in a comment on the function.

### 4.5 `api/_lib/quizCardData.js` — stat shaping, pure

The shaping is worth having as a testable pure function, and `AGENTS.md` says validation and normalisation belong in `api/_lib`.

```js
export function buildPracticeMe(run, answers, total) { /* ... */ }
```

Practice has no leaderboard, so `rank` and `playerCount` are `null` and the renderer draws no rank band and no "placed N of M" line. Practice scoring explicitly runs "without streaks or power-ups" (`quiz-practice.js:15`), so `bestStreak` is `null` rather than a fake `0`.

### 4.6 Stat assembly

**Live personal.** Nickname, `avatar_id`, `total_score`, rank from `rankPlayers` (`api/_lib/quiz.js:124`), player count from the ranked list length, quiz title, `quiz_teams.name` when `session.team_mode`, and from `quiz_player_stats`: `correct_count` plus the session question count from `sessionQuestionIds`.

**Practice personal.** `nickname`, `avatar_id`, `total_score`, quiz title. Accuracy counted from `quiz_practice_answers.correct` — the same derivation as `quiz-practice.js:143-147`.

**Field naming.** The renderer reads `avatarId` and `score`; the database and `rankPlayers` both say `avatar_id` and `total_score`. Rows are renamed by `toBoardRow` in `api/_lib/quizCardData.js` before they reach the renderer. Passing a row straight through drew the literal string `undefined` for every score, and a PNG-magic-number assertion cannot see that, so the shape is tested directly instead.

**Battle duel.** Both `quiz_battle_sides` rows: nickname, `avatar_id`, `total_score`. Winner from `winner_slot`, `forfeit` flag, question count from `question_ids.length`. No rank. Slot `a` is always the left column, so the same battle always draws the same way for both players. `final.questions` in `PlayBattle.jsx` is viewer-oriented (`quiz-battle.js:276-282`), so any per-question row is built from raw `quiz_battle_answers`, never from that payload.

**Board.** `rankPlayers` over all `quiz_players` for the session. Team standings when `session.team_mode`, drawn above the rows and counted against the room the rows have left.

---

## 5. Practice share code

`api/_lib/handlers/quiz-practice.js` mints `share_code` when a run transitions to finished, using `run.share_code ?? generatePracticeShareCode()` so a reload does not orphan the first card link. Returned in the existing `op: 'state'` payload alongside `finished`.

It rides along in the existing `op: 'state'` payload (`base` in `quiz-practice.js`), so a reload re-supplies it and nothing extra is stored on the phone. A run finished before the migration has no code, and the button is gated on it rather than rendering a broken link.

The row is removed by `quiz_practice_cleanup()` after 90 days (`supabase/migrations/20261001130000_quiz_teams_branding_practice.sql:104-115`). A card fetched after that returns 410 `This practice run is no longer stored.` — the same shape as CBT's expiry message. No schema change needed.

**Battle needs no migration.** `code` is already the public key and `/battle/:code` is already shareable (`PlayBattle.jsx:298-326`). The card endpoint just reads both sides' `total_score` server-side, which `op: 'info'` deliberately does not expose today (`quiz-battle.js:469-498`).

---

## 6. Client

### 6.1 `src/lib/shareCard.js`

Split into three so a caller that already has the bytes does not fetch twice:

```js
export async function shareOrDownloadBlob(blob, filename, shareTitle)
export async function shareOrDownloadCard(imageUrl, filename, shareTitle)  // unchanged signature
export function saveCardBlob(blob, filename)
```

`shareOrDownloadCard` keeps its signature and behaviour for the two existing callers (`src/components/awards/ResultsSummary.jsx:6`, `src/pages/Awards.jsx:84`).

### 6.2 `src/lib/quizCard.js`

```js
export function personalCardUrl({ sessionId, token })
export function boardCardUrl(sessionId)
export function practiceCardUrl(shareCode)
export function duelCardUrl(code)
export async function fetchCardBlob(url, { admin })
export function cardFilename(nickname, fallback)
```

`fetchCardBlob` sends the admin's Supabase session as an `Authorization` header when `admin` is true, and surfaces the server's own error message. `cardFilename` uses `fileSlug` from `src/lib/downloadFile.js:15`.

**Why a blob and not an `<img src>`:** the board card needs an `Authorization` header, which an `<img>` cannot send. Fetching to a blob also means the image is already in memory, so Save does not re-download it.

### 6.3 `src/components/quiz/ResultCardModal.jsx`

The preview. Shows the PNG at `max-w-sm`, with Share and Save below, plus loading and error states.

- Share and Save both use the fetched blob. Save forces the download path via `saveCardBlob`, which revokes on a delay like `downloadTextFile` does, since some browsers have not started reading the blob when `click()` returns.
- Error state reuses `src/components/ui/ErrorState.jsx` with the server's message.
- Closes on backdrop tap, `Escape`, and after a successful save.
- Uses the `share` and `download` glyphs, both already in the `icon_names=` list in `index.html`, so `src/lib/iconFont.test.js` stays green.
- Not wrapped in `Phone`, `Stage` or `Shell`, and each page renders it as a **sibling** of that frame, not a child. `useProjectorFit` zooms `Stage`'s `<main>` when the standings overflow, and a `position: fixed` overlay inside a zoomed element is anchored to that element rather than the screen — a bug that only appears on a busy finished screen, which is the one that wants a board card.
- Follows the repo's modal conventions (`src/components/admin/quizLibrary/QuizModal.jsx`): `useBodyScrollLock()`, focus moved to the dialog with `tabIndex={-1}`, Escape on `window`, a `div` backdrop that closes on click, and `ErrorState` for the failure case. No focus trap — no modal in this repo has one.
- The object URL is revoked when the modal closes, not held for the tab's lifetime.

### 6.4 Button placements

| File | Line | Variant |
|---|---|---|
| `src/pages/PlayQuiz.jsx` | before `:807` "Play again" | Personal |
| `src/pages/HostQuiz.jsx` | `:828`, beside "Download results (CSV)" | Board |
| `src/pages/admin/AdminQuizReport.jsx` | `:150`, beside "Export CSV" | Board |
| `src/pages/PlayPractice.jsx` | `:342-372` finish screen | Practice |
| `src/pages/PlayBattle.jsx` | `:390-434` `FinalBoard` | Duel |

The admin report's button sits inside the existing `qz-no-print` div at line 149, so it does not print. Phone copy is "Share my result"; projector and admin copy is "Result card".

---

## 7. Studio

`src/pages/admin/AdminQuizStudio.jsx` gains a fourth `TabButton` after "Characters (50)" (line 174), with its own save button since the theme save is hidden there.

- **Accent colour** — reuses the picker at line 213. `null` means inherit from the theme, and the studio shows which it is using.
- **Background image** — `uploadBrandingImage(quizId, file, { maxEdge: BACKDROP_MAX_EDGE, maxBytes: BACKDROP_MAX_BYTES })` from `src/data/quizBranding.js:21`. Shows the current image with a remove button.
- **Stat lines** — one checkbox each for character, quiz title, placement, accuracy, streak, team.
- **Preview** — a real 1080×1920 render at `/api/quiz-card?preview=<quizId>` using sample data. The endpoint renders the *saved* card, so the sanitised draft is hashed by `cardPreviewVersion()` onto the url and onto the `key`, forcing a redraw on every edit. Without that the preview sits on the old design until a full reload.

**The card's save sweep must not touch the look's pictures, and vice versa.** Both mutations compute `keep` and the delete candidates from the *same* `theme` object, so theme pictures are symmetric and can never be deleted by the wrong save. The look's save deliberately passes no `card`, because a card draft that has dropped its background says nothing about what is still in the database.

Saved by `saveQuizCard(id, card)` in `src/data/quiz.js`, beside `saveQuizTheme` (line 367). It calls `sanitizeCard` client-side first, so the studio cannot save a value the renderer would reject.

`brandingPaths` (`src/data/quizBranding.js:35`) gains a `card` parameter so deleting a quiz removes the card image and swapping it does not orphan the old file.

---

## 8. Tests

| File | Covers |
|---|---|
| `api/_lib/quizCard.test.js` | `sanitizeCard` falls back on bad hex / bad flags / a path from another quiz; idempotent; every `DEFAULT_CARD` key survives a `{}` input |
| `api/_lib/characterSvg.test.js` | All 50 ids produce a complete SVG; out-of-range ids fall back to 0; mood changes the output; size is honoured |
| `api/_lib/quizCardRender.test.js` | PNG magic number on every variant; every-stat-hidden still renders; no theme still renders; long nickname does not throw; missing streak changes the output; empty board renders; `rowsThatFit` keeps rows and their summary line clear of the footer with and without teams; every look stays legible |
| `api/_lib/handlers/quiz-card.test.js` | 405/400/401/403/409/410/429 paths, admin gate on board, cache headers, the shape the renderer is given |
| `src/lib/quizCard.test.js` | each URL variant matches the query its endpoint branch reads; tokens are encoded; filenames stay safe; the server's own error message and status survive |
| `api/_lib/quizCardData.test.js` (in the handler test) | `buildPracticeMe` shape, no streak, no rank |

Canvas tests run in Node and need no browser guard, but they are slow (~200ms each). Keep them to a handful of assertions and do not snapshot the image.

---

## 9. Constraints from `AGENTS.md` this work must not break

- **`api/_lib` purity.** `quizCard.js` and `quizCardData.js` obey it. `characterSvg.js` and `quizCardRender.js` do not, exactly as `awardCardRender.js` does not. Nothing in `src/` may import either.
- **Icons.** Any new `material-symbols-outlined` name must be added to `icon_names=` in `index.html`, alphabetically, or `src/lib/iconFont.test.js` fails. `share`, `download`, `image`, `close`, `trophy`, `palette`, `star` are all present already.
- **Comments explain why.** The rate limiter, the `no-store` choice, the CSS import move and the public preview endpoint all need a why-not-what line.
- **No `console.log`, no commented-out code.**
- **Tailwind tokens only** in JSX. The PNG renderer is not JSX and uses hex directly, like `awardCardRender.js` — that is the one place raw hex is correct.

---

## 10. Build order

1. Migration + `sanitizeCard`
2. Copy `card` into `quiz_sessions`, add `saveQuizCard`
3. Move the CSS import, `characterSvg` — **verify `npm run build` and a real `loadImage` here, before writing any rendering code**
4. `quizCardRender`
5. Endpoint: live personal + board
6. Practice share code
7. Battle duel
8. Client lib + modal
9. Five button placements
10. Studio tab
11. Verification

Task 3 is the gate. If `react-dom/server` does not bundle into a Vercel function, stop and switch to shape extraction before writing anything else.

---

## 11. Risks, in the order they would bite

1. **`react-dom/server` in a Vercel function** — no `api/` file currently imports from `src/`.
2. **The migration must be applied before anything renders.** A missing `card` column makes every read throw.
3. **A card's layout cannot be judged from its buffer.** Three real defects got through a green suite and were caught only by rendering and looking: a board row through the footer, a duel crammed into the top half, and an accent-coloured score too dark to read. Render the variants and look at them.
4. **`isQuizImagePath(path, undefined)` returns `true` for any string** (`api/_lib/quizImage.js:17`). Every card code path must pass `quizId`.
5. **Emoji render as nothing.** No emoji font is bundled, which is why rank 1 gets a drawn crown rather than 🥇.

---

## 12. Verification

```bash
npm test
npm run lint
npm run build
```

Then, and this cannot be faked: apply the migration, host a real game with a Supabase login, finish it, open the card and look at it.

**As of writing, the card output has not been seen in a real game, the character on canvas has not been verified, and the studio preview has not been checked.**