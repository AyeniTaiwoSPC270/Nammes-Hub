// Converts raw browser screenshots (from capture-screens.mjs) into the compact JPEGs the book embeds.
// Footer strips are cropped off automatically by finding the first row of the dark-green footer.
// Usage: node scripts/manual/prep-screens.mjs <raw-screens-dir>
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const here = path.dirname(fileURLToPath(import.meta.url))
const rawDir = process.argv[2]
if (!rawDir) throw new Error('Pass the folder with the raw screenshots.')
const outDir = path.join(here, 'screens')
// Pages that have no site footer to trim, or whose own background is the same dark green the probe looks for and
// would therefore be trimmed away to nothing: the offline screen and the result card are both full-bleed brand green.
const NO_CROP = new Set(['home', 'm-home', 'm-menu', 'offline', 'result-card'])
const OUT_WIDTH = 1280

function isFooterGreen(data, width, y) {
  for (const x of [8, 24, width - 24, width - 8]) {
    const i = (y * width + x) * 4
    if (Math.abs(data[i] - 11) > 6 || Math.abs(data[i + 1] - 36) > 6 || Math.abs(data[i + 2] - 23) > 6) return false
  }
  return true
}

await fs.mkdir(outDir, { recursive: true })
for (const file of await fs.readdir(rawDir)) {
  if (!file.endsWith('.png')) continue
  const name = file.replace(/\.png$/, '')
  const img = await loadImage(await fs.readFile(path.join(rawDir, file)))
  const probe = createCanvas(img.width, img.height)
  const pctx = probe.getContext('2d')
  pctx.drawImage(img, 0, 0)
  const { data } = pctx.getImageData(0, 0, img.width, img.height)
  // Walk up from the bottom edge while the row is footer green; that run is the footer.
  let cropTo = img.height
  if (!NO_CROP.has(name)) {
    while (cropTo > 300 && isFooterGreen(data, img.width, cropTo - 1)) cropTo--
  }
  const scale = Math.min(1, OUT_WIDTH / img.width)
  const out = createCanvas(Math.round(img.width * scale), Math.round(cropTo * scale))
  out.getContext('2d').drawImage(img, 0, 0, img.width, cropTo, 0, 0, out.width, out.height)
  await fs.writeFile(path.join(outDir, `${name}.jpg`), out.toBuffer('image/jpeg', 80))
  console.log(name, `${out.width}x${out.height}`)
}
