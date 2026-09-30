import puppeteer from 'puppeteer-core'
// Captures the public pages of the live site as raw PNGs. Usage: node scripts/manual/capture-screens.mjs <out-folder>
// Needs: npm i --no-save puppeteer-core, and Edge installed. Feed the folder to prep-screens.mjs afterwards.
const out = process.argv[2]
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--hide-scrollbars'] })
const BASE = 'https://www.nammeshub.com.ng'
async function open(mobile = false) {
  const p = await b.newPage()
  await p.setViewport(mobile ? { width: 400, height: 800, deviceScaleFactor: 2, isMobile: true } : { width: 1280, height: 860, deviceScaleFactor: 1.5 })
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('nammes-theme', 'light'); localStorage.setItem('nammes-tour-seen','1') } catch {} })
  return p
}
async function shot(p, path, name, { full = false, wait = 2500, clip } = {}) {
  await p.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
  await new Promise((r) => setTimeout(r, wait))
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: full, ...(clip ? { clip } : {}) })
  console.log('ok', name, p.url())
}
const p = await open()
const pages = [['/', 'home'], ['/about', 'about'], ['/excos', 'excos'], ['/outlines', 'outlines'], ['/outlines/100', 'outlines-level'], ['/outlines/100/1', 'outlines-courses'], ['/curriculum', 'curriculum'], ['/timetable', 'timetable'], ['/timetable/100', 'timetable-level'], ['/cgpa', 'cgpa'], ['/resources', 'resources'], ['/resources/100', 'resources-level'], ['/resources/100/1', 'resources-list'], ['/events', 'events'], ['/news', 'news'], ['/opportunities', 'opportunities'], ['/awards', 'awards'], ['/forms', 'forms'], ['/contact', 'contact'], ['/login', 'login'], ['/signup', 'signup'], ['/forgot-password', 'forgot']]
for (const [path, name] of pages) await shot(p, path, name)
// detail pages via first link
async function firstLink(path, prefix) {
  await p.goto(BASE + path, { waitUntil: 'networkidle2' }).catch(() => {})
  await new Promise((r) => setTimeout(r, 2000))
  return p.evaluate((pre) => [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')).find((h) => h && h.startsWith(pre) && h.length > pre.length), prefix)
}
for (const [list, pre, name] of [['/events', '/events/', 'event-detail'], ['/news', '/news/', 'news-detail'], ['/forms', '/forms/', 'form-detail']]) {
  const href = await firstLink(list, pre)
  console.log(name, href)
  if (href) await shot(p, href, name)
}
// outline detail: click first row button
await p.goto(BASE + '/outlines/100/1', { waitUntil: 'networkidle2' }).catch(() => {})
await new Promise((r) => setTimeout(r, 2000))
const btn = await p.evaluateHandle(() => [...document.querySelectorAll('tbody tr button, tbody tr')].find(Boolean))
if (btn.asElement()) { await btn.asElement().click(); await new Promise((r) => setTimeout(r, 2500)); await p.screenshot({ path: `${out}/outline-detail.png` }); console.log('outline-detail', p.url()) }
// mobile
const m = await open(true)
for (const [path, name] of [['/', 'm-home'], ['/outlines', 'm-outlines']]) await shot(m, path, name)
await m.goto(BASE + '/', { waitUntil: 'networkidle2' }).catch(() => {})
await m.click('button[aria-label="Toggle menu"]').catch(() => {})
await new Promise((r) => setTimeout(r, 800))
await m.screenshot({ path: `${out}/m-menu.png` })
await b.close()
