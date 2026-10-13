# Quiz Character Cast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin design up to 12 characters for one quiz from the drawer, choose who players see, and have every player, bot, bracket and result card resolve an `avatar_id` against that cast instead of against the fixed 50.

**Architecture:** A quiz's cast lives in a `quiz_characters` table keyed by a stable slot, so `avatar_id` stays one integer: 0–49 is always a built-in, 50–61 is always slot 0–11 of that quiz's cast. Slots are never renumbered or reused; retired rows retain only their slot reservation after their authored data is scrubbed. A hosted game snapshots its active cast into `quiz_sessions.characters` at start, exactly as it snapshots `theme`; battles and practice read the active cast live, exactly as they read `theme` live.

**Tech Stack:** Plain ESM JavaScript, React 19, TanStack Query, Tailwind v4, Vitest, Supabase, Vercel serverless functions.

**Spec:** `docs/superpowers/specs/2026-10-12-quiz-character-cast-design.md` §3, §5, §6, §7, §8, §9.

**Depends on:** `2026-10-12-quiz-character-art-module.md` and `2026-10-12-quiz-character-parts.md` must both be merged. This plan assumes `BODIES` has 19 entries and `DEFAULT_MOOD` exists.

---

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20261013090000_quiz_character_cast.sql` | **Create.** The table, `cast_mode`, the session snapshot, and the five widened checks. |
| `supabase/rollbacks/20261013090000_quiz_character_cast.rollback.sql` | **Create.** |
| `supabase/migrations/20261013100000_quiz_character_slot_retirement.sql` | **Create.** Add the `deleted_at` slot-reservation marker after the initial cast migration. |
| `supabase/rollbacks/20261013100000_quiz_character_slot_retirement.rollback.sql` | **Create.** Removes `deleted_at`; this permits slot reuse again. |
| `api/_lib/quizCharacterArt.js` | **Modify.** `sanitizeCharacterSpec`, `sanitizeCharacterMoves`, `sanitizeCast`, `deriveColour`, `castIds`, `allowedAvatarIds`, `characterSpec`. |
| `api/_lib/quiz.js` | **Modify.** `isAvatarId(value, cast)`. |
| `api/_lib/castStore.js` | **Create.** Read and write a quiz's cast rows. |
| `api/_lib/handlers/quiz-cast.js` | **Create.** The `roster` and `cast` ops. |
| `api/quiz.js` | **Modify.** Register the handler in `ACTIONS`. |
| `api/_lib/handlers/quiz-create.js` | **Modify.** Snapshot the cast into the session. |
| `api/_lib/handlers/quiz-join.js`, `quiz-battle.js`, `quiz-practice.js` | **Modify.** Pass the cast to `isAvatarId`. |
| `api/_lib/handlers/quiz-host.js`, `quiz-bracket*.js`, `quiz-practice.js` | **Modify.** Bots and ghosts draw from the cast. |
| `api/_lib/quizTeams.js` | **Modify.** Line 50's hardcoded `< 50`. |
| `api/_lib/quizCardData.js`, `handlers/quiz-card.js` | **Modify.** Resolve `avatarId` against the cast. |
| `src/data/quiz.js` | **Modify.** `useCastQuery`, `useSaveCast`. |
| `src/components/admin/quizStudio/CharacterEditor.jsx` | **Create.** The editor. |
| `src/pages/admin/AdminQuizStudio.jsx` | **Modify.** Cast mode above the gallery. |
| `src/pages/PlayQuiz.jsx`, `PlayBattle.jsx`, `PlayPractice.jsx` | **Modify.** Picker draws the cast. |
| `AGENTS.md` | **Modify.** The new rules. |

---

### Task 1: The migration

**Files:**
- Create: `supabase/migrations/20261013090000_quiz_character_cast.sql`
- Create: `supabase/rollbacks/20261013090000_quiz_character_cast.rollback.sql`

- [ ] **Step 1: Write the migration**

```sql
-- A quiz's own cast: up to 12 characters an admin designs, which players can pick alongside or instead of the 50
-- built-ins. avatar_id 0-49 stays a built-in; 50-61 is slot 0-11 of this quiz's cast.
--
-- A slot is allocated once and never reused. Deleting a character scrubs its authored data but leaves a reservation row,
-- so the same avatar_id can never later point at a different design.
create table public.quiz_characters (
  id         uuid primary key default gen_random_uuid(),
  quiz_id    uuid not null references public.quizzes(id) on delete cascade,
  slot       smallint not null check (slot between 0 and 11),
  name       text not null check (char_length(name) between 1 and 24),
  spec       jsonb not null check (jsonb_typeof(spec) = 'object'),
  moves      jsonb not null check (jsonb_typeof(moves) = 'object'),
  created_at timestamptz not null default now(),
  unique (quiz_id, slot)
);

create index quiz_characters_by_quiz on public.quiz_characters (quiz_id, slot);

-- Who players see: the 50 as they are, the 50 plus the cast, or the cast alone.
alter table public.quizzes
  add column cast_mode text not null default 'builtins'
  check (cast_mode in ('builtins', 'all', 'custom'));

-- The snapshot. A hosted game copies the cast when it starts, the way it copies the theme, so editing a cast can never
-- change a game already running. The 50 are compiled into the bundle and are not carried here; 12 characters is about
-- 2.2 KB, comfortably inside the check.
alter table public.quiz_sessions
  add column characters jsonb not null default '{}'::jsonb
  check (jsonb_typeof(characters) = 'object' and pg_column_size(characters) < 8000);

-- Widen the id space on every table that holds one. Nothing else about the column changes: the type, the default and
-- the indexes stay, because ids 0-49 keep meaning exactly what they mean today.
alter table public.quiz_players      drop constraint if exists quiz_players_avatar_id_check;
alter table public.quiz_players      add constraint quiz_players_avatar_id_check check (avatar_id between 0 and 61);
alter table public.quiz_teams         drop constraint if exists quiz_teams_avatar_id_check;
alter table public.quiz_teams         add constraint quiz_teams_avatar_id_check check (avatar_id between 0 and 61);
alter table public.quiz_battle_sides drop constraint if exists quiz_battle_sides_avatar_id_check;
alter table public.quiz_battle_sides add constraint quiz_battle_sides_avatar_id_check check (avatar_id between 0 and 61);
alter table public.quiz_battle_ratings drop constraint if exists quiz_battle_ratings_avatar_id_check;
alter table public.quiz_battle_ratings add constraint quiz_battle_ratings_avatar_id_check check (avatar_id between 0 and 61);
alter table public.quiz_practice_runs drop constraint if exists quiz_practice_runs_avatar_id_check;
alter table public.quiz_practice_runs add constraint quiz_practice_runs_avatar_id_check check (avatar_id between 0 and 61);

-- Admins only. Players never read this table: quizzes is admin-only too, and every player read goes through the API
-- with the service key, which is how joining already works.
alter table public.quiz_characters enable row level security;
grant select, insert, update, delete on public.quiz_characters to authenticated;
create policy quiz_characters_admin_all on public.quiz_characters
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
```

Because the cast migration may already be applied when slot retirement is added, add the marker in its own later
migration rather than editing and rerunning the original:

```sql
-- supabase/migrations/20261013100000_quiz_character_slot_retirement.sql
alter table public.quiz_characters
  add column if not exists deleted_at timestamptz;
```

**Check the generated constraint names first.** Postgres names a column check `<table>_<column>_check`, which is what the
`drop constraint if exists` lines assume. Run this against the live database before applying and correct the names if
they differ:

```sql
select conrelid::regclass as table, conname from pg_constraint
where contype = 'c' and pg_get_constraintdef(oid) like '%avatar_id%';
```

- [ ] **Step 2: Write the rollback**

```sql
drop policy quiz_characters_admin_all on public.quiz_characters;
revoke select, insert, update, delete on public.quiz_characters from authenticated;
drop table if exists public.quiz_characters;

alter table public.quiz_practice_runs drop constraint if exists quiz_practice_runs_avatar_id_check;
alter table public.quiz_practice_runs add constraint quiz_practice_runs_avatar_id_check check (avatar_id between 0 and 49);
alter table public.quiz_battle_ratings drop constraint if exists quiz_battle_ratings_avatar_id_check;
alter table public.quiz_battle_ratings add constraint quiz_battle_ratings_avatar_id_check check (avatar_id between 0 and 49);
alter table public.quiz_battle_sides drop constraint if exists quiz_battle_sides_avatar_id_check;
alter table public.quiz_battle_sides add constraint quiz_battle_sides_avatar_id_check check (avatar_id between 0 and 49);
alter table public.quiz_teams drop constraint if exists quiz_teams_avatar_id_check;
alter table public.quiz_teams add constraint quiz_teams_avatar_id_check check (avatar_id between 0 and 49);
alter table public.quiz_players drop constraint if exists quiz_players_avatar_id_check;
alter table public.quiz_players add constraint quiz_players_avatar_id_check check (avatar_id between 0 and 49);

alter table public.quiz_sessions drop column if exists characters;
alter table public.quizzes drop column if exists cast_mode;
```

The rollback narrows the checks again, which means any custom character already picked by a player now fails the
constraint. That is why the rollback is a restore tool, not a routine step.

- [ ] **Step 3: Apply it and verify**

Run it in the Supabase SQL editor, then:

```sql
-- Expect 0: no row outside 0-61
select count(*) from public.quiz_players where avatar_id not between 0 and 61;
-- Expect 5 constraints, all saying 0 and 61
select conrelid::regclass, pg_get_constraintdef(oid) from pg_constraint
where contype = 'c' and pg_get_constraintdef(oid) like '%avatar_id between 0 and 61%';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261013090000_quiz_character_cast.sql supabase/rollbacks/20261013090000_quiz_character_cast.rollback.sql
git commit -m "feat(quiz): add the character cast table and widen the avatar id space"
```

---

### Task 2: The cast logic, in the art module

Pure, shared, and the only answer to "which character is id N".

**Files:**
- Modify: `api/_lib/quizCharacterArt.js`
- Modify: `api/_lib/quizCharacterArt.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `api/_lib/quizCharacterArt.test.js`:

```js
import { sanitizeCharacterSpec, sanitizeCharacterMoves, sanitizeCast, deriveColour, castIds, allowedAvatarIds, characterSpec, MAX_CAST } from './quizCharacterArt.js'

describe('sanitizeCharacterSpec', () => {
  it('keeps a valid spec as it is', () => {
    const spec = { body: 'pot', topper: 'beret', eyes: 'sleep', mouth: 'stitched', accessory: 'weldmask', prop: 'ingot', color: '#ff5a1f' }
    expect(sanitizeCharacterSpec(spec)).toEqual(spec)
  })

  it('replaces anything that is not a key in the tables', () => {
    expect(sanitizeCharacterSpec({ body: 'nope', topper: 42, eyes: { toString: 'x' } }))
      .toMatchObject({ body: 'blob', topper: 'none', eyes: 'round' })
  })

  it('falls back to a default colour for anything that is not a hex', () => {
    expect(sanitizeCharacterSpec({ color: 'red' }).color).toBeNull()
    expect(sanitizeCharacterSpec({ color: '#ff5a' }).color).toBeNull()
    expect(sanitizeCharacterSpec({ color: 'javascript:alert(1)' }).color).toBeNull()
  })

  it('survives a spec that is not an object at all', () => {
    expect(() => sanitizeCharacterSpec(null)).not.toThrow()
    expect(() => sanitizeCharacterSpec('blob')).not.toThrow()
    expect(() => sanitizeCharacterSpec([1, 2, 3])).not.toThrow()
  })

  it('never carries a key the drawing does not read', () => {
    expect(Object.keys(sanitizeCharacterSpec({ body: 'blob', __proto__: { x: 1 }, evil: 'yes' })).sort())
      .toEqual(['accessory', 'body', 'color', 'eyes', 'mouth', 'prop', 'topper'])
  })
})

describe('sanitizeCharacterMoves', () => {
  it('keeps a valid set and replaces the rest', () => {
    expect(sanitizeCharacterMoves({ idle: 'sway', win: 'nope', sad: null, hello: 'clap' }))
      .toEqual({ idle: 'sway', win: 'jump', sad: 'droop', hello: 'clap' })
  })
})

describe('deriveColour', () => {
  it('always gives a darker outline and a lighter highlight', () => {
    for (const hex of ['#ff5a1f', '#000000', '#ffffff', '#4ade80']) {
      const { main, dark, light } = deriveColour(hex)
      expect(lightness(light)).toBeGreaterThan(lightness(main))
      expect(lightness(dark)).toBeLessThan(lightness(main))
    }
  })
})

describe('sanitizeCast', () => {
  const one = { slot: 0, name: 'Kola', spec: { body: 'pot' }, moves: { idle: 'sway' } }

  it('defaults to the 50 and an empty cast', () => {
    expect(sanitizeCast(null)).toEqual({ mode: 'builtins', characters: [] })
  })

  it('keeps a good cast', () => {
    expect(sanitizeCast({ mode: 'all', characters: [one] })).toMatchObject({ mode: 'all', characters: [{ slot: 0, name: 'Kola' }] })
  })

  it('refuses two characters in one slot rather than picking a winner', () => {
    expect(() => sanitizeCast({ characters: [one, { ...one, name: 'Other' }] })).toThrow(/slot 0/)
  })

  it('refuses a cast over the limit', () => {
    const many = Array.from({ length: MAX_CAST + 1 }, (_, i) => ({ ...one, slot: i }))
    expect(() => sanitizeCast({ characters: many })).toThrow(/12/)
  })

  it('refuses a slot outside 0-11', () => {
    expect(() => sanitizeCast({ characters: [{ ...one, slot: 12 }] })).toThrow()
    expect(() => sanitizeCast({ characters: [{ ...one, slot: -1 }] })).toThrow()
  })
})

describe('castIds', () => {
  const cast = { mode: 'all', characters: [{ slot: 0, name: 'A' }, { slot: 2, name: 'C' }] }

  it('is the 50 when the cast is not offered', () => {
    expect(castIds({ mode: 'builtins', characters: cast.characters })).toHaveLength(50)
  })

  it('adds the cast, skipping the hole at slot 1 without renumbering', () => {
    const ids = castIds(cast)
    expect(ids).toHaveLength(52)
    expect(ids.slice(50)).toEqual([50, 52])
  })

  it('is only the cast when the built-ins are switched off', () => {
    expect(castIds({ ...cast, mode: 'custom' })).toEqual([50, 52])
  })

  it('is the same as the allowed set', () => {
    expect([...allowedAvatarIds(cast)].sort((a, b) => a - b)).toEqual(castIds(cast).sort((a, b) => a - b))
  })
})

describe('characterSpec', () => {
  const cast = sanitizeCast({
    mode: 'all',
    characters: [{ slot: 0, name: 'Kola', spec: { body: 'pot', color: '#ff5a1f' }, moves: { idle: 'sway' } }],
  })

  it('resolves a built-in from its id', () => {
    expect(characterSpec(0, cast).name).toBe('Pixel')
  })

  it('resolves a cast character from 50 + its slot', () => {
    expect(characterSpec(50, cast)).toMatchObject({ name: 'Kola', body: 'pot', idle: 'sway' })
  })

  it('falls back to character 0 for an id the cast does not have', () => {
    expect(characterSpec(51, cast).name).toBe('Pixel')
  })

  it('ignores the cast entirely when it is not being offered', () => {
    expect(characterSpec(50, { mode: 'builtins', characters: cast.characters }).name).toBe('Pixel')
  })
})

function lightness(hex) {
  const n = parseInt(hex.slice(1), 16)
  return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run api/_lib/quizCharacterArt.test.js`
Expected: FAIL — none of these are exported yet.

- [ ] **Step 3: Write the code**

Append to `api/_lib/quizCharacterArt.js`:

```js
// ---- a quiz's own cast -------------------------------------------------------------------------------------------
//
// Above this line is the 50, which are code and always available. Below it is everything a quiz's own characters
// need: a spec is cleaned the same way in the studio, on the phone and on the server, so a hand-edited row can never
// put a part in the drawing that the drawing does not have a case for. This is the boundary that makes
// dangerouslySetInnerHTML safe.

export const MAX_CAST = 12
export const CAST_MODES = ['builtins', 'all', 'custom']
const HEX = /^#[0-9a-f]{6}$/

const oneOf = (list, value, fallback) => (typeof value === 'string' && list.includes(value) ? value : fallback)

export function sanitizeCharacterSpec(raw) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return {
    body: oneOf(BODIES, input.body, 'blob'),
    topper: oneOf(TOPPERS, input.topper, 'none'),
    eyes: oneOf(EYES, input.eyes, 'round'),
    mouth: oneOf(MOUTHS, input.mouth, 'smile'),
    accessory: oneOf(ACCESSORIES, input.accessory, 'none'),
    prop: oneOf(PROPS, input.prop, 'none'),
    color: typeof input.color === 'string' && HEX.test(input.color) ? input.color : null,
  }
}

export function sanitizeCharacterMoves(raw) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return {
    idle: oneOf(IDLE_MOVES, input.idle, 'bob'),
    win: oneOf(WIN_MOVES, input.win, 'jump'),
    sad: oneOf(SAD_MOVES, input.sad, 'droop'),
    hello: oneOf(HELLO_MOVES, input.hello, 'wave'),
  }
}

// One hex in, three out. The outline is what every line in the drawing is stroked with and the highlight is the sheen on
// a hat or an ear, so neither can be the same lightness as the body or the character reads as a flat blob.
export function deriveColour(hex) {
  const base = HEX.test(hex) ? hex : builtinColour(0).main
  return { main: base, dark: withLightness(base, 28), light: withLightness(base, 90) }
}

function withLightness(hex, lightnessPercent) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const rgb = hslToHex(h, s * 100, lightnessPercent)
  return rgb
}

export function sanitizeCast(raw) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const mode = CAST_MODES.includes(input.mode) ? input.mode : 'builtins'
  const list = Array.isArray(input.characters) ? input.characters : []
  if (list.length > MAX_CAST) throw new Error(`a cast holds at most ${MAX_CAST} characters, got ${list.length}`)
  const taken = new Set()
  const characters = list.map((entry) => {
    const slot = entry?.slot
    if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_CAST) throw new Error(`slot ${slot} is outside 0-${MAX_CAST - 1}`)
    if (taken.has(slot)) throw new Error(`two characters in slot ${slot}`)
    taken.add(slot)
    const name = typeof entry?.name === 'string' ? entry.name.trim().slice(0, 24) : ''
    if (!name) throw new Error(`slot ${slot} has no name`)
    const spec = sanitizeCharacterSpec(entry?.spec)
    return {
      slot,
      name,
      id: typeof entry?.id === 'string' ? entry.id : null,
      spec,
      moves: sanitizeCharacterMoves(entry?.moves),
      color: deriveColour(spec.color ?? builtinColour(slot).main),
    }
  })
  return { mode, characters }
}

const BUILTIN_IDS = Array.from({ length: BUILTIN_COUNT }, (_, i) => i)

export function castIds(cast) {
  const safe = { mode: 'builtins', characters: [] }
  const source = cast && typeof cast === 'object' ? cast : safe
  const custom = (Array.isArray(source.characters) ? source.characters : [])
    .map((c) => BUILTIN_COUNT + c.slot)
    .filter((id) => Number.isInteger(id))
  if (source.mode === 'custom') return custom.sort((a, b) => a - b)
  if (source.mode === 'all') return [...BUILTIN_IDS, ...custom.sort((a, b) => a - b)]
  return BUILTIN_IDS
}

export function allowedAvatarIds(cast) {
  return new Set(castIds(cast))
}

// The one answer to "which character is id N", for every caller on both sides.
export function characterSpec(id, cast) {
  if (Number.isInteger(id) && id >= BUILTIN_COUNT) {
    const entry = Array.isArray(cast?.characters)
      ? cast.characters.find((c) => BUILTIN_COUNT + c.slot === id)
      : null
    const offered = cast?.mode === 'all' || cast?.mode === 'custom'
    if (entry && offered) return { ...entry.spec, ...entry.moves, color: entry.color, name: entry.name, id }
  }
  return avatarInfo(id)
}

// Two characters are the same design when every part and the colour match. The colour counts: a deliberate "the same, but
// gold" is a different character, and the studio warns about a clash rather than refusing it. The built-in roster's own
// distinctness test is a hard assertion about code and does not go through here.
export function sameDesign(a, b) {
  return a.body === b.body && a.topper === b.topper && a.eyes === b.eyes && a.mouth === b.mouth
    && a.accessory === b.accessory && a.prop === b.prop
    && (a.color ?? '') === (b.color ?? '')
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run api/_lib/quizCharacterArt.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/quizCharacterArt.js api/_lib/quizCharacterArt.test.js
git commit -m "feat(quiz): add the cast logic to the art module"
```

---

### Task 3: Reading and writing a cast

**Files:**
- Create: `api/_lib/castStore.js`
- Create: `api/_lib/handlers/quiz-cast.js`
- Modify: `api/quiz.js`
- Create: `api/_lib/castStore.test.js`

- [ ] **Step 1: Write the failing test**

Create `api/_lib/castStore.test.js` using the fake db already used by `api/_lib/quizHandlers.test.js` — copy its
`db` fixture and its request helpers rather than inventing new ones:

```js
import { describe, it, expect } from 'vitest'
import { createQuizCastHandler } from './handlers/quiz-cast.js'
import { makeDb } from './testDb.js'

// The two ops. `roster` is what a phone calls before it has joined anything, keyed by join code or by quiz id.
// `cast` is what the studio saves, and it is the only writer.
describe('the cast handler', () => {
  const admin = () => ({ role: 'admin' })

  it('answers a roster by code, from the session snapshot', async () => {
    const db = makeDb({
      quiz_sessions: [{ id: 's1', code: '123456', quiz_id: 'q1', characters: { mode: 'all', characters: [{ slot: 0, name: 'Kola', spec: {}, moves: {} }] } }],
    })
    const res = fakeRes()
    await createQuizCastHandler(() => db, admin)(post({ op: 'roster', code: '123456' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ mode: 'all', characters: [{ name: 'Kola' }] })
  })

  it('answers a roster by quiz id, cleaned', async () => {
    const db = makeDb({
      quizzes: [{ id: 'q1', cast_mode: 'custom' }],
      quiz_characters: [{ quiz_id: 'q1', slot: 0, name: 'Kola', spec: { body: 'pot', color: 'red' }, moves: {} }],
    })
    const res = fakeRes()
    await createQuizCastHandler(() => db, { role: 'anon' })(post({ op: 'roster', quizId: 'q1' }), res)
    expect(res.body.characters[0].spec).toMatchObject({ body: 'pot', color: null })
    expect(res.body.characters[0].spec.topper).toBe('none')
  })

  it('says no for a code it does not know', async () => {
    const res = fakeRes()
    await createQuizCastHandler(() => makeDb({}), { role: 'anon' })(post({ op: 'roster', code: '999999' }), res)
    expect(res.statusCode).toBe(404)
  })

  it('refuses to save a cast for anyone who is not an admin', async () => {
    const res = fakeRes()
    await createQuizCastHandler(() => makeDb({}), { role: 'anon' })(post({ op: 'cast', quizId: 'q1', characters: [] }), res)
    expect(res.statusCode).toBe(403)
  })

  it('upserts by id and retires the ones the draft dropped, never reusing their slots', async () => {
    const db = makeDb({
      quizzes: [{ id: 'q1', cast_mode: 'all' }],
      quiz_characters: [
        { id: 'c1', quiz_id: 'q1', slot: 0, name: 'Kola', spec: {}, moves: {} },
        { id: 'c2', quiz_id: 'q1', slot: 1, name: 'Gone', spec: {}, moves: {} },
      ],
    })
    const res = fakeRes()
    await createQuizCastHandler(() => db, admin())(
      post({ op: 'cast', quizId: 'q1', mode: 'all', characters: [{ id: 'c1', slot: 0, name: 'Kolar', spec: {}, moves: {} }] }),
      res,
    )
    expect(res.statusCode).toBe(200)
    const left = db.tables.quiz_characters
    expect(left).toHaveLength(2)
    expect(left.find((row) => row.id === 'c1')).toMatchObject({ slot: 0, name: 'Kolar' })
    expect(left.find((row) => row.id === 'c2')).toMatchObject({ slot: 1, name: 'Deleted', spec: {}, moves: {}, deleted_at: expect.any(String) })
    expect(res.body.retiredSlots).toEqual([1])
    expect(db.tables.quizzes[0].cast_mode).toBe('all')
  })

  it('refuses to move a character into a slot that is not free', async () => {
    const db = makeDb({
      quizzes: [{ id: 'q1', cast_mode: 'all' }],
      quiz_characters: [
        { id: 'c1', quiz_id: 'q1', slot: 0, name: 'A', spec: {}, moves: {} },
        { id: 'c2', quiz_id: 'q1', slot: 1, name: 'B', spec: {}, moves: {} },
      ],
    })
    const res = fakeRes()
    await createQuizCastHandler(() => db, admin())(
      post({ op: 'cast', quizId: 'q1', mode: 'all', characters: [{ id: 'c1', slot: 1, name: 'A', spec: {}, moves: {} }] }),
      res,
    )
    expect(res.statusCode).toBe(400)
    expect(db.tables.quiz_characters).toHaveLength(2)
  })
})
```

**Before writing this test, check what exists.** If `api/_lib/testDb.js` and the `post`/`fakeRes` helpers are not real,
copy the fixture and the helpers out of `api/_lib/quizHandlers.test.js` into this file rather than inventing a second
fake database. One fake db, not two.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run api/_lib/castStore.test.js`
Expected: FAIL — `createQuizCastHandler` does not exist.

- [ ] **Step 3: Write the handler**

Create `api/_lib/handlers/quiz-cast.js`:

```js
import { sanitizeCast } from '../quizCharacterArt.js'
import { readQuizCast, saveQuizCast } from '../castStore.js'
import { isUuid } from '../validate.js'

// Two ops in one file, because they are the same feature and the function budget in AGENTS.md is deliberate: `roster` is
// what a phone calls before it has joined anything, and `cast` is the only writer.
//
// `roster` answers by join code as well as by quiz id because a player joining a hosted game has nothing but a
// six-character code. The code is already the join credential, so reading the cast with it leaks nothing joining does not.

export function createQuizCastHandler(getDb, getCaller) {
  return async function quizCast(req, res) {
    const { op, code, quizId, mode, characters } = req.body ?? {}

    if (op === 'roster') {
      if (typeof code === 'string' && code.trim()) {
        const { data: session } = await getDb()
          .from('quiz_sessions')
          .select('quiz_id, characters')
          .eq('code', code.trim().toUpperCase())
          .maybeSingle()
        if (!session) return res.status(404).json({ error: 'No game with that code.' })
        return res.status(200).json(clean(session.characters))
      }
      if (isUuid(quizId)) {
        const cast = await readQuizCast(getDb(), quizId)
        if (!cast) return res.status(404).json({ error: 'No quiz with that id.' })
        return res.status(200).json(cast)
      }
      return res.status(400).json({ error: 'Send a join code or a quiz id.' })
    }

    if (op === 'cast') {
      const caller = await getCaller(req)
      if (caller?.role !== 'admin') return res.status(403).json({ error: 'Admins only.' })
      if (!isUuid(quizId)) return res.status(400).json({ error: 'Bad quiz id.' })

      let cleanCast
      try {
        cleanCast = sanitizeCast({ mode, characters })
      } catch (error) {
        // A cast that cannot be read is refused, not repaired: an admin who saved a character that silently became
        // something else would find out from a player.
        return res.status(400).json({ error: error.message })
      }

      try {
        const saved = await saveQuizCast(getDb(), quizId, cleanCast)
        return res.status(200).json(saved)
      } catch (error) {
        const status = error.message.startsWith('Could not ') ? 500 : 400
        return res.status(status).json({ error: status === 400 ? error.message : 'Could not save the character cast.' })
      }
    }

    return res.status(400).json({ error: 'Unknown op.' })
  }

  function clean(raw) {
    try {
      return sanitizeCast(raw)
    } catch {
      return { mode: 'builtins', characters: [] }
    }
  }
}
```

- [ ] **Step 4: Register it**

In `api/quiz.js`, add the import and the entry:

```js
import cast from './_lib/handlers/quiz-cast.js'
```

```js
const ACTIONS = { create, advance, join, answer, state, host, powerup, practice, battle, sets, cbt, cast }
```

**Check `vercel.json`** for the rewrite that maps `/api/quiz?action=…` — if the actions are enumerated there, add `cast`
to it too. Read the file first; do not assume.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run api/_lib/castStore.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/handlers/quiz-cast.js api/_lib/castStore.test.js api/quiz.js vercel.json
git commit -m "feat(quiz): add the roster and cast ops"
```

---

### Task 4: The session snapshot

**Files:**
- Modify: `api/_lib/handlers/quiz-create.js`

- [ ] **Step 1: Write the failing test**

In `api/_lib/quizHandlers.test.js`, next to the existing assertion that the theme is copied into a session
(`quizHandlers.test.js` has one for `theme`):

```js
it('copies the cast into the session, so editing it later cannot change a running game', async () => {
  const db = makeDb({
    quizzes: [{ id: QUIZ, cast_mode: 'all', title: 'Metallurgy', questions: [] }],
    quiz_characters: [{ quiz_id: QUIZ, slot: 0, name: 'Kola', spec: { body: 'pot' }, moves: { idle: 'sway' } }],
  })
  await createQuizHandler(() => db)(post({ op: 'create', title: 'Metallurgy', questionIds: [] }), res)
  expect(res.statusCode).toBe(200)
  expect(db.tables.quiz_sessions[0].characters).toMatchObject({ mode: 'all', characters: [{ name: 'Kola', slot: 0 }] })
})
```

Match the surrounding helpers exactly — read the existing `theme` snapshot test and copy its setup shape.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run api/_lib/quizHandlers.test.js`
Expected: FAIL — nothing writes `characters` into the session.

- [ ] **Step 3: Snapshot it**

In `quiz-create.js`, where the session row is inserted, read the quiz's cast and write it alongside `theme`:

```js
import { sanitizeCast } from '../quizCharacterArt.js'

const { data: castRows } = await db.from('quiz_characters').select('*').eq('quiz_id', quizId)
const cast = sanitizeCast({ mode: quiz.cast_mode, characters: castRows ?? [] })
```

and add to the session insert:

```js
characters: cast,
```

`sanitizeCast` throws on a duplicate slot. Wrap it — a quiz whose rows were hand-edited into a bad state should start
with the built-ins rather than fail to start:

```js
function safeCast(mode, rows) {
  try {
    return sanitizeCast({ mode, characters: rows ?? [] })
  } catch {
    return { mode: 'builtins', characters: [] }
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run api/_lib/quizHandlers.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/handlers/quiz-create.js api/_lib/quizHandlers.test.js
git commit -m "feat(quiz): copy the cast into a session when a game starts"
```

---

### Task 5: Validation against the cast

**Files:**
- Modify: `api/_lib/quiz.js`
- Modify: `api/_lib/handlers/quiz-join.js`, `quiz-battle.js`, `quiz-practice.js`
- Modify: `api/_lib/quiz.js`'s test file

- [ ] **Step 1: Write the failing test**

```js
import { isAvatarId } from './quiz.js'
import { sanitizeCast } from './quizCharacterArt.js'

describe('isAvatarId against a cast', () => {
  const cast = sanitizeCast({ mode: 'all', characters: [{ slot: 0, name: 'Kola', spec: {}, moves: {} }] })

  it('accepts every id the cast offers', () => {
    for (const id of [0, 25, 49, 50]) expect(isAvatarId(id, cast)).toBe(true)
  })

  it('rejects an id the quiz does not have', () => {
    expect(isAvatarId(51, cast)).toBe(false)
  })

  it('rejects a cast id when the built-ins are the only ones on offer', () => {
    expect(isAvatarId(50, { mode: 'builtins', characters: cast.characters })).toBe(false)
  })

  it('still rejects junk', () => {
    expect(isAvatarId('3', cast)).toBe(false)
    expect(isAvatarId(99, cast)).toBe(false)
    expect(isAvatarId(3)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run api/_lib/quiz.test.js`
Expected: FAIL — `isAvatarId` still compares against 50.

- [ ] **Step 3: Change the one gate**

In `api/_lib/quiz.js`:

```js
export function isAvatarId(value, cast) {
  if (!Number.isInteger(value)) return false
  return allowedAvatarIds(cast).has(value)
}
```

**No cast means the 50.** `castIds(null)` returns the built-ins, so every existing caller that passes nothing keeps its
current behaviour and its current tests.

- [ ] **Step 4: Pass the cast at the four call sites**

| File | Line | Cast from |
|---|---|---|
| `handlers/quiz-join.js` | 23 | `session.characters` — the snapshot, already on the row it fetched |
| `handlers/quiz-battle.js` | 520, 628 | `quiz.cast_mode` + `quiz_characters` for `quizId` at create; `battle.quiz_id`'s cast at join |
| `handlers/quiz-practice.js` | 290 | `quiz.cast_mode` + rows for `quizId` |

Each of those handlers already fetches the quiz or the session it needs; add the cast columns to the existing `select`
rather than making a second round trip.

- [ ] **Step 5: Run the handler tests**

Run: `npx vitest run api/_lib/quizHandlers.test.js api/_lib/quiz.test.js api/_lib/quizBattleHandler.test.js api/_lib/quizSets.test.js`
Expected: PASS. Any handler test that asserted `avatarId: 99` is a `400` still passes, because 99 is not in the 50.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/quiz.js api/_lib/handlers/quiz-join.js api/_lib/handlers/quiz-battle.js api/_lib/handlers/quiz-practice.js
git commit -m "feat(quiz): validate an avatar id against the quiz's cast"
```

---

### Task 6: Bots, ghosts, byes and teams

**Files:**
- Modify: `api/_lib/handlers/quiz-host.js:242`, `handlers/quiz-battle.js:588`, `handlers/quiz-practice.js:117`, `quizBracket.js:41`, `quizTeams.js:50`
- Modify: the test file for each

- [ ] **Step 1: Write the failing test**

In `api/_lib/quizHandlers.test.js`, beside the existing `addBots` test:

```js
it('gives bots characters from the cast the players are picking from', async () => {
  const db = makeDb({
    quizzes: [{ id: QUIZ, cast_mode: 'all' }],
    quiz_characters: [{ quiz_id: QUIZ, slot: 0, name: 'Kola', spec: {}, moves: {} }],
    quiz_sessions: [{ id: SESSION, quiz_id: QUIZ, code: '123456', characters: { mode: 'all', characters: [{ slot: 0, name: 'Kola', spec: {}, moves: {} }] } }],
  })
  // host addBots for 12
  expect(db.tables.quiz_players.filter((p) => p.bot_skill).every((p) => p.avatar_id < 51)).toBe(true)
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run api/_lib/quizHandlers.test.js`
Expected: FAIL — bots are drawn from 0–49 only.

- [ ] **Step 3: Change the five pickers**

| Site | Today | Becomes |
|---|---|---|
| `quiz-host.js:242` | `(offset + i * 7 + 2) % AVATAR_COUNT` | `castIds(cast)[(offset + i * 7 + 2) % castIds(cast).length]` |
| `quiz-battle.js:588` | `Math.floor(seeded(battle.id, 8) * AVATAR_COUNT)` | `castIds(cast)[Math.floor(seeded(battle.id, 8) * castIds(cast).length)]` |
| `quiz-practice.js:117` | `Math.floor(seeded(id, 5) * 50)` | the same, against `quizId`'s cast |
| `quizBracket.js:41` | `Math.floor(seeded(id, 5) * 50)` | the session's cast |
| `quizTeams.js:50` | `t.avatarId >= 0 && t.avatarId < 50` | `allowedAvatarIds(cast).has(t.avatarId)` |

Bind `const ids = castIds(cast)` once in each function rather than calling `castIds` inside the loop — it allocates.

`quizTeams.js:50` is inside `cleanTeams`, which is pure and has no cast to hand. Give it a second argument defaulting to
`undefined`, and pass the cast at the one call site in `quiz-create.js`:

```js
export function cleanTeams(raw, cast) {
  ...
  const allowed = allowedAvatarIds(cast)
  const avatarId = allowed.has(t?.avatarId) ? t.avatarId : 0
}
```

The default keeps the existing tests calling it with one argument.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/handlers/quiz-host.js api/_lib/handlers/quiz-battle.js api/_lib/handlers/quiz-practice.js api/_lib/quizBracket.js api/_lib/quizTeams.js
git commit -m "feat(quiz): draw bots, ghosts and byes from the cast"
```

---

### Task 7: The card resolves against the cast

**Files:**
- Modify: `api/_lib/quizCardData.js`, `api/_lib/handlers/quiz-card.js`
- Modify: `api/_lib/quizCardRender.test.js`

- [ ] **Step 1: Write the failing test**

In `api/_lib/quizCardRender.test.js`:

```js
it('draws a custom character on the card, not a fallback', () => {
  const cast = { mode: 'all', characters: [{ slot: 0, name: 'Kola', spec: { body: 'pot', color: '#ff5a1f' }, moves: {}, color: { main: '#ff5a1f', dark: '#7f1d1d', light: '#ffedd5' } }] }
  const svg = characterSvg(50, { mood: 'happy', cast })
  expect(svg).toContain('<svg')
  // the pot body's path, not the blob's
  expect(svg).not.toBe(characterSvg(0, { mood: 'happy' }))
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run api/_lib/quizCardRender.test.js`
Expected: FAIL — `characterSvg` ignores the cast.

- [ ] **Step 3: Thread the cast through**

`api/_lib/characterSvg.js` — accept a cast and resolve through the one function:

```js
export function characterSvg(id, { mood = 'happy', size = 100, cast } = {}) {
  const px = Number(size) > 0 ? Math.round(Number(size)) : 100
  const markup = characterSvgMarkup(characterSpec(normalizeAvatarId(id), cast), mood).replace(/\sclass="[^"]*"/g, '')
  return markup.replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}"`)
}
```

`quizCardData.js` — it already maps database rows to renderer shapes; the cast comes from the session row for a hosted
game and from the quiz for a practice run and a battle, which is the same live-read rule `theme` already follows at
`handlers/quiz-practice.js:143`.

- [ ] **Step 4: Run the card tests**

Run: `npx vitest run api/_lib/quizCardRender.test.js api/_lib/handlers/quiz-card.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/characterSvg.js api/_lib/quizCardData.js api/_lib/handlers/quiz-card.js api/_lib/characterSvg.test.js api/_lib/quizCardRender.test.js
git commit -m "feat(quiz): draw the result card from the cast"
```

---

### Task 8: The client hooks

**Files:**
- Modify: `src/data/quiz.js`

- [ ] **Step 1: Write the failing test**

`src/data/quiz.test.js` exists — check its shape first and follow it. If testing a hook needs infrastructure that is not
there, follow `quizStudio.test.jsx` and test the query-key builder instead, which is where the actual bug risk is:

```js
import { castQueryKey } from './quiz'

describe('castQueryKey', () => {
  it('keys by code when there is only a code', () => {
    expect(castQueryKey({ code: '123456' })).toEqual(['cast', 'code', '123456'])
  })

  it('keys by quiz id when there is one', () => {
    expect(castQueryKey({ quizId: 'q1' })).toEqual(['cast', 'quiz', 'q1'])
  })

  it('keys by nothing when it has neither, rather than by a shared string', () => {
    expect(castQueryKey({})).toBeNull()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/data/quiz.test.js`
Expected: FAIL — `castQueryKey` is not exported.

- [ ] **Step 3: Write the hooks**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { callAdminQuiz } from './quizAdmin'   // or whatever the studio's admin caller is — match it

export function castQueryKey(target) {
  if (target?.code) return ['cast', 'code', target.code]
  if (target?.quizId) return ['cast', 'quiz', target.quizId]
  return null
}

// What players see. The server answers with the built-ins until a query is available, so a picker that renders before
// this resolves still shows something valid rather than an empty grid.
export function useCastQuery(target) {
  const key = castQueryKey(target)
  return useQuery({
    queryKey: key ?? ['cast', 'none'],
    queryFn: () => callQuiz('cast', { op: 'roster', ...target }),
    enabled: Boolean(key),
    staleTime: 60_000,
  })
}

export function useSaveCast(quizId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (cast) => callAdminQuiz('cast', { quizId, ...cast }),
    onSuccess: (clean) => {
      queryClient.setQueryData(['cast', 'quiz', quizId], clean)
      queryClient.invalidateQueries({ queryKey: ['quizzes'] })
    },
  })
}
```

Match the existing `callQuiz` signature in `src/data/quiz.js` — read it before writing these.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/data/quiz.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/quiz.js src/data/quiz.test.js
git commit -m "feat(quiz): add the cast queries"
```

---

### Task 9: The pickers

**Files:**
- Modify: `src/pages/PlayQuiz.jsx:186`, `PlayBattle.jsx:128`, `PlayPractice.jsx:155`

- [ ] **Step 1: Write the failing test**

The three pickers are the same markup written three times, so this is the moment to stop. Extract them first.

Create `src/components/quiz/CharacterPicker.jsx` and move the grid from `PlayPractice.jsx:155-166` into it:

```jsx
import { AVATAR_COUNT, castIds, characterSpec } from '../../../api/_lib/quizCharacterArt.js'
import Character from './Character'
import './characters.css'

// The grid a player picks from. It is drawn on a cast, not on the 50: a quiz can offer its own characters, so the ids
// come from castIds and each tile resolves through characterSpec. Until the cast query resolves, castIds gives the 50
// built-ins, so this never renders an empty grid.

export default function CharacterPicker({ cast, value, onChange, label = 'Characters' }) {
  const ids = castIds(cast)
  return (
    <div className="grid max-h-56 grid-cols-5 gap-2 overflow-y-auto rounded-2xl border border-hairline p-2" role="group" aria-label={label}>
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-label={characterSpec(id, cast).name}
          aria-pressed={value === id}
          className={`aspect-square rounded-xl border-2 p-0.5 ${value === id ? 'border-orange-500 bg-orange-500/12' : 'border-transparent bg-paper'}`}
        >
          <Character spec={characterSpec(id, cast)} mood={value === id ? 'happy' : 'static'} />
        </button>
      ))}
    </div>
  )
}

export function randomCastId(cast) {
  const ids = castIds(cast)
  return ids[Math.floor(Math.random() * ids.length)] ?? 0
}
```

- [ ] **Step 2: Point all three screens at it**

Each of the three files: replace its inline grid with `<CharacterPicker cast={cast} value={avatarId} onChange={setAvatarId} />`,
and replace `useState(randomAvatarId)` with:

```js
const [avatarId, setAvatarId] = useState(() => randomCastId(undefined))
const { data: cast } = useCastQuery(PLAY_TARGET)   // { code } on PlayQuiz, { quizId } on the others
```

**The shuffle button** in all three becomes `randomCastId(cast)` rather than `randomAvatarId()`.

The big preview above the grid (`PlayQuiz.jsx:180`, `PlayBattle.jsx:119`, `PlayPractice.jsx:146`) uses
`<Character id={avatarId} mood="wave" />`; change it to `<Character spec={characterSpec(avatarId, cast)} mood="wave" />`.

- [ ] **Step 3: Run the build**

Run: `npm test` then `npm run build`
Expected: both succeed.

- [ ] **Step 4: Play a game**

**This cannot be faked.** Start a hosted game, join from two phones, pick two custom characters, and confirm the lobby
board and the podium show them. A `Character` that takes `spec` but a picker that sends `id` will pass every test here
and fail on the phone.

- [ ] **Step 5: Commit**

```bash
git add src/components/quiz/CharacterPicker.jsx src/pages/PlayQuiz.jsx src/pages/PlayBattle.jsx src/pages/PlayPractice.jsx
git commit -m "feat(quiz): draw the player picker from the quiz's cast"
```

---

### Task 10: The editor

The biggest UI task. Build it in three pieces so each is reviewable on its own.

**Files:**
- Create: `src/components/admin/quizStudio/CharacterEditor.jsx`
- Create: `src/components/admin/quizStudio/CharacterEditor.test.jsx`
- Modify: `src/pages/admin/AdminQuizStudio.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect } from 'vitest'
import { sanitizeCast, sameDesign, castIds, DEFAULT_MOOD, MAX_CAST } from '../../../api/_lib/quizCharacterArt.js'

// The editor's rules live here rather than in a rendering test, because they are rules about data: what a draft may
// contain, and what happens to a slot when a character is deleted. Rendering a React tree is not where a bug in either
// would show up, and quizStudio.test.jsx already sets the precedent of testing the studio's source rather than its DOM.

describe('the cast draft', () => {
  it('never holds a part that is not in the tables', () => {
    const dirty = sanitizeCast({ mode: 'all', characters: [{ slot: 0, name: 'Kola', spec: { body: 'evil' }, moves: {} }] })
    expect(dirty.characters[0].spec.body).toBe(DEFAULT_MOOD.body)
  })

  it('never holds a colour that is not a hex', () => {
    const dirty = sanitizeCast({ mode: 'all', characters: [{ slot: 0, name: 'Kola', spec: { color: 'url(evil)' }, moves: {} }] })
    expect(dirty.characters[0].spec.color).toBeNull()
  })

  it('leaves a retired slot hole rather than shifting or reusing it', () => {
    const saved = sanitizeCast({
      mode: 'all',
      characters: [
        { slot: 0, name: 'A', spec: {}, moves: {} },
        { slot: 2, name: 'C', spec: {}, moves: {} },
      ],
    })
    // Deleting slot 0 retires it. C is still slot 2, still id 52, and slot 0 cannot be allocated again.
    const afterDelete = saved.characters.filter((c) => c.slot !== 0)
    expect(afterDelete.map((c) => c.slot)).toEqual([2])
    expect(afterDelete[0]).toMatchObject({ name: 'C', slot: 2 })
  })

  it('keeps the hole in the picker rather than closing it', () => {
    const saved = sanitizeCast({ mode: 'all', characters: [{ slot: 2, name: 'C', spec: {}, moves: {} }] })
    expect(castIds(saved)).toEqual([...Array.from({ length: 50 }, (_, i) => i), 52])
  })
})

describe('sameDesign', () => {
  it('is true for two identical characters', () => {
    expect(sameDesign(DEFAULT_MOOD, { ...DEFAULT_MOOD })).toBe(true)
  })

  it('is false when any part differs', () => {
    expect(sameDesign(DEFAULT_MOOD, { ...DEFAULT_MOOD, body: 'pot' })).toBe(false)
    expect(sameDesign(DEFAULT_MOOD, { ...DEFAULT_MOOD, prop: 'ingot' })).toBe(false)
  })

  it('is false when only the colour differs, because "the same but gold" is a different character', () => {
    expect(sameDesign({ ...DEFAULT_MOOD, color: '#ff5a1f' }, { ...DEFAULT_MOOD, color: '#4ade80' })).toBe(false)
  })
})

describe('the editor surface', () => {
  it('holds no more than a full cast', () => {
    expect(MAX_CAST).toBe(12)
  })
})
```

**If `@testing-library/react` is already a dependency** — check `package.json` first — add a second file that renders the
editor and asserts one section is open at a time and that there is exactly one Save control. **If it is not, do not add
one for this**: `quizStudio.test.jsx` already tests the studio this way, and a new testing dependency for two assertions is
not worth the CI cost.

- [ ] **Step 2: The cast mode row**

Three buttons above the editor, matching the studio's existing `Choice` and `Section` components:

| Button | `mode` | Disabled when |
|---|---|---|
| The 50, as they are | `builtins` | never |
| The 50 + your N | `all` | N is 0 |
| Your N only | `custom` | N is 0 |

Disabled with a reason, so the mode can never promise a character that does not exist.

- [ ] **Step 3: The accordion**

Nine sections — Name, Body, Colour, Headpiece, Eyes, Mouth, Wears, Prop, Moves — with **one open at a time**.

The six part sections contain 137 options in total; opening them all would render 137 character previews. The accordion
bounds that to the largest section, Wears, at 36 previews at once. Each option is drawn on the character as it stands,
not as a word:

```jsx
<button
  key={part}
  type="button"
  onClick={() => onChangeField(field, part)}
  aria-pressed={spec[field] === part}
  aria-label={part}
  className={['flex aspect-square cursor-pointer flex-col items-center rounded-xl border p-1', spec[field] === part ? 'border-orange-500 ring-2 ring-orange-500/40' : 'border-hairline hover:bg-surface-low'].join(' ')}
>
  <Character spec={{ ...spec, [field]: part }} mood="static" className="h-full w-full" />
  <span className="w-full truncate text-[10px] text-ink-muted">{part}</span>
</button>
```

The studio test must assert only one section is expanded. That is the guard against 137 drawings at once.

- [ ] **Step 4: Colour and the duplicate warning**

One `<input type="color">` plus a strip of ten swatches, the shape the Accent and Page rows already use. A `role="status"`
line warns when white text on the outline would be under 4.5:1.

On save, compare each draft character against the built-ins and the rest of the cast with `sameDesign` from Task 2, so
the studio and the test cannot disagree about what "the same character" means:

```jsx
const clash = cast.characters.filter((c) => sameDesign(c, character)).map((c) => c.name)
```

**A duplicate is a warning, not a refusal.** A deliberate "the same, but gold" is a legitimate thing to want, and a picker
that silently drops a choice is worse than a legible warning. The built-in roster's own distinctness test stays a hard
assertion — that is a property of code, and code does not get a warning.

- [ ] **Step 5: Save, Reset and delete**

One **Save cast** button writes the whole draft through `useSaveCast`. Deleting a saved character retires its slot; the
draft keeps the hole and the editor allocates only never-used slots. Deleting a new, unsaved draft does not consume a slot.

- [ ] **Step 6: Run it**

Run: `npm test`, `npm run lint`, `npm run build`
Expected: all pass, lint exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/quizStudio/CharacterEditor.jsx src/components/admin/quizStudio/CharacterEditor.test.jsx src/pages/admin/AdminQuizStudio.jsx
git commit -m "feat(quiz): add the character editor to the studio"
```

---

### Task 11: Record the rules

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add the rules**

```md
- **`avatar_id` is one integer with two meanings.** 0–49 is always one of the 50 built-ins; 50–61 is slot 0–11 of the
  quiz's own cast (`api/_lib/quizCharacterArt.js`). Do not add a second `avatar_spec` column beside it: "who is this
  player" must have one answer, and about 20 read sites already have it.
- **A slot is never renumbered or reused.** Deleting a character leaves a retired hole. Renumbering or reuse would silently re-point a player in a
  game already running at a different character, and the change is invisible — their id still passes every check.
- **A hosted game snapshots its cast** into `quiz_sessions.characters` when it starts, exactly as it snapshots `theme`.
  Battles and practice read the cast live from the quiz, exactly as they read `theme` live.
- **`sanitizeCast` is the boundary.** A cast is cleaned by it in the studio, on the phone and on the server, so a
  hand-edited row cannot put a part in the drawing that the drawing has no case for. It **refuses** a cast it cannot read
  — two characters in one slot, a slot outside 0–11 — rather than repairing it.
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs(quiz): record how a character cast is stored"
```

---

## Before you call this done

1. `npm test` — all suites pass.
2. `npm run lint` — exit 0, no new warnings.
3. `npm run build` — succeeds.
4. **The migration is applied to the live database** and Task 1's verification queries return what it says they will.
5. **A real game, end to end.** Host a game, join from two phones, pick two custom characters, let it finish, and look at
   the podium and the downloaded card. Then start a game, change the cast **while it is running**, and confirm nobody's
   character changed. That second one is the whole reason the snapshot exists and nothing but a real game proves it.
6. **Say plainly that the result has not been seen in a real game unless it has.** Steps 4 and 5 need a Supabase login.

## Order of work if this is too much for one pass

Tasks 1–7 are the server and are one coherent unit: nothing works until all of them are in. Tasks 8–9 are the players'
picking, and Task 10 is the admin's authoring. **Tasks 1–8 without Task 10 leave the feature unreachable from the UI but
fully working for a hand-inserted row**, which is a legitimate checkpoint if the editor needs to be split.
