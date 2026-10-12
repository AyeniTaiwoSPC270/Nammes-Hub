# Quiz Character Cast Design

The 50 quiz characters are fixed. They live in a hard-coded roster (`src/data/quizCharacters.js:27`) compiled into the
bundle, and an admin can only browse them. Every part they are made of — 13 bodies, 12 headpieces, 10 eyes, 8 mouths,
20 accessories, 12 props, 33 moves — is already separate and combinable, but nothing lets anyone put a new combination
together.

This spec adds the other half: an admin designs custom characters for a quiz from a grown drawer of 137 parts, and
players pick from them.

**Status:** approved. **Date:** 2026-10-12. **Amended:** 2026-10-12, after review — the 62 new parts and the parts lab
moved from out of scope into §4a and §8a, which split the build into three phases (§10).

---

## 1. Scope

### In

| Area | Change |
|---|---|
| Drawing | One shared art module in `api/_lib/` that draws any character spec, for the browser and the result card |
| Parts | 62 new parts across all six lists, including 6 new bodies (§4a) |
| Parts lab | A read-only studio browser for every part, so new art has somewhere to be reviewed (§8a) |
| Storage | `quiz_characters` table (max 12 per quiz) plus `quizzes.cast_mode` |
| Id space | `avatar_id` check widened from `0..49` to `0..61` on the five tables that hold one |
| Snapshot | The cast copies into `quiz_sessions.characters` when a hosted game starts, like `theme` does |
| Reading it | One read-only `roster` op on the existing quiz router, keyed by join code or quiz id |
| Studio | A cast-mode selector and a character editor on the existing Characters tab: name, 6 parts, colour, 4 moves |
| Players | The picker on all three join screens draws the quiz's real cast |
| Bots | Bots draw from the same cast the players see |
| Duplicates | A warning naming the clash, not a refusal |

### Out

- **Letting players design characters.** Admin-only. A player picks from the cast, they do not author it.
- **New parts in the built-in 50.** The 62 are for custom characters only. The roster rows stay as they are, so the 50
  players already know are unchanged.
- **A second accent colour** for the headpiece and prop, separate from the body. Cheap to add later, and it doubles the
  colour handling in the art module today.
- **Editing the 50 built-ins.** They stay code. A built-in is still one row and no admin controls.
- **Saving a character to a player's account.** A player picks per game; nothing persists between games.
- **The award cards** (`api/_lib/awardCardRender.js`). A different feature on a different table.

---

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| How a custom character is referenced | Ids 50–61, after the 50 built-ins | One integer in the column that already exists. A parallel jsonb spec column would make "who is this player" two answers, in ~20 read sites |
| Slot stability | A slot is allocated once and never renumbered | If deleting slot 3 renumbered everyone, a game already running would point a player at a different character (§5) |
| Where the cast lives | A `quiz_characters` table | The roster is read whole, once, and edited row by row. A jsonb column on `quizzes` would need a second answer for ordering and per-row validation |
| Card support | Refactor the drawing into shared pure JS | The card reads a generated table of the 50 and silently falls back to character 0 for anything else (`quizCharacterMarkup.js:50`). A custom character on a shared card is a wrong character on a thing people download and post |
| How the drawing is shared | A string builder, not `react-dom/server` | The repo has already been bitten by a module Vercel's Node runtime could not load. A string builder keeps React off the server entirely |
| Cast composition | Admin picks: the 50 / the 50 + the cast / the cast only | An admin who adds one character and forgets the rest must not end up with a one-character game |
| Duplicate designs | Warn, save anyway | The 50 are distinct by design, but a deliberate "same but gold" is a legitimate thing to want, and a picker that refuses a choice is worse than a warning |
| Colour | One free hex; outline and highlight derived | The art needs three colours. Two would be more admin decisions with nothing to show for it |
| Snapshot rule | Hosted games snapshot; battles and practice read live | Exactly what `theme` already does — a game in progress cannot restyle itself, but a practice card drawn on demand does not need a copy |
| Reordering | Not in this change | Slots are stable, so order is cosmetic; the picker can sort by name later without touching ids |
| Part volume | 62, weighted towards the cheap categories | Six new bodies cost far more than six new mouths, because every hat and accessory positions itself off a body's geometry row (§4a) |
| Where new parts are reviewed | A parts lab in the studio | New parts are unusable until Phase 3, so without the lab nobody sees a floating hat until an admin builds a character with it by accident |
| Part flavour | General-cute, with about seven materials-engineering items | The site belongs to a materials engineering department and already nods to it with π, Σ, √ and ∞, but a roster that is all lab equipment stops being cute |

---

## 3. The id space

`avatar_id` is `smallint check (avatar_id between 0 and 49)` on five tables:

| Table | Migration |
|---|---|
| `quiz_players` | `20260930170000_quiz_avatars.sql:4` |
| `quiz_teams` | `20261001130000_quiz_teams_branding_practice.sql:21` |
| `quiz_battle_sides` | `20261001170000_quiz_battles.sql:36` |
| `quiz_battle_ratings` | `20261001190000_quiz_battle_rankings.sql:9` |
| `quiz_practice_runs` | `20261001130000_quiz_teams_branding_practice.sql:55` |

One migration drops and recreates each check as `between 0 and 61`, with a rollback file in `supabase/rollbacks/`
alongside `20260930170000_quiz_avatars.rollback.sql`. Nothing else about these columns changes: the type, the default
and every index stay as they are, because **ids 0–49 keep meaning what they mean today.**

The alternative — a second `avatar_spec jsonb` column beside `avatar_id` — was rejected in §2. It would need the spec
threaded through `rankPlayers`, `quizCardData`, the bracket engine, both battle handlers, the practice handler and the
three player screens, with `avatar_id` still there as a fallback nobody can be sure is needed.

---

## 4. The shared art module

`api/_lib/quizCharacterArt.js`. Pure: no `window`, no Supabase client, no Node built-ins, no JSX, no React. It is
imported by `src/components/quiz/Character.jsx` and by `api/_lib/characterSvg.js` by relative path, which is what the
`api/_lib/*.js` sharing rule in `AGENTS.md` is for.

### What moves into it

| From | What |
|---|---|
| `Character.jsx:11-25` | `BODY` — the geometry table (eye row, head top, ear and arm attachment, neck) |
| `Character.jsx:27-610` | `Body`, `Topper`, `Eye`, `Mouth`, `Face`, `Accessory`, `Prop`, `Arms`, rewritten as string builders |
| `quizCharacters.js:6-24` | The six part lists, the four move lists and their human labels |
| `quizCharacters.js:27-78` | `ROSTER`, the 50 built-ins |
| `quizCharacters.js:83-112` | `SPECIAL_COLOURS`, `TONES`, `colourFor` — the golden-angle colour the built-ins use |

`src/data/quizCharacters.js` is deleted and `src/data/quiz.js:29` re-exports from the new module, so the roster has one
home. This is the `fonts.js` rule in `AGENTS.md`: two copies of the roster would let a part be renamed in one and not the
other, and the tests read whichever one they were pointed at.

### What it exports

```js
BODIES, TOPPERS, EYES, MOUTHS, ACCESSORIES, PROPS
IDLE_MOVES, WIN_MOVES, SAD_MOVES, HELLO_MOVES   // and the label lists beside them
BUILTIN_COUNT = 50
DEFAULT_CHARACTER                               // a complete, valid spec and move set
sanitizeCharacterSpec(raw)                      // every part an enum key that exists; colour a validated hex
sanitizeCharacterMoves(raw)                     // every move a key that exists
sanitizeCast(raw)                               // { mode, characters: [{ slot, name, spec, moves }] }, max 12
deriveColour(hex)                               // { main, dark, light } from one hex
castIds(cast)                                   // the avatar ids a player may pick from, as an array
allowedAvatarIds(cast)                          // the same, as a Set, for the server
characterSpec(id, cast)                         // id 0-49 → a built-in row; id 50-61 → the cast row for id - 50
characterSvgBody(spec, mood)                    // the inner SVG as a string
```

`BUILTIN_COUNT` replaces **two** declarations of the same number: `AVATAR_COUNT = 50` in `api/_lib/quiz.js:11` and the
derived `ROSTER.length` in `quizCharacters.js:80`. They agree today by hand.

### Why a string, and `dangerouslySetInnerHTML` in the browser

`characterSvgBody` returns markup, not a React tree, because `react-dom/server` inside a Vercel function is the exact
class of failure already recorded at `api/_lib/characterSvg.js:9-12`. A string is what `@napi-rs/canvas` parses today,
so the card path changes only in where the string comes from.

`Character.jsx` becomes a wrapper that renders it with `dangerouslySetInnerHTML`. That is safe here because nothing
admin-typed reaches the markup: every part is an enum key looked up in a fixed table, and the colour is
`/^#[0-9a-f]{6}$/`-validated before use. The name is **never** drawn into the SVG. The sanitiser is the boundary, and
`quizCharacterArt.test.js` asserts that a spec made entirely of junk and a spec made of prototype keys both produce a
character rather than markup.

### What goes away

| File | Why |
|---|---|
| `api/_lib/quizCharacterMarkup.js` | The generated table of 300 entries. The drawing is the string builder, so there is no second copy left to drift |
| `scripts/quizCharacterMarkup.test.js` | Its job was proving the two copies agree. There is one copy |
| `scripts/regenerateCharacters.mjs` | Regeneration is meaningless with one copy |
| `cards:characters` in `package.json` | Same |

`api/_lib/characterSvg.test.js` keeps the checks that were never about the copy — that every file rendering a
`Character` imports `characters.css`, and that `Character.jsx` does not, because Node cannot parse a stylesheet when it
draws the card.

---

## 4a. The part expansion

The six part lists grow from 75 entries to 137:

| List | Now | After | New |
|---|---|---|---|
| `BODIES` | 13 | 19 | 6 |
| `TOPPERS` | 12 | 24 | 12 |
| `EYES` | 10 | 18 | 8 |
| `MOUTHS` | 8 | 14 | 6 |
| `ACCESSORIES` | 20 | 36 | 16 |
| `PROPS` | 12 | 26 | 14 |

19 × 24 × 18 × 14 × 36 × 26 is 107,557,632 combinations before colour, so nothing runs out.

### Colour

A new part does whatever the part of its kind already does. Bodies and most headpieces take the character's `main`,
`dark` and `light`; accessories and props carry their own fixed hexes, the way the crown is gold and the bowtie red
(`Character.jsx:395-470`). There is no third rule to invent, which is the point.

### Flavour

General-cute, with about seven materials-engineering items among them — a welding mask, calipers, an ingot, a heat
shield, a gear, a beaker, a micrometer. Seven, not seventy: `PROPS` already nods to the department with π, Σ, √ and ∞,
and a drawer that is all lab equipment stops being a drawer anyone browses.

### The six new bodies are the risk

Every headpiece, accessory and prop positions itself off the body's geometry row — the eye row, the top of the head,
where ears attach, where the neck sits, where the arms start. A new body with a wrong row does not fail; it looks wrong
in a way no test can see: a crown hovering above the head, a scarf drawn on the shoulder of nothing.

So each new body is rendered against **all 24 headpieces, all 36 accessories and all 26 props** in a test strip, and
every coordinate in the output is checked to fall inside the 100 × 100 box. That catches a hat drawn off the canvas; it
does not catch a hat drawn two millimetres too high, which is what §8a is for.

### They are for custom characters only

`ROSTER` keeps its 50 rows, so nothing built in ever references a new part and the gallery of 50 is unchanged. The
distinctness test (`quizCharacters.test.js:7`) is unaffected.

---

## 5. Slots, and why they never move

A custom character's id is `50 + slot`, `slot` being 0–11.

The obvious design reindexes: delete the second of three and the third becomes 51. **That breaks running games.** A
player who already picked 52 would be re-pointed at a different design, and the change is invisible — their
`avatar_id` still says 52 and still passes every check.

So a slot is allocated on creation and never reused. Deleting slot 3 leaves a hole; the picker shows the filled slots
and `castIds` simply does not include 51. The ids of every other character are untouched by any edit.

`avatar_id` therefore means one thing for its whole life: 0–49 is a built-in, 50–61 is slot 0–11 of the quiz's cast.

---

## 6. Data model

```sql
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

alter table public.quizzes
  add column cast_mode text not null default 'builtins'
  check (cast_mode in ('builtins', 'all', 'custom'));

alter table public.quiz_sessions
  add column characters jsonb not null default '{}'::jsonb
  check (jsonb_typeof(characters) = 'object' and pg_column_size(characters) < 8000);
```

**RLS.** `select`, `insert`, `update` and `delete` to admins only, using `is_admin()` — the same predicate the rest of
the admin surface uses. Players never read this table: `quizzes` is admin-only too
(`20260930150000_live_quiz.sql:78-79`), and every player read goes through the API with the service key, which is how
joining already works.

**The snapshot** is `{ mode, characters: [...] }` — the custom cast only, because the 50 are compiled in and cost
nothing to carry. The largest cast an admin can build is 12 rows of about 180 characters, roughly 2.2 KB, against the
8 KB check. `theme`'s 4 KB check is untouched: this is a separate column on purpose, since a cast and a look are saved
independently and must not be able to overflow each other.

### Saving a cast

One **Save cast** button writes the whole draft: upsert each character by `id`, scoped to the quiz, and delete the ids
the draft no longer has. Saving is refused, not silently repaired, when the draft has two characters in one slot or a
part that is not in the tables. Freeing a slot is an explicit delete, so §5 holds.

---

## 7. Reading the cast

One new read-only op on the quiz router, keyed either way:

```js
callQuiz('roster', { code })      // joining a hosted game or a battle — the phone has only the 6-character code
callQuiz('roster', { quizId })    // practice, and creating a battle, where the client already chose the quiz
```

It returns `{ mode, characters }` already run through `sanitizeCast`. Registered in the router's `ACTIONS` map, not as
a new `api/*.js` entry point — the function budget rule in `AGENTS.md` is deliberate.

The join screens need it *before* joining, which is why it cannot be part of the join response: today a player types a
code and picks a character in one screen (`PlayQuiz.jsx:128,186`).

`src/data/quiz.js` gains `useCastQuery({ code } | { quizId })` and `useSaveCast()`, react-query, keyed so two tabs of
the same quiz do not fight.

### Validation

`isAvatarId(value)` in `api/_lib/quiz.js:19` becomes `isAvatarId(value, cast)`, checking `allowedAvatarIds(cast)`. It is
already the single gate for `quiz-join.js:23`, `quiz-battle.js:520,628` and `quiz-practice.js:290`, so those four call
sites pass the cast and nothing else changes shape.

### Bots

`quiz-host.js:242` (`(offset + i * 7 + 2) % AVATAR_COUNT`) and `quiz-battle.js:588` pick from the built-ins by
modulus. Both draw from `castIds(cast)` instead, so a room of custom characters has custom bots. `quiz-practice.js:117`
and `quizBracket.js:41` (`seeded(id, 5) * 50`) do the same for ghosts and byes.

`quizTeams.js:50` hardcodes `< 50` when an admin names a team; it validates against `allowedAvatarIds` too, so a team
can be named after a custom character.

---

## 8. The studio

The Characters tab (`AdminQuizStudio.jsx:218`) keeps its two-column shape: controls left, sticky preview right.

### Cast mode

Three buttons at the top: **The 50, as they are** / **The 50 + your N** / **Your N only**. The second and third are
disabled with the count when the cast is empty, so the mode can never promise a character that does not exist.

### The editor

| Section | Contents |
|---|---|
| Name | A text field, 24 characters |
| Body | 13 |
| Colour | One `<input type="color">` plus a strip of ten swatches |
| Headpiece | 12 |
| Eyes | 10 |
| Mouth | 8 |
| Wears | 20 |
| Prop | 12 |
| Moves | idle 11, win 10, sad 4, hello 8 |

**One section open at a time.** All eight expanded is 75 live animated drawings, which is why the sections are an
accordion. At most 20 render.

Every option is drawn **on the character as it stands** — a hat swatch is the current body with that hat — because a
list of words cannot tell an admin whether a crown sits right on a `loaf`. Each swatch is `aria-pressed` and labelled
with the part's name.

The preview is the existing `CharacterGallery` preview, unchanged: the same five mood buttons, the same moves table
underneath. `CharacterGallery.jsx` is reused rather than copied — the tab today is already that component, and a
second mood switcher would be two places for a mood to be added.

### Colour

The admin picks one hex. `deriveColour` produces `dark` at lightness 28 for the outline and `light` at lightness 90 for
highlights, which is exactly what `colourFor` does for the built-ins (`quizCharacters.js:107-112`). A contrast line
warns below 4.5 against white, matching the Accent and Page rows in the same tab.

### Duplicates

On save, the six parts and the colour of each draft character are compared as one signature against the built-ins and the
rest of the cast. A clash is a `role="status"` warning naming the other character, and the save goes ahead. The
built-in test (`quizCharacters.test.js:7`) stays a hard assertion about the 50 — that is a property of code, and code
does not get a warning.

### The 50, unchanged

Below the editor, the existing read-only gallery of all 50, exactly as it is today. An admin can see what players pick
by default without being able to change it.

---

## 8a. The parts lab

A read-only studio tab, next to Characters. It exists because the 62 new parts are unusable until Phase 3: without it,
nobody sees a floating hat until an admin builds a character with it by accident.

| | |
|---|---|
| Categories | Six tabs — Body, Headpiece, Eyes, Mouth, Wears, Prop — with counts on each |
| Canvas | Every option drawn on one neutral `blob` body, at 96px |
| Filter | A text box matching part names, so 36 accessories do not have to be scanned |
| Detail | One tile at a time: the part alone, the part on the neutral body, and a five-mood strip |

It is a browsing surface, not an editor. Nothing here writes.

### Why it is a tab and not a section

137 options across six categories in one scroll is a list nobody reads. One category at a time, with the filter, is
readable. It is also the acceptance surface for Phase 2: **a new part is not done until somebody has looked at it
here**, because the tests in §11 prove it draws and not that it looks right.

---

## 9. The picker

All three join screens replace `Array.from({ length: AVATAR_COUNT }, ...)` with `castIds(cast)`:

| Screen | Line |
|---|---|
| `PlayQuiz.jsx` | `186` |
| `PlayBattle.jsx` | `128` (both `Profile` instances share it) |
| `PlayPractice.jsx` | `155` |

`randomAvatarId()` becomes `randomCastId(cast)`. Until the roster query resolves, the picker shows the 50 built-ins, so a
slow network never blocks joining — a player who taps through fast picks a built-in, which is always valid.

The grid already scrolls and already handles any count, so a 62-character cast is a longer scroll and nothing else.
`HostQuiz.jsx`, `PlayBattle.jsx:676,707,747` and the podium take `avatarId` and resolve it through
`characterSpec(id, cast)`, which they now need the cast for — the host gets it from the session snapshot, everyone
else from the roster op.

---

## 10. Delivery order

Three dependent pieces, and the order is not negotiable — each one cannot exist without the one before it.

| Phase | What | Why here |
|---|---|---|
| 1 | The art module (§4): move the drawing into `api/_lib/`, prove it against the 50, delete the generated copy | Nothing can draw a character that is not one of the 50 until this lands, and **drawing 62 parts twice is not an option**. It ships with **no behaviour change at all** — the same 50, drawn by the same code, on every screen |
| 2 | The 62 new parts and the parts lab (§4a, §8a) | They are drawn as string builders once, into the module Phase 1 put in place. The lab is what makes them reviewable, and it has to exist before there is anything to review |
| 3 | The cast (§3, §5–§9): the table, the ids, the roster op, the editor, the pickers | Only now is there anything to store, and by now there are 137 parts to store it from |

Phase 1 is the risky one and it is worth landing on its own, so a problem with the drawing shows up against a card that
worked yesterday. Phase 2 is the long one and can be split again, category by category, without breaking anything.

---

## 11. Tests

| Test | Asserts |
|---|---|
| `api/_lib/quizCharacterArt.test.js` | Every part list value draws; `sanitizeCharacterSpec` maps junk, wrong types and prototype keys to a valid spec rather than markup; `deriveColour` always returns a dark darker than its main and a light lighter; a fixture captured from today's output is reproduced byte for byte by the string builder |
| `api/_lib/quizCharacterArt.test.js` (parts) | Every one of the 137 entries appears in exactly one list; each body's geometry row puts the eyes above the neck and the head top above the eyes, with ear and arm anchors inside the box; each new body renders against all 24 headpieces, 36 accessories and 26 props without throwing |
| `api/_lib/quizCharacterArt.test.js` (bounds) | For every part on every body, no emitted coordinate falls outside the 100 × 100 viewBox, and no part name appears verbatim in the markup — the sanitiser boundary, proved rather than asserted |
| `api/_lib/quizCharacterArt.test.js` (cast) | `castIds` is 50 ids for `builtins`, 50 + filled slots for `all`, filled slots only for `custom`; a hole in the slots is skipped, not renumbered; a cast over 12 is refused |
| `api/_lib/quizCharacterArt.test.js` (roster, moved from `src/data/quizCharacters.test.js`) | Unchanged assertions — 50 built-ins, all distinct, an out-of-range id falls back to 0 — plus: no roster row references a part added in Phase 2 |
| `api/_lib/quizCardRender.test.js` | A custom spec reaches the painted card; a cast the card was not given falls back exactly as `characterMarkup` does today |
| `api/_lib/quizHandlers.test.js` | The session snapshot carries `{ mode, characters }`; join rejects an id outside the quiz's cast and accepts every id in it; `addBots` picks from the cast; the roster op answers by code and by quiz id |
| `src/components/admin/quizStudio/quizStudio.test.jsx` | Every draft write goes through `sanitizeCharacterSpec`/`sanitizeCharacterMoves`; deleting frees a slot rather than renumbering; the duplicate warning names the other character and the save proceeds; the parts lab shows one category at a time and writes nothing |
| `api/_lib/characterSvg.test.js` | Keeps the stylesheet-reach checks it has today, minus the deleted generator |

---

## 12. Accessibility

- Every swatch is a real `<button>` with `aria-pressed` and an `aria-label` carrying the part's name, matching the
  picker buttons on the player side.
- Sections are `<button aria-expanded>` disclosures, one open at a time, so the tab is navigable without sight of the
  layout.
- The duplicate and contrast warnings are `role="status"`, the same posture as the Accent and Page rows.
- The colour picker is one labelled `<input type="color">`; the character is never identified by colour alone, since
  the shape and the name are on screen with it.
- The preview keeps its `title`/`aria-label` on the `Character` root, so the character is announced by name.
- The parts lab's category tabs are a real tablist, the filter is a labelled search input, and each tile carries its
  part's name as text under the drawing — so the lab is usable without seeing any of the art.

---

## 13. Risks

- **Refactoring the drawing touches the card path.** The card is the one thing that cannot be checked without a real
  game and a canvas. Mitigation: the existing `quizCardRender.test.js` runs before and after, and the new art module is
  proven against the 50 built-ins before a single custom character exists.
- **Unverified without a real session.** The picker, the podium, the brackets and the downloaded card with a custom
  character on them all need a Supabase login and a real game. Say so rather than implying they were looked at.
- **75 animated drawings if the accordion is broken.** The guard is the accordion itself; the studio test asserts only
  one section is expanded.
- **The 50 built-ins are now drawn by a string builder.** They were JSX. Phase 1 captures today's output as a fixture
  first and reproduces it byte for byte, so a change in how a body is drawn fails loudly instead of shipping.
- **`dangerouslySetInnerHTML` in a hot path.** It runs for every character on a 42-player board. The string is built
  once per `Character` render, same as the JSX tree was, but it is worth watching on a busy lobby.
- **Sixty-two hand-drawn parts is a lot of visual judgement no test can make.** The bounds test catches a hat drawn off
  the canvas; it cannot catch one drawn two millimetres too high, and six new bodies mean six chances to be wrong about
  where a neck is. This is what the parts lab is for, and the claim that the new art looks right has to be made by
  somebody who opened it, not by a passing suite.
- **137 options is past the point where a grid reads.** The parts lab answers it by showing one category at a time; the
  editor answers it with the accordion. If either ends up showing everything at once, that is the symptom to look for.