// Builds the NAMMES Hub Handbook locally: assembles the book HTML, prints it to PDF with Microsoft Edge/Chrome, then
// prints it a second time so the table of contents can carry real page numbers.
//
//   node scripts/manual/build.mjs
//
// Needs: Edge or Chrome installed. Page text is read with pdf.js (already a dependency, and the same reader the
// serverless builder uses), so unlike the old pdftotext call there is no external binary to install.
// Output: public/documents/NAMMES-Hub-Handbook.pdf  (the fallback download; once an admin rebuilds the handbook from
// Admin > Handbook, the site serves that newer copy instead).
// The book text and design live in book-content.mjs / content-*.mjs / book.css and are shared with the site's builder.
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildBookHtml, locate, norm } from './book-lib.mjs'
import { makeContext } from './book-content.mjs'
// The serverless builder already measures page text the same way; sharing it keeps the two builds from drifting.
import { pdfPageTexts } from '../../api/_lib/handbookBuild.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const outDir = path.join(here, 'out')
const htmlPath = path.join(outDir, 'book.html')
const pdfPath = path.join(outDir, 'book.pdf')
const finalPdf = path.join(root, 'public/documents/NAMMES-Hub-Handbook.pdf')

async function loadContext() {
  const css = await fs.readFile(path.join(here, 'book.css'), 'utf8')
  return makeContext({}, css.replaceAll('../../api/_lib/fonts', pathToFileURL(path.join(root, 'api/_lib/fonts')).href))
}

function findBrowser() {
  const candidates = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ]
  return candidates.find((p) => existsSync(p))
}
function printPdf(browser) {
  execFileSync(
    browser,
    ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw', '--virtual-time-budget=20000', `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href],
    { stdio: 'ignore', timeout: 240000 },
  )
}

async function pageTexts() {
  return pdfPageTexts(await fs.readFile(pdfPath), norm)
}

async function main() {
  const ctx = await loadContext()
  await fs.mkdir(outDir, { recursive: true })
  const browser = findBrowser()
  if (!browser) throw new Error('Install Microsoft Edge or Google Chrome to render the PDF.')

  // Pass 1: placeholder page numbers, to measure where everything lands.
  await fs.writeFile(htmlPath, await buildBookHtml(ctx, () => '00'))
  printPdf(browser)
  let { map, total } = locate(ctx, await pageTexts())

  // A printed book has an even page count: add a spare notes page if the back cover would land on an odd page.
  const extraNotes = total % 2 === 1
  await fs.writeFile(htmlPath, await buildBookHtml(ctx, (id) => String(map[id] ?? 0), { extraNotes }))
  printPdf(browser)
  const second = locate(ctx, await pageTexts())
  const changed = Object.keys(map).some((k) => map[k] !== second.map[k])
  if (changed) {
    // Numbers moved between passes (rare): rebuild once more with the settled values.
    await fs.writeFile(htmlPath, await buildBookHtml(ctx, (id) => String(second.map[id]), { extraNotes }))
    printPdf(browser)
  }

  await fs.mkdir(path.dirname(finalPdf), { recursive: true })
  await fs.copyFile(pdfPath, finalPdf)
  const size = (await fs.stat(finalPdf)).size
  console.log(`Handbook written: ${path.relative(root, finalPdf)} (${second.total} pages, ${(size / 1024 / 1024).toFixed(1)} MB)`)
  console.log(Object.entries(second.map).map(([k, v]) => `${k}: p.${v}`).join('  '))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
