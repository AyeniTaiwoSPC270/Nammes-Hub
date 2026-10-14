#!/usr/bin/env node
// Load test for the live quiz: many fake phones play one hosted game, so the server side can be tried without a room
// full of people. Each fake phone does what PlayQuiz does: joins with the code, asks /api/quiz?action=state on a timer,
// listens for the host's realtime nudge, and answers every question after a random think time.
//
// You host the game as usual (lobby open, join code on screen), start this, then press Start on the host screen.
//
//   node --env-file=.env scripts/loadtest-quiz.mjs --base http://localhost:3000 --code 123456 --players 100
//
// Options
//   --base URL        where the API lives: `vercel dev` (http://localhost:3000) or a preview deployment. Required.
//   --code 123456     the game's join code. Required.
//   --players N       how many phones (default 100; the game's own max_players still applies).
//   --poll MS         state polling interval per phone (default 4000, the same as PlayQuiz).
//   --join-window S   spread the joins over S seconds instead of all at once (default 0: a burst).
//   --no-realtime     skip the websocket part. Without VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY it is skipped anyway.
//   --spread-ips      send a different X-Forwarded-For per phone. Only a server that trusts that header honours it
//                     (Vercel replaces it with the real address), so leave it off to see what one shared wifi does.
//   --max-minutes M   stop after M minutes whatever the game is doing (default 30).
//   --allow-production  needed to aim at the live site, which this refuses by default.

const args = parseArgs(process.argv.slice(2))
const PROTECTED_HOSTS = ['nammeshub.com.ng', 'www.nammeshub.com.ng', 'nammes-hub.vercel.app']

const base = String(args.base ?? '').replace(/\/+$/, '')
const code = String(args.code ?? '')
const playerCount = Number(args.players ?? 100)
const pollMs = Number(args.poll ?? 4000)
const joinWindowMs = Number(args['join-window'] ?? 0) * 1000
const maxMinutes = Number(args['max-minutes'] ?? 30)
const spreadIps = Boolean(args['spread-ips'])
const supabaseUrl = args['supabase-url'] ?? process.env.VITE_SUPABASE_URL
const anonKey = args['anon-key'] ?? process.env.VITE_SUPABASE_ANON_KEY

let host = ''
try { host = new URL(base).hostname } catch { /* reported just below */ }
if (!host || !/^\d{6}$/.test(code) || !Number.isInteger(playerCount) || playerCount < 1 || !(pollMs > 0)) {
  console.error('Usage: node --env-file=.env scripts/loadtest-quiz.mjs --base http://localhost:3000 --code 123456 [--players 100]')
  process.exit(1)
}
// A load test fills the game tables with fake players and trips the per-IP join limit for everyone on this connection.
if (PROTECTED_HOSTS.includes(host) && !args['allow-production']) {
  console.error(`${host} is the live site. Aim this at a local server or a preview deployment, or pass --allow-production if you really mean it.`)
  process.exit(1)
}

// ---- What each kind of call took, and how it ended ----
const stats = {}
function record(name, ms, status) {
  const s = (stats[name] ??= { ms: [], status: {} })
  s.ms.push(ms)
  s.status[status] = (s.status[status] ?? 0) + 1
}
const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function call(action, body, ip) {
  const started = performance.now()
  let status = 'network-error'
  try {
    const res = await fetch(`${base}/api/quiz?action=${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(ip ? { 'x-forwarded-for': ip } : {}) },
      body: JSON.stringify(body),
    })
    status = res.status
    const data = await res.json().catch(() => ({}))
    return { status, data }
  } catch {
    return { status, data: {} }
  } finally {
    record(action, performance.now() - started, status)
  }
}

// ---- Realtime: one client per phone, so the server sees as many websockets as a real room would open ----
let makeClient = null
if (!args['no-realtime']) {
  if (!supabaseUrl || !anonKey) {
    console.warn('No VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY: running without the realtime connections.')
  } else {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      makeClient = () => createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    } catch (e) {
      console.warn(`Could not load supabase-js (${e.message}): running without the realtime connections.`)
    }
  }
}

const lastState = new Map() // phone index -> latest game state it saw, or 'gone' when the host removed it
const realtime = new Map() // phone index -> latest websocket status
const joinProblems = {}
let joined = 0
let stopping = false

async function join(i) {
  const nickname = `LT-${String(i + 1).padStart(3, '0')}`
  const ip = spreadIps ? `10.${(i >> 8) & 255}.${i & 255}.1` : null
  let avatarId = i % 50
  let teamId
  for (let attempt = 0; attempt < 8 && !stopping; attempt++) {
    const { status, data } = await call('join', { code, nickname, avatarId, ...(teamId ? { teamId } : {}) }, ip)
    if (status === 200) return data
    // Too many joins from one address: a phone would just try again a little later, so do the same.
    if (status === 429) { await sleep(5000 + Math.random() * 5000); continue }
    if (status === 409 && data.needsTeam) { teamId = 'auto'; continue }
    if (status === 400 && /character/i.test(data.error ?? '')) { avatarId = (avatarId + 1) % 50; continue }
    const reason = `${status} ${data.error ?? ''}`.trim()
    joinProblems[reason] = (joinProblems[reason] ?? 0) + 1
    return null
  }
  joinProblems['gave up after repeated rate limiting'] = (joinProblems['gave up after repeated rate limiting'] ?? 0) + 1
  return null
}

async function play(i) {
  await sleep(joinWindowMs ? Math.random() * joinWindowMs : 0)
  if (stopping) return
  const me = await join(i)
  if (!me) { lastState.set(i, 'gone'); return }
  joined++

  const answered = new Set() // question positions this phone has already answered
  let client = null

  const submit = async (q) => {
    if (stopping) return
    // Players answer the option they were shown, so index straight into what the state call sent.
    const open = q.options.map((_, n) => n).filter((n) => !(q.hidden ?? []).includes(n))
    const choice = q.type === 'numeric' ? { answerText: String(Math.floor(Math.random() * 10)) }
      : q.type === 'text' ? { answerText: 'test' }
      : { chosenIndex: open[Math.floor(Math.random() * open.length)] }
    await call('answer', { token: me.token, ...choice })
  }

  const refresh = async () => {
    if (stopping) return
    const { status, data } = await call('state', { token: me.token })
    if (status === 401 || status === 404) { lastState.set(i, 'gone'); return }
    if (status !== 200) return
    lastState.set(i, data.session.state)
    const q = data.question
    if (data.session.state !== 'question' || !q || q.answered || answered.has(data.session.index)) return
    answered.add(data.session.index)
    setTimeout(() => submit(q), q.timeLimitSeconds * 1000 * (0.1 + Math.random() * 0.6))
  }

  if (makeClient) {
    client = makeClient()
    // Same channel and filter as PlayQuiz; the host moving the game on wakes the phone, with a small random delay.
    client
      .channel(`play-${me.sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quiz_sessions', filter: `id=eq.${me.sessionId}` }, () => {
        setTimeout(refresh, Math.random() * 400)
      })
      .subscribe((s) => realtime.set(i, s))
  }

  await refresh()
  while (!stopping && !['finished', 'gone'].includes(lastState.get(i))) {
    await sleep(pollMs * (0.9 + Math.random() * 0.2))
    await refresh()
  }
  if (client) client.removeAllChannels()
}

// ---- Progress and the final report ----
const startedAt = Date.now()
const clock = () => {
  const s = Math.floor((Date.now() - startedAt) / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
const p95 = (name) => Math.round(percentile([...(stats[name]?.ms ?? [])].sort((a, b) => a - b), 0.95))
const countBy = (map) => {
  const out = {}
  for (const v of map.values()) out[v] = (out[v] ?? 0) + 1
  return Object.entries(out).map(([k, n]) => `${k}×${n}`).join(' ') || '-'
}

const ticker = setInterval(() => {
  const up = [...realtime.values()].filter((s) => s === 'SUBSCRIBED').length
  console.log(`[${clock()}] joined ${joined}/${playerCount} · ${countBy(lastState)} · realtime ${makeClient ? `${up} up` : 'off'} · p95 state ${p95('state')}ms answer ${p95('answer')}ms`)
}, 5000)

function report() {
  console.log('\n=== Results ===')
  for (const [name, s] of Object.entries(stats)) {
    const sorted = [...s.ms].sort((a, b) => a - b)
    const codes = Object.entries(s.status).map(([k, n]) => `${k}×${n}`).join(' ')
    console.log(`${name.padEnd(7)} ${String(sorted.length).padStart(6)} calls  p50 ${Math.round(percentile(sorted, 0.5))}ms  p95 ${Math.round(percentile(sorted, 0.95))}ms  max ${Math.round(sorted.at(-1))}ms  [${codes}]`)
  }
  if (makeClient) {
    const states = [...realtime.values()]
    console.log(`realtime: ${states.filter((s) => s === 'SUBSCRIBED').length} of ${realtime.size} connections were subscribed at the end; statuses ${countBy(realtime)}`)
  }
  console.log(`joined ${joined} of ${playerCount}`)
  for (const [reason, n] of Object.entries(joinProblems)) console.log(`  join problem: ${reason} ×${n}`)
  console.log('Anything other than 200 for state and answer, or a slow p95, is worth a look. 409 on answer after the timer is normal.')
}

process.on('SIGINT', () => { stopping = true })
setTimeout(() => { stopping = true }, maxMinutes * 60_000).unref()

console.log(`Starting ${playerCount} phones against ${base} for game ${code}. Press Start on the host screen once they have joined.`)
await Promise.all(Array.from({ length: playerCount }, (_, i) => play(i)))
clearInterval(ticker)
report()
// Websocket handles can keep the process alive after the game ends.
process.exit(0)

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const key = argv[i].slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[key] = true
    else { out[key] = next; i++ }
  }
  return out
}
