import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { callQuiz } from '../data/quiz'
import { BrandMark, QuizBackdrop, QuizTopBar } from '../components/quiz/QuizParts'
import { QuizThemeScope } from '../components/quiz/QuizTheme'

// /practice: every quiz an admin has opened for practice, so nobody needs a link to find one. No account needed.

export default function PracticeList() {
  const [quizzes, setQuizzes] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    callQuiz('practice', { op: 'list' })
      .then((d) => !cancelled && setQuizzes(d.quizzes))
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <QuizThemeScope theme={null}>
      <div className="relative flex min-h-[100dvh] flex-col bg-paper text-ink-900">
        <QuizBackdrop />
        <QuizTopBar compact />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-5">
          <Link to="/" className="text-sm font-semibold text-orange-500">← Back to NAMMES Hub</Link>
          <div className="flex flex-col items-center gap-2 text-center">
            <BrandMark className="h-14 w-14" />
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-500">Practice</p>
            <h1 className="text-3xl font-bold">Pick a quiz to practise</h1>
            <p className="text-ink-muted">Go at your own pace and see the answer after each question. No account needed.</p>
          </div>
          {error ? (
            <p role="alert" className="rounded-2xl bg-red-600/12 px-4 py-3 text-center text-sm font-semibold text-red-600">{error}</p>
          ) : quizzes === null ? (
            <p className="mt-10 text-center text-xl text-ink-muted">Loading…</p>
          ) : quizzes.length === 0 ? (
            <p className="rounded-2xl border border-hairline bg-surface p-5 text-center text-ink-muted">No quiz is open for practice right now. Check back soon.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {quizzes.map((q) => (
                <li key={q.id} className="flex flex-col gap-3 rounded-3xl border border-hairline bg-surface p-5 shadow-md">
                  <div>
                    <h2 className="text-xl font-bold">{q.title}</h2>
                    <p className="text-sm text-ink-muted">{q.questionCount} question{q.questionCount === 1 ? '' : 's'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/practice/${q.id}`} className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-orange-500 px-5 font-bold text-white no-underline">Practise</Link>
                    {q.battleEnabled && (
                      <Link to={`/battle?quiz=${q.id}`} className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border-2 border-orange-500 px-5 font-bold text-orange-500 no-underline">Battle</Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/make" className="text-center text-sm font-semibold text-orange-500">Want to use your own questions? Make a quiz</Link>
        </main>
      </div>
    </QuizThemeScope>
  )
}
