import puppeteer from 'puppeteer-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Captures the public pages of the live site as raw PNGs.
//   node scripts/manual/capture-screens.mjs <out-folder>            public pages
//   node scripts/manual/capture-screens.mjs <out-folder> --admin    admin pages, after signing in
//   node scripts/manual/capture-screens.mjs --smoke                 check the admin sign-in and stop
// Needs: npm i --no-save puppeteer-core, and Edge installed. Feed the folder to prep-screens.mjs afterwards.
//
// The admin pass authenticates straight against Supabase and drops the session into localStorage. It cannot use
// the sign-in form: Login.jsx renders a Turnstile challenge, and the site key is configured in production, so a
// headless browser never receives a token and the password grant is refused with captcha_failed. The admin API is
// not captcha-protected, so one magic-link exchange mints a session instead. That sends a magic-link email to the
// account each time a fresh session is needed, which is harmless for a throwaway address but is why the session
// is cached rather than minted per page.
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const BASE = 'https://www.nammeshub.com.ng'

const args = process.argv.slice(2)
const smoke = args.includes('--smoke')
const admin = args.includes('--admin')
const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length)
const out = args.find((a) => !a.startsWith('--'))
const wanted = only ? new Set(only.split(',').map((s) => s.trim())) : null
const keep = (name) => !wanted || wanted.has(name)
if (!smoke && !out) {
  console.error('Usage: capture-screens.mjs <out-folder> [--admin]   |   --smoke')
  process.exit(1)
}

/** Parses a .env file. Strips quotes so a value like "abc def" survives. */
function parseEnv(text) {
  const parsed = {}
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    const v = m[2].trim()
    parsed[m[1]] = /^(['"]).*\1$/.test(v) ? v.slice(1, -1) : v
  }
  return parsed
}

/** `.env` then `.env.local` (which wins, as in Vite), except that real environment variables always win. */
async function loadEnv() {
  const merged = {}
  for (const file of ['.env', '.env.local']) {
    try {
      Object.assign(merged, parseEnv(await fs.readFile(path.join(root, file), 'utf8')))
    } catch {}
  }
  for (const [k, v] of Object.entries(merged)) if (process.env[k] === undefined) process.env[k] = v
}

/** supabase-js keeps the session under sb-<project ref>-auth-token, where the ref is the host's first label. */
const sessionKey = (supabaseUrl) => `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

const SESSION_FILE = path.join(here, 'out', 'admin-session.json')

/** Cached so a capture run mints one session rather than one per page. */
async function cachedSession() {
  try {
    const s = JSON.parse(await fs.readFile(SESSION_FILE, 'utf8'))
    if (s.expires_at - Math.floor(Date.now() / 1000) > 120) return s
  } catch {}
  return null
}

async function mintSession() {
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  const email = process.env.HANDBOOK_ADMIN_EMAIL
  if (!url || !anon) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing from .env')
  if (!service) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing from .env')
  if (!email) throw new Error('HANDBOOK_ADMIN_EMAIL is missing from .env.local')

  const post = (endpoint, key, body) =>
    fetch(`${url}/auth/v1/${endpoint}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })

  const link = await post('admin/generate_link', service, { type: 'magiclink', email })
  if (!link.ok) throw new Error(`generate_link failed (${link.status}): ${(await link.text()).slice(0, 200)}`)
  const { hashed_token } = await link.json()

  const ver = await post('verify', anon, { type: 'magiclink', token_hash: hashed_token })
  if (!ver.ok) throw new Error(`verify failed (${ver.status}): ${(await ver.text()).slice(0, 200)}`)
  const session = await ver.json()
  // supabase-js works out expires_at itself, so supply it rather than letting it read an expired session.
  session.expires_at = Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600)

  await fs.mkdir(path.dirname(SESSION_FILE), { recursive: true })
  await fs.writeFile(SESSION_FILE, JSON.stringify(session), 'utf8')
  return session
}

async function signIn(page) {
  const session = (await cachedSession()) ?? (await mintSession())
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: sessionKey(process.env.VITE_SUPABASE_URL), value: JSON.stringify(session) },
  )
  return session.user?.email ?? null
}

await loadEnv()
if (out) await fs.mkdir(path.resolve(root, out), { recursive: true })
const b = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--hide-scrollbars'],
})

async function open(mobile = false) {
  const p = await b.newPage()
  await p.setViewport(mobile ? { width: 400, height: 800, deviceScaleFactor: 2, isMobile: true } : { width: 1280, height: 860, deviceScaleFactor: 1.5 })
  await p.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('nammes-theme', 'light')
      localStorage.setItem('nammes-tour-seen', '1')
    } catch {}
  })
  return p
}

const save = (name) => `${out}/${name}.png`

async function shot(p, route, name, { full = false, wait = 2500, clip, height } = {}) {
  // A page whose banner pushes its actual content below the fold needs a taller window, or the shot is all banner.
  if (height) await p.setViewport({ width: 1280, height, deviceScaleFactor: 1.5 })
  await p.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
  await new Promise((r) => setTimeout(r, wait))
  await p.screenshot({ path: save(name, full), fullPage: full, ...(clip ? { clip } : {}) })
  if (height) await p.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1.5 })
  console.log('ok', name, p.url())
}

/** Screens that only exist in a particular state, so the capture has to click its way there first. */
async function shotAfterClick(p, route, name, clickTexts, { wait = 2500, settle = 1500 } = {}) {
  const labels = Array.isArray(clickTexts) ? clickTexts : [clickTexts]
  await p.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
  await new Promise((r) => setTimeout(r, wait))
  for (const label of labels) {
    const clicked = await p.evaluate((text) => {
      const nodes = [...document.querySelectorAll('button, a, [role="tab"]')]
      // Exact label first, so a loose fallback cannot hit the wrong control on a page with similar wording.
      const el =
        nodes.find((n) => (n.textContent ?? '').trim().toLowerCase() === text.toLowerCase()) ??
        nodes.find((n) => (n.textContent ?? '').toLowerCase().includes(text.toLowerCase()))
      if (!el) return false
      el.click()
      return true
    }, label)
    if (!clicked) {
      console.log('!! could not find', JSON.stringify(label), 'on', route)
      return
    }
    await new Promise((r) => setTimeout(r, settle))
  }
  await p.screenshot({ path: save(name) })
  console.log('ok', name, '(clicked', labels.join(' then ') + ')')
}

/**
 * The welcome tour is stored under the signed-in user's own id, so it cannot be seeded before the id is known and
 * it sits on top of every admin page. Clicking Skip once writes that key and it stays dismissed for the run.
 */
async function dismissTour(page) {
  const skipped = await page.evaluate(() => {
    const el = [...document.querySelectorAll('button, a')].find((n) => (n.textContent ?? '').trim() === 'Skip')
    if (!el) return false
    el.click()
    return true
  })
  if (skipped) await new Promise((r) => setTimeout(r, 1000))
  return skipped
}

// ------------------------------------------------------------------ public

const PUBLIC_PAGES = [
  ['/', 'home'],
  ['/about', 'about'],
  ['/excos', 'excos'],
  ['/calendar', 'calendar'],
  ['/outlines/100', 'outlines-level'],
  ['/outlines/100/1', 'outlines-courses'],
  ['/curriculum', 'curriculum'],
  ['/timetable/100', 'timetable-level'],
  ['/cgpa', 'cgpa'],
  ['/resources', 'resources'],
  ['/resources/100/1', 'resources-list'],
  ['/events', 'events'],
  ['/news', 'news'],
  ['/opportunities', 'opportunities'],
  ['/awards', 'awards'],
  ['/forms', 'forms'],
  ['/contact', 'contact'],
  ['/login', 'login'],
  ['/signup', 'signup'],
  ['/forgot-password', 'forgot'],
  ['/quiz', 'quiz-hub'],
  ['/practice', 'practice'],
  ['/cbt', 'cbt'],
  ['/cbt/make', 'cbt-make'],
  ['/make', 'make'],
  // A real route, not the review-only backstop: App.jsx renders the offline screen with a fixed status, so it can
  // be photographed here. Cutting the network with setOfflineMode instead gives Edge's own error page, not this one.
  ['/offline', 'offline'],
]

// Admin routes that hold no personal data. Deliberately absent, because the handbook is a public download:
//   /admin/users, /admin/messages, /admin/reviews, /admin/system, /admin/broadcasts  member emails, contact
//   messages, pending edits, server errors, recipient lists
//   /admin/submissions, /admin/forms/:id/responses                                  student names, matric numbers
const ADMIN_PAGES = [
  ['/admin', 'admin-dashboard'],
  ['/admin/home', 'admin-home'],
  ['/admin/links', 'admin-links'],
  ['/admin/banners', 'admin-banners'],
  ['/admin/news', 'admin-news'],
  ['/admin/opportunities', 'admin-opportunities'],
  ['/admin/events', 'admin-events'],
  ['/admin/resources', 'admin-resources'],
  ['/admin/excos', 'admin-excos'],
  ['/admin/handbook', 'admin-handbook'],
  ['/admin/outlines', 'admin-outlines'],
  ['/admin/timetables', 'admin-timetables'],
  ['/admin/calendar?tab=dates', 'admin-calendar-dates'],
  ['/admin/calendar?tab=paste', 'admin-calendar-paste'],
  ['/admin/calendar?tab=design', 'admin-calendar-design'],
  ['/admin/calendar?tab=session', 'admin-calendar-session'],
  ['/admin/forms', 'admin-forms'],
  ['/admin/quizzes', 'admin-quizzes'],
  ['/admin/quizzes/battles', 'admin-battles'],
  ['/admin/cbt', 'admin-cbt'],
  ['/admin/awards', 'admin-awards'],
  ['/admin/email-templates', 'admin-templates'],
  ['/admin/security', 'admin-security'],
]

// Pages whose page banner is tall enough to push the content the chapter is describing below the fold. Shot at the
// default height they come back as a picture of a green banner and nothing else.
const TALLER_VIEWPORT = new Set(['calendar', 'quiz-hub'])

try {
  const p = await open()

  if (smoke) {
    const who = await signIn(p)
    await p.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 60000 })
    const state = await p.evaluate(() => ({
      landedOn: location.pathname,
      mfaWall: !!document.querySelector('#mfa-code'),
      loginForm: !!document.querySelector('input[type="password"]'),
      heading: document.querySelector('h1')?.textContent?.trim() ?? null,
      tiles: document.querySelectorAll('a[href^="/admin/"]').length,
    }))
    console.log('signed in as', who)
    console.log(JSON.stringify(state, null, 2))
    if (state.mfaWall) console.log('FAIL: MFA is enrolled. Remove the authenticator from this account, then retry.')
    else if (state.loginForm) console.log('FAIL: bounced back to the sign-in form.')
    else if (state.landedOn !== '/admin') console.log('WARN: /admin redirected to', state.landedOn)
    else console.log('OK: admin area reachable,', state.tiles, 'admin links on the page.')
  } else if (admin) {
    await signIn(p)
    await p.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 60000 })
    console.log('tour dismissed:', await dismissTour(p))
    for (const [route, name] of ADMIN_PAGES) await shot(p, route, name)
    // These exist only behind a click: the editors and the studio tabs are not routable on their own.
    await shotAfterClick(p, '/admin/quizzes', 'admin-quiz-edit', 'Edit', { settle: 3000 })
    await shotAfterClick(p, '/admin/quizzes', 'admin-quiz-studio', 'Design', { settle: 3000 })
    await shotAfterClick(p, '/admin/quizzes', 'admin-card-tab', ['Design', 'Result card'], { settle: 3000 })
    await shotAfterClick(p, '/admin/forms', 'admin-form-editor', 'Edit', { settle: 3000 })
    await shotAfterClick(p, '/admin/cbt', 'admin-cbt-exam', 'CBT EXAM', { settle: 2500 })
  } else {
    for (const [route, name] of PUBLIC_PAGES) {
  if (!keep(name)) continue
  // A page whose banner pushes its actual content below the fold needs a taller window, or the shot is all banner.
  await shot(p, route, name, TALLER_VIEWPORT.has(name) ? { height: 1560 } : {})
}

    // The menu bar on its own, for the chapter that explains how the site is organised.
    if (keep('home-nav')) {
      await p.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
      await new Promise((r) => setTimeout(r, 2000))
      await p.screenshot({ path: save('home-nav'), clip: { x: 0, y: 0, width: 1280, height: 96 } })
      console.log('ok home-nav')
    }

    // Detail pages reached by following the first matching link.
    async function firstLink(route, prefix) {
      await p.goto(BASE + route, { waitUntil: 'networkidle2' }).catch(() => {})
      await new Promise((r) => setTimeout(r, 2000))
      return p.evaluate((pre) => [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')).find((h) => h && h.startsWith(pre) && h.length > pre.length), prefix)
    }
    for (const [list, pre, name] of [['/events', '/events/', 'event-detail'], ['/news', '/news/', 'news-detail'], ['/forms', '/forms/', 'form-detail']]) {
      const href = await firstLink(list, pre)
      console.log(name, href)
      if (href) await shot(p, href, name)
    }

    // Outline detail: click the first row.
    await p.goto(BASE + '/outlines/100/1', { waitUntil: 'networkidle2' }).catch(() => {})
    await new Promise((r) => setTimeout(r, 2000))
    const btn = await p.evaluateHandle(() => [...document.querySelectorAll('tbody tr button, tbody tr')].find(Boolean))
    if (btn.asElement()) {
      await btn.asElement().click()
      await new Promise((r) => setTimeout(r, 2500))
      await p.screenshot({ path: save('outline-detail') })
      console.log('ok outline-detail')
    }

    // A CBT exam start page needs a real code, and the codes live on the list page.
    const code = await firstLink('/cbt', '/cbt/')
    console.log('cbt start code', code)
    if (code) await shot(p, code, 'cbt-start')

    // The calendar has no view URL parameter, so the Agenda shot has to click its way there.
    await shotAfterClick(p, '/calendar', 'calendar-agenda', 'Agenda')

    // Phones.
    if (wanted && !keep('m-menu')) {
      console.log('nothing left to capture')
    } else {
      const m = await open(true)
      for (const [route, name] of [['/calendar', 'm-calendar'], ['/cbt', 'm-cbt']]) if (keep(name)) await shot(m, route, name)
      if (keep('m-menu')) {
        // Full page: the menu is five labelled cards and a half-height shot cuts off Support.
        await m.goto(BASE + '/', { waitUntil: 'networkidle2' }).catch(() => {})
        await m.click('button[aria-label="Toggle menu"]').catch(() => {})
        await new Promise((r) => setTimeout(r, 1200))
        await m.screenshot({ path: save('m-menu'), fullPage: true })
        console.log('ok m-menu')
      }
    }
  }
} catch (err) {
  console.error(err.message ?? err)
  process.exitCode = 1
} finally {
  await b.close()
}