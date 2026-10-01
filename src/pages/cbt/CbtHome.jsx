import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { callCbt, loadHistory, progressSummary, LEVEL_LABEL } from '../../data/cbt'
import CbtShell from '../../components/cbt/CbtShell'

// /cbt: pick a course exam (by level, or search by course code), open an exam by code, or see your own progress.

export default function CbtHome() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [level, setLevel] = useState('all')
  const [search, setSearch] = useState('')
  const [code, setCode] = useState('')
  const progress = useMemo(() => progressSummary(loadHistory()), [])

  function load() {
    setError('')
    callCbt('list')
      .then(setData)
      .catch((e) => setError(e.message))
  }
  useEffect(() => {
    let cancelled = false
    callCbt('list')
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  const needle = search.trim().toLowerCase()
  const courses = (data?.courses ?? []).filter(
    (c) => (level === 'all' || c.level === level) && (!needle || `${c.code} ${c.title}`.toLowerCase().includes(needle)),
  )
  const levels = [...new Set((data?.courses ?? []).map((c) => c.level))]

  return (
    <CbtShell>
      <div className="flex flex-col gap-1">
        <Link to="/quiz" className="text-sm font-semibold text-orange-600">← All quizzes</Link>
        <h1 className="text-3xl font-bold sm:text-4xl">CBT practice</h1>
        <p className="max-w-2xl text-ink-muted">Timed exams that work like the real CBT: one paper, a countdown, answers only at the end. Free for everyone, no account needed.</p>
      </div>

      <form
        className="flex items-center gap-2 rounded-2xl border border-hairline bg-surface p-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.length === 6) navigate(`/cbt/${code}`)
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="Have an exam code?"
          aria-label="Exam code"
          autoCapitalize="characters"
          autoComplete="off"
          className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-hairline bg-paper px-4 text-lg font-bold uppercase tracking-[0.2em] text-ink-900 focus:border-orange-500 focus:outline-none"
        />
        <button type="submit" disabled={code.length !== 6} className="min-h-12 rounded-xl bg-orange-500 px-6 font-bold text-white disabled:opacity-50">Open</button>
      </form>

      <section aria-label="Course exams" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="sr-only">Search by course code or title</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by course code, like MTH 101"
              className="min-h-12 rounded-xl border-2 border-hairline bg-surface px-4 text-lg text-ink-900 focus:border-orange-500 focus:outline-none"
            />
          </label>
          {levels.length > 1 && (
            <div role="tablist" aria-label="Level" className="flex flex-wrap gap-2">
              {['all', ...levels].map((l) => (
                <button
                  key={l}
                  type="button"
                  role="tab"
                  aria-selected={level === l}
                  onClick={() => setLevel(l)}
                  className={`min-h-10 rounded-full border px-4 text-sm font-bold ${level === l ? 'border-ink-900 bg-ink-900 text-paper' : 'border-hairline bg-surface text-ink-900'}`}
                >
                  {l === 'all' ? 'All levels' : LEVEL_LABEL[l]}
                </button>
              ))}
            </div>
          )}
        </div>

        {error ? (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-xl bg-red-600/10 p-4 text-red-600">
            <p className="font-semibold">{error}</p>
            <button type="button" onClick={load} className="min-h-10 rounded-full border border-red-600 px-4 font-bold">Try again</button>
          </div>
        ) : !data ? (
          <p className="text-ink-muted">Loading exams…</p>
        ) : courses.length === 0 ? (
          <p className="rounded-xl border border-hairline bg-surface p-5 text-ink-muted">
            {data.courses.length === 0 ? 'No course exams have been published yet. You can still make your own practice exam below.' : 'No course matches that. Try a different code or level.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {courses.map((c) => (
              <li key={c.code} className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h2 className="text-xl font-bold">{c.code}</h2>
                  <span className="text-sm font-semibold text-ink-muted">{LEVEL_LABEL[c.level]}</span>
                </div>
                <p className="text-ink-muted">{c.title}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {c.exams.map((e) => (
                    <li key={e.code}>
                      <Link to={`/cbt/${e.code}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-hairline px-4 py-3 no-underline hover:border-orange-500">
                        <span className="min-w-0">
                          <span className="block font-bold text-ink-900">{e.title}</span>
                          <span className="block text-sm text-ink-muted">{e.questionsPerAttempt} questions · {e.durationMinutes} min · pass {e.passMarkPercent}%</span>
                        </span>
                        <span className="font-bold text-orange-600">Start →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {progress.length > 0 && (
        <section aria-label="My progress" className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-ink-muted">My progress on this device</h2>
          <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
            {progress.map((p) => (
              <li key={p.code}>
                <Link to={`/cbt/${p.code}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 no-underline">
                  <span className="min-w-0 truncate font-semibold text-ink-900">{p.courseCode ? `${p.courseCode} · ` : ''}{p.title}</span>
                  <span className="text-sm text-ink-muted">{p.attempts} {p.attempts === 1 ? 'attempt' : 'attempts'} · best {p.best}% · latest {p.latest}%</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted">This list lives in this browser. Clearing your browser data clears it.</p>
        </section>
      )}

      <Link to="/cbt/make" className="rounded-2xl border border-hairline bg-surface p-5 no-underline">
        <p className="font-bold text-ink-900">Make your own practice exam</p>
        <p className="text-ink-muted">Paste past questions from a spreadsheet and take them as a timed CBT, up to 100 questions. Private to you and anyone you share the code with.</p>
      </Link>
    </CbtShell>
  )
}
