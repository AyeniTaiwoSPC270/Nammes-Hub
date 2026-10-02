import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderFlyer } from './render.mjs'
import { FLYERS } from './flyers.config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, 'out')

async function main() {
  await fs.mkdir(outDir, { recursive: true })
  for (const config of FLYERS) {
    const buffer = await renderFlyer(config)
    const file = path.join(outDir, `${config.slug}.png`)
    await fs.writeFile(file, buffer)
    console.log('wrote', file)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
