// Generates the sound-effect library with the ElevenLabs sound-effects API into public/sfx/.
// Needs ELEVENLABS_API_KEY in video/.env. Already-generated files are kept (no re-billing); set REGEN=1 to redo them.
// Usage: npx tsx scripts/generate-sfx.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')
const out = join(root, 'public', 'sfx')

const env: Record<string, string> = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

// name -> prompt and length in seconds. Names are used by src/sfx.ts.
export const SFX: Record<string, { prompt: string; seconds: number }> = {
  whoosh: { prompt: 'fast cinematic whoosh transition, short and clean', seconds: 0.8 },
  swish: { prompt: 'quick soft swish, light airy', seconds: 0.5 },
  pop: { prompt: 'bubbly cartoon pop, short and bright', seconds: 0.5 },
  click: { prompt: 'single soft computer mouse click', seconds: 0.5 },
  ping: { prompt: 'phone chat message notification ping, short', seconds: 1 },
  stamp: { prompt: 'heavy rubber stamp thud on paper, punchy and short', seconds: 0.7 },
  impact: { prompt: 'big cinematic logo impact boom with a short shimmer tail', seconds: 1.8 },
  chime: { prompt: 'bright success chime, two ascending notes', seconds: 1.2 },
  ding: { prompt: 'single clean bell ding, short', seconds: 0.8 },
  tick: { prompt: 'short dry clock tick', seconds: 0.5 },
  type: { prompt: 'a few quick keyboard keystrokes typing', seconds: 1.5 },
  fanfare: { prompt: 'short triumphant victory fanfare with crowd cheer and applause', seconds: 3.5 },
  shutter: { prompt: 'camera shutter click', seconds: 0.5 },
  error: { prompt: 'short negative error buzz, comedic', seconds: 0.8 },
  scan: { prompt: 'short futuristic scanner beep sweep', seconds: 1 },
  rise: { prompt: 'rising swoosh with a light sparkle, bars growing upward', seconds: 1 },
}

async function main() {
  if (!env.ELEVENLABS_API_KEY) throw new Error('Set ELEVENLABS_API_KEY in video/.env first.')
  mkdirSync(out, { recursive: true })
  for (const [name, { prompt, seconds }] of Object.entries(SFX)) {
    const file = join(out, `${name}.mp3`)
    if (existsSync(file) && !process.env.REGEN) {
      console.log(`keep ${name}`)
      continue
    }
    const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ text: prompt, duration_seconds: seconds, prompt_influence: 0.5 }),
    })
    if (!r.ok) {
      console.error(`FAILED ${name}: ${r.status} ${(await r.text()).slice(0, 200)}`)
      continue
    }
    writeFileSync(file, Buffer.from(await r.arrayBuffer()))
    console.log(`made ${name}`)
  }
}

main()
