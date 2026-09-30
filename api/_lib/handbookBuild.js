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

const PHOTO_RE = /^(builtin:[a-z0-9-]{1,80}|store:authors\/[A-Za-z0-9._-]{1,160}|url:https:\/\/[^\s"'<>]{1,400})$/
const clip = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '')

/** Keeps only what the book understands from the saved front/back-matter text. Plain text: the layout escapes it. */
function cleanTexts(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = {}
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'finder' && Array.isArray(value)) out.finder = value.slice(0, 40).map((v) => clip(v, 200))
    else if (typeof value === 'string') out[key] = clip(value, 6000)
  }
  return out
}

function cleanAuthors(raw) {
  if (!raw || typeof raw !== 'object') return null
  const people = Array.isArray(raw.people)
    ? raw.people
        .slice(0, 14)
        .map((p) => ({ name: clip(p?.name, 120).trim(), role: clip(p?.role, 120).trim(), photo: PHOTO_RE.test(p?.photo ?? '') ? p.photo : '' }))
        .filter((p) => p.name)
    : []
  return { team: clip(raw.team, 80).trim(), session: clip(raw.session, 40).trim(), people }
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
        texts: cleanTexts(settingsRow.texts),
      }
    : null
  return { settings, chapters, authors: cleanAuthors(settingsRow?.authors) }
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

/* ------------------------------------------------------------------ author photos */

const PHOTO_SIZE = 360

function placeholderPhoto(name) {
  const initials = String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
  const safe = initials.replace(/[^A-Z0-9]/g, '') || '?'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PHOTO_SIZE}" height="${PHOTO_SIZE}"><rect width="100%" height="100%" fill="#0b2417"/><text x="50%" y="56%" font-family="sans-serif" font-size="140" font-weight="700" fill="#ff5a1f" text-anchor="middle">${safe}</text></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

/** Crops any uploaded picture to a face-friendly square and shrinks it, so the PDF stays small. */
export async function squarePhoto(bytes) {
  const { createCanvas, loadImage } = await import('@napi-rs/canvas')
  const image = await loadImage(bytes)
  const side = Math.min(image.width, image.height)
  const sx = (image.width - side) / 2
  const sy = image.height > image.width ? Math.min((image.height - side) * 0.15, image.height - side) : 0
  const canvas = createCanvas(PHOTO_SIZE, PHOTO_SIZE)
  canvas.getContext('2d').drawImage(image, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE)
  return `data:image/jpeg;base64,${canvas.toBuffer('image/jpeg', 82).toString('base64')}`
}

async function fetchPhotoBytes(photo, { supabase, env = process.env }) {
  if (photo.startsWith('store:')) {
    const { data, error } = await supabase.storage.from('handbook').download(photo.slice(6))
    if (error) throw error
    return Buffer.from(await data.arrayBuffer())
  }
  // Pictures already on the site (Meet the Excos): only our own public storage, nothing else on the internet.
  const url = new URL(photo.slice(4))
  const own = new URL(env.VITE_SUPABASE_URL)
  if (url.host !== own.host || !url.pathname.startsWith('/storage/v1/object/public/')) throw new Error('Photo address not allowed')
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Photo download failed (${response.status})`)
  return Buffer.from(await response.arrayBuffer())
}

/** Fills in each author's `img`. Bundled photos keep their file path; uploaded ones become inline data. */
export async function resolvePhotos(ctx, deps) {
  await Promise.all(
    ctx.people.map(async (person) => {
      if (String(person.photo).startsWith('builtin:') && person.img) return
      try {
        if (!person.photo) throw new Error('No photo')
        person.img = await squarePhoto(await fetchPhotoBytes(person.photo, deps))
      } catch (error) {
        console.error('handbook photo failed for', person.name, error?.message)
        person.img = placeholderPhoto(person.name)
      }
    }),
  )
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
  // pdf.js normally finds its worker file by path at run time, which the serverless bundler cannot see and leaves out.
  // Importing it here by name gets it bundled, and handing it over directly skips the path lookup.
  globalThis.pdfjsWorker ??= await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
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
export async function buildHandbookPdf({ overrides, launch = defaultLaunch, supabase }) {
  const [{ buildBookHtml, locate, norm }, { makeContext }] = await Promise.all([
    import('../../scripts/manual/book-lib.mjs'),
    import('../../scripts/manual/book-content.mjs'),
  ])
  const css = await fs.readFile(path.join(MANUAL, 'book.css'), 'utf8')
  const ctx = makeContext(overrides, css)
  await resolvePhotos(ctx, { supabase })
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
