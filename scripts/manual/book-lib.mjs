// Assembles the NAMMES Hub Handbook as one HTML document. Pure string building: no file access, so the same code
// runs in the local build (build.mjs, Edge) and in the site's PDF builder (api/_lib/handlers/handbook-build.js).
import QRCode from 'qrcode'
import { AUTHORS } from './data/authors.mjs'
import { SITE } from './helpers.mjs'

const ENTITIES = { '&amp;': '&', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&quot;': '"' }


export const FIND = [
  ['I want to create an account', 'quickstart'],
  ['I forgot my password', 'account'],
  ['I want to know what a course covers', 'outlines'],
  ['I need my class or exam timetable', 'timetable'],
  ['I want to work out my CGPA', 'cgpa'],
  ['I am looking for past questions or notes', 'outlines'],
  ['I am looking for slides and shared folders', 'resources'],
  ['I want to see photos from an event', 'events'],
  ['I want to find a scholarship or internship', 'opportunities'],
  ['I want to vote in the awards', 'awards'],
  ['I need to register for something', 'forms'],
  ['I want to reach an executive', 'association'],
  ['I want to publish news or an event', 'admin-content'],
  ['I want to build a registration form', 'admin-forms'],
  ['I want to run the awards', 'admin-awards'],
  ['I want to email every member', 'admin-comms'],
  ['I want to make someone an admin', 'admin-people'],
  ['Something has gone wrong', 'faq'],
]

export const plain = (html) => html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, (m) => ENTITIES[m] ?? m).replace(/\s+/g, ' ').trim()
export const norm = (t) => t.normalize('NFKD').toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ')

const authorImg = (a) => `../authors/${a.slug}.jpg`
const chapterLabel = (c) => (c.admin ? `Admin Guide · ${c.title}` : `${c.num} · ${c.title}`)

function frontCover(ctx) {
  return `
<section class="cover front">
  <div class="rings"></div><div class="rings b"></div>
  <div class="band"></div>
  <div class="inner">
    <div class="eyebrow">NAMMES · University of Lagos Chapter</div>
    <div class="logo-disc"><img src="../../../public/logo.png" alt=""></div>
    <h1 class="title">The NAMMES <span>Hub</span> Handbook</h1>
    <p class="subtitle">A beginner's complete guide to every page, tool and feature, with a full guide for admins.</p>
    <div class="below-band">
      <div class="credit-label">Written by</div>
      <div class="credit">The Executive Council · The Aegis 26/27</div>
      <div class="faces">${AUTHORS.map((a) => `<img src="${authorImg(a)}" alt="">`).join('')}</div>
      <div class="foot"><span><b>${ctx.edition}</b></span><span>${SITE.replace('https://', '')}</span></div>
    </div>
  </div>
</section>`
}

async function backCover(ctx) {
  const qr = await QRCode.toDataURL(SITE, { margin: 0, width: 400, color: { dark: '#0b2417', light: '#ffffff' } })
  const inside = ['Every page of the Hub, explained', 'Sign-up, sign-in and your account', 'Outlines, timetable and CGPA', 'Events, news and opportunities', 'Awards and forms, step by step', 'A complete guide for admins']
  return `
<section class="cover back">
  <div class="rings"></div><div class="rings b"></div>
  <div class="band"></div>
  <div class="inner">
    <div class="eyebrow">The NAMMES Hub Handbook</div>
    <h2 style="margin-top:14mm">Everything NAMMES Hub has to offer, in one book.</h2>
    <p>NAMMES Hub is the home of the National Association of Metallurgical and Materials Engineering Students, University of Lagos Chapter: your outlines, timetable, CGPA calculator, resources, events, news, opportunities, awards and forms, all in one place.</p>
    <p>This handbook walks a complete beginner through every page and shows the executives how to run it.</p>
    <ul>${inside.map((i) => `<li>${i}</li>`).join('')}</ul>
    <div class="scan">
      <div class="qr"><img src="${qr}" alt=""></div>
      <div class="scan-text"><b>${SITE.replace('https://', '')}</b><span>Scan to open NAMMES Hub on your phone.</span></div>
    </div>
    <div class="fine"><span>National Association of Metallurgical and Materials Engineering Students · UNILAG Chapter</span><span>${ctx.edition}</span></div>
  </div>
</section>`
}

function insideCover() {
  return `
<section class="plain" style="page: plain">
  <div style="padding-top:78mm;text-align:center">
    <div style="width:14mm;height:.8mm;background:#ff5a1f;margin:0 auto 7mm"></div>
    <div style="font-family:'Playfair Display',serif;font-size:17pt;color:#0b2417;line-height:1.35;max-width:96mm;margin:0 auto">For every student of Materials and Metallurgical Engineering: past, present and yet to come.</div>
    <div style="width:14mm;height:.8mm;background:#ff5a1f;margin:7mm auto 0"></div>
  </div>
</section>`
}

function titlePage() {
  return `
<section class="title-page" style="page: plain; break-before: page">
  <img class="logo" src="../../../public/logo.png" alt="">
  <h1>The NAMMES <span>Hub</span><br>Handbook</h1>
  <div class="rule"></div>
  <p class="sub">A beginner's complete guide to every page, tool and feature of NAMMES Hub, with a full guide for admins.</p>
  <div class="by">Written by</div>
  <div class="by-name">The Executive Council</div>
  <div class="by" style="margin-top:1mm">The Aegis 26/27</div>
  <div class="byline">${AUTHORS.map((a) => `<div><b>${a.name}</b><span>${a.role}</span></div>`).join('')}</div>
  <div class="pub">National Association of Metallurgical and Materials Engineering Students<br>University of Lagos Chapter</div>
</section>`
}

function copyrightPage(ctx) {
  return `
<section class="copyright" style="page: plain; break-before: page">
  <p><strong>${ctx.title}</strong><br>${ctx.edition}</p>
  <p>Published by the National Association of Metallurgical and Materials Engineering Students (NAMMES), University of Lagos Chapter, as a free companion to ${SITE.replace('https://', '')}.</p>
  <p>&copy; 2026 NAMMES Hub. All rights reserved. You are welcome to download, print and share this handbook with fellow students, provided it is shared whole and free of charge.</p>
  <p>This handbook describes NAMMES Hub as it stood on <strong>${ctx.asOf}</strong>. The Hub is updated continually by the executives, so screens, wording and features may change, and pages shown empty here may since have been filled. The latest edition can always be downloaded from the footer of the Hub.</p>
  <p>Screenshots were taken from the live public website. Course, event and form names shown are examples of the content published at that time.</p>
  <p>Set in Playfair Display and Public Sans.</p>
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

  const finder = FIND.map(([task, id]) => {
    const c = ctx.chapters.find((x) => x.id === id) ?? ctx.appendices.find((x) => x.id === id)
    const where = c.num ? `Chapter ${c.num}` : `Appendix ${c.letter}`
    return `<div class="row sec"><span>${task}</span><span class="dots"></span><span>${where} · p. ${pageOf(id)}</span></div>`
  })

  return `
<section class="toc" style="page: front; break-before: page">
  <h2 class="first">Contents</h2>
  ${rows.join('')}
</section>
<section class="toc finder" style="page: front; break-before: page">
  <h2 class="first">Where Do I Find…?</h2>
  <p class="small" style="margin-bottom:3mm">Not sure which chapter you need? Start from what you want to do.</p>
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

function authorsPage() {
  const cards = AUTHORS.map((a) => `<div class="author"><img src="${authorImg(a)}" alt=""><div class="nm">${a.name}</div><div class="rl">${a.role}</div></div>`).join('')
  return `
<section class="chapter" style="page: ap-authors; break-before: page">
  <span class="mark">§open-authors§</span>
  <div class="small" style="letter-spacing:.16em;text-transform:uppercase;color:#ae3200;font-weight:700;margin-bottom:1mm">Appendix D</div>
  <h2 class="first" style="font-size:22pt">Meet the Authors</h2>
  <p>This handbook was written by the Executive Council of NAMMES, University of Lagos Chapter: <strong>The Aegis 26/27</strong>. Between them they lead the association for the 2026/2027 session and look after the Hub you have just learned to use.</p>
  <div class="authors">${cards}</div>
  <p style="margin-top:6mm">With thanks to every member who uses, tests and improves NAMMES Hub. Your questions shaped this book. If something is unclear, reach any of us through the Contact page of the Hub.</p>
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

function pageCss(ctx) {
  const box = 'font-family:"Public Sans",sans-serif;font-size:7.2pt;letter-spacing:.14em;text-transform:uppercase;color:#424843;'
  const num = 'font-family:"Playfair Display",serif;font-size:10pt;color:#ae3200;'
  const one = (name, label) => `
@page ${name}:left { @top-left { content: "${ctx.title}"; ${box} } @bottom-left { content: counter(page); ${num} } }
@page ${name}:right { @top-right { content: "${label.replace(/"/g, '')}"; ${box} } @bottom-right { content: counter(page); ${num} } }`
  const parts = [
    `@page plain { margin: 22mm 16mm 24mm 22mm; }`,
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
    insideCover(),
    titlePage(),
    copyrightPage(ctx),
    foreword(ctx),
    tocPages(ctx, pageOf),
    ...ctx.chapters.map(chapterHtml),
    ...ctx.appendices.map(appendixHtml),
    authorsPage(),
    notesPage(),
    extraNotes ? notesPage('More Notes') : '',
    await backCover(ctx),
  ].join('\n')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${ctx.title}</title>
<style>${ctx.css}
${pageCss(ctx)}</style></head><body>${body}</body></html>`
}


/** Finds the page each chapter/appendix opens on, searching forward from the end of the contents pages. */
export function locate(ctx, texts) {
  const map = {}
  let cursor = texts.findIndex((t) => t.includes('where do i find')) + 1
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

