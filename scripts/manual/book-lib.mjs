// Assembles the NAMMES Hub Handbook as one HTML document. Pure string building: no file access, so the same code
// runs in the local build (build.mjs, Edge) and in the site's PDF builder (api/_lib/handlers/handbook-build.js).
import QRCode from 'qrcode'
import { SITE } from './helpers.mjs'
import { longSession } from './book-content.mjs'

const ENTITIES = { '&amp;': '&', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&quot;': '"' }



export const plain = (html) => html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, (m) => ENTITIES[m] ?? m).replace(/\s+/g, ' ').trim()
export const norm = (t) => t.normalize('NFKD').toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ')

const chapterLabel = (c) => (c.admin ? `Admin Guide · ${c.title}` : `${c.num} · ${c.title}`)

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** Plain text with **bold** and line breaks, made safe for the page. */
const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
const lines = (t) => inline(t).split(/\r?\n/).join('<br>')
const paragraphs = (t) => String(t ?? '').split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${lines(p)}</p>`).join('\n  ')
const bulletLines = (t) => String(t ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => `<li>${inline(l)}</li>`).join('')

/** The book title with "Hub" picked out in orange; `stack` puts the last word on its own line. */
function titleHtml(title, stack = false) {
  let t = esc(title).replace(/\bHub\b/, '<span>Hub</span>')
  if (stack) t = t.replace(/ (\S+)$/, '<br>$1')
  return t
}

/** {{team}}, {{session}} and friends, filled in wherever they appear in the book. */
function fillTokens(html, ctx) {
  const tokens = {
    team: esc(ctx.team),
    session: esc(ctx.session),
    session_long: esc(longSession(ctx.session)),
    title: esc(ctx.title),
    edition: ctx.edition,
    as_of: ctx.asOf,
    site: SITE.replace('https://', ''),
  }
  return html.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in tokens ? tokens[key] : m))
}

const faces = (ctx) => ctx.people.map((a) => `<img src="${a.img}" alt="">`).join('')

function frontCover(ctx) {
  const t = ctx.texts
  return `
<section class="cover front">
  <div class="rings"></div><div class="rings b"></div>
  <div class="band"></div>
  <div class="inner">
    <div class="eyebrow">${esc(t.cover_eyebrow)}</div>
    <div class="logo-disc"><img src="../../../public/logo.png" alt=""></div>
    <h1 class="title">${titleHtml(t.cover_title)}</h1>
    <p class="subtitle">${lines(t.cover_subtitle)}</p>
    <div class="below-band">
      <div class="credit-label">${esc(t.credit_label)}</div>
      <div class="credit">${esc(t.credit_council)} · {{team}} {{session}}</div>
      <div class="faces">${faces(ctx)}</div>
      <div class="foot"><span><b>${ctx.edition}</b></span><span>{{site}}</span></div>
    </div>
  </div>
</section>`
}

async function backCover(ctx) {
  const t = ctx.texts
  const qr = await QRCode.toDataURL(SITE, { margin: 0, width: 400, color: { dark: '#0b2417', light: '#ffffff' } })
  return `
<section class="cover back">
  <div class="rings"></div><div class="rings b"></div>
  <div class="band"></div>
  <div class="inner">
    <div class="eyebrow">${esc(t.back_eyebrow)}</div>
    <h2 style="margin-top:14mm">${lines(t.back_heading)}</h2>
    ${paragraphs(t.back_body)}
    <ul>${bulletLines(t.back_list)}</ul>
    <div class="scan">
      <div class="qr"><img src="${qr}" alt=""></div>
      <div class="scan-text"><b>{{site}}</b><span>${inline(t.back_scan)}</span></div>
    </div>
    <div class="fine"><span>${inline(t.back_fine)}</span><span>${ctx.edition}</span></div>
  </div>
</section>`
}

function insideCover(ctx) {
  return `
<section class="plain" style="page: plain">
  <div style="padding-top:78mm;text-align:center">
    <div style="width:14mm;height:.8mm;background:#ff5a1f;margin:0 auto 7mm"></div>
    <div style="font-family:'Playfair Display',serif;font-size:17pt;color:#0b2417;line-height:1.35;max-width:96mm;margin:0 auto">${lines(ctx.texts.dedication)}</div>
    <div style="width:14mm;height:.8mm;background:#ff5a1f;margin:7mm auto 0"></div>
  </div>
</section>`
}

function titlePage(ctx) {
  const t = ctx.texts
  return `
<section class="title-page" style="page: plain; break-before: page">
  <img class="logo" src="../../../public/logo.png" alt="">
  <h1>${titleHtml(t.cover_title, true)}</h1>
  <div class="rule"></div>
  <p class="sub">${lines(t.title_subtitle)}</p>
  <div class="by">${esc(t.credit_label)}</div>
  <div class="by-name">${esc(t.credit_council)}</div>
  <div class="by" style="margin-top:1mm">{{team}} {{session}}</div>
  <div class="byline">${ctx.people.map((a) => `<div><b>${esc(a.name)}</b><span>${esc(a.role)}</span></div>`).join('')}</div>
  <div class="pub">${lines(t.title_publisher)}</div>
</section>`
}

function copyrightPage(ctx) {
  return `
<section class="copyright" style="page: plain; break-before: page">
  <p><strong>${esc(ctx.title)}</strong><br>${ctx.edition}</p>
  ${paragraphs(ctx.texts.copyright_body)}
</section>`
}

function foreword(ctx) {
  return `
<section class="foreword" style="page: front">
  <h2 class="first">A Word Before You Begin</h2>
${ctx.forewordHtml}
</section>`
}

function tocPages(ctx, pageOf) {
  const rows = []
  let lastPart = ''
  for (const c of ctx.chapters) {
    if (c.part !== lastPart) {
      rows.push(`<div class="part">${c.part}</div>`)
      lastPart = c.part
    }
    const n = `<span class="n">${c.num}</span>`
    rows.push(`<div class="row ch">${n}<span>${c.title}</span><span class="dots"></span><span>${pageOf(c.id)}</span></div>`)
  }
  rows.push('<div class="part">Appendices</div>')
  for (const a of ctx.appendices) rows.push(`<div class="row ch"><span class="n">${a.letter}</span><span>${a.title}</span><span class="dots"></span><span>${pageOf(a.id)}</span></div>`)
  rows.push(`<div class="row ch"><span class="n">D</span><span>Meet the Authors</span><span class="dots"></span><span>${pageOf('authors')}</span></div>`)

  const finder = ctx.finder.map(([task, id]) => {
    const c = ctx.chapters.find((x) => x.id === id) ?? ctx.appendices.find((x) => x.id === id)
    const where = c.num ? `Chapter ${c.num}` : `Appendix ${c.letter}`
    return `<div class="row sec"><span>${esc(task)}</span><span class="dots"></span><span>${where} · p. ${pageOf(id)}</span></div>`
  })

  return `
<section class="toc" style="page: front; break-before: page">
  <h2 class="first">${esc(ctx.texts.toc_heading)}</h2>
  ${rows.join('')}
</section>
<section class="toc finder" style="page: front; break-before: page; position: relative">
  <span class="mark">§toc-end§</span>
  <h2 class="first">${esc(ctx.texts.finder_heading)}</h2>
  <p class="small" style="margin-bottom:3mm">${inline(ctx.texts.finder_intro)}</p>
  ${finder.join('')}
</section>`
}

function chapterHtml(c) {
  const listItems = c.inThis.map((i) => `<li>${i}</li>`).join('')
  const numBlock = `<div class="num">${String(c.num).padStart(2, '0')}</div>`
  return `
<section class="opener${c.admin ? ' admin' : ''}">
  <span class="mark">§open-${c.id}§</span>
  <div class="rings"></div>
  <div class="part-tag">${c.part}</div>
  ${numBlock}
  <div class="body">
    <h1>${c.title}</h1>
    <div class="bar"></div>
    <p class="intro">${c.intro}</p>
    <div class="inthis"><b>In this chapter</b><ul>${listItems}</ul></div>
  </div>
</section>
<section class="chapter" style="page: ch-${c.id}">
${c.html}
</section>`
}

function appendixHtml(a) {
  return `
<section class="chapter appendix" style="page: ap-${a.id}; break-before: page">
  <span class="mark">§open-${a.id}§</span>
  <div class="small" style="letter-spacing:.16em;text-transform:uppercase;color:#ae3200;font-weight:700;margin-bottom:1mm">Appendix ${a.letter}</div>
  <h2 class="first" style="font-size:22pt">${a.title}</h2>
  ${a.html.replace('<h2 class="first">', '<h2 class="first" style="border:0;font-size:13pt;margin-top:3mm">')}
</section>`
}

function authorsPage(ctx) {
  const cards = ctx.people.map((a) => `<div class="author"><img src="${a.img}" alt=""><div class="nm">${esc(a.name)}</div><div class="rl">${esc(a.role)}</div></div>`).join('')
  return `
<section class="chapter" style="page: ap-authors; break-before: page">
  <span class="mark">§open-authors§</span>
  <div class="small" style="letter-spacing:.16em;text-transform:uppercase;color:#ae3200;font-weight:700;margin-bottom:1mm">Appendix D</div>
  <h2 class="first" style="font-size:22pt">Meet the Authors</h2>
  ${paragraphs(ctx.texts.authors_intro)}
  <div class="authors">${cards}</div>
  <div style="margin-top:6mm">${paragraphs(ctx.texts.authors_thanks)}</div>
</section>`
}

function notesPage(title = 'Notes') {
  return `
<section class="chapter" style="page: ap-notes; break-before: page">
  <h2 class="first">${title}</h2>
  <p class="small">Space for your own reminders: passwords do <strong>not</strong> belong here.</p>
  <div class="notes-lines">${'<div></div>'.repeat(19)}</div>
</section>`
}

// Text placed inside a CSS string: no quotes, backslashes or line breaks.
const cssText = (t) => String(t).replace(/["\\\r\n]/g, ' ')

function pageCss(ctx) {
  const box = 'font-family:"Public Sans",sans-serif;font-size:7.2pt;letter-spacing:.14em;text-transform:uppercase;color:#424843;'
  const num = 'font-family:"Playfair Display",serif;font-size:10pt;color:#ae3200;'
  // Pages carry no horizontal margin any more (see the note on @page in book.css), so these boxes have to
  // inset themselves to sit level with the text block, which starts 22mm in and ends 16mm in.
  const one = (name, label) => `
@page ${name}:left { @top-left { content: "${cssText(ctx.title)}"; padding-left: 22mm; ${box} } @bottom-left { content: counter(page); padding-left: 22mm; ${num} } }
@page ${name}:right { @top-right { content: "${label.replace(/"/g, '')}"; padding-right: 16mm; ${box} } @bottom-right { content: counter(page); padding-right: 16mm; ${num} } }`
  const parts = [
    `@page plain { margin: 22mm 0 24mm 0; }`,
    one('front', 'Contents'),
  ]
  for (const c of ctx.chapters) parts.push(one(`ch-${c.id}`, chapterLabel(c)))
  for (const a of ctx.appendices) parts.push(one(`ap-${a.id}`, `Appendix ${a.letter} · ${a.title}`))
  parts.push(one('ap-authors', 'Appendix D · Meet the Authors'), one('ap-notes', 'Notes'))
  parts.push(`.plain, .title-page, .copyright { }`)
  return parts.join('\n')
}

export async function buildBookHtml(ctx, pageOf, { extraNotes = false } = {}) {
  const body = [
    frontCover(ctx),
    insideCover(ctx),
    titlePage(ctx),
    copyrightPage(ctx),
    foreword(ctx),
    tocPages(ctx, pageOf),
    ...ctx.chapters.map(chapterHtml),
    ...ctx.appendices.map(appendixHtml),
    authorsPage(ctx),
    notesPage(),
    extraNotes ? notesPage('More Notes') : '',
    await backCover(ctx),
  ].join('\n')
  const filled = fillTokens(body, ctx)
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(ctx.title)}</title>
<style>${ctx.css}
${pageCss(ctx)}</style></head><body>${filled}</body></html>`
}


/** Finds the page each chapter/appendix opens on, searching forward from the end of the contents pages. */
export function locate(ctx, texts) {
  const map = {}
  let cursor = texts.findIndex((t) => t.includes('§toc-end§')) + 1
  const ids = [...ctx.chapters.map((c) => c.id), ...ctx.appendices.map((a) => a.id), 'authors']
  for (const id of ids) {
    const needle = `§open-${id}§`
    let found = -1
    for (let i = cursor; i < texts.length; i++) {
      if (texts[i].includes(needle)) { found = i; break }
    }
    if (found === -1) throw new Error(`Could not find the "${id}" marker in the PDF text.`)
    map[id] = found + 1
    cursor = found
  }
  return { map, total: texts.length }
}

