# Live quiz: custom audio and per-effect switches (spec)

Date: 2026-10-04
Status: Built (see "As built" at the end). Follows `2026-09-30-live-quiz-premium-features.md`, which built the sound engine, the Sound tab and the drum roll this builds on.

## Goal

An admin can (1) switch off any single sound effect in a quiz, and (2) import their own background music and sound effects, use them in a game, and delete them again.

## Decisions already made

- Imported audio stays in the browser on the device that imported it. It is never uploaded to Supabase. Deleting a clip removes it from that browser.
- No migration, no Supabase Storage, no new RLS. A quiz's `theme` is already jsonb, so the new fields only need a default in `DEFAULT_THEME` and a fallback in the matching `clean*` function.
- The built-in synthesised sounds remain the default and the fallback for everything.
- Phones (`PlayQuiz.jsx`) are unchanged: built-in effects only, never music, never an imported clip.
- Switching an effect off is saved in the quiz's theme, so it follows the quiz to any device. Imported clips do not.

## Slices, in build order

1. Per-effect switches.
2. The local library: import, list, preview, delete.
3. Custom effects: a clip can replace the built-in sound of the same name.
4. Custom music: one clip can be the quiz's background music.

Each slice ships and is tested on its own.

## Design

### Theme shape (`api/_lib/quizTheme.js`, pure)

```js
sound: {
  music: 'off' | 'chill' | ... | 'custom',
  effects: true,
  off: ['applause', 'join'],            // effect names switched off
  custom: { music: 'clip-id' | null, effects: { drumroll: 'clip-id' } },
}
```

- Add `THEME_EFFECTS` (the list of effect names) to `quizTheme.js`, because `sanitizeTheme` has to stay pure. A test asserts it agrees with `EFFECT_GROUPS` in `quizSound.js`, the same way `THEME_MUSIC` is checked.
- `off` keeps only known effect names, with no duplicates. `custom.effects` keeps only known names mapped to ids that match a fixed pattern (`^[a-z0-9-]{8,40}$`).
- `music: 'custom'` with no valid `custom.music` falls back to `'off'`.
- Nothing in a theme becomes free text that reaches CSS or a URL. An id is only ever a key into the local library.

### Local library (`src/lib/quizAudioStore.js`, framework-free)

- IndexedDB database with one store of clips: `{ id, name, kind, type, size, duration, createdAt, blob }`.
- Every call fails silently and reports "unavailable" when IndexedDB is missing or blocked (private mode, old browser). Audio must never break the game.
- Ask `navigator.storage.persist()` on the first import, so the browser is less likely to evict the clips under storage pressure.
- Deleting a clip removes the blob. Quizzes that still point at its id fall back to the built-in sound.
- Limits are enforced at import, before anything is stored.

### Engine (`src/lib/quizSound.js`)

- `play(name)` returns at once if the name is in the theme's `off` list. Otherwise it plays the custom clip if one is loaded, and the synthesised sound if not.
- Custom effects are decoded once into buffers when the host screen loads the theme, never at the moment of a reveal. A clip that fails to decode is skipped silently.
- Custom music plays through an audio element on a blob URL (streamed, `loop`), connected to the existing music gain. The same quiet-during-questions level, volume, mute and fade-out apply. Music is not decoded into memory, because a 3 minute stereo track is about 60 MB decoded.
- The unlock-on-gesture rule, the silent failure on unsupported or closed contexts, and the "phones never read `theme.sound.music`" rule are unchanged.

### Coupling to the reveal hold (`HostQuiz.jsx`)

The reveal screen holds the correct answer for `REVEAL_STING_MS` so it lands on the drum roll's hit. That hold must follow what will actually play:

- If `drumroll` is switched off, the hold is 0.
- If a custom drum roll is in use, the built-in hit time no longer applies.
- Put this in one pure function (for example `revealHoldMs`) and test it. Do not leave it as a condition inside the component.

### UI (UI-GATE: the owner designs this externally; stop and ask before any visual change)

- An import control and the clip list, with preview and delete.
- A switch beside each effect in the Sound Lab.
- A picker per effect for "use my sound", and "My music" as a music card.
- A "not on this device" state for a clip the theme refers to but this browser does not have.

## Non-goals

- Uploading audio anywhere, or sharing clips between devices or admins.
- Custom sounds on phones.
- In-app trimming or editing.
- A bundled library of ready-made sounds.
- Any migration.

## Risks

- Clips live only in one browser. Clearing site data, private mode or a new laptop means the quiz falls back to built-in sounds. The UI must say so plainly.
- Browsers can evict stored data. `persist()` reduces this but does not remove it.
- MP3 can leave a small gap when it loops. OGG or WAV loops cleanly.
- The admin is responsible for having the rights to what they import. A one-line reminder belongs in the import UI.

## Decision gates (answered 2026-10-04)

1. **Limits.** Music up to 15 MB and 8 minutes; effects up to 1 MB and 10 seconds; at most 40 clips and 100 MB in total.
2. **Custom music as its own style.** `'custom'` is a new key in `THEME_MUSIC`, so existing validation and the studio list keep working.
3. **Custom drum roll timing.** The hold equals the clip's length, so the clip must be trimmed to end on its hit, and the UI says so.
4. **Formats.** MP3, OGG, WAV and M4A, checked by trying to decode or load them, not by file extension.
5. **The UI itself.** A minimal UI built to match the existing Sound Lab, for the owner to redesign afterwards.
6. **Phones and the off list.** Phones honour the off list and keep their built-in sounds; they never read a custom clip or the music choice.
7. **Auditioning a switched-off effect.** The Sound Lab's Play button ignores the off list, because otherwise it sits next to the switch that turned it off and does nothing.
8. **Theme size.** All 13 effects may be customised; the "stays small enough for the database limit" test moves from 2000 to 3000 bytes.

## Tests

- Pure: `sanitizeTheme` for `off` and `custom` (unknown names, duplicates, bad ids, `music: 'custom'` without a clip); `THEME_EFFECTS` against `EFFECT_GROUPS`; `revealHoldMs` for every combination.
- The store takes an injectable database so it can be tested with a fake. No new dependency.
- Not testable here: whether an imported clip sounds right, loops cleanly, or lands on the reveal. Say so in the done report.

## Before calling it done

`npm test`, `npm run lint`, `npm run build`, all passing. Then state plainly that imported audio has not been heard in a real game.

## As built

All four slices are built, in the order above.

- **Theme (`api/_lib/quizTheme.js`).** `THEME_EFFECTS` lists all 13 effects with their labels, in `EFFECT_GROUPS` order, so a cleaned theme's `off` and `custom.effects` come back in a fixed order however the admin filled them in — the studio's "unsaved changes" check compares two JSON strings and would otherwise report a change that was not one. `isClipId` is exported so the store and the theme agree on one shape. `cleanSound` sets `music: 'custom'` to `'off'` when there is no valid clip id.
- **Limits.** `LIMITS` in the store holds the numbers from gate 1, and `checkImport` is pure: kind, then the browser's measurement (which doubles as the format check), then size, then length by kind, then the two library caps. Every limit is judged before a single byte is written, so a refused import leaves nothing behind.
- **Store (`src/lib/quizAudioStore.js`).** One IndexedDB store. Everything the browser owns is injected — the database, the object URLs, the length probe, the storage quota and the id source — so the whole store is tested against a fake with no browser and no new dependency. Reading the list goes through a cursor so listing 40 clips does not drag 40 blobs into memory. `refusals` is a map of reasons in plain words, so the import panel never spells out a limit itself. `url(id)` keeps one blob address per clip until the clip is deleted, because music is streamed from it rather than decoded.
- **Engine (`src/lib/quizSound.js`).** `setSoundConfig` takes the cleaned `sound` once per screen. `play` returns at once for anything in `off`; `previewEffect` is the same path with the off list ignored, for the lab. Imported effects are decoded when the host screen loads its theme, and the engine publishes afterwards so the reveal picks up the drum roll's real length. An import is turned down to a fixed peak (0.9) at decode time: an import can be a whisper or a recording of the whole hall, and without this one imported effect could be several times louder than everything else on the projector with nothing the host could do about it. A clip that will not decode, or that this device does not have, is left out and the built-in sound plays instead — the projector never mentions it.
- **Custom music.** `'custom'` is a key in `THEME_MUSIC` with a note. `startMusic('custom', { address })` connects an `<audio>` element to the same bus a generated loop uses, so ducking during a question, the volume, the mute and the fade all reach it by the path they always had. `hasMusicStyle('custom')` stays false, which is the point: it is the one style the engine cannot generate.
- **The reveal hold (`revealHoldMs`).** One pure function: no sound config or a roll that is switched off gives 0, a decoded custom roll gives `DRUMROLL_START_MS + its length`, anything else gives the built-in `DRUMROLL_START_MS + DRUMROLL_HIT_MS`. `DRUMROLL_START_MS` moved out of `HostQuiz.jsx` next to it, so the roll, the sting and the hold can no longer disagree.
- **UI.** Per-effect switches beside each Play button in the Sound Lab; a "Your own audio" panel between the music cards and the effects; a `select` per effect that only appears once an effect clip exists; a "My music" card with a track picker. A clip a quiz names but this browser does not have shows "Not on this device" in both the effect pickers and the music card, and the built-in plays. The library panel says plainly that clips stay in this browser and that clearing site data deletes them. The compact sound list on the Design tab leaves `custom` out — an imported track can only be picked from a list of files that exists in the browser — and points at the Sound tab instead.
- **`Toggle` gained `hideLabel`**, so a switch can sit inside a row that is already labelled without printing its label twice.
- **Two tests that spelled out the theme shape** (`quizHandlers.test.js`, twice) now compare against `DEFAULT_THEME.sound`, and the "stays small enough for the database limit" test in `quizTheme.test.js` moved to 3000 bytes with a case that fills every effect.
- **`index.html` gained `upload`** for the import buttons; `refresh`, `delete`, `stop` and `play_arrow` were already in the font list.
- **One real bug the tests caught.** The clip id was built by adding numbers to a string, which spells them in base 10, so anything from 10 up took two characters and an id could grow past the 40 characters a saved theme accepts — every quiz with an imported clip would have silently lost it. Fixed to write each character in base 36 explicitly.