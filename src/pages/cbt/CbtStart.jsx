import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { callQuiz } from '../../data/quiz'
import { mySetByCode, forgetMySet, saveMySet } from '../customSets'
import { callCbt, saveActive, loadActive, clearActive, historyFor, formatDuration, LEVEL_LABEL } from '../../data/cbt'
import CbtShell from '../../components/cbt/CbtShell'

// /cbt/:code: one exam's start page. Shows what to expect, any attempts already made on this device, and the way in.

function Fact({ label, value }) {
  return (
    <div className="flex flex-col rounded-xl border border-hairline bg-surface px-4 py-3">
      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">{label}</dt>
      <dd className="text-xl font-bold text-ink-900">{value}</dd>
    </div>
  )
}

// For the person who made a personal exam: its share link, keep it longer, or delete it.
function OwnerPanel({ code, mine, expiresAt, onExtended }) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const link = `${window.location.origin}/cbt/${code}`

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: mine.title, url: link })
        return
      }
    } catch {
      // cancelled: fall through to copying
    }
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // the link is shown to copy by hand
    }
  }
  async function extend(days) {
    setBusy(true)
    setError('')
    try {
      const data = await callQuiz('sets', { op: 'extend', code, manageToken: mine.manageToken, days })
      saveMySet({ ...mine, expiresAt: data.expiresAt })
      onExtended(data.expiresAt)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    setBusy(true)
    try {
      await callQuiz('sets', { op: 'remove', code, manageToken: mine.manageToken })
    } catch {
      // already gone: forgetting it here is still right
    }
    forgetMySet(code)
    navigate('/cbt', { replace: true })
  }

  return (
    <section aria-label="Your exam" className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-5">
      <h2 className="text-lg font-bold">You made this exam</h2>
      <p className="text-ink-muted">Share the code or link so friends can take it too. Kept until {new Date(expiresAt).toLocaleDateString()}.</p>
      <p className="text-4xl font-bold tracking-[0.25em]" aria-label={`Exam code ${code.split('').join(' ')}`}>{code}</p>
      <p className="break-all text-sm text-ink-muted">{link}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={share} className="min-h-11 rounded-xl bg-orange-500 px-5 font-bold text-white">{copied ? 'Link copied!' : 'Share this exam'}</button>
        <span className="text-ink-muted">Keep it longer:</span>
        {[90, 180].map((d) => (
          <button key={d} type="button" disabled={busy} onClick={() => extend(d)} className="min-h-11 rounded-full border border-hairline px-4 font-bold disabled:opacity-60">{d} days</button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      {asking ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span>Delete this exam for good?</span>
          <button type="button" disabled={busy} onClick={remove} className="min-h-11 rounded-full bg-red-600 px-4 font-bold text-white">Yes, delete</button>
          <button type="button" onClick={() => setAsking(false)} className="min-h-11 rounded-full border border-hairline px-4 font-bold">Keep it</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className="self-start text-sm font-semibold text-ink-muted underline">Delete this exam</button>
      )}
    </section>
  )
}

export default function CbtStart() {
  const { code: rawCode } = useParams()
  const code = String(rawCode ?? '').toUpperCase()
  const navigate = useNavigate()
  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState('')
  const [startError, setStartError] = useState('')
  const [active, setActive] = useState(() => {
    const entry = loadActive(code)
    return entry && !entry.done ? entry : null
  })
  const past = historyFor(code)

  useEffect(() => {
    let cancelled = false
    callCbt('info', { code })
      .then((data) => !cancelled && setInfo(data))
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [code])

  async function begin(mode) {
    setStarting(mode)
    setStartError('')
    try {
      const data = await callCbt('start', { code, mode })
      saveActive(code, { token: data.token, mode })
      navigate(`/cbt/${code}/exam`, { state: { token: data.token, view: data } })
    } catch (e) {
      setStartError(e.message)
      setStarting('')
    }
  }

  if (error) {
    return (
      <CbtShell>
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <span className="material-symbols-outlined text-5xl text-ink-muted" aria-hidden="true">search_off</span>
          <h1 className="text-2xl font-bold">Exam not found</h1>
          <p className="max-w-md text-ink-muted">{error}</p>
          <Link to="/cbt" className="flex min-h-12 items-center rounded-xl bg-orange-500 px-6 font-bold text-white no-underline">See all exams</Link>
        </div>
      </CbtShell>
    )
  }
  if (!info) {
    return (
      <CbtShell>
        <p className="mt-16 text-center text-xl text-ink-muted">Loading…</p>
      </CbtShell>
    )
  }

  const personal = info.kind === 'personal'
  const mine = personal ? mySetByCode(code) : null
  return (
    <CbtShell title={info.course?.code}>
      <Link to="/cbt" className="text-sm font-semibold text-orange-600">← All exams</Link>
      <div className="flex flex-col gap-1">
        {info.course && <p className="text-sm font-bold uppercase tracking-[0.12em] text-ink-muted">{info.course.code} · {LEVEL_LABEL[info.course.level]}</p>}
        {personal && <p className="text-sm font-bold uppercase tracking-[0.12em] text-ink-muted">Made by a student</p>}
        <h1 className="text-3xl font-bold text-ink-900">{info.title}</h1>
        {info.course && <p className="text-ink-muted">{info.course.title}{info.session ? ` · ${info.session}` : ''}</p>}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="Questions" value={info.questionsPerAttempt} />
        <Fact label="Time" value={`${info.durationMinutes} min`} />
        <Fact label="Pass mark" value={`${info.passMarkPercent}%`} />
        <Fact label="Question bank" value={info.bankSize} />
      </dl>

      {mine && <OwnerPanel code={code} mine={mine} expiresAt={info.expiresAt} onExtended={(expiresAt) => setInfo((i) => ({ ...i, expiresAt }))} />}

      <section aria-label="How it works" className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-2 text-lg font-bold">How it works</h2>
        <ul className="list-disc space-y-1 pl-5 text-ink-900">
          <li>The clock starts when you press Start and keeps running if you close the page.</li>
          <li>Answers are shown only after you submit. You can skip, flag and come back to any question.</li>
          {info.bankSize > info.questionsPerAttempt && <li>Each attempt draws {info.questionsPerAttempt} questions at random from {info.bankSize}, so a retake is different.</li>}
          <li>Your score is saved on this device only. There are no accounts and no rankings.</li>
          {personal && info.expiresAt && <li>This exam is deleted on {new Date(info.expiresAt).toLocaleDateString()}.</li>}
        </ul>
      </section>

      {active && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-orange-500 bg-orange-500/10 p-5">
          <p className="font-bold">You have an exam in progress on this device.</p>
          <div className="flex flex-wrap gap-3">
            <Link to={`/cbt/${code}/exam`} className="flex min-h-12 items-center rounded-xl bg-orange-500 px-6 font-bold text-white no-underline">Continue exam</Link>
            <button type="button" onClick={() => { clearActive(code); setActive(null) }} className="min-h-12 rounded-xl border-2 border-hairline px-5 font-bold">Forget it and start fresh</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button type="button" onClick={() => begin('exam')} disabled={Boolean(starting)} className="min-h-14 rounded-xl bg-orange-500 px-6 text-xl font-bold text-white shadow-md disabled:opacity-60">
          {starting === 'exam' ? 'Starting…' : 'Start exam'}
        </button>
        {info.allowStudyMode && (
          <button type="button" onClick={() => begin('study')} disabled={Boolean(starting)} className="min-h-12 rounded-xl border-2 border-hairline px-6 font-bold disabled:opacity-60">
            {starting === 'study' ? 'Starting…' : 'Study mode: no timer, see each answer'}
          </button>
        )}
        {startError && <p role="alert" className="rounded-xl bg-red-600/12 px-4 py-3 text-sm font-semibold text-red-600">{startError}</p>}
      </div>

      {past.length > 0 && (
        <section aria-label="Your attempts" className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-ink-muted">Your attempts on this device</h2>
          <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
            {past.slice(0, 8).map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="text-ink-muted">{new Date(h.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}{h.mode === 'study' ? ' · study' : ''}</span>
                <span className="font-bold text-ink-900">
                  {h.score}/{h.total} ({h.percent}%)
                  {h.mode === 'exam' && <span className={h.passed ? 'ml-2 text-green-700' : 'ml-2 text-red-600'}>{h.passed ? 'Passed' : 'Not passed'}</span>}
                  {h.mode === 'exam' && h.secondsUsed != null && <span className="ml-2 font-normal text-ink-muted">{formatDuration(h.secondsUsed)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </CbtShell>
  )
}
