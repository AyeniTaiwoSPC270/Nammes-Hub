import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { callCbt, clockOffset, answeredCount, saveActive, loadActive, saveHistory } from '../../data/cbt'
import CbtShell from '../../components/cbt/CbtShell'
import ExamClock from '../../components/cbt/ExamClock'
import Navigator from '../../components/cbt/Navigator'
import QuestionView from '../../components/cbt/QuestionView'
import ResultView from '../../components/cbt/ResultView'

// /cbt/:code/exam: the exam itself. The paper, the answer order and the deadline all come from the server; this page
// shows them, saves answers as they are given (so a refresh or a dropped connection loses nothing) and submits.
// In study mode there is no clock and each answer is checked straight away.

const SAVE_DELAY_MS = 600
const RETRY_MS = 4000

export default function CbtExam() {
  const { code: rawCode } = useParams()
  const code = String(rawCode ?? '').toUpperCase()
  const location = useLocation()

  const [phase, setPhase] = useState('loading') // loading | running | result | error
  const [error, setError] = useState('')
  const [view, setView] = useState(null)
  const [result, setResult] = useState(null)
  const [answers, setAnswers] = useState({})
  const [flagged, setFlagged] = useState([])
  const [feedback, setFeedback] = useState({})
  const [current, setCurrent] = useState(0)
  const [offset, setOffset] = useState(0)
  const [saveState, setSaveState] = useState('saved') // saved | saving | failed
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [checking, setChecking] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  const token = useRef(null)
  const latest = useRef({ answers: {}, flagged: [] })
  const flags = useRef({ dirty: false, inFlight: false, finished: false })
  const timers = useRef({ save: null, retry: null })
  const api = useRef({})

  function stopTimers() {
    clearTimeout(timers.current.save)
    clearTimeout(timers.current.retry)
  }

  function fail(e) {
    flags.current.finished = true
    stopTimers()
    setError(e?.message || 'Something went wrong. Please try again.')
    setPhase('error')
  }

  function showResult(data) {
    flags.current.finished = true
    stopTimers()
    setConfirming(false)
    setSubmitting(false)
    setResult(data)
    setPhase('result')
    if (token.current) {
      saveActive(code, { token: token.current, mode: data.mode, done: true })
      saveHistory({
        id: token.current.slice(-10),
        code,
        title: data.title,
        courseCode: data.courseCode ?? null,
        mode: data.mode,
        score: data.score,
        total: data.total,
        percent: data.percent,
        passed: data.passed,
        secondsUsed: data.secondsUsed,
        at: Date.now(),
      })
    }
  }

  function showRunning(data) {
    latest.current = { answers: data.answers ?? {}, flagged: data.flagged ?? [] }
    setView(data)
    setAnswers(data.answers ?? {})
    setFlagged(data.flagged ?? [])
    setFeedback(data.feedback ?? {})
    setOffset(clockOffset(data.serverNow))
    setPhase('running')
  }

  function apply(data) {
    if (data.status === 'submitted') showResult(data)
    else showRunning(data)
  }

  // Sends the answers to the server. One request at a time: if something changes meanwhile, it is sent again after.
  async function flush() {
    const f = flags.current
    if (f.finished) return
    if (f.inFlight) {
      f.dirty = true
      return
    }
    f.inFlight = true
    f.dirty = false
    setSaveState('saving')
    try {
      const data = await callCbt('save', { token: token.current, answers: latest.current.answers, flagged: latest.current.flagged })
      if (data.status === 'submitted') {
        showResult(data)
        return
      }
      setOffset(clockOffset(data.serverNow))
      setSaveState(f.dirty ? 'saving' : 'saved')
    } catch (e) {
      if (e.status === 401 || e.status === 410) {
        fail(e)
        return
      }
      setSaveState('failed')
      timers.current.retry = setTimeout(() => api.current.flush(), RETRY_MS)
    } finally {
      f.inFlight = false
      if (f.dirty && !f.finished) api.current.flush()
    }
  }

  function queueSave() {
    clearTimeout(timers.current.save)
    setSaveState('saving')
    timers.current.save = setTimeout(() => api.current.flush(), SAVE_DELAY_MS)
  }

  function setAnswer(question, value) {
    const next = { ...latest.current.answers }
    const empty = value === null || (value.text !== undefined && value.text.trim() === '')
    if (empty) delete next[question.id]
    else next[question.id] = value
    latest.current = { ...latest.current, answers: next }
    setAnswers(next)
    if (view.mode === 'exam') queueSave()
  }

  function toggleFlag(question) {
    const has = latest.current.flagged.includes(question.id)
    const next = has ? latest.current.flagged.filter((id) => id !== question.id) : [...latest.current.flagged, question.id]
    latest.current = { ...latest.current, flagged: next }
    setFlagged(next)
    queueSave()
  }

  // Study mode: ask the server whether this answer is right.
  async function check(question, value) {
    const sent = value ?? latest.current.answers[question.id]
    if (!sent) return
    setChecking(true)
    try {
      const data = await callCbt('check', { token: token.current, questionId: question.id, choice: sent.choice, text: sent.text })
      setFeedback((f) => ({ ...f, [question.id]: data.feedback }))
      if (data.answer) {
        latest.current = { ...latest.current, answers: { ...latest.current.answers, [question.id]: data.answer } }
        setAnswers(latest.current.answers)
      }
    } catch (e) {
      if (e.status === 401 || e.status === 410) fail(e)
      else setSubmitError(e.message)
    } finally {
      setChecking(false)
    }
  }

  async function doSubmit() {
    if (flags.current.finished || submitting) return
    setSubmitting(true)
    setSubmitError('')
    stopTimers()
    try {
      const body = { token: token.current, flagged: latest.current.flagged }
      if (view?.mode === 'exam') body.answers = latest.current.answers
      showResult(await callCbt('submit', body))
    } catch (e) {
      if (e.status === 401 || e.status === 410) {
        fail(e)
        return
      }
      setSubmitting(false)
      setSubmitError(`${e.message} Your answers are still here. Try again.`)
    }
  }

  useEffect(() => {
    api.current = { flush, doSubmit }
  })

  // Load: the first view comes with the navigation from the start page, otherwise ask the server (a refresh, a new tab).
  useEffect(() => {
    let cancelled = false
    const given = location.state?.token ? location.state : null
    token.current = given?.token ?? loadActive(code)?.token ?? null
    if (!token.current) {
      setError('There is no exam in progress on this device.')
      setPhase('error')
      return undefined
    }
    if (given?.view) {
      apply(given.view)
    } else {
      callCbt('resume', { token: token.current })
        .then((data) => !cancelled && apply(data))
        .catch((e) => !cancelled && fail(e))
    }
    return () => {
      cancelled = true
      stopTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const running = phase === 'running'
  const exam = view?.mode === 'exam'

  // Warn before an exam is closed by accident (the clock keeps running on the server anyway).
  useEffect(() => {
    if (!running || !exam) return undefined
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [running, exam])

  // Arrow keys move between questions (unless typing an answer).
  useEffect(() => {
    if (!running) return undefined
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || confirming) return
      if (e.key === 'ArrowRight') setCurrent((c) => Math.min(c + 1, view.questions.length - 1))
      if (e.key === 'ArrowLeft') setCurrent((c) => Math.max(c - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, confirming, view])

  if (phase === 'loading') {
    return (
      <CbtShell>
        <p className="mt-16 text-center text-xl text-ink-muted">Loading your exam…</p>
      </CbtShell>
    )
  }

  if (phase === 'error') {
    return (
      <CbtShell>
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <span className="material-symbols-outlined text-5xl text-ink-muted" aria-hidden="true">error</span>
          <h1 className="text-2xl font-bold">We can not open this exam</h1>
          <p className="max-w-md text-ink-muted">{error}</p>
          <Link to={`/cbt/${code}`} className="flex min-h-12 items-center rounded-xl bg-orange-500 px-6 font-bold text-white no-underline">Start again</Link>
          <Link to="/cbt" className="font-semibold text-orange-600">All exams</Link>
        </div>
      </CbtShell>
    )
  }

  if (phase === 'result') {
    return (
      <CbtShell title={result.courseCode ? `${result.courseCode} · ${result.title}` : result.title}>
        <ResultView result={result} code={code} />
      </CbtShell>
    )
  }

  const questions = view.questions
  const question = questions[current]
  const answered = answeredCount(answers, questions)
  const unanswered = questions.length - answered
  const last = current === questions.length - 1
  const isFlagged = flagged.includes(question.id)
  const title = view.courseCode ? `${view.courseCode} · ${view.title}` : view.title
  const go = (i) => {
    setCurrent(Math.min(Math.max(i, 0), questions.length - 1))
    setNavOpen(false)
  }
  const saveText = !exam ? '' : saveState === 'saved' ? 'All answers saved' : saveState === 'saving' ? 'Saving…' : 'Not saved yet. Retrying…'

  return (
    <CbtShell
      wide
      title={title}
      right={
        <>
          {exam && <ExamClock deadlineAt={view.deadlineAt} offset={offset} onExpire={() => api.current.doSubmit()} />}
          <button type="button" onClick={() => setConfirming(true)} className="hidden min-h-11 rounded-xl bg-ink-900 px-5 font-bold text-paper sm:block">
            {exam ? 'Submit' : 'Finish'}
          </button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-4">
          {!exam && <p className="rounded-xl bg-surface px-4 py-2 text-sm text-ink-muted">Study mode: there is no timer, and you see the answer after each question.</p>}
          <QuestionView
            key={question.id}
            question={question}
            index={current}
            total={questions.length}
            answer={answers[question.id]}
            feedback={feedback[question.id]}
            checking={checking}
            onAnswer={(value) => {
              setAnswer(question, value)
              if (!exam && value.choice !== undefined) check(question, value)
            }}
            onCheck={!exam && question.type !== 'multiple' && question.type !== 'truefalse' ? () => check(question) : undefined}
          />

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => go(current - 1)} disabled={current === 0} className="min-h-12 rounded-xl border-2 border-hairline px-5 font-bold disabled:opacity-40">Previous</button>
            {exam && (
              <>
                <button type="button" onClick={() => toggleFlag(question)} aria-pressed={isFlagged} className={`flex min-h-12 items-center gap-1.5 rounded-xl border-2 px-4 font-bold ${isFlagged ? 'border-amber-500 bg-amber-500/15 text-amber-700' : 'border-hairline'}`}>
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">flag</span>
                  {isFlagged ? 'Flagged' : 'Flag for review'}
                </button>
                <button type="button" onClick={() => setAnswer(question, null)} disabled={!answers[question.id]} className="min-h-12 rounded-xl border-2 border-hairline px-4 font-bold disabled:opacity-40">Clear answer</button>
              </>
            )}
            <span className="flex-1" />
            {last ? (
              <button type="button" onClick={() => setConfirming(true)} className="min-h-12 rounded-xl bg-orange-500 px-6 font-bold text-white">{exam ? 'Review and submit' : 'Finish'}</button>
            ) : (
              <button type="button" onClick={() => go(current + 1)} className="min-h-12 rounded-xl bg-orange-500 px-6 font-bold text-white">Next</button>
            )}
          </div>
          {submitError && !confirming && <p role="alert" className="rounded-xl bg-red-600/12 px-4 py-3 text-sm font-semibold text-red-600">{submitError}</p>}
        </div>

        <aside className="flex flex-col gap-3">
          <button type="button" onClick={() => setNavOpen((o) => !o)} aria-expanded={navOpen} className="flex min-h-12 items-center justify-between rounded-xl border-2 border-hairline bg-surface px-4 font-bold lg:hidden">
            <span>Questions ({answered}/{questions.length} answered)</span>
            <span className="material-symbols-outlined" aria-hidden="true">{navOpen ? 'expand_less' : 'expand_more'}</span>
          </button>
          <div className={`${navOpen ? 'block' : 'hidden'} rounded-2xl border border-hairline bg-surface p-4 lg:block`}>
            <p className="mb-3 hidden text-sm font-bold text-ink-900 lg:block">{answered} of {questions.length} answered</p>
            <Navigator questions={questions} answers={answers} flagged={flagged} current={current} onGo={go} feedback={exam ? null : feedback} />
          </div>
          {exam && <p role="status" className={`text-sm ${saveState === 'failed' ? 'font-semibold text-red-600' : 'text-ink-muted'}`}>{saveText}</p>}
          <button type="button" onClick={() => setConfirming(true)} className="min-h-12 rounded-xl bg-ink-900 px-5 font-bold text-paper sm:hidden">{exam ? 'Submit exam' : 'Finish'}</button>
        </aside>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="submit-title" className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-paper p-6 shadow-lg">
            <h2 id="submit-title" className="text-2xl font-bold">{exam ? 'Submit your exam?' : 'Finish this session?'}</h2>
            <ul className="flex flex-col gap-1 text-lg">
              <li>You answered <strong>{answered}</strong> of {questions.length}.</li>
              {unanswered > 0 && <li className="font-semibold text-amber-700">{unanswered} not answered.</li>}
              {flagged.length > 0 && <li className="font-semibold text-amber-700">{flagged.length} flagged for review.</li>}
            </ul>
            {exam && <p className="text-sm text-ink-muted">You can not change your answers after you submit.</p>}
            {submitError && <p role="alert" className="rounded-xl bg-red-600/12 px-3 py-2 text-sm font-semibold text-red-600">{submitError}</p>}
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={doSubmit} disabled={submitting} className="min-h-12 flex-1 rounded-xl bg-orange-500 px-5 font-bold text-white disabled:opacity-60">{submitting ? 'Submitting…' : exam ? 'Submit now' : 'Finish'}</button>
              <button type="button" autoFocus onClick={() => { setConfirming(false); setSubmitError('') }} disabled={submitting} className="min-h-12 flex-1 rounded-xl border-2 border-hairline px-5 font-bold">Keep working</button>
            </div>
          </div>
        </div>
      )}
    </CbtShell>
  )
}
