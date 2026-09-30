// Builds the handbook PDF on the server from the book's default text plus the edits saved in Admin > Handbook.
// Same layout pipeline as scripts/manual/build.mjs (two passes, so the contents page carries real page numbers),
// but rendered by a headless Chromium that fits in a serverless function.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const MANUAL = path.resolve(here, '../../scripts/manual')
const FONTS = path.join(here, 'fonts')
const LOGO = path.resolve(here, '../../public/logo.png')

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf' }

/* ------------------------------------------------------------------ text safety */

export function escapeText(value) {
  return String(value ?? '').replace(/&(?!(?:[a-z]+|#\d+);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Admin-written HTML is rendered by a server-side browser, so strip anything that can run code or fetch things.
 * The renderer also has JavaScript off and blocks every network request; this is the first of those layers.
 */
export function sanitizeHtml(html) {
  return String(html ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|link|meta|base|form|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|template|noscript)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src|xlink:href|action|formaction)\s*=\s*("\s*(?:javascript|vbscript|data:text)[^"]*"|'\s*(?:javascript|vbscript|data:text)[^']*')/gi, '')
    .replace(/\scontenteditable(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/gi, '')
}

/** Turns rows from handbook_settings / handbook_chapters into the `overrides` shape book-content.mjs expects, made safe. */
export function overridesFromRows(settingsRow, chapterRows) {
  const chapters = {}
  for (const row of chapterRows ?? []) {
    chapters[row.id] = {
      title: row.title ? escapeText(row.title) : '',
      intro: row.intro ? escapeText(row.intro) : '',
      html: row.html ? sanitizeHtml(row.html) : '',
    }
  }
  const settings = settingsRow
    ? {
        edition: escapeText(settingsRow.edition ?? ''),
        as_of: escapeText(settingsRow.as_of ?? ''),
        foreword_html: settingsRow.foreword_html ? sanitizeHtml(settingsRow.foreword_html) : '',
      }
    : null
  return { settings, chapters }
}

/* ------------------------------------------------------------------ assets */

const fileCache = new Map()
async function dataUri(file) {
  if (!fileCache.has(file)) {
    const bytes = await fs.readFile(file)
    fileCache.set(file, `data:${MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'};base64,${bytes.toString('base64')}`)
  }
  return fileCache.get(file)
}

async function replaceAsync(text, regex, fn) {
  const jobs = []
  text.replace(regex, (...args) => {
    jobs.push(fn(...args))
    return ''
  })
  const values = await Promise.all(jobs)
  let i = 0
  return text.replace(regex, () => values[i++])
}

/** Swaps the book's relative image and font paths for inline data, so the page needs no network and no files. */
export async function inlineAssets(html) {
  let out = await replaceAsync(html, /(\.\.\/(?:screens|authors)\/[A-Za-z0-9._-]+)/g, (m) => {
    const rel = m.slice(3)
    if (rel.includes('..')) return m
    return dataUri(path.join(MANUAL, rel))
  })
  out = await replaceAsync(out, /\.\.\/\.\.\/\.\.\/public\/logo\.png/g, () => dataUri(LOGO))
  out = await replaceAsync(out, /\.\.\/\.\.\/api\/_lib\/fonts\/([A-Za-z0-9._-]+)/g, (_m, name) => dataUri(path.join(FONTS, name)))
  return out
}

/* ------------------------------------------------------------------ rendering */

async function defaultLaunch() {
  const { default: puppeteer } = await import('puppeteer-core')
  const localBrowser = process.env.HANDBOOK_CHROME_PATH
  if (localBrowser) {
    return puppeteer.launch({ executablePath: localBrowser, headless: true, args: ['--no-sandbox'] })
  }
  const { default: chromium } = await import('@sparticuz/chromium')
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: 'shell',
  })
}

/** Prints one HTML string to a PDF buffer. JavaScript is off and every network request is refused. */
export async function renderPdf(browser, html) {
  const page = await browser.newPage()
  try {
    await page.setJavaScriptEnabled(false)
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      const url = request.url()
      if (url.startsWith('data:') || url === 'about:blank') request.continue()
      else request.abort()
    })
    await page.setContent(html, { waitUntil: 'load', timeout: 120000 })
    await page.evaluateHandle('document.fonts.ready')
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, timeout: 240000 })
    return Buffer.from(pdf)
  } finally {
    await page.close().catch(() => {})
  }
}

/** Reads the text of every page, so the builder can see which page each chapter opens on. */
export async function pdfPageTexts(buffer, norm) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: false, verbosity: 0 })
  const doc = await task.promise
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push(norm(content.items.map((item) => item.str).join(' ')))
    page.cleanup()
  }
  await task.destroy()
  return pages
}

/**
 * Full build: pass 1 measures where each chapter lands, pass 2 prints the contents with real page numbers
 * (and an extra notes page if the total is odd, so the back cover falls on an even page), pass 3 only if numbers moved.
 * Returns { pdf, pages }.
 */
export async function buildHandbookPdf({ overrides, launch = defaultLaunch }) {
  const [{ buildBookHtml, locate, norm }, { makeContext }] = await Promise.all([
    import('../../scripts/manual/book-lib.mjs'),
    import('../../scripts/manual/book-content.mjs'),
  ])
  const css = await fs.readFile(path.join(MANUAL, 'book.css'), 'utf8')
  const ctx = makeContext(overrides, css)
  const render = async (browser, pageOf, opts) => renderPdf(browser, await inlineAssets(await buildBookHtml(ctx, pageOf, opts)))

  const browser = await launch()
  try {
    let pdf = await render(browser, () => '00')
    let located = locate(ctx, await pdfPageTexts(pdf, norm))
    const extraNotes = located.total % 2 === 1

    pdf = await render(browser, (id) => String(located.map[id] ?? 0), { extraNotes })
    const second = locate(ctx, await pdfPageTexts(pdf, norm))
    const moved = Object.keys(located.map).some((id) => located.map[id] !== second.map[id])
    if (moved) pdf = await render(browser, (id) => String(second.map[id]), { extraNotes })

    return { pdf, pages: second.total }
  } finally {
    await browser.close().catch(() => {})
  }
}
