import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { callQuiz } from '../data/quiz'
import { questionsFromCsv, CBT_COLUMNS, CSV_COLUMNS, CSV_MAX_BYTES } from '../data/quizCsv'
import { cleanQuestion } from '../data/quizQuestions'
import { downloadTextFile } from '../lib/downloadFile'
import { sanitizeCustomQuestions, cleanTitle, CUSTOM_MAX_QUESTIONS, CUSTOM_DAYS, CUSTOM_DAY_CHOICES } from '../../api/_lib/quizCustom.js'
import { BrandMark, QuizBackdrop, QuizTopBar } from '../components/quiz/QuizParts'
import { QuizThemeScope } from '../components/quiz/QuizTheme'
import MathText from '../components/quiz/MathText'
import CbtShell from '../components/cbt/CbtShell'
import { loadMySets, saveMySet } from './customSets'

// /make: bring your own questions. Paste them from a spreadsheet (or upload a CSV), check the preview, and get a private
// code to practise them, challenge a friend or duel. No account needed; the quiz is deleted after 30 days.

const TEMPLATE = [
  CBT_COLUMNS.join(','),
  'multiple,What is the capital of Ghana?,Lagos,Accra,Kumasi,Abuja,B,20,1000,Accra is the capital city.,Geography,',
  'truefalse,The sun is a star.,,,,,True,10,500,,,',
  'numeric,How many days are in a leap year?,,,,,366,20,1000,,,',
  'text,What is the capital of France?,,,,,Paris|paris,30,1000,,,',
].join('\r\n')

const TYPE_LABEL = { multiple: 'Multiple choice', truefalse: 'True or false', numeric: 'Number', text: 'Typed answer' }

function answerOf(q) {
  if (q.type === 'multiple' || q.type === 'truefalse') return q.options[q.correct_index]
  if (q.type === 'numeric') return String(q.numeric_answer) + (q.numeric_tolerance > 0 ? ` (± ${q.numeric_tolerance})` : '')
  return q.accepted_answers.join(' / ')
}

// `variant="cbt"` is the same maker dressed as an exam page (/cbt/make): exam wording, exam settings open, and it lands on the
// exam's start page. The default is the quiz version (/make).
export default function MakeQuiz({ variant = 'quiz' }) {
  const cbt = variant === 'cbt'
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  // Exam settings (used when the quiz is taken as a timed CBT exam)
  const [days, setDays] = useState(CUSTOM_DAYS)
  const [minutes, setMinutes] = useState('')
  const [passMark, setPassMark] = useState(50)
  const [shuffleQuestions, setShuffleQuestions] = useState(true)
  const [shuffleOptions, setShuffleOptions] = useState(true)
  const mine = useMemo(() => loadMySets(), [])

  // Read the pasted text the same way the admin import does, then run the same checks the server will.
  const parsed = useMemo(() => {
    if (!text.trim()) return null
    const { questions, problems } = questionsFromCsv(text)
    const cleaned = questions.map((q) => cleanQuestion(q))
    const checked = sanitizeCustomQuestions(cleaned)
    return { rows: cleaned, good: checked.questions, problems: [...problems, ...checked.problems] }
  }, [text])
  const titleCheck = title.trim() ? cleanTitle(title) : null
  const ready = parsed && parsed.problems.length === 0 && parsed.good.length > 0 && titleCheck && !titleCheck.error

  async function readFile(file) {
    if (!file) return
    if (file.size > CSV_MAX_BYTES) {
      setError('That file is too big. A quiz spreadsheet should be a small file.')
      return
    }
    setError('')
    setText(await file.text())
  }

  async function create() {
    setBusy(true)
    setError('')
    try {
      const settings = {
        pass_mark_percent: Number(passMark) || 50,
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        ...(Number(minutes) > 0 ? { duration_minutes: Number(minutes) } : {}),
      }
      const data = await callQuiz('sets', { op: 'create', title, questions: parsed.rows, days, settings })
      saveMySet({ code: data.code, manageToken: data.manageToken, title: data.title, quizId: data.quizId, expiresAt: data.expiresAt })
      navigate(cbt ? `/cbt/${data.code}` : `/set/${data.code}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const content = (
    <>
          <section className="flex flex-col gap-5 rounded-2xl bg-green-900 px-5 py-7 sm:px-8 sm:py-9">
            <Link
              to={cbt ? '/cbt' : '/quiz'}
              className="w-fit text-sm font-semibold text-white/70 no-underline hover:text-white"
            >
              {cbt ? '← All exams' : '← All quizzes'}
            </Link>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                {!cbt && (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1.5">
                    <BrandMark className="h-full w-full" />
                  </span>
                )}
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/70">
                  {cbt ? 'CBT practice' : 'Your own questions'}
                </p>
              </div>
              <h1 className="text-3xl font-bold text-white sm:text-4xl">
                {cbt ? 'Make your own practice exam' : 'Make a quiz from a spreadsheet'}
              </h1>
              <p className="max-w-xl text-white/80">
                {cbt
                  ? 'Paste your past questions from a spreadsheet and take them as a timed CBT exam. You get a private code to share with friends. No account needed.'
                  : 'Paste your questions, get a private code, then take them as a timed CBT exam, practise them, challenge a friend or duel. No account needed.'}
              </p>
            </div>
          </section>

          <section className="flex flex-col gap-5 rounded-2xl border border-hairline bg-surface p-5 shadow-sm sm:p-6">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">{cbt ? 'Name your exam' : 'Name your quiz'}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                autoComplete="off"
                placeholder={cbt ? 'e.g. MTH 101 past questions' : 'e.g. MTH 101 revision'}
                className="min-h-12 rounded-lg border border-hairline bg-paper px-4 text-lg font-semibold text-ink-900 focus:border-orange-500 focus:outline-none"
              />
              {titleCheck?.error && <span className="text-sm font-semibold text-danger">{titleCheck.error}</span>}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Your questions</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                spellCheck={false}
                placeholder={'Paste rows from Excel or Google Sheets here.\nOne question per row: question, four answers, and the letter of the right one.'}
                className="rounded-lg border border-hairline bg-paper p-3 font-mono text-sm text-ink-900 focus:border-orange-500 focus:outline-none"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-hairline px-3 text-sm font-bold text-ink-900 hover:bg-surface-low">
                <span className="material-symbols-outlined text-lg" aria-hidden="true">upload_file</span>
                Upload a CSV file
                <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => readFile(e.target.files?.[0])} />
              </label>
              <button
                type="button"
                onClick={() => downloadTextFile('my-quiz-template.csv', TEMPLATE)}
                className="flex min-h-10 items-center gap-1.5 rounded-lg border border-hairline px-3 text-sm font-bold text-ink-900 hover:bg-surface-low"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">download</span>
                Download a template
              </button>
            </div>

            <details className="border-t border-hairline pt-4 text-sm text-ink-muted" open={cbt}>
              <summary className="cursor-pointer text-sm font-bold text-ink-900">Exam settings and how long to keep it</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-ink-900">Time allowed (minutes)</span>
                  <input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" placeholder="Automatic (about 1 minute a question)" className="min-h-11 rounded-lg border border-hairline bg-paper px-3 text-ink-900 focus:border-orange-500 focus:outline-none" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-ink-900">Pass mark (%)</span>
                  <input value={passMark} onChange={(e) => setPassMark(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" className="min-h-11 rounded-lg border border-hairline bg-paper px-3 text-ink-900 focus:border-orange-500 focus:outline-none" />
                </label>
                <label className="flex items-center gap-2 font-semibold text-ink-900"><input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} className="h-5 w-5 accent-orange-500" /> Shuffle the questions</label>
                <label className="flex items-center gap-2 font-semibold text-ink-900"><input type="checkbox" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} className="h-5 w-5 accent-orange-500" /> Shuffle the answers</label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="font-semibold text-ink-900">Keep this quiz for</span>
                  <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="min-h-11 rounded-lg border border-hairline bg-paper px-3 text-ink-900">
                    {CUSTOM_DAY_CHOICES.map((d) => <option key={d} value={d}>{d} days</option>)}
                  </select>
                </label>
              </div>
            </details>

            <details className="border-t border-hairline pt-4 text-sm text-ink-muted">
              <summary className="cursor-pointer text-sm font-bold text-ink-900">How should the spreadsheet look?</summary>
              <p className="mt-2">
                The simplest sheet has no header: the question, four answers, then the letter of the right one (A to D). For more control, use the columns{' '}
                <code>{CSV_COLUMNS.join(', ')}</code>. Question types: multiple, truefalse, numeric (the <code>correct</code> cell is the number, optionally <code>366|1</code> for a margin) and text (accepted answers
                separated by <code>|</code>). Up to {CUSTOM_MAX_QUESTIONS} questions. Maths goes between dollar signs, like <code>$x^2$</code>. For exams you can add the optional columns <code>explanation</code> (shown in the review after the exam) and <code>no_shuffle</code> (yes, to keep that question's answers in order).
              </p>
            </details>

            {parsed && parsed.problems.length > 0 && (
              <ul role="alert" className="flex flex-col gap-1 rounded-lg bg-danger-bg p-3 text-sm font-semibold text-danger">
                {parsed.problems.slice(0, 8).map((p, i) => <li key={i}>Row {p.line}: {p.message}</li>)}
                {parsed.problems.length > 8 && <li>…and {parsed.problems.length - 8} more.</li>}
              </ul>
            )}
            {error && <p role="alert" className="rounded-lg bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
          </section>

          {parsed && parsed.good.length > 0 && (
            <section aria-label="Preview" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-ink-muted">Preview</h2>
                <p className="text-sm font-semibold text-success dark:text-brand">{parsed.good.length} question{parsed.good.length === 1 ? '' : 's'} ready</p>
              </div>
              <ol className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface shadow-sm">
                {parsed.good.slice(0, 5).map((q, i) => (
                  <li key={i} className="flex gap-3 px-4 py-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-low text-xs font-bold text-ink-muted">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="font-semibold"><MathText>{q.text}</MathText></p>
                      <p className="text-sm text-ink-muted">{TYPE_LABEL[q.type]} · answer: <span className="font-bold text-success dark:text-brand"><MathText>{answerOf(q)}</MathText></span></p>
                    </div>
                  </li>
                ))}
              </ol>
              {parsed.good.length > 5 && <p className="text-center text-sm text-ink-muted">…and {parsed.good.length - 5} more.</p>}
            </section>
          )}

          <button
            type="button"
            disabled={!ready || busy}
            onClick={create}
            className="min-h-14 rounded-xl bg-orange-500 px-6 text-lg font-bold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-ink-muted/15 disabled:text-ink-muted"
          >
            {busy ? (cbt ? 'Making your exam…' : 'Making your quiz…') : cbt ? 'Make my exam' : 'Make my quiz'}
          </button>

          <form
            className="flex items-center gap-2 rounded-xl border border-hairline bg-surface p-2.5 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault()
              if (code.length === 6) navigate(cbt ? `/cbt/${code}` : `/set/${code}`)
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder={cbt ? 'Got an exam code?' : 'Got a quiz code?'}
              aria-label={cbt ? 'Exam code' : 'Quiz code'}
              autoCapitalize="characters"
              autoComplete="off"
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-hairline bg-paper px-4 text-base font-bold uppercase tracking-[0.2em] text-ink-900 placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-muted focus:border-orange-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={code.length !== 6}
              className="min-h-11 rounded-lg bg-orange-500 px-5 font-bold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-ink-muted/15 disabled:text-ink-muted"
            >
              Open
            </button>
          </form>

          {mine.length > 0 && (
            <section aria-label="Your quizzes" className="flex flex-col gap-2">
              <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-ink-muted">{cbt ? 'Exams you made on this device' : 'Quizzes you made on this device'}</h2>
              <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface shadow-sm">
                {mine.map((s) => (
                  <li key={s.code}>
                    <Link to={cbt ? `/cbt/${s.code}` : `/set/${s.code}`} className="flex items-center justify-between gap-3 px-4 py-3 no-underline hover:bg-surface-low">
                      <span className="min-w-0 truncate font-semibold text-ink-900">{s.title}</span>
                      <span className="shrink-0 rounded-full bg-surface-low px-3 py-1 font-mono text-sm font-bold tracking-[0.15em] text-brand-orange">{s.code}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
    </>
  )

  if (cbt) return <CbtShell>{content}</CbtShell>
  return (
    <QuizThemeScope theme={null}>
      <div className="relative isolate flex min-h-[100dvh] flex-col bg-paper text-ink-900">
        <QuizBackdrop />
        <QuizTopBar compact />
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-5">{content}</main>
      </div>
    </QuizThemeScope>
  )
}
