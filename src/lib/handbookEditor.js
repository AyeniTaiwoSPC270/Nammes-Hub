// Helpers for the handbook editor (Admin > Handbook). The book's own stylesheet drives the editing view, so what an
// admin sees while typing looks like the printed page.
import bookCss from '../../scripts/manual/book.css?raw'
import { tip, note, warn, adminBox } from '../../scripts/manual/helpers.mjs'

// Screenshots used in the book, keyed by file name. Vite gives each one a real URL for the editing view.
const screenshots = import.meta.glob('../../scripts/manual/screens/*.jpg', { eager: true, query: '?url', import: 'default' })
const SCREEN_URLS = Object.fromEntries(Object.entries(screenshots).map(([file, url]) => [file.split('/').pop(), url]))

export const CALLOUTS = {
  tip: () => tip('<p>Write your tip here.</p>'),
  note: () => note('<p>Write the note here.</p>'),
  warn: () => warn('<p>Write the warning here.</p>'),
  admin: () => adminBox('<p>Write the admin-only advice here.</p>'),
}

/** The book's images point at ../screens/name.jpg; the editing view needs URLs the browser can load. */
export function toEditorHtml(html) {
  return String(html ?? '').replace(/\.\.\/screens\/([A-Za-z0-9._-]+)/g, (match, name) => SCREEN_URLS[name] ?? match)
}

/** Reverses toEditorHtml and removes everything the editing view added, so only book markup is saved. */
export function fromEditorHtml(html) {
  let out = String(html ?? '')
  for (const [name, url] of Object.entries(SCREEN_URLS)) out = out.split(url).join(`../screens/${name}`)
  return out
    .replace(/\scontenteditable="(?:true|false|plaintext-only)"/g, '')
    .replace(/\sspellcheck="[^"]*"/g, '')
    .trim()
}

// The book's @font-face rules point at files the site does not serve; the two fonts come from Google Fonts instead.
const screenCss = bookCss.replace(/@font-face\s*\{[^}]*\}/g, '')

const EDITOR_CSS = `
html { background: #e8ebe6; }
body { margin: 0; padding: 18px 12px; font-family: 'Public Sans', sans-serif; }
#page { max-width: 170mm; margin: 0 auto; background: #fff; padding: 12mm 19mm; box-sizing: border-box; min-height: 60vh; box-shadow: 0 1px 8px rgba(11,36,23,.15); }
#ed { outline: none; }
#ed:focus-visible { outline: none; }
figure[contenteditable="false"] { cursor: default; user-select: none; }
figure[contenteditable="false"]::after { content: 'Screenshot: fixed'; display: block; margin-top: 2mm; font-size: 7pt; letter-spacing: .1em; text-transform: uppercase; color: #ae3200; }
::selection { background: rgba(255, 90, 31, .28); }
`

/** The full page shown in the editing frame. `bodyClass` is the book section the text normally lives in. */
export function frameDocument(bodyHtml, bodyClass = 'chapter') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Public+Sans:ital,wght@0,400;0,700;1,400&display=swap">
<style>${screenCss}\n${EDITOR_CSS}</style></head>
<body><div id="page"><section id="ed" class="${bodyClass}" contenteditable="true" spellcheck="true">${toEditorHtml(bodyHtml)}</section></div></body></html>`
}

/** Makes screenshots read-only while keeping their captions editable. Run once the frame has loaded. */
export function lockFigures(doc) {
  doc.querySelectorAll('#ed figure').forEach((figure) => {
    figure.setAttribute('contenteditable', 'false')
    figure.querySelector('figcaption')?.setAttribute('contenteditable', 'true')
  })
}

/** Turns book text (which may hold entities like &rsquo;) into what a plain input should show, and back. */
export function htmlToText(html) {
  const el = document.createElement('div')
  el.innerHTML = String(html ?? '')
  return el.textContent
}
export function textToHtml(text) {
  return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
