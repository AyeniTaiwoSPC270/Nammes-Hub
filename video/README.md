# NAMMES Hub explainer video

A 2:38 motion graphics explainer for NAMMES Hub, built with [Remotion](https://www.remotion.dev) (React). It lives in its own folder with its own `package.json`, so it never touches the website build.

Two formats from one codebase: **Explainer169** (1920×1080) and **Explainer916** (1080×1920), both 30 fps. Every scene is shared; the layout reflows by reading the canvas size (`src/layout.tsx`). In 9:16, content stays inside the safe zone (150 px clear at the top, 250 px at the bottom).

## Run it

```bash
cd video
npm install            # first time only
npm run preview        # Remotion Studio (pick Explainer169 or Explainer916)
npm run render:169     # writes out/nammes-hub-explainer-16x9.mp4
npm run render:916     # writes out/nammes-hub-explainer-9x16.mp4
npm run stills         # one review still per beat, in both formats -> out/stills/
npm run docs           # regenerates captions.srt and voiceover-script.md
```

The render scripts run `npm run docs` first, so `captions.srt` and `voiceover-script.md` are always in step with the video.

## Change the timing

All timing is in **`src/constants.ts`**, in seconds, one number per beat (a beat is one idea on screen):

```ts
academics: { outlines: 7, detail: 6, curriculum: 4, timetable: 5, cgpa: 8, resources: 5 },
```

Change a number and the scene length, captions, `captions.srt`, `voiceover-script.md` and the total video length all follow. Scene order is `SCENE_ORDER` in the same file.

## Change the words

- **Narration and burned-in captions**: `src/script.ts`, one line per beat. Captions are cut from these lines automatically (short chunks, two lines at most). `npm run docs` warns if a line is too long for its beat (about 2.6 words per second is comfortable).
- **On-screen text** (pills, headings, stamps) is written inside each scene file in `src/scenes/`.
- Keep to the hard rules: never promise more than the Hub does, say "members" (not "everyone") for Awards, use the exact feature names (Live quiz, Quiz battles, Awards, Forms), and don't invent numbers or testimonials.

## Change the screenshots

Real screenshots are in `public/screens/` (copied from `scripts/manual/screens/`). To update one, overwrite the file with the same name (screenshots are 1280 px wide for the site, 800 px wide for phone shots; keep that width). Scenes point at them like `src="screens/outlines.jpg"`.

A few site pages were captured as empty states (awards, CGPA sign-in wall, news, opportunities, timetable). For those, the scenes draw the filled-in UI natively in React instead (skeleton bars, sample grades, nicknames such as `Ada_Bolt`, `MMEKing`, `Player 1`). No real student names, matric numbers or photos are used in quiz UI. The excos page screenshot does show the executives' public photos, as it does on the site.

## Characters

The 50 quiz characters are ported from the site (`src/components/CharacterSvg.tsx` and `quizCharacters.ts`, same drawing code). Motion comes from `src/components/Avatar.tsx`.

## Voiceover, music and sound effects

The audio is generated and already in `public/`:

| File | What it is |
| --- | --- |
| `public/vo/*.wav` | One narration clip per beat (free Microsoft neural voice `en-NG-EzinneNeural` via `edge-tts`). Each plays at the start of its beat. |
| `public/music.mp3` | Synthesised afrobeat-style music bed. Low volume, ducks under narration (levels in `AUDIO` in `src/constants.ts`). |
| `public/whoosh.mp3` | Played at the start of each scene. |
| `public/pop.mp3` | Played at each beat of the quiz scene. |

Regenerate with `npm run audio` (needs `pip install edge-tts`). After editing `src/script.ts`, run `REGEN=1 npm run audio -- voice` to re-speak every line, then re-render. Pick another voice with `VOICE=en-NG-AbeoNeural`.

To use your own recording instead, put one file at `public/voiceover.mp3`: it replaces the generated clips. To use your own music, replace `public/music.mp3`. Any file you delete is simply skipped, with no errors. Restart `npm run preview` after adding or removing files.

## Captions

Captions are burned into the video (bold, high contrast, two lines max) so it works muted on WhatsApp and Reels. `captions.srt` has the same timing for uploading as a subtitle track.

## Before you commit

`video/out/`, `video/node_modules/` and `video/.stills` are git-ignored. If this folder gets committed to the site repo, consider adding `video` to a `.vercelignore` so the website deployment doesn't upload it.
