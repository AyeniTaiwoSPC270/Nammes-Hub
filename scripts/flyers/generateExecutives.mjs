import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderExecutivesFlyer, preloadExecPhotos } from './renderExecutives.mjs'
import { EXEC_VARIANTS } from './executives.config.mjs'
import { EXECS } from './data/execs-data.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, 'out', 'executives')

// Matches the photo inset geometry in renderExecutives.mjs (COL_W - 18, PANEL_H - 9)
const PHOTO_W = 180 - 18
const PHOTO_H = 208 - 9

async function main() {
  await fs.mkdir(outDir, { recursive: true })
  console.log('Fetching + decoding exec photos once...')
  const photos = await preloadExecPhotos(EXECS, PHOTO_W, PHOTO_H)

  for (const variant of EXEC_VARIANTS) {
    const buffer = await renderExecutivesFlyer(variant, EXECS, photos)
    const file = path.join(outDir, `${variant.slug}.png`)
    await fs.writeFile(file, buffer)
    console.log('wrote', file, '—', variant.label)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
