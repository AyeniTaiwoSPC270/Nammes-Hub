import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { callQuiz } from '../data/quiz'
import { BrandMark, QuizBackdrop, QuizTopBar } from '../components/quiz/QuizParts'
import { QuizThemeScope } from '../components/quiz/QuizTheme'
import { mySetByCode, forgetMySet } from './customSets'

// /set/:code: a quiz someone made from their own questions. From here: practise it, challenge a friend, or duel.

export default function CustomSet() {
  const { code: raw } = useParams()
  const code = String(raw ?? '').toUpperCase()
  const navigate = useNavigate()
  const [set, setSet] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const mine = mySetByCode(code)
  const link = `${window.location.origin}/set/${code}`

  useEffect(() => {
    let cancelled = false
    callQuiz('sets', { op: 'info', code })
      .then((d) => !cancelled && setSet(d))
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [code])

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: set?.title ?? 'A quiz for you', url: link })
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
      // the link is shown on the page to copy by hand
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await callQuiz('sets', { op: 'remove', code, manageToken: mine.manageToken })
    } catch {
      // already gone: forgetting it locally is still right
    }
    forgetMySet(code)
    navigate('/make', { replace: true })
  }

  const button = 'flex min-h-14 items-center justify-center rounded-2xl px-6 text-xl font-bold no-underline shadow-md'
  return (
    <QuizThemeScope theme={null}>
      <div className="relative flex min-h-[100dvh] flex-col bg-paper text-ink-900">
        <QuizBackdrop />
        <QuizTopBar compact />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-5">
          <Link to="/make" className="text-sm font-semibold text-orange-500">← Make or find a quiz</Link>
          {error ? (
            <div className="mt-16 flex flex-col items-center gap-3 text-center">
              <span className="material-symbols-outlined text-5xl text-ink-muted" aria-hidden="true">search_off</span>
              <h1 className="text-2xl font-bold">Quiz not found</h1>
              <p className="text-ink-muted">{error}</p>
              {mine && <button type="button" onClick={() => { forgetMySet(code); navigate('/make') }} className="font-semibold text-orange-500 underline">Forget this one</button>}
            </div>
          ) : !set ? (
            <p className="mt-16 text-center text-xl text-ink-muted">Loading…</p>
          ) : (
            <>
              <div className="flex flex-col items-center gap-2 text-center">
                <BrandMark className="h-14 w-14" />
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-500">Community quiz</p>
                <h1 className="text-3xl font-bold">{set.title}</h1>
                <p className="text-ink-muted">{set.questionCount} question{set.questionCount === 1 ? '' : 's'}. Deleted on {new Date(set.expiresAt).toLocaleDateString()}.</p>
              </div>

              <Link to={`/practice/${set.quizId}`} className={`${button} bg-orange-500 text-white`}>Practise it</Link>
              <Link to={`/battle?quiz=${set.quizId}`} className={`${button} border-2 border-orange-500 text-orange-500`}>Challenge a friend or duel</Link>

              <div className="flex flex-col items-center gap-3 rounded-3xl border border-hairline bg-surface p-5 text-center shadow-md">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Quiz code</p>
                <p className="text-5xl font-bold tracking-[0.25em]" aria-label={`Quiz code ${code.split('').join(' ')}`}>{code}</p>
                <p className="break-all text-sm text-ink-muted">{link}</p>
                <button type="button" onClick={share} className={`${button} w-full bg-orange-500 text-white`}>{copied ? 'Link copied!' : 'Share this quiz'}</button>
                <p className="text-xs text-ink-muted">Anyone with the code or link can play it. Nothing else about you is shared.</p>
              </div>

              {mine &&
                (asking ? (
                  <div role="alert" className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-surface p-3 text-sm font-semibold">
                    <span>Delete this quiz for good?</span>
                    <button type="button" disabled={busy} onClick={remove} className="min-h-11 rounded-full bg-red-600 px-4 font-bold text-white">Yes, delete</button>
                    <button type="button" onClick={() => setAsking(false)} className="min-h-11 rounded-full bg-paper px-4 font-bold">Keep it</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAsking(true)} className="mx-auto min-h-11 px-4 text-sm font-semibold text-ink-muted underline">Delete this quiz</button>
                ))}
            </>
          )}
        </main>
      </div>
    </QuizThemeScope>
  )
}
