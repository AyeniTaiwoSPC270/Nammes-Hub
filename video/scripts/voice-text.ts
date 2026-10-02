// Writes voiceover-elevenlabs.txt: every narration line, in order, separated by a 1.5 second pause tag, ready to paste
// into the ElevenLabs Text to Speech page. Some words are respelled so the voice says them properly.
// The importer (scripts/import-voice.ts) later splits the audio you download back into one clip per beat at those pauses.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BEAT_SECONDS, SCENE_ORDER } from '../src/constants'
import { VO } from '../src/script'

// How to say things. Edit freely; run `npm run voice-text` again after changing it.
const SAY: [RegExp, string][] = [
  [/NAMMES/g, 'Nammes'],
  [/UNILAG/g, 'Unilag'],
  [/CCMAS/g, 'C C M A S'],
  [/CGPA/g, 'C G P A'],
  [/\bQR\b/g, 'Q R'],
  [/50\/50/g, 'fifty fifty'],
  [/AEGIS 26\/27/g, 'Aegis twenty six, twenty seven'],
  [/nammeshub\.com\.ng/g, 'nammeshub dot com dot N G'],
]

const lines: string[] = []
for (const scene of SCENE_ORDER) {
  for (const beat of Object.keys(BEAT_SECONDS[scene])) {
    let text = (VO[scene] as Record<string, string>)[beat]
    for (const [re, to] of SAY) text = text.replace(re, to)
    lines.push(text)
  }
}
const body = lines.join('\n<break time="1.5s" />\n')
writeFileSync(join(__dirname, '..', 'voiceover-elevenlabs.txt'), body, 'utf8')
console.log(`Wrote voiceover-elevenlabs.txt: ${lines.length} lines, ${body.length} characters.`)
