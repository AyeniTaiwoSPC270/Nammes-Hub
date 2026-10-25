import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

// The live gallery's photographs are not in the repo, but the event's own poster
// was in the capture. Cropping it out gives the lightbox the one picture this
// event really has, instead of eight invented placeholder tiles.
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require(path.resolve(process.cwd(), '../node_modules/@napi-rs/canvas'))

const SRC = path.resolve('../scripts/manual/out/raw/event-detail.png')
const OUT = path.resolve('public/gallery')

// Measured off the 1920x1290 capture: the poster starts below the tabs.
const POSTER = { x: 110, y: 430, w: 1700, h: 860 }

const main = async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const source = await loadImage(fs.readFileSync(SRC))

  const poster = createCanvas(POSTER.w, POSTER.h)
  poster.getContext('2d').drawImage(source, -POSTER.x, -POSTER.y)
  fs.writeFileSync(path.join(OUT, 'poster.webp'), poster.toBuffer('image/webp', 92))

  console.log('wrote', fs.readdirSync(OUT).join(', '))
}

main()
