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
      <section className="flex flex-col gap-5 rounded-2xl bg-green-900 px-5 py-7 sm:px-8 sm:py-9">
        <Link to="/quiz" className="w-fit text-sm font-semibold text-white/70 no-underline hover:text-white">
          ← All quizzes
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">CBT practice</h1>
          <p className="max-w-xl text-white/80">
            Timed exams that work like the real CBT: one paper, a countdown, answers only at the end. Free for everyone, no account needed.
          </p>
        </div>

        <form
          className="flex flex-col gap-2 rounded-xl bg-surface p-2.5 sm:flex-row sm:items-center"
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
            className="min-h-12 min-w-0 flex-1 rounded-lg border border-hairline bg-paper px-4 text-lg font-bold uppercase tracking-[0.2em] text-ink-900 placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-muted focus:border-orange-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={code.length !== 6}
            className="min-h-12 rounded-lg bg-orange-500 px-7 font-bold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-ink-muted/15 disabled:text-ink-muted"
          >
            Open
          </button>
        </form>
      </section>

      <section aria-label="Course exams" className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Course exams</h2>

        <div className="flex flex-col gap-3">
          <label className="relative flex flex-col gap-1">
            <span className="sr-only">Search by course code or title</span>
            <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-ink-muted" aria-hidden="true">
              search
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by course code, like MTH 101"
              className="min-h-12 w-full rounded-lg border border-hairline bg-surface pl-12 pr-4 text-base text-ink-900 focus:border-green-900 focus:outline-none"
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
                  className={`min-h-10 rounded-full border px-4 text-sm font-bold ${
                    level === l ? 'border-green-900 bg-green-900 text-white' : 'border-hairline bg-surface text-ink-900 hover:border-ink-muted'
                  }`}
                >
                  {l === 'all' ? 'All levels' : LEVEL_LABEL[l]}
                </button>
              ))}
            </div>
          )}
        </div>

        {error ? (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-xl bg-danger-bg p-4 text-danger">
            <p className="font-semibold">{error}</p>
            <button type="button" onClick={load} className="min-h-10 rounded-full border border-danger px-4 font-bold">
              Try again
            </button>
          </div>
        ) : !data ? (
          <p className="rounded-xl border border-hairline bg-surface px-5 py-6 text-center text-ink-muted">Loading exams…</p>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-hairline bg-surface-low px-6 py-10 text-center">
            <span className="material-symbols-outlined mb-1 text-3xl text-ink-muted" aria-hidden="true">
              quiz
            </span>
            <p className="font-bold text-ink-900">
              {data.courses.length === 0 ? 'No course exams published yet' : 'No course matches that'}
            </p>
            <p className="text-sm text-ink-muted">
              {data.courses.length === 0
                ? 'You can still make your own practice exam below.'
                : 'Try a different code or level.'}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {courses.map((c) => (
              <li key={c.code} className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-hairline bg-surface-low px-5 py-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold">{c.code}</h3>
                    <p className="text-sm text-ink-muted">{c.title}</p>
                  </div>
                  <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.05em] text-ink-muted">
                    {LEVEL_LABEL[c.level]}
                  </span>
                </div>
                <ul className="divide-y divide-hairline">
                  {c.exams.map((e) => (
                    <li key={e.code}>
                      <Link
                        to={`/cbt/${e.code}`}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 no-underline hover:bg-surface-low"
                      >
                        <span className="min-w-0">
                          <span className="block font-bold text-ink-900">{e.title}</span>
                          <span className="block text-sm text-ink-muted">
                            {e.questionsPerAttempt} questions · {e.durationMinutes} min · pass {e.passMarkPercent}%
                          </span>
                        </span>
                        <span className="flex items-center gap-1 font-bold text-brand-orange">
                          Start
                          <span className="material-symbols-outlined text-lg" aria-hidden="true">
                            arrow_forward
                          </span>
                        </span>
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
          <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface shadow-sm">
            {progress.map((p) => (
              <li key={p.code}>
                <Link
                  to={`/cbt/${p.code}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-3.5 no-underline hover:bg-surface-low"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink-900">
                    {p.courseCode ? `${p.courseCode} · ` : ''}
                    {p.title}
                  </span>
                  <span className="flex items-baseline gap-4 text-sm text-ink-muted">
                    <span>{p.attempts} {p.attempts === 1 ? 'attempt' : 'attempts'}</span>
                    <span>
                      best <span className="font-bold text-ink-900">{p.best}%</span>
                    </span>
                    <span>
                      latest <span className="font-bold text-ink-900">{p.latest}%</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted">This list lives in this browser. Clearing your browser data clears it.</p>
        </section>
      )}

      <Link
        to="/cbt/make"
        className="flex items-center gap-4 rounded-xl border border-orange-100 bg-orange-100 p-5 no-underline transition-colors hover:border-orange-500"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-orange-600">
          <span className="material-symbols-outlined" aria-hidden="true">
            add
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-ink-900">Make your own practice exam</span>
          <span className="block text-sm text-ink-900/75">
            Paste past questions from a spreadsheet and take them as a timed CBT, up to 100 questions. Private to you and anyone you share the code with.
          </span>
        </span>
        <span className="material-symbols-outlined text-orange-600" aria-hidden="true">
          arrow_forward
        </span>
      </Link>
    </CbtShell>
  )
}
