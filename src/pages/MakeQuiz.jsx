import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { callQuiz } from '../data/quiz'
import { questionsFromCsv, CSV_COLUMNS, CSV_MAX_BYTES } from '../data/quizCsv'
import { cleanQuestion } from '../data/quizQuestions'
import { downloadTextFile } from '../lib/downloadFile'
import { sanitizeCustomQuestions, cleanTitle, CUSTOM_MAX_QUESTIONS, CUSTOM_DAYS } from '../../api/_lib/quizCustom.js'
import { BrandMark, QuizBackdrop, QuizTopBar } from '../components/quiz/QuizParts'
import { QuizThemeScope } from '../components/quiz/QuizTheme'
import MathText from '../components/quiz/MathText'
import { loadMySets, saveMySet } from './customSets'

// /make: bring your own questions. Paste them from a spreadsheet (or upload a CSV), check the preview, and get a private
// code to practise them, challenge a friend or duel. No account needed; the quiz is deleted after 30 days.

const TEMPLATE = [
  CSV_COLUMNS.join(','),
  'multiple,What is the capital of Ghana?,Lagos,Accra,Kumasi,Abuja,B,20,1000',
  'truefalse,The sun is a star.,,,,,True,10,500',
  'numeric,How many days are in a leap year?,,,,,366,20,1000',
  'text,What is the capital of France?,,,,,Paris|paris,30,1000',
].join('\r\n')

const TYPE_LABEL = { multiple: 'Multiple choice', truefalse: 'True or false', numeric: 'Number', text: 'Typed answer' }

function answerOf(q) {
  if (q.type === 'multiple' || q.type === 'truefalse') return q.options[q.correct_index]
  if (q.type === 'numeric') return String(q.numeric_answer) + (q.numeric_tolerance > 0 ? ` (± ${q.numeric_tolerance})` : '')
  return q.accepted_answers.join(' / ')
}

export default function MakeQuiz() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
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
      const data = await callQuiz('sets', { op: 'create', title, questions: parsed.rows })
      saveMySet({ code: data.code, manageToken: data.manageToken, title: data.title, quizId: data.quizId, expiresAt: data.expiresAt })
      navigate(`/set/${data.code}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <QuizThemeScope theme={null}>
      <div className="relative flex min-h-[100dvh] flex-col bg-paper text-ink-900">
        <QuizBackdrop />
        <QuizTopBar compact />
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-5">
          <Link to="/quiz" className="text-sm font-semibold text-orange-500">← All quizzes</Link>
          <div className="flex flex-col items-center gap-2 text-center">
            <BrandMark className="h-14 w-14" />
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-500">Your own questions</p>
            <h1 className="text-3xl font-bold">Make a quiz from a spreadsheet</h1>
            <p className="text-ink-muted">
              Paste your questions, get a private code, then practise them, challenge a friend or duel. No account needed. Your quiz is deleted after {CUSTOM_DAYS} days.
            </p>
          </div>

          <section className="flex flex-col gap-4 rounded-3xl border border-hairline bg-surface p-5 shadow-md">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Name your quiz</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                autoComplete="off"
                placeholder="e.g. MTH 101 revision"
                className="min-h-14 rounded-2xl border-2 border-hairline bg-paper px-4 text-lg font-semibold text-ink-900 focus:border-orange-500 focus:outline-none"
              />
              {titleCheck?.error && <span className="text-sm font-semibold text-red-600">{titleCheck.error}</span>}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">Your questions</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                spellCheck={false}
                placeholder={'Paste rows from Excel or Google Sheets here.\nOne question per row: question, four answers, and the letter of the right one.'}
                className="rounded-2xl border-2 border-hairline bg-paper p-3 font-mono text-sm text-ink-900 focus:border-orange-500 focus:outline-none"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="cursor-pointer rounded-full border border-hairline px-4 py-2 font-bold hover:bg-surface-low">
                Upload a CSV file
                <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => readFile(e.target.files?.[0])} />
              </label>
              <button type="button" onClick={() => downloadTextFile('my-quiz-template.csv', TEMPLATE)} className="rounded-full border border-hairline px-4 py-2 font-bold hover:bg-surface-low">
                Download a template
              </button>
            </div>
            <details className="text-sm text-ink-muted">
              <summary className="cursor-pointer font-semibold text-ink-900">How should the spreadsheet look?</summary>
              <p className="mt-2">
                The simplest sheet has no header: the question, four answers, then the letter of the right one (A to D). For more control, use the columns{' '}
                <code>{CSV_COLUMNS.join(', ')}</code>. Question types: multiple, truefalse, numeric (the <code>correct</code> cell is the number, optionally <code>366|1</code> for a margin) and text (accepted answers
                separated by <code>|</code>). Up to {CUSTOM_MAX_QUESTIONS} questions. Maths goes between dollar signs, like <code>$x^2$</code>.
              </p>
            </details>

            {parsed && parsed.problems.length > 0 && (
              <ul role="alert" className="flex flex-col gap-1 rounded-2xl bg-red-600/10 p-3 text-sm font-semibold text-red-600">
                {parsed.problems.slice(0, 8).map((p, i) => <li key={i}>Row {p.line}: {p.message}</li>)}
                {parsed.problems.length > 8 && <li>…and {parsed.problems.length - 8} more.</li>}
              </ul>
            )}
            {error && <p role="alert" className="rounded-2xl bg-red-600/12 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>}
          </section>

          {parsed && parsed.good.length > 0 && (
            <section aria-label="Preview" className="flex flex-col gap-2">
              <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-ink-muted">{parsed.good.length} question{parsed.good.length === 1 ? '' : 's'} ready</h2>
              <ol className="flex flex-col gap-2">
                {parsed.good.slice(0, 5).map((q, i) => (
                  <li key={i} className="rounded-2xl border border-hairline bg-surface p-3">
                    <p className="font-semibold"><span className="text-ink-muted">{i + 1}.</span> <MathText>{q.text}</MathText></p>
                    <p className="text-sm text-ink-muted">{TYPE_LABEL[q.type]} · answer: <span className="font-bold text-green-600"><MathText>{answerOf(q)}</MathText></span></p>
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
            className="min-h-14 rounded-2xl bg-orange-500 px-6 text-xl font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Making your quiz…' : 'Make my quiz'}
          </button>

          <form
            className="flex items-center gap-2 rounded-3xl border border-hairline bg-surface p-4 shadow-md"
            onSubmit={(e) => {
              e.preventDefault()
              if (code.length === 6) navigate(`/set/${code}`)
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="Got a quiz code?"
              aria-label="Quiz code"
              autoCapitalize="characters"
              autoComplete="off"
              className="min-h-14 min-w-0 flex-1 rounded-2xl border-2 border-hairline bg-paper px-4 text-lg font-bold uppercase tracking-[0.2em] text-ink-900 focus:border-orange-500 focus:outline-none"
            />
            <button type="submit" disabled={code.length !== 6} className="min-h-14 rounded-2xl bg-orange-500 px-6 text-xl font-bold text-white disabled:opacity-50">Open</button>
          </form>

          {mine.length > 0 && (
            <section aria-label="Your quizzes" className="flex flex-col gap-2">
              <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-ink-muted">Quizzes you made on this device</h2>
              <ul className="flex flex-col gap-2">
                {mine.map((s) => (
                  <li key={s.code}>
                    <Link to={`/set/${s.code}`} className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface p-3 no-underline">
                      <span className="min-w-0 truncate font-semibold text-ink-900">{s.title}</span>
                      <span className="font-mono text-sm font-bold tracking-[0.15em] text-orange-500">{s.code}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
      </div>
    </QuizThemeScope>
  )
}
