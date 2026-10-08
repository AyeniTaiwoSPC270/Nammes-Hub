# Result Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every quiz result can be turned into a 1080×1920 PNG the player previews, shares through the native share sheet, or saves.

**Architecture:** A new `quizzes.card` / `quiz_sessions.card` jsonb column holds per-quiz card design settings, cleaned by a pure `sanitizeCard` in `api/_lib/quizCard.js`. A new `api/quiz-card.js` GET endpoint resolves a result four ways — player token (live), admin bearer (board), `share_code` (practice), `code` (battle) — assembles the stats, and hands them to `api/_lib/quizCardRender.js`, which draws a PNG with `@napi-rs/canvas` using the fonts already in `api/_lib/fonts/`. The cartoon character reaches the server as an SVG string produced by rendering the existing `Character.jsx` with `react-dom/server`. One modal, `ResultCardModal.jsx`, fetches the PNG as a blob and offers Share or Save.

**Tech Stack:** React 19, `@napi-rs/canvas`, `react-dom/server`, Supabase (Postgres + Storage), Tailwind 4, Vitest, Vercel serverless (Node).

**Spec:** `docs/superpowers/specs/2026-10-07-result-cards-design.md`

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/20261007140000_quiz_cards.sql` | `quizzes.card`, `quiz_sessions.card`, `quiz_practice_runs.share_code` |
| `api/_lib/quizCard.js` | `DEFAULT_CARD`, `sanitizeCard` — pure, shared browser/server |
| `api/_lib/quizCard.test.js` | sanitiser contract |
| `api/_lib/characterSvg.js` | `characterSvg(id, { mood, size })` → SVG string. Server-only |
| `api/_lib/characterSvg.test.js` | all 50 ids produce valid SVG |
| `api/_lib/quizCardRender.js` | `renderPersonalCard`, `renderBoardCard`, `renderDuelCard`. Server-only |
| `api/_lib/quizCardRender.test.js` | non-empty buffers, stat toggles change output |
| `api/_lib/quizCardData.js` | `buildPracticeMe` — pure stat shaping |
| `api/_lib/handlers/quiz-card.js` | handler factory `createQuizCardHandler(getClient, { allow, caller, baseUrl })` |
| `api/_lib/handlers/quiz-card.test.js` | 405/400/401/403/409/410/429 paths, auth, cache headers |
| `api/quiz-card.js` | the route file |
| `api/_lib/handlers/quiz-practice.js` | mint `share_code` on finish (modify) |
| `api/_lib/handlers/quiz-create.js` | copy `card` into `quiz_sessions` (modify) |
| `api/_lib/quiz.js` | `generatePracticeShareCode` (modify) |
| `src/lib/shareCard.js` | add `shareOrDownloadBlob`, `saveCardBlob` (modify) |
| `src/lib/quizCard.js` | URL builders, `fetchCardBlob`, `cardFilename` |
| `src/components/quiz/ResultCardModal.jsx` | the preview |
| `src/pages/PlayQuiz.jsx` | button (modify) |
| `src/pages/HostQuiz.jsx` | button (modify) |
| `src/pages/admin/AdminQuizReport.jsx` | button (modify) |
| `src/pages/PlayPractice.jsx` | store `shareCode`, button (modify) |
| `src/pages/PlayBattle.jsx` | button (modify) |
| `src/pages/admin/AdminQuizStudio.jsx` | Card tab (modify) |
| `src/data/quiz.js` | `saveQuizCard` (modify) |
| `src/data/quizBranding.js` | `brandingPaths` takes `card` (modify) |
| `src/components/quiz/Character.jsx` | move CSS import only (modify) |
| `src/components/quiz/QuizParts.jsx` | receive CSS import (modify) |

## Review gates

Every task ends with the same two gates. **Neither is skippable.**

**Spec Review** — a fresh subagent checks the task's diff against that task's stated requirement plus the spec. It must confirm: nothing in the requirement is unimplemented, nothing outside it was added (YAGNI), and every error path the requirement names actually returns. Output: pass, or a list of gaps.

**Code Review** — a second fresh subagent reviews against `AGENTS.md` and the codebase's conventions. It must check: `api/_lib/*.js` purity (no `window`, no Supabase client, no Node built-ins in files `src/` imports); icons present in `icon_names=`; Tailwind tokens not raw hex in JSX; every `DEFAULT_CARD` key has a fallback in `sanitizeCard`; comments explain why; no `console.log`; no commented-out code; tests colocated. Output: pass, or a list of violations.

Plus `npm test && npm run lint && npm run build` must exit 0 at the end of every task.

---

### Task 1: Card settings column + sanitiser

The foundation. Nothing renders until this exists, and `sanitizeCard` is the only thing allowed to decide what a card value is.

**Files:**
- Create: `supabase/migrations/20261007140000_quiz_cards.sql`
- Create: `api/_lib/quizCard.js`
- Create: `api/_lib/quizCard.test.js`

**Produces:** `DEFAULT_CARD` and `sanitizeCard(input, { quizId })`, consumed by Tasks 5, 6, 7 and 10.

- [ ] **Step 1: Write the migration**

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

- [ ] **Step 2: Apply it**

This repo has a real `supabase/migrations` directory, so the file is the source of truth. Apply with the Supabase CLI or the SQL editor, then confirm with `select column_name from information_schema.columns where table_name in ('quizzes','quiz_sessions','quiz_practice_runs') and column_name in ('card','share_code');` — expect three rows.

- [ ] **Step 3: Write the failing test**

`api/_lib/quizCard.test.js`:

```javascript
import { describe, expect, it } from 'vitest'
import { DEFAULT_CARD, sanitizeCard } from './quizCard.js'

const QUIZ = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

describe('sanitizeCard', () => {
  it('fills in every default from an empty object', () => {
    expect(sanitizeCard({})).toEqual(DEFAULT_CARD)
  })

  it('fills in every default from junk', () => {
    expect(sanitizeCard('nope')).toEqual(DEFAULT_CARD)
    expect(sanitizeCard([1, 2, 3])).toEqual(DEFAULT_CARD)
    expect(sanitizeCard(null)).toEqual(DEFAULT_CARD)
  })

  it('keeps a lowercased hex accent and drops anything else', () => {
    expect(sanitizeCard({ accent: '#FF5A1F' }).accent).toBe('#ff5a1f')
    expect(sanitizeCard({ accent: 'red' }).accent).toBeNull()
    expect(sanitizeCard({ accent: '#ff5a' }).accent).toBeNull()
  })

  it('treats any flag that is not literal false as on', () => {
    expect(sanitizeCard({ showStreak: false }).showStreak).toBe(false)
    expect(sanitizeCard({ showStreak: 0 }).showStreak).toBe(true)
    expect(sanitizeCard({ showStreak: 'no' }).showStreak).toBe(true)
  })

  it('keeps a background path in this quiz folder only', () => {
    const path = `${QUIZ}/33333333-3333-4333-8333-333333333333-1700000000000.jpg`
    expect(sanitizeCard({ background: path }, { quizId: QUIZ }).background).toBe(path)
    expect(sanitizeCard({ background: `${OTHER}/x.jpg` }, { quizId: QUIZ }).background).toBeNull()
    expect(sanitizeCard({ background: 'https://evil.example/x.jpg' }, { quizId: QUIZ }).background).toBeNull()
  })

  it('is idempotent', () => {
    const once = sanitizeCard({ accent: '#ABCDEF', showTeam: false }, { quizId: QUIZ })
    expect(sanitizeCard(once, { quizId: QUIZ })).toEqual(once)
  })

  it('never returns a key that is not in DEFAULT_CARD', () => {
    expect(Object.keys(sanitizeCard({ nonsense: true })).sort()).toEqual(Object.keys(DEFAULT_CARD).sort())
  })
})
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `npm test -- quizCard`
Expected: FAIL — `Cannot find module './quizCard.js'`.

- [ ] **Step 5: Write the implementation**

`api/_lib/quizCard.js`:

```javascript
import { isHexColor } from './quizTheme.js'
import { isQuizImagePath } from './quizImage.js'

// How the result card is designed. Separate from the theme: theme drives the projector and phone screens, card
// drives one exported image, and the theme column has a size cap this must not eat into.
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

// Any value that is not literal false leaves the line on, so a hand-edited row can only ever hide a line.
function flag(value) {
  return value !== false
}

export function sanitizeCard(input, { quizId } = {}) {
  const c = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  return {
    accent: isHexColor(c.accent) ? c.accent.toLowerCase() : null,
    background: isQuizImagePath(c.background, quizId) ? c.background.toLowerCase() : null,
    showCharacter: flag(c.showCharacter),
    showTitle: flag(c.showTitle),
    showPlacement: flag(c.showPlacement),
    showAccuracy: flag(c.showAccuracy),
    showStreak: flag(c.showStreak),
    showTeam: flag(c.showTeam),
  }
}
```

`isQuizImagePath(path, quizId)` returns `true` for any string when `quizId` is `undefined` (`api/_lib/quizImage.js:17`). That is why the two path tests pass `quizId`, and why the renderer must always pass it too.

- [ ] **Step 6: Run it to confirm it passes**

Run: `npm test -- quizCard`
Expected: PASS, 7 tests.

- [ ] **Step 7: Verify the whole suite and the build**

Run: `npm test && npm run lint && npm run build`
Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261007140000_quiz_cards.sql api/_lib/quizCard.js api/_lib/quizCard.test.js
git commit -m "feat(quiz): add result card settings column and sanitiser"
```

- [ ] **Step 9: SPEC REVIEW** then **CODE REVIEW**

---

### Task 2: Copy card settings into a game when it starts

**Files:**
- Modify: `api/_lib/handlers/quiz-create.js:107-119`
- Modify: `api/_lib/handlers/quiz-practice.js` (`view()` at line 142)
- Modify: `src/data/quiz.js` (add `saveQuizCard`)

**Spec requirement:** A game copies `quizzes.card` into `quiz_sessions.card` at create time. Editing a quiz must never restyle a finished game.

- [ ] **Step 1: Read the current create insert**

Run: `grep -n "theme" api/_lib/handlers/quiz-create.js`
Expected: a `const theme = sanitizeTheme(quiz?.theme, { quizId })` line and `theme,` inside the insert object at ~line 113.

- [ ] **Step 2: Add the sanitise line**

Immediately after the existing `theme` line, add:

```javascript
  const card = sanitizeCard(quiz?.card, { quizId })
```

and add `import { sanitizeCard } from '../quizCard.js'`.

- [ ] **Step 3: Write it into the insert**

Add `card,` directly after `theme,` in the `quiz_sessions` insert object at `api/_lib/handlers/quiz-create.js:107-119`.

- [ ] **Step 4: Send the card to the practice finish screen too**

In `quiz-practice.js`, `view()` builds `base` at line 142. Add `card: sanitizeCard(quiz?.card, { quizId: run.quiz_id })` to that object, and import `sanitizeCard` from `'../quizCard.js'`. Task 9 needs it on the phone.

- [ ] **Step 5: Add `saveQuizCard` to the data layer**

In `src/data/quiz.js`, directly after `saveQuizTheme` (line 367), add:

```javascript
// Saves the result card design from the studio's Card tab. Cleaned on the client too, so the studio cannot save a
// value the renderer would reject.
export async function saveQuizCard(id, card) {
  const clean = sanitizeCard(card, { quizId: id })
  const { data, error } = await supabase.from('quizzes').update({ card: clean }).eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No changes were saved — your account may not have admin access to make this change.')
  }
  return clean
}
```

Add `import { sanitizeCard } from '../../api/_lib/quizCard.js'` to the top of `src/data/quiz.js`. This is the documented cross-boundary import pattern; `quizCard.js` has no Node built-ins so it is safe to bundle.

- [ ] **Step 6: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all exit 0.

- [ ] **Step 7: Commit**

```bash
git add api/_lib/handlers/quiz-create.js api/_lib/handlers/quiz-practice.js src/data/quiz.js
git commit -m "feat(quiz): copy card settings into a game at create time"
```

- [ ] **Step 8: SPEC REVIEW** then **CODE REVIEW**

---

### Task 3: The character as an SVG string

**The gate task.** If `react-dom/server` does not bundle into a Vercel function, stop here and switch to shape extraction before writing anything else.

**Files:**
- Modify: `src/components/quiz/Character.jsx:2`
- Modify: `src/components/quiz/QuizParts.jsx:6`
- Create: `api/_lib/characterSvg.js`
- Create: `api/_lib/characterSvg.test.js`

**Spec requirement:** The card shows the player's real cartoon character, drawn by the same code the browser uses.

- [ ] **Step 1: Move the CSS import**

`src/components/quiz/Character.jsx` line 2 is `import './characters.css'`. Delete it.

Add `import './characters.css'` to `src/components/quiz/QuizParts.jsx`, next to its other imports at line 6.

Why: Node cannot parse CSS, and the server render has to import this module. Every browser consumer of `Character` (`PlayQuiz.jsx:9`, `PlayPractice.jsx:6`, `PlayBattle.jsx:6`, `CharacterGallery.jsx:3`) already loads `QuizParts`, so the stylesheet still arrives everywhere it did before.

- [ ] **Step 2: Confirm the characters still look right**

Run: `npm run dev`, open a quiz and step through several characters.
Expected: all 50 animate as before. Do not proceed on a hunch — the animations are the thing most likely to break here.

- [ ] **Step 3: Write the failing test**

`api/_lib/characterSvg.test.js`:

```javascript
import { describe, expect, it } from 'vitest'
import { characterSvg } from './characterSvg.js'
import { AVATAR_COUNT } from '../../src/data/quizCharacters.js'

describe('characterSvg', () => {
  it('produces a complete svg for all 50 characters', () => {
    for (let id = 0; id < AVATAR_COUNT; id++) {
      const svg = characterSvg(id)
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg.endsWith('</svg>')).toBe(true)
      expect(svg).toContain('viewBox="0 0 100 100"')
      expect(svg).toContain('</g>')
    }
  })

  it('falls back to the first character for an id that does not exist', () => {
    expect(characterSvg(999)).toBe(characterSvg(0))
    expect(characterSvg(-1)).toBe(characterSvg(0))
  })

  it('carries the mood so a happy face differs from a sad one', () => {
    expect(characterSvg(3, { mood: 'sad' })).not.toBe(characterSvg(3, { mood: 'happy' }))
  })

  it('honours the requested size', () => {
    expect(characterSvg(0, { size: 420 })).toContain('width="420"')
  })
})
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `npm test -- characterSvg`
Expected: FAIL — `Cannot find module './characterSvg.js'`.

- [ ] **Step 5: Write the implementation**

`api/_lib/characterSvg.js`:

```javascript
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import Character from '../../src/components/quiz/Character.jsx'

// The quiz characters are inline SVG React components, not image files, so the only way to get one onto a
// server-rendered canvas card is to render the very same component to a string here. Rendering the component
// rather than redrawing it means the card can never drift from what the player saw in the lobby.
//
// This module breaks the api/_lib purity rule on purpose (it imports React and src/), the same way
// awardCardRender.js does: it is server-only, and nothing in src/ imports it. Character.jsx's CSS import moved to
// QuizParts.jsx for the same reason — Node cannot parse CSS.

// @napi-rs/canvas parses a standalone SVG, and xmlns is what makes the string standalone. The animation classes
// (qz-i-*, qz-w-*, qz-h-*) mean nothing without characters.css attached, which is exactly right for a still card.
export function characterSvg(id, { mood = 'happy', size = 100 } = {}) {
  const markup = renderToStaticMarkup(createElement(Character, { id, mood }))
  return markup.replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"`)
}
```

- [ ] **Step 6: Run it to confirm it passes**

Run: `npm test -- characterSvg`
Expected: PASS, 4 tests.

- [ ] **Step 7: Prove the string actually loads into a canvas**

This is the real gate — the test above only proves the string is well-formed, not that Skia can draw it. Run:

```bash
node --input-type=module -e "
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { characterSvg } from './api/_lib/characterSvg.js';
const svg = characterSvg(13, { size: 300 });
const img = await loadImage(Buffer.from(svg));
console.log('loaded', img.width, 'x', img.height);
const c = createCanvas(300, 300);
const ctx = c.getContext('2d');
ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 300, 300);
ctx.drawImage(img, 0, 0, 300, 300);
const buf = c.toBuffer('image/png');
console.log('png bytes', buf.length);
"
```

Expected: `loaded 300 x 300` and a png byte count in the tens of thousands. A byte count near 1000 means nothing drew and the character is invisible — investigate before continuing.

- [ ] **Step 8: Confirm it builds into a serverless function**

Run: `npm run build`, then trigger a preview deploy and confirm the Node function bundles.
Expected: the build completes. If `react-dom/server` cannot be bundled into the Node runtime, **stop** and report back: the fallback is extracting `Character.jsx`'s shapes into `src/data/quizCharacterShapes.js`, which both sides import, satisfying the purity rule.

- [ ] **Step 9: Commit**

```bash
git add src/components/quiz/Character.jsx src/components/quiz/QuizParts.jsx api/_lib/characterSvg.js api/_lib/characterSvg.test.js
git commit -m "feat(quiz): render the cartoon characters to SVG strings for server-side cards"
```

- [ ] **Step 10: SPEC REVIEW** then **CODE REVIEW**

---

### Task 4: The card renderer

**Files:**
- Create: `api/_lib/quizCardRender.js`
- Create: `api/_lib/quizCardRender.test.js`

**Produces:** `renderPersonalCard`, `renderBoardCard`, `renderDuelCard`. Task 5 imports these.

- [ ] **Step 1: Write the failing test**

`api/_lib/quizCardRender.test.js`:

```javascript
import { describe, expect, it } from 'vitest'
import { DEFAULT_CARD } from './quizCard.js'
import { renderBoardCard, renderDuelCard, renderPersonalCard } from './quizCardRender.js'

const QUIZ = { title: 'Naming Origins' }
const THEME = { look: 'classic', accent: null, pattern: 'math', logo: null, backdropOpacity: 8 }
const ME = { nickname: 'Ada', avatarId: 13, score: 14200, rank: 3, playerCount: 42, correctCount: 12, totalQuestions: 15, bestStreak: 5, teamName: 'Crimson' }

describe('renderPersonalCard', () => {
  it('returns a real png buffer', async () => {
    const png = await renderPersonalCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, me: ME })
    expect(Buffer.isBuffer(png)).toBe(true)
    expect(png.length).toBeGreaterThan(5000)
    // PNG magic number, so this cannot pass on an empty or error buffer.
    expect(png.subarray(1, 4).toString()).toBe('PNG')
  })

  it('still renders when every stat is hidden', async () => {
    const card = { ...DEFAULT_CARD, showAccuracy: false, showStreak: false, showPlacement: false, showTeam: false, showTitle: false, showCharacter: false }
    const png = await renderPersonalCard({ card, theme: THEME, quiz: QUIZ, me: ME })
    expect(png.length).toBeGreaterThan(5000)
  })

  it('renders without a theme at all', async () => {
    const png = await renderPersonalCard({ card: DEFAULT_CARD, theme: null, quiz: null, me: ME })
    expect(png.subarray(1, 4).toString()).toBe('PNG')
  })

  it('copes with a very long nickname without throwing', async () => {
    const png = await renderPersonalCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, me: { ...ME, nickname: 'Bartholomew Fitzgerald-Montgomery III' } })
    expect(png.length).toBeGreaterThan(5000)
  })

  it('skips the streak line when there is no streak to show', async () => {
    const withStreak = await renderPersonalCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, me: ME })
    const without = await renderPersonalCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, me: { ...ME, bestStreak: null } })
    expect(without.length).not.toBe(withStreak.length)
  })
})

describe('renderBoardCard', () => {
  it('returns a real png for a full table', async () => {
    const ranked = Array.from({ length: 42 }, (_, i) => ({ rank: i + 1, nickname: `Player ${i + 1}`, avatarId: i % 50, score: 10000 - i * 100 }))
    const png = await renderBoardCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, ranked, teams: [] })
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect(png.length).toBeGreaterThan(5000)
  })

  it('renders with nobody on the board', async () => {
    const png = await renderBoardCard({ card: DEFAULT_CARD, theme: THEME, quiz: QUIZ, ranked: [], teams: [] })
    expect(png.subarray(1, 4).toString()).toBe('PNG')
  })
})

describe('renderDuelCard', () => {
  it('returns a real png for two sides', async () => {
    const png = await renderDuelCard({
      card: DEFAULT_CARD, theme: THEME, quiz: QUIZ,
      sides: [{ slot: 'a', nickname: 'Ada', avatarId: 13, score: 14200 }, { slot: 'b', nickname: 'Bola', avatarId: 24, score: 9900 }],
      winnerSlot: 'a', forfeit: false, questionCount: 10,
    })
    expect(png.subarray(1, 4).toString()).toBe('PNG')
  })

  it('renders a draw', async () => {
    const png = await renderDuelCard({
      card: DEFAULT_CARD, theme: THEME, quiz: QUIZ,
      sides: [{ slot: 'a', nickname: 'Ada', avatarId: 13, score: 900 }, { slot: 'b', nickname: 'Bola', avatarId: 24, score: 900 }],
      winnerSlot: null, forfeit: false, questionCount: 8,
    })
    expect(png.subarray(1, 4).toString()).toBe('PNG')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- quizCardRender`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the renderer**

`api/_lib/quizCardRender.js`. Scaffold, then the three exports:

```javascript
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { characterSvg } from './characterSvg.js'
import { DEFAULT_CARD, sanitizeCard } from './quizCard.js'
import { sanitizeTheme, THEME_LOOKS } from './quizTheme.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 1080x1920 is the story format: it is what Instagram and WhatsApp status both crop to without losing the middle.
export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1920

let fontsRegistered = false
function ensureFonts() {
  if (fontsRegistered) return
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/PlayfairDisplay-Bold.ttf'), 'Playfair Display')
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/PublicSans-Regular.ttf'), 'Public Sans')
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/PublicSans-Bold.ttf'), 'Public Sans Bold')
  // The maths backdrop needs glyphs the two Public Sans faces do not carry (pi, sigma, root, infinity).
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/DejaVuSans.ttf'), 'DejaVu Sans')
  GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/DejaVuSans-Bold.ttf'), 'DejaVu Sans Bold')
  fontsRegistered = true
}
```

Then these helpers:

```javascript
const GOLD = '#e9b64f'
const GOLD_LIGHT = '#f7dfa0'
const SILVER = '#c7ccd1'
const BRONZE = '#b07a3c'
const QUIZ_GLYPHS = ['π', 'Σ', '∫', '√', 'Δ', 'λ', 'θ', '∞', '≈', '±']

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Shrinks the type until it fits the box, so a 20-character nickname never runs off the card.
function fittedFont(ctx, text, maxWidth, startSize, family = 'Public Sans Bold') {
  let size = startSize
  ctx.font = `bold ${size}px "${family}"`
  while (ctx.measureText(text).width > maxWidth && size > 24) {
    size -= 4
    ctx.font = `bold ${size}px "${family}"`
  }
  return size
}

// The card's palette: the studio's own choice first, then the theme's accent, then the look's own accent. The same
// precedence themeAccent uses, so a card never disagrees with the screens it was shared from.
function palette(card, theme) {
  const t = sanitizeTheme(theme)
  const accent = card.accent ?? t.accent ?? THEME_LOOKS[t.look].accent
  return { accent, deepA: THEME_LOOKS[t.look].deep[0], deepB: THEME_LOOKS[t.look].deep[1] }
}

// The card background, injected by the endpoint so tests never reach the network.
let backgroundLoader = async () => null
export function setBackgroundLoader(fn) { backgroundLoader = fn }

async function drawBackdrop(ctx, card, theme, colors) {
  const t = sanitizeTheme(theme)
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT)
  bg.addColorStop(0, colors.deepA)
  bg.addColorStop(1, colors.deepB)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // A background picture replaces the pattern rather than sitting under it: two busy layers read as noise.
  const buffer = card.background ? await backgroundLoader(card.background) : null
  if (buffer) {
    try {
      const image = await loadImage(buffer)
      const scale = Math.max(CARD_WIDTH / image.width, CARD_HEIGHT / image.height)
      ctx.save()
      ctx.globalAlpha = 0.45
      ctx.drawImage(image, (CARD_WIDTH - image.width * scale) / 2, (CARD_HEIGHT - image.height * scale) / 2, image.width * scale, image.height * scale)
      ctx.restore()
      return
    } catch {
      // A picture that will not decode falls through to the pattern: a card must still render.
    }
  }

  // The pattern is drawn faint, the way QuizBackdrop draws it behind the live screens.
  ctx.save()
  ctx.globalAlpha = Math.max(0.04, t.backdropOpacity / 100)
  ctx.fillStyle = colors.accent
  ctx.font = 'bold 64px "DejaVu Sans"'
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 10; col++) {
      ctx.fillText(QUIZ_GLYPHS[(row * 7 + col * 3) % QUIZ_GLYPHS.length], col * 130 + (row % 2 ? 65 : 0) - 20, row * 130 + 40)
    }
  }
  ctx.restore()
}

async function drawCharacter(ctx, avatarId, cx, cy, size, mood = 'happy') {
  const image = await loadImage(Buffer.from(characterSvg(avatarId, { mood, size })))
  ctx.drawImage(image, cx - size / 2, cy - size / 2, size, size)
}

// Rank 1 gets a drawn gold band. The emoji medals the live screens use have no glyphs in the bundled fonts, so
// they would render as nothing at all on a canvas.
function drawRankBand(ctx, rank, cx, cy, width) {
  const colors = rank === 1 ? [GOLD_LIGHT, GOLD, '#a9781f'] : rank === 2 ? ['#eef1f3', SILVER, '#8d949b'] : ['#f0d9c2', BRONZE, '#7d5227']
  const grad = ctx.createLinearGradient(cx - width / 2, cy, cx + width / 2, cy)
  grad.addColorStop(0, colors[0])
  grad.addColorStop(0.45, colors[1])
  grad.addColorStop(1, colors[2])
  ctx.fillStyle = grad
  roundRect(ctx, cx - width / 2, cy - 34, width, 68, 12)
  ctx.fill()
}

function drawFooter(ctx, colors) {
  ctx.strokeStyle = colors.accent
  ctx.globalAlpha = 0.5
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(CARD_WIDTH / 2 - 160, CARD_HEIGHT - 110)
  ctx.lineTo(CARD_WIDTH / 2 + 160, CARD_HEIGHT - 110)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = 'bold 30px "Public Sans Bold"'
  ctx.textAlign = 'center'
  ctx.fillText('NAMMES HUB', CARD_WIDTH / 2, CARD_HEIGHT - 60)
}
```

Now the three exports:

```javascript
export async function renderPersonalCard({ card, theme, quiz, me }) {
  ensureFonts()
  const c = sanitizeCard(card)
  const t = sanitizeTheme(theme)
  const colors = palette(c, t)
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT)
  const ctx = canvas.getContext('2d')

  await drawBackdrop(ctx, c, t, colors)
  ctx.textAlign = 'center'

  if (c.showTitle && quiz?.title) {
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    fittedFont(ctx, quiz.title, CARD_WIDTH - 160, 40, 'Public Sans')
    ctx.fillText(quiz.title, CARD_WIDTH / 2, 150)
  }

  if (c.showCharacter) {
    // Podium players get the dancing character, everyone else the plain happy face.
    await drawCharacter(ctx, me.avatarId, CARD_WIDTH / 2, 620, 460, me.rank && me.rank <= 3 ? 'dance' : 'happy')
  }

  // The one big line on the card.
  ctx.fillStyle = '#ffffff'
  fittedFont(ctx, me.nickname, CARD_WIDTH - 120, 96, 'Playfair Display')
  ctx.fillText(me.nickname, CARD_WIDTH / 2, 960)

  // Rank when there is one. Practice has none, so no band is drawn at all rather than an empty one.
  if (c.showPlacement && me.rank) {
    drawRankBand(ctx, me.rank, CARD_WIDTH / 2, 1060, 460)
    ctx.fillStyle = me.rank === 1 ? '#3a2a06' : '#ffffff'
    ctx.font = 'bold 52px "Public Sans Bold"'
    ctx.fillText(me.rank === 1 ? '#1 CROWNED' : `#${me.rank}`, CARD_WIDTH / 2, 1078)
  }

  ctx.fillStyle = colors.accent
  ctx.font = 'bold 92px "Public Sans Bold"'
  ctx.fillText(String(me.score), CARD_WIDTH / 2, me.rank ? 1230 : 1120)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '34px "Public Sans"'
  ctx.fillText('points', CARD_WIDTH / 2, (me.rank ? 1230 : 1120) + 48)

  const lines = []
  if (c.showPlacement && me.rank && me.playerCount) lines.push(`Placed ${me.rank} of ${me.playerCount}`)
  if (c.showTeam && me.teamName) lines.push(me.teamName)
  if (c.showAccuracy && me.correctCount !== null && me.correctCount !== undefined) {
    lines.push(`${me.correctCount} of ${me.totalQuestions} correct`)
  }
  if (c.showStreak && me.bestStreak) lines.push(`Best streak ${me.bestStreak}`)

  let y = me.rank ? 1380 : 1270
  for (const line of lines) {
    ctx.fillStyle = 'rgba(255,255,255,0.82)'
    ctx.font = '40px "Public Sans"'
    ctx.fillText(line, CARD_WIDTH / 2, y)
    y += 62
  }

  drawFooter(ctx, colors)
  return canvas.toBuffer('image/png')
}
```

```javascript
export async function renderBoardCard({ card, theme, quiz, ranked, teams }) {
  ensureFonts()
  const c = sanitizeCard(card)
  const t = sanitizeTheme(theme)
  const colors = palette(c, t)
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT)
  const ctx = canvas.getContext('2d')
  const rows = ranked ?? []

  await drawBackdrop(ctx, c, t, colors)
  ctx.textAlign = 'center'

  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '36px "Public Sans"'
  ctx.fillText(quiz?.title ?? 'Quiz results', CARD_WIDTH / 2, 140)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 72px "Playfair Display"'
  ctx.fillText('Final results', CARD_WIDTH / 2, 230)

  // Podium three, tallest in the middle, matching the projector's FinishedScreen ordering.
  const podium = [[1, 300, 190], [2, 120, 150], [3, 480, 130]]
  for (const [place, x, height] of podium) {
    const p = rows[place - 1]
    ctx.fillStyle = place === 1 ? colors.accent : 'rgba(255,255,255,0.14)'
    roundRect(ctx, x, 700 - height, 200, height, 16)
    ctx.fill()
    if (!p) continue
    await drawCharacter(ctx, p.avatarId, x + 100, 700 - height - 100, 160, place === 1 ? 'dance' : 'happy')
    ctx.fillStyle = '#ffffff'
    fittedFont(ctx, p.nickname, 190, 34)
    ctx.fillText(p.nickname, x + 100, 740)
    ctx.font = 'bold 30px "Public Sans Bold"'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(String(p.score), x + 100, 782)
  }

  // Everyone below the podium as rows. A 150-player game gets a summary line rather than 147 rows.
  const rest = rows.slice(3)
  const shown = rest.slice(0, 14)
  let y = 850
  for (const p of shown) {
    ctx.fillStyle = 'rgba(255,255,255,0.10)'
    roundRect(ctx, 80, y - 44, CARD_WIDTH - 160, 68, 14)
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = 'bold 32px "Public Sans Bold"'
    ctx.fillText(String(p.rank), 110, y)
    await drawCharacter(ctx, p.avatarId, 210, y - 10, 52, 'happy')
    ctx.fillStyle = '#ffffff'
    fittedFont(ctx, p.nickname, 520, 34)
    ctx.fillText(p.nickname, 280, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = colors.accent
    ctx.font = 'bold 36px "Public Sans Bold"'
    ctx.fillText(String(p.score), CARD_WIDTH - 110, y)
    ctx.textAlign = 'center'
    y += 78
  }
  if (rest.length > shown.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = '34px "Public Sans"'
    ctx.fillText(`and ${rest.length - shown.length} more`, CARD_WIDTH / 2, y + 20)
  }

  drawFooter(ctx, colors)
  return canvas.toBuffer('image/png')
}
```

```javascript
export async function renderDuelCard({ card, theme, quiz, sides, winnerSlot, forfeit, questionCount }) {
  ensureFonts()
  const c = sanitizeCard(card)
  const t = sanitizeTheme(theme)
  const colors = palette(c, t)
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT)
  const ctx = canvas.getContext('2d')

  await drawBackdrop(ctx, c, t, colors)
  ctx.textAlign = 'center'

  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '36px "Public Sans"'
  ctx.fillText(quiz?.title ?? 'Quiz duel', CARD_WIDTH / 2, 140)

  ctx.fillStyle = colors.accent
  ctx.font = 'bold 76px "Playfair Display"'
  ctx.fillText(forfeit ? 'Forfeit' : winnerSlot ? 'Winner' : 'A draw', CARD_WIDTH / 2, 250)

  // Slot a is always the left column, so the same battle always draws the same way for both players.
  const ordered = [...(sides ?? [])].sort((x, y) => (x.slot === 'a' ? -1 : 1))
  for (let i = 0; i < Math.min(ordered.length, 2); i++) {
    const s = ordered[i]
    const cx = i === 0 ? 290 : 790
    const won = winnerSlot === s.slot
    await drawCharacter(ctx, s.avatarId, cx, 620, 320, won ? 'dance' : 'happy')
    ctx.fillStyle = '#ffffff'
    fittedFont(ctx, s.nickname, 380, 52)
    ctx.fillText(s.nickname, cx, 880)
    ctx.fillStyle = won ? GOLD : 'rgba(255,255,255,0.85)'
    ctx.font = 'bold 76px "Public Sans Bold"'
    ctx.fillText(String(s.score), cx, 980)
  }

  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '36px "Public Sans"'
  ctx.fillText(`${questionCount} questions`, CARD_WIDTH / 2, 1100)

  drawFooter(ctx, colors)
  return canvas.toBuffer('image/png')
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npm test -- quizCardRender`
Expected: PASS, 9 tests.

- [ ] **Step 5: Look at the output**

This cannot be checked any other way. Run:

```bash
node --input-type=module -e "
import { writeFileSync } from 'node:fs';
import { renderPersonalCard, renderBoardCard, renderDuelCard } from './api/_lib/quizCardRender.js';
import { DEFAULT_CARD } from './api/_lib/quizCard.js';
const me = { nickname: 'Ada', avatarId: 13, score: 14200, rank: 3, playerCount: 42, correctCount: 12, totalQuestions: 15, bestStreak: 5, teamName: 'Crimson' };
writeFileSync('card-personal.png', await renderPersonalCard({ card: DEFAULT_CARD, theme: { look: 'classic', pattern: 'math' }, quiz: { title: 'Naming Origins' }, me }));
writeFileSync('card-board.png', await renderBoardCard({ card: DEFAULT_CARD, theme: { look: 'classic' }, quiz: { title: 'Naming Origins' }, ranked: Array.from({length:42},(_,i)=>({rank:i+1,nickname:'Player '+(i+1),avatarId:i%50,score:10000-i*100})), teams: [] }));
writeFileSync('card-duel.png', await renderDuelCard({ card: DEFAULT_CARD, theme: { look: 'classic' }, quiz: { title: 'Naming Origins' }, sides: [{slot:'a',nickname:'Ada',avatarId:13,score:14200},{slot:'b',nickname:'Bola',avatarId:24,score:9900}], winnerSlot:'a', forfeit:false, questionCount:10 }));
console.log('written');
"
```

Open all three. Check: the character is visible and correctly coloured, text is inside its box, the maths pattern is faint not loud, nothing is clipped at the edges. **These images have not been seen by anyone until you open them.**

- [ ] **Step 6: Delete the scratch images**

```bash
Remove-Item card-personal.png,card-board.png,card-duel.png
```

- [ ] **Step 7: Commit**

```bash
git add api/_lib/quizCardRender.js api/_lib/quizCardRender.test.js
git commit -m "feat(quiz): render 1080x1920 result cards to PNG"
```

- [ ] **Step 8: SPEC REVIEW** then **CODE REVIEW**

---

### Task 5: The endpoint — live personal and board

**Files:**
- Create: `api/_lib/handlers/quiz-card.js`
- Create: `api/_lib/handlers/quiz-card.test.js`
- Create: `api/quiz-card.js`
- Modify: `api/_lib/quiz.js` (add `generatePracticeShareCode`)

- [ ] **Step 1: Write the failing test**

`api/_lib/handlers/quiz-card.test.js`. Build a fake Supabase client with a chainable stub:

```javascript
import { describe, expect, it } from 'vitest'
import { createQuizCardHandler } from './quiz-card.js'

const SESSION = { id: '11111111-1111-4111-8111-111111111111', quiz_id: '22222222-2222-4222-8222-222222222222', state: 'finished', team_mode: false, card: {}, theme: {} }
const QUIZ = { id: '22222222-2222-4222-8222-222222222222', title: 'Naming Origins', theme: {}, card: {} }

function fake({ session = SESSION, players = [{ id: 'p1', nickname: 'Ada', total_score: 14200, avatar_id: 13, streak: 5 }], stats = { correct_count: 12 } } = {}) {
  const tables = {
    quiz_player_tokens: [{ player_id: 'p1' }],
    quiz_players: players,
    quiz_sessions: session ? [session] : [],
    quizzes: [QUIZ],
    quiz_player_stats: stats ? [stats] : [],
    quiz_teams: [],
  }
  return {
    from(table) {
      const filters = []
      const api = {
        select() { return api },
        eq(col, val) { filters.push([col, val]); return api },
        maybeSingle: async () => ({ data: filter(tables[table], filters)[0] ?? null, error: null }),
        then(resolve, reject) { return Promise.resolve(filter(tables[table], filters)).then(resolve, reject) },
      }
      return api
    },
  }
}

function filter(list, filters) {
  return (list ?? []).filter((row) => filters.every(([col, val]) => row[col] === val))
}

function fakeRes() {
  const res = { statusCode: 200, headers: {}, body: null }
  res.setHeader = (k, v) => { res.headers[k] = v }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (payload) => { res.body = payload; return res }
  res.send = (payload) => { res.body = payload; return res }
  return res
}

const allow = () => true

describe('quiz card endpoint', () => {
  it('refuses anything that is not a GET', async () => {
    const handler = createQuizCardHandler(() => fake(), { allow })
    const res = fakeRes()
    await handler({ method: 'POST', headers: {}, query: {} }, res)
    expect(res.statusCode).toBe(405)
  })

  it('rejects a malformed session id', async () => {
    const handler = createQuizCardHandler(() => fake(), { allow })
    const res = fakeRes()
    await handler({ method: 'GET', headers: {}, query: { session: 'not-a-uuid', token: 't' } }, res)
    expect(res.statusCode).toBe(400)
  })

  it('rejects an unknown player token with 401 and the state handler message', async () => {
    const handler = createQuizCardHandler(() => fake({ players: [] }), { allow })
    const res = fakeRes()
    await handler({ method: 'GET', headers: {}, query: { session: SESSION.id, token: 'nope' } }, res)
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('Unknown player. Rejoin the game.')
  })

  it('refuses a card for a game that has not finished', async () => {
    const handler = createQuizCardHandler(() => fake({ session: { ...SESSION, state: 'question' } }), { allow })
    const res = fakeRes()
    await handler({ method: 'GET', headers: {}, query: { session: SESSION.id, token: 't' } }, res)
    expect(res.statusCode).toBe(410)
    expect(res.body.error).toBe('This game is not finished yet.')
  })

  it('throttles rather than rendering', async () => {
    const handler = createQuizCardHandler(() => fake(), { allow: () => false })
    const res = fakeRes()
    await handler({ method: 'GET', headers: {}, query: { session: SESSION.id, token: 't' } }, res)
    expect(res.statusCode).toBe(429)
  })

  it('serves a finished player card as a png with no-store', async () => {
    const handler = createQuizCardHandler(() => fake(), { allow })
    const res = fakeRes()
    await handler({ method: 'GET', headers: {}, query: { session: SESSION.id, token: 't' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.headers['Content-Type']).toBe('image/png')
    expect(res.headers['Cache-Control']).toBe('no-store')
    expect(res.body.subarray(1, 4).toString()).toBe('PNG')
  })

  it('serves a board card to an admin and caches it briefly', async () => {
    const handler = createQuizCardHandler(() => fake(), { allow, caller: async () => ({ isAdmin: true }) })
    const res = fakeRes()
    await handler({ method: 'GET', headers: { authorization: 'Bearer x' }, query: { session: SESSION.id, view: 'board' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.headers['Cache-Control']).toBe('public, s-maxage=300')
  })

  it('refuses a board card to a signed-in non-admin', async () => {
    const handler = createQuizCardHandler(() => fake(), { allow, caller: async () => ({ error: [403, 'Admin access required'] }) })
    const res = fakeRes()
    await handler({ method: 'GET', headers: { authorization: 'Bearer x' }, query: { session: SESSION.id, view: 'board' } }, res)
    expect(res.statusCode).toBe(403)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- quiz-card`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the handler**

`api/_lib/handlers/quiz-card.js`:

```javascript
import { getCaller, bearerToken } from '../authz.js'
import { isUuid, isAllowedImageUrl } from '../validate.js'
import { hashToken, createRateLimiter, clientIp, rankPlayers } from '../quiz.js'
import { sanitizeTheme } from '../quizTheme.js'
import { sanitizeCard } from '../quizCard.js'
import { renderBoardCard, renderPersonalCard, setBackgroundLoader } from '../quizCardRender.js'
import { sessionQuestionIds } from '../quizSessionQuestions.js'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

// Every fetch draws the card again; nothing is stored. A generous limit stops one phone hammering the function
// while the generous cache headers stop everyone else having to.
export function createQuizCardHandler(
  getClient,
  { allow = createRateLimiter({ max: 30, windowMs: 60_000 }), caller = getCaller, baseUrl = process.env.VITE_SUPABASE_URL } = {},
) {
  // Branding pictures live in the public quiz-branding bucket under the quiz's own folder.
  function publicUrl(path) {
    return `${String(baseUrl).replace(/\/+$/, '')}/storage/v1/object/public/quiz-branding/${path}`
  }

  function sendPng(res, buffer, cacheControl) {
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', cacheControl)
    res.status(200).send(buffer)
  }

  return async function handler(req, res) {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const { session, token, view, practice, battle, preview } = req.query ?? {}

    // Backgrounds are fetched only from our own Supabase project, with a timeout and a size cap, exactly like
    // api/award-card.js does for nominee photos. A card must still render when the picture 404s.
    setBackgroundLoader(async (path) => {
      try {
        if (!isAllowedImageUrl(publicUrl(path), [new URL(baseUrl).hostname])) return null
        const response = await fetch(publicUrl(path), { signal: AbortSignal.timeout(5000) })
        if (!response.ok || Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) return null
        return Buffer.from(await response.arrayBuffer())
      } catch {
        return null
      }
    })

    if (!isUuid(session ?? '')) {
      res.status(400).json({ error: 'session is required' })
      return
    }

    // A board card shows every player's name and score, so it needs an admin. A personal card is the player's own
    // result and is gated on the token that already identifies them everywhere else in the quiz.
    if (view === 'board') {
      const supabaseAdmin = getClient()
      const who = await caller(supabaseAdmin, bearerToken(req))
      if (who.error) {
        res.status(who.error[0]).json({ error: who.error[1] })
        return
      }
      if (!who.isAdmin) {
        res.status(403).json({ error: 'Admin access required' })
        return
      }
      if (!allow(clientIp(req))) {
        res.status(429).json({ error: 'Slow down' })
        return
      }
      await serveBoard(res, supabaseAdmin, session)
      return
    }

    if (typeof token !== 'string' || !token) {
      res.status(400).json({ error: 'token is required' })
      return
    }
    if (!allow(hashToken(token))) {
      res.status(429).json({ error: 'Slow down' })
      return
    }
    await servePersonal(res, getClient(), session, token)
  }
}
```

with `servePersonal` and `serveBoard`:

```javascript
async function servePersonal(res, supabaseAdmin, sessionId, token) {
  const { data: tokenRow } = await supabaseAdmin.from('quiz_player_tokens').select('player_id').eq('token_hash', hashToken(token)).maybeSingle()
  if (!tokenRow) {
    res.status(401).json({ error: 'Unknown player. Rejoin the game.' })
    return
  }
  const { data: players } = await supabaseAdmin
    .from('quiz_players')
    .select('id, nickname, total_score, avatar_id, streak, team_id')
    .eq('session_id', sessionId)
  const ranked = rankPlayers(players ?? [])
  const me = ranked.find((p) => p.id === tokenRow.player_id)
  if (!me) {
    res.status(404).json({ error: 'Game not found' })
    return
  }
  const { data: session } = await supabaseAdmin.from('quiz_sessions').select('*').eq('id', sessionId).maybeSingle()
  if (!session) {
    res.status(404).json({ error: 'Game not found' })
    return
  }
  if (session.state !== 'finished') {
    res.status(410).json({ error: 'This game is not finished yet.' })
    return
  }
  const { data: quiz } = await supabaseAdmin.from('quizzes').select('id, title, theme, card').eq('id', session.quiz_id).maybeSingle()
  const { data: stats } = await supabaseAdmin.from('quiz_player_stats').select('correct_count').eq('session_id', sessionId).eq('player_id', me.id).maybeSingle()
  const team = session.team_mode && me.team_id
    ? (await supabaseAdmin.from('quiz_teams').select('name').eq('id', me.team_id).maybeSingle()).data
    : null
  const total = (await sessionQuestionIds(supabaseAdmin, session))?.length ?? 0

  const buffer = await renderPersonalCard({
    card: sanitizeCard(session.card, { quizId: session.quiz_id }),
    theme: sanitizeTheme(session.theme, { quizId: session.quiz_id }),
    quiz,
    me: {
      nickname: me.nickname,
      avatarId: me.avatar_id ?? 0,
      score: me.total_score ?? 0,
      rank: me.rank ?? null,
      playerCount: ranked.length,
      correctCount: stats?.correct_count ?? null,
      totalQuestions: total || null,
      bestStreak: me.streak ?? null,
      teamName: team?.name ?? null,
    },
  })
  sendPng(res, buffer, 'no-store')
}

async function serveBoard(res, supabaseAdmin, sessionId) {
  const { data: session } = await supabaseAdmin.from('quiz_sessions').select('id, quiz_id, state, theme, card').eq('id', sessionId).maybeSingle()
  if (!session) {
    res.status(404).json({ error: 'Game not found' })
    return
  }
  if (session.state !== 'finished') {
    res.status(410).json({ error: 'This game is not finished yet.' })
    return
  }
  const [{ data: players }, { data: quiz }] = await Promise.all([
    supabaseAdmin.from('quiz_players').select('id, nickname, total_score, avatar_id').eq('session_id', sessionId),
    supabaseAdmin.from('quizzes').select('id, title, theme, card').eq('id', session.quiz_id).maybeSingle(),
  ])
  const buffer = await renderBoardCard({
    card: sanitizeCard(session.card, { quizId: session.quiz_id }),
    theme: sanitizeTheme(session.theme, { quizId: session.quiz_id }),
    quiz,
    ranked: rankPlayers(players ?? []),
    teams: [],
  })
  sendPng(res, buffer, 'public, s-maxage=300')
}
```

`sendPng` is defined inside the factory so it can be used by both serve functions; move `servePersonal` and `serveBoard` inside the factory closure too, since they call `sendPng` and `publicUrl`.

- [ ] **Step 4: Add the route file**

`api/quiz-card.js`:

```javascript
import { createQuizCardHandler } from './_lib/handlers/quiz-card.js'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'

export default createQuizCardHandler(getSupabaseAdmin)
```

A top-level `api/` file, so Vercel serves `/api/quiz-card` with no `vercel.json` change. Matches `api/award-card.js`.

- [ ] **Step 5: Add the practice share code generator**

In `api/_lib/quiz.js`, next to `generateJoinCode` (line 24):

```javascript
const SHARE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I, O, 0 or 1: these get read aloud and copied by hand

// The public half of a finished practice run's card link. Longer than a join code on purpose, so the two are
// never mistaken for each other in a URL or in a screenshot.
export function generatePracticeShareCode(rand = randomInt) {
  let out = ''
  for (let i = 0; i < 8; i++) out += SHARE_ALPHABET[rand(0, SHARE_ALPHABET.length)]
  return out
}
```

Confirm `randomInt` exists at the top of the file; if it does not, add `import { randomInt } from 'node:crypto'`.

- [ ] **Step 6: Run it to confirm it passes**

Run: `npm test -- quiz-card`
Expected: PASS, 8 tests.

- [ ] **Step 7: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add api/_lib/handlers/quiz-card.js api/_lib/handlers/quiz-card.test.js api/quiz-card.js api/_lib/quiz.js
git commit -m "feat(quiz): add the result card endpoint for live games"
```

- [ ] **Step 9: SPEC REVIEW** then **CODE REVIEW**

---

### Task 6: Mint the practice share code

**Files:**
- Create: `api/_lib/quizCardData.js`
- Modify: `api/_lib/handlers/quiz-practice.js:405-417`
- Modify: `api/_lib/handlers/quiz-card.js`
- Modify: `api/_lib/handlers/quiz-card.test.js`

- [ ] **Step 1: Write the failing test**

Add to the existing test file:

```javascript
  it('never shows a streak or a rank on a practice card, because practice has neither', async () => {
    const { buildPracticeMe } = await import('../quizCardData.js')
    expect(buildPracticeMe({ nickname: 'Ada', avatar_id: 3, total_score: 900 }, [{ correct: true }, { correct: false }], 5)).toEqual({
      nickname: 'Ada', avatarId: 3, score: 900, rank: null, playerCount: null,
      correctCount: 1, totalQuestions: 5, bestStreak: null, teamName: null,
    })
  })
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- quiz-card`
Expected: FAIL — `buildPracticeMe` does not exist.

- [ ] **Step 3: Write the pure function**

`api/_lib/quizCardData.js`:

```javascript
// What one result contributes to a card. Pure, so the shaping is testable without a database and so the renderer
// receives the same shape whichever of the four endpoints produced it.

export function buildPracticeMe(run, answers, total) {
  return {
    nickname: run.nickname,
    avatarId: run.avatar_id ?? 0,
    score: run.total_score ?? 0,
    // Practice has no leaderboard, so there is no rank and no "placed N of M" line to invent.
    rank: null,
    playerCount: null,
    correctCount: (answers ?? []).filter((a) => a.correct === true).length,
    totalQuestions: total || null,
    // Practice scoring explicitly runs without streaks (quiz-practice.js), so this stays null rather than a fake 0.
    bestStreak: null,
    teamName: null,
  }
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npm test -- quiz-card`
Expected: the pure-function test PASSes.

- [ ] **Step 5: Mint the code when a practice run finishes**

In `quiz-practice.js`, the `patch` at line 406:

```javascript
    const patch = last
      ? { finished_at: new Date(now()).toISOString(), current_index: run.current_index + 1, share_code: run.share_code ?? generatePracticeShareCode() }
      : { current_index: run.current_index + 1, question_started_at: new Date(now()).toISOString() }
```

`run.share_code ?? …` keeps the code stable if the player reloads and finishes again, rather than minting a second one and orphaning the first card link. Add `generatePracticeShareCode` to the existing import from `'../quiz.js'` at line 5.

- [ ] **Step 6: Add the practice branch**

In `api/_lib/handlers/quiz-card.js`, inside the handler before the `isUuid(session)` check:

```javascript
    if (practice) {
      if (!/^[A-Z0-9]{8}$/.test(String(practice))) {
        res.status(400).json({ error: 'Invalid share code' })
        return
      }
      if (!allow(hashToken(practice))) {
        res.status(429).json({ error: 'Slow down' })
        return
      }
      const { data: run } = await getClient()
        .from('quiz_practice_runs')
        .select('id, quiz_id, nickname, avatar_id, total_score, share_code, question_ids')
        .eq('share_code', String(practice))
        .maybeSingle()
      if (!run) {
        res.status(410).json({ error: 'This practice run is no longer stored.' })
        return
      }
      const { data: answers } = await getClient().from('quiz_practice_answers').select('correct').eq('run_id', run.id)
      const { data: quiz } = await getClient().from('quizzes').select('id, title, theme, card').eq('id', run.quiz_id).maybeSingle()
      const buffer = await renderPersonalCard({
        card: sanitizeCard(quiz?.card, { quizId: run.quiz_id }),
        theme: sanitizeTheme(quiz?.theme, { quizId: run.quiz_id }),
        quiz,
        me: buildPracticeMe(run, answers ?? [], run.question_ids?.length ?? 0),
      })
      sendPng(res, buffer, 'no-store')
      return
    }
```

Add `import { buildPracticeMe } from '../quizCardData.js'`. Because this branch runs before `getClient()` is called elsewhere, hoist `const supabaseAdmin = getClient()` to the top of the handler and use it throughout.

- [ ] **Step 7: Verify**

Run: `npm test -- quiz-card && npm test && npm run lint && npm run build`
Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add api/_lib/handlers/quiz-practice.js api/_lib/handlers/quiz-card.js api/_lib/handlers/quiz-card.test.js api/_lib/quizCardData.js
git commit -m "feat(quiz): give a finished practice run a shareable card link"
```

- [ ] **Step 9: SPEC REVIEW** then **CODE REVIEW**

---

### Task 7: The battle duel card

**Files:**
- Modify: `api/_lib/handlers/quiz-card.js`
- Modify: `api/_lib/handlers/quiz-card.test.js`

No migration. `quiz_battles.code` is already the public key and `/battle/:code` is already shareable; this task just reads both seats' scores, which `op: 'info'` deliberately withholds today.

- [ ] **Step 1: Write the failing test**

```javascript
  it('rejects a malformed battle code', async () => {
    const handler = createQuizCardHandler(() => fake(), { allow })
    const res = fakeRes()
    await handler({ method: 'GET', headers: {}, query: { battle: 'lower case' } }, res)
    expect(res.statusCode).toBe(400)
  })
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- quiz-card`
Expected: FAIL — 400 today, but with `session is required` rather than `Invalid battle code`.

- [ ] **Step 3: Implement it**

Add inside the handler, before the `isUuid(session)` check:

```javascript
    if (battle) {
      if (!/^[A-Z0-9]{6}$/.test(String(battle))) {
        res.status(400).json({ error: 'Invalid battle code' })
        return
      }
      if (!allow(hashToken(battle))) {
        res.status(429).json({ error: 'Slow down' })
        return
      }
      const { data: row } = await supabaseAdmin
        .from('quiz_battles')
        .select('id, quiz_id, state, winner_slot, forfeit, question_ids')
        .eq('code', String(battle).toUpperCase())
        .maybeSingle()
      if (!row) {
        res.status(404).json({ error: 'That duel does not exist' })
        return
      }
      // A battle still in progress is a conflict, not an expired thing: 410 is reserved for gone results.
      if (row.state !== 'finished') {
        res.status(409).json({ error: 'This duel is not finished yet.' })
        return
      }
      const [{ data: sides }, { data: quiz }] = await Promise.all([
        supabaseAdmin.from('quiz_battle_sides').select('slot, nickname, avatar_id, total_score').eq('battle_id', row.id),
        supabaseAdmin.from('quizzes').select('id, title, theme, card').eq('id', row.quiz_id).maybeSingle(),
      ])
      const buffer = await renderDuelCard({
        card: sanitizeCard(quiz?.card, { quizId: row.quiz_id }),
        theme: sanitizeTheme(quiz?.theme, { quizId: row.quiz_id }),
        quiz,
        sides: sides ?? [],
        winnerSlot: row.winner_slot ?? null,
        forfeit: Boolean(row.forfeit),
        questionCount: row.question_ids?.length ?? 0,
      })
      sendPng(res, buffer, 'no-store')
      return
    }
```

Add `renderDuelCard` to the import from `'../quizCardRender.js'`.

- [ ] **Step 4: Run it to confirm it passes**

Run: `npm test -- quiz-card`
Expected: PASS, 9 tests.

- [ ] **Step 5: Verify, then commit**

Run: `npm test && npm run lint && npm run build`
Expected: all exit 0.

```bash
git add api/_lib/handlers/quiz-card.js api/_lib/handlers/quiz-card.test.js
git commit -m "feat(quiz): serve a duel card for finished battles"
```

- [ ] **Step 6: SPEC REVIEW** then **CODE REVIEW**

---

### Task 8: The client — blob fetching and the preview modal

**Files:**
- Modify: `src/lib/shareCard.js`
- Create: `src/lib/quizCard.js`
- Create: `src/components/quiz/ResultCardModal.jsx`

**Why a blob, not an `<img src>`:** the board card needs an `Authorization` header, which an `<img>` cannot send. Fetching to a blob also means the image is already in memory, so Save does not re-download it.

- [ ] **Step 1: Add `shareOrDownloadBlob` and `saveCardBlob`**

Replace `src/lib/shareCard.js` with:

```javascript
// The blob half, split out so a caller that already has the bytes (a card fetched with an auth header, say) does
// not have to fetch a second time just to share them.
export async function shareOrDownloadBlob(blob, filename, shareTitle) {
  const file = new File([blob], filename, { type: blob.type || 'image/png' })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: shareTitle })
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function shareOrDownloadCard(imageUrl, filename, shareTitle) {
  const response = await fetch(imageUrl)
  if (!response.ok) throw new Error('Could not load the card image')
  return shareOrDownloadBlob(await response.blob(), filename, shareTitle)
}

// Always saves, never opens the share sheet.
export function saveCardBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
```

The two existing callers (`src/components/awards/ResultsSummary.jsx:6`, `src/pages/Awards.jsx:84`) are unchanged — `shareOrDownloadCard` keeps its signature and behaviour.

- [ ] **Step 2: Write the card client**

`src/lib/quizCard.js`:

```javascript
import { supabase } from './supabaseClient'
import { fileSlug } from './downloadFile.js'

const ENDPOINT = '/api/quiz-card'

export function personalCardUrl({ sessionId, token }) {
  return `${ENDPOINT}?session=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`
}

export function boardCardUrl(sessionId) {
  return `${ENDPOINT}?session=${encodeURIComponent(sessionId)}&view=board`
}

export function practiceCardUrl(shareCode) {
  return `${ENDPOINT}?practice=${encodeURIComponent(shareCode)}`
}

export function duelCardUrl(code) {
  return `${ENDPOINT}?battle=${encodeURIComponent(code)}`
}

// Fetches the PNG as bytes. The board variant needs the admin's own session, because a plain <img> cannot send an
// Authorization header — so every card goes through here rather than through an img src.
export async function fetchCardBlob(url, { admin = false } = {}) {
  const headers = {}
  if (admin) {
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`
  }
  const response = await fetch(url, { headers })
  if (!response.ok) {
    let message = 'Could not make your result card'
    try {
      message = (await response.json())?.error || message
    } catch {
      // not JSON (a gateway error page)
    }
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return response.blob()
}

export function cardFilename(nickname, fallback = 'result') {
  return `nammes-${fileSlug(nickname, fallback)}.png`
}
```

- [ ] **Step 3: Write the modal**

`src/components/quiz/ResultCardModal.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { ErrorState } from '../ui/ErrorState'
import { fetchCardBlob } from '../../lib/quizCard'
import { saveCardBlob, shareOrDownloadBlob } from '../../lib/shareCard'

// Preview a rendered result card, then share or save it. One component for every quiz mode: it takes a URL, an
// optional admin flag for the board card, and the filename to save under.
export default function ResultCardModal({ url, admin = false, filename, shareTitle, onClose }) {
  const [blob, setBlob] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setError('')
    setBlob(null)
    fetchCardBlob(url, { admin })
      .then((b) => {
        if (cancelled) return
        setBlob(b)
        setPreview(URL.createObjectURL(b))
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => { cancelled = true }
  }, [url, admin])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function share() {
    if (!blob) return
    setBusy(true)
    try {
      await shareOrDownloadBlob(blob, filename, shareTitle)
    } catch {
      // A cancelled share sheet rejects; that is not an error worth showing.
    } finally {
      setBusy(false)
    }
  }

  function save() {
    if (!blob) return
    saveCardBlob(blob, filename)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Your result card">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div className="relative z-10 flex max-h-full w-full max-w-sm flex-col gap-4">
        <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-2xl bg-surface-low">
          {error ? (
            <ErrorState message={error} onRetry={onClose} />
          ) : preview ? (
            <img src={preview} alt="Your result card" className="h-auto w-full" />
          ) : (
            <p className="px-6 py-16 text-center text-ink-muted">Making your card…</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="accent" onClick={share} loading={busy} disabled={!blob} className="flex-1">
            <span className="material-symbols-outlined" aria-hidden="true">share</span>
            Share
          </Button>
          <Button variant="secondary" onClick={save} disabled={!blob} className="flex-1">
            <span className="material-symbols-outlined" aria-hidden="true">download</span>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
```

Both `share` and `download` are already in the `icon_names=` list in `index.html`, so `src/lib/iconFont.test.js` stays green. Confirm the `Button` component accepts `className`; if it does not, wrap the icon and label in a `<span className="inline-flex items-center gap-2">` instead.

- [ ] **Step 4: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all exit 0. Confirm `iconFont.test.js` passed — if it fails, the icon name is not in the subset.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shareCard.js src/lib/quizCard.js src/components/quiz/ResultCardModal.jsx
git commit -m "feat(quiz): add the result card preview modal and blob client"
```

- [ ] **Step 6: SPEC REVIEW** then **CODE REVIEW**

---

### Task 9: Wire the buttons

Five entry points. Nothing here changes existing behaviour — each is an addition.

**Files:**
- Modify: `src/pages/PlayQuiz.jsx:807`
- Modify: `src/pages/HostQuiz.jsx:828`
- Modify: `src/pages/admin/AdminQuizReport.jsx:150`
- Modify: `src/pages/PlayPractice.jsx:342-372`
- Modify: `src/pages/PlayBattle.jsx:390-434`

- [ ] **Step 1: The player's phone (live quiz)**

In `PlayQuiz.jsx`, the finished screen at line 783. Add imports for `ResultCardModal`, `personalCardUrl`, `cardFilename`. The token lives in the `saved` record from `sessionStorage` (line 20).

Add state next to the other `useState` calls in `PlayQuizGame`, and above the existing "Play again" button at line 807:

```jsx
        <button
          type="button"
          onClick={() => setCardOpen(true)}
          className="mt-2 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-green-900 px-6 text-xl font-bold text-white shadow-md active:scale-[0.98]"
        >
          <span className="material-symbols-outlined" aria-hidden="true">share</span>
          Share my result
        </button>
```

and after the `</Phone>` closing tag, inside the fragment:

```jsx
        {cardOpen && saved?.token && (
          <ResultCardModal
            url={personalCardUrl({ sessionId: saved.sessionId, token: saved.token })}
            filename={cardFilename(me.nickname)}
            shareTitle={`I placed ${me.rank} in this quiz`}
            onClose={() => setCardOpen(false)}
          />
        )}
```

The button only appears once the session is `finished`, so the endpoint's 410 guard cannot fire from here.

- [ ] **Step 2: The projector**

`HostQuiz.jsx`, in the `FinishedScreen` footer next to the CSV button at line 828:

```jsx
<ActionButton onClick={() => setCardOpen(true)} tone="muted" icon="share">Result card</ActionButton>
```

with the state and modal the same shape as above, using `boardCardUrl(sessionId)` and `admin: true`. `FinishedScreen` (line 819) needs the `sessionId` passed in — check its existing props and add it if it is not already there.

- [ ] **Step 3: The admin report**

`AdminQuizReport.jsx`, in the action row at line 150:

```jsx
<Button variant="secondary" onClick={() => setCardOpen(true)}>Result card</Button>
```

with the modal using `boardCardUrl(session.id)` and `admin: true`. It lives inside the existing `qz-no-print` div at line 149, so it does not print.

- [ ] **Step 4: Practice**

`PlayPractice.jsx`. Store the share code next to the token in the `nammes-quiz-practice` sessionStorage record (lines 24-31), and add the button to the finish screen at 342-372. The `state` response now carries `card` (Task 2) and `shareCode`.

Guard the button on `shareCode` being present, because a run finished before this migration has none.

- [ ] **Step 5: Battle**

`PlayBattle.jsx`, in `FinalBoard` at line 390. The battle code is already in the view, so:

```jsx
<button type="button" onClick={() => setCardOpen(true)} className="...">
  <span className="material-symbols-outlined" aria-hidden="true">share</span>
  Share this duel
</button>
```

using `duelCardUrl(view.code)`.

- [ ] **Step 6: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all exit 0.

- [ ] **Step 7: Manual pass — this is the part tests cannot cover**

With the dev server running and a Supabase login:

1. Host a quiz, join from two phones, finish it.
2. On a phone, tap **Share my result**. Confirm the card loads, the character is your own, and the rank and placement line are right.
3. Tap **Save**. Confirm a PNG lands in downloads and opens at 1080×1920.
4. On the projector, tap **Result card**. Confirm the board shows all players.
5. On `/admin/quizzes/games/<id>`, tap **Result card**.
6. Run a practice quiz to the end, share the card.
7. Run a battle to the end, share the card.
8. Confirm the characters on all three match what the phones showed.

**No card has been seen in a real game. None of this has been verified.**

- [ ] **Step 8: Commit**

```bash
git add src/pages/PlayQuiz.jsx src/pages/HostQuiz.jsx src/pages/admin/AdminQuizReport.jsx src/pages/PlayPractice.jsx src/pages/PlayBattle.jsx
git commit -m "feat(quiz): add result card buttons to every results screen"
```

- [ ] **Step 9: SPEC REVIEW** then **CODE REVIEW**

---

### Task 10: The studio Card tab

**Files:**
- Modify: `src/pages/admin/AdminQuizStudio.jsx`
- Modify: `src/data/quizBranding.js:35`
- Modify: `api/_lib/handlers/quiz-card.js` (preview branch)

**Spec requirement:** An admin designs the card in a fourth tab: accent colour, background image, and a checkbox per stat line.

- [ ] **Step 1: Include the card background in the delete sweep**

`src/data/quizBranding.js`, `brandingPaths`:

```javascript
export function brandingPaths(theme, card) {
  return [theme?.logo, theme?.image, ...(theme?.sponsors ?? []).map((s) => s.path), card?.background].filter(Boolean)
}
```

Update the two callers at `AdminQuizStudio.jsx:111-112` to pass the card object: `brandingPaths(clean, card)` and `brandingPaths(saved, savedCard)`.

- [ ] **Step 2: Add the tab button**

`AdminQuizStudio.jsx`, after line 174:

```jsx
<TabButton active={tab === 'card'} onClick={() => setTab('card')}>Result card</TabButton>
```

The theme Save/Reset buttons are hidden when `tab === 'characters'` (line 159). Extend that so they are hidden on the card tab too, since the card has its own save.

- [ ] **Step 3: Add the card state and save mutation**

Next to the existing `draft` state at line 88:

```javascript
  const [cardDraft, setCardDraft] = useState(null)
```

and the derived values:

```javascript
  const savedCard = sanitizeCard(quiz?.card, { quizId: id })
  const card = cardDraft ?? savedCard
  const cardDirty = cardDraft !== null && JSON.stringify(sanitizeCard(cardDraft, { quizId: id })) !== JSON.stringify(savedCard)
```

```javascript
  const cardMutation = useMutation({
    mutationFn: async () => {
      const clean = await saveQuizCard(id, card)
      const keep = new Set(brandingPaths(theme, clean))
      await removeBrandingFiles(brandingPaths(theme, savedCard).filter((p) => !keep.has(p) && isQuizImagePath(p, id)))
      return clean
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      setCardDraft(null)
      toast.success('Card saved. New games of this quiz will use it.')
    },
    onError: (error) => toast.error(error.message),
  })
```

- [ ] **Step 4: Add the tab body**

Add a `tab === 'card'` branch with: an accent section (a "use the look's accent" button plus a colour input, reusing the picker at line 213); a background section using `addPicture` with `{ maxEdge: BACKDROP_MAX_EDGE, maxBytes: BACKDROP_MAX_BYTES }`; a stat-lines section with one checkbox per line; Reset and Save buttons; and a live preview `<img src={`/api/quiz-card?preview=${id}`} alt="Result card preview" className="w-full max-w-sm rounded-2xl shadow-md" />`.

Add the imports: `sanitizeCard`, `DEFAULT_CARD` from `'../../../api/_lib/quizCard.js'`; `saveQuizCard` from `'../../data/quiz'`; `BACKDROP_MAX_EDGE`, `BACKDROP_MAX_BYTES` from `'../../data/quizBranding'`. `AdminQuizStudio.jsx` already imports `brandingPaths`, `removeBrandingFiles`, `uploadBrandingImage` and `themeAccent`.

**Verify while doing this:** `uploadBrandingImage` builds its path with `quizImagePath`, which produces `<quizId>/<uuid>-<stamp>.<ext>`. `isQuizImagePath` requires exactly that shape, so the upload should pass sanitisation. Confirm by saving a background and checking the card preview actually shows it. If it does not, `sanitizeCard` is dropping it — that is a bug to fix here, not a reason to relax the check.

- [ ] **Step 5: Serve the preview**

Add a `preview` branch to the handler:

```javascript
    if (preview) {
      if (!isUuid(preview)) {
        res.status(400).json({ error: 'Invalid quiz id' })
        return
      }
      await servePreview(res, supabaseAdmin, preview)
      return
    }
```

```javascript
// An <img> cannot send an Authorization header and the preview url is just the quiz id, so this is reachable by
// anyone who knows one. It renders sample numbers only, never a real player, so nothing leaks.
async function servePreview(res, supabaseAdmin, quizId) {
  const { data: quiz } = await supabaseAdmin.from('quizzes').select('id, title, theme, card').eq('id', quizId).maybeSingle()
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found' })
    return
  }
  const buffer = await renderPersonalCard({
    card: sanitizeCard(quiz.card, { quizId }),
    theme: sanitizeTheme(quiz.theme, { quizId }),
    quiz,
    me: { nickname: 'Ada', avatarId: 13, score: 14200, rank: 3, playerCount: 42, correctCount: 12, totalQuestions: 15, bestStreak: 5, teamName: 'Crimson' },
  })
  sendPng(res, buffer, 'no-store')
}
```

- [ ] **Step 6: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all exit 0.

- [ ] **Step 7: Manual studio pass**

Open `/admin/quizzes/<id>/studio`, click **Result card**. Confirm: the preview renders, toggling a checkbox changes the preview, the colour picker changes it, an uploaded background appears, Save persists and the tab reads **Saved** after a reload.

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin/AdminQuizStudio.jsx src/data/quizBranding.js api/_lib/handlers/quiz-card.js
git commit -m "feat(quiz): add the result card tab to the design studio"
```

- [ ] **Step 9: SPEC REVIEW** then **CODE REVIEW**

---

### Task 11: Final verification

- [ ] **Step 1: Full gate**

```bash
npm test
npm run lint
npm run build
```

Expected: all exit 0, `iconFont.test.js` included.

- [ ] **Step 2: Confirm the migration applied cleanly**

```sql
select column_name, data_type from information_schema.columns
 where table_name in ('quizzes','quiz_sessions','quiz_practice_runs')
   and column_name in ('card','share_code');
```

Expect `card` twice (jsonb) and `share_code` once (text).

- [ ] **Step 3: Full manual pass**

Re-run Task 9 Step 7 end to end, plus the studio pass from Task 10 Step 7, on a preview deploy rather than localhost so the serverless bundling is genuinely exercised. This is the only way to know `react-dom/server` and `@napi-rs/canvas` both behave in production.

- [ ] **Step 4: Report honestly**

State plainly in the handoff: which parts were seen running, and which were not. Per `AGENTS.md`, a change touching the theme shape, audio or a quiz screen **has not** been fully verified until someone has played a real game with it.

- [ ] **Step 5: Commit any stragglers**

```bash
git status
git commit -m "chore(quiz): tidy result card work"   # only if there is something to commit
```

---

## Risks, in the order they would bite

1. **`react-dom/server` in a Vercel function** — Task 3, Steps 7 and 8. No `api/` file currently imports from `src/`. If it fails, the fallback is extracting `Character.jsx`'s shapes into a shared plain module, and Tasks 3 through 4 shift.
2. **The migration must be applied before anything renders.** A missing `card` column makes every read throw.
3. **The character has never been seen on a canvas.** Task 4 Step 5 exists because no test can tell you a PNG is ugly.
4. **`isQuizImagePath(path, undefined)` returns `true` for any string** (`api/_lib/quizImage.js:17`). Every card code path must pass `quizId`, or a hand-edited row could point the renderer at any path.
5. **Emoji render as nothing.** No emoji font is bundled, which is why rank 1 gets a drawn crown rather than 🥇.