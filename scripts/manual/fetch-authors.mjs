// Downloads each author's public exco photo and saves a 4:5 crop (top-anchored, so faces stay in frame)
// into scripts/manual/authors/. The build embeds these files, so it never needs the network again.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { AUTHORS } from './data/authors.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, 'authors')
const W = 480
const H = 600

await fs.mkdir(outDir, { recursive: true })
for (const a of AUTHORS) {
  const res = await fetch(a.photoUrl)
  if (!res.ok) throw new Error(`${a.name}: HTTP ${res.status}`)
  const img = await loadImage(Buffer.from(await res.arrayBuffer()))
  const ratio = W / H
  let sw = img.width
  let sh = Math.round(sw / ratio)
  if (sh > img.height) {
    sh = img.height
    sw = Math.round(sh * ratio)
  }
  const sx = Math.round((img.width - sw) / 2)
  const canvas = createCanvas(W, H)
  canvas.getContext('2d').drawImage(img, sx, 0, sw, sh, 0, 0, W, H)
  await fs.writeFile(path.join(outDir, `${a.slug}.jpg`), canvas.toBuffer('image/jpeg', 85))
  console.log('saved', a.slug, `${img.width}x${img.height}`)
}
