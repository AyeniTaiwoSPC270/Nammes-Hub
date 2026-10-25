/**
 * Renders video/flyers/*.html to PNG posters at 1080x1350 (4:5, the social
 * portrait size) so five designs can be compared side by side.
 *
 *   node scripts/capture-flyers.mjs [name ...]
 *
 * Screenshots come from a local file:// load, so the only network fetch is the
 * Google Fonts link in each flyer; the wait below covers both, and every flyer
 * also carries a system fallback in its font stack.
 */
import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'node:url'
import { readdirSync, mkdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const W = 1080
const H = 1350

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const srcDir = join(root, 'flyers')
const outDir = join(root, 'out', 'flyers')
mkdirSync(outDir, { recursive: true })

if (!existsSync(EDGE)) {
  console.error(`Edge not found at ${EDGE}`)
  process.exit(1)
}

const wanted = process.argv.slice(2)
const pages = readdirSync(srcDir)
  .filter((f) => f.endsWith('.html'))
  .filter((f) => !wanted.length || wanted.some((w) => f.startsWith(w)))

if (!pages.length) {
  console.error('no flyers matched')
  process.exit(1)
}

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true })
for (const page of pages) {
  const tab = await browser.newPage()
  await tab.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
  await tab.goto(`file:///${join(srcDir, page).replace(/\\/g, '/')}`, {
    waitUntil: 'networkidle0',
  })
  // Fonts arrive after load; document.fonts.ready resolves once they are usable.
  await tab.evaluate(() => document.fonts.ready)
  await new Promise((r) => setTimeout(r, 250))
  const out = join(outDir, page.replace(/\.html$/, '.png'))
  await tab.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } })
  console.log('wrote', out)
  await tab.close()
}
await browser.close()
