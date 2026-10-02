// Renders one still per beat (near the end of the beat, when its animation has settled) for quick visual review.
// Usage: npx tsx scripts/stills.ts [169|916|both] [scale] [sceneFilter]
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { BEAT_SECONDS, SCENE_ORDER, SCENE_START, sec } from '../src/constants'

const root = join(__dirname, '..')
const which = process.argv[2] ?? 'both'
const scale = Number(process.argv[3] ?? 0.5)
const filter = process.argv[4]

async function main() {
  const serveUrl = await bundle({ entryPoint: join(root, 'src/index.ts'), publicDir: join(root, 'public') })
  const formats = which === 'both' ? ['169', '916'] : [which]
  for (const fmt of formats) {
    const id = `Explainer${fmt}`
    const composition = await selectComposition({ serveUrl, id })
    const dir = join(root, 'out', 'stills', fmt)
    mkdirSync(dir, { recursive: true })
    for (const scene of SCENE_ORDER) {
      if (filter && !scene.startsWith(filter)) continue
      let t = SCENE_START[scene]
      for (const [beat, seconds] of Object.entries(BEAT_SECONDS[scene])) {
        const len = sec(seconds as number)
        const frame = Math.min(composition.durationInFrames - 1, t + Math.round(len * 0.78))
        await renderStill({ composition, serveUrl, frame, scale, output: join(dir, `${scene}-${beat}.png`), logLevel: 'error' })
        console.log(`${fmt} ${scene}/${beat} @${frame}`)
        t += len
      }
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
