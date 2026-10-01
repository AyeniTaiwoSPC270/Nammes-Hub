import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../../lib/ToastContext'
import Button from '../../ui/Button'
import Toggle from '../../ui/Toggle'
import Badge from '../../ui/Badge'
import ErrorState from '../../ui/ErrorState'
import MathText from '../../quiz/MathText'
import { CBT_COLUMNS, CSV_MAX_BYTES } from '../../../data/quizCsv'
import { downloadTextFile, fileSlug } from '../../../lib/downloadFile'
import { formatDuration } from '../../../data/cbt'
import { fetchBank, fetchStats, updateExam, deleteExam, importBank, deleteBankQuestion, bankFromText, bankToCsv, BANK_MAX } from '../../../data/cbtAdmin'

// Everything for one exam: its settings, its question bank (import, export, remove), how students are doing, and its link.

const TYPE_LABEL = { multiple: 'Multiple choice', truefalse: 'True/false', numeric: 'Number', text: 'Typed' }
const input = 'min-h-11 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-base text-ink-900 focus:border-brand focus:outline-none'
const label = 'flex flex-col gap-1 text-sm font-semibold text-ink-900'

function formFrom(exam) {
  return {
    title: exam.title,
    session_label: exam.session_label ?? '',
    mode: exam.mode,
    draw_count: exam.draw_count ?? '',
    duration_minutes: exam.duration_minutes,
    pass_mark_percent: exam.pass_mark_percent,
    shuffle_questions: exam.shuffle_questions,
    shuffle_options: exam.shuffle_options,
    show_explanations: exam.show_explanations,
    allow_study_mode: exam.allow_study_mode,
    published: exam.published,
  }
}

function Settings({ exam, bankSize, onDeleted }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() => formFrom(exam))
  const [asking, setAsking] = useState(false)
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const save = useMutation({
    mutationFn: () => updateExam(exam.id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cbt_exams'] })
      toast.success('Exam saved.')
    },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: () => deleteExam(exam.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cbt_exams'] })
      toast.success('Exam deleted.')
      onDeleted()
    },
    onError: (e) => toast.error(e.message),
  })
  const link = `${window.location.origin}/cbt/${exam.code}`
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // the link is shown on the page to copy by hand
    }
  }
  const perAttempt = form.mode === 'fixed' || String(form.draw_count).trim() === '' ? bankSize : Math.min(Number(form.draw_count) || bankSize, bankSize)

  return (
    <section aria-label="Settings" className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>Title<input className={input} value={form.title} maxLength={120} onChange={(e) => set('title')(e.target.value)} /></label>
        <label className={label}>Session (optional)<input className={input} value={form.session_label} maxLength={40} placeholder="e.g. 2024/25 first semester" onChange={(e) => set('session_label')(e.target.value)} /></label>
        <label className={label}>
          How the paper is made
          <select className={input} value={form.mode} onChange={(e) => set('mode')(e.target.value)}>
            <option value="bank">Random draw from the bank (a different paper each attempt)</option>
            <option value="fixed">Fixed paper (every question, every attempt)</option>
          </select>
        </label>
        {form.mode === 'bank' && (
          <label className={label}>Questions per attempt<input className={input} inputMode="numeric" value={form.draw_count} placeholder={`All ${bankSize}`} onChange={(e) => set('draw_count')(e.target.value.replace(/\D/g, '').slice(0, 3))} /></label>
        )}
        <label className={label}>Time allowed (minutes)<input className={input} inputMode="numeric" value={form.duration_minutes} onChange={(e) => set('duration_minutes')(e.target.value.replace(/\D/g, '').slice(0, 3))} /></label>
        <label className={label}>Pass mark (%)<input className={input} inputMode="numeric" value={form.pass_mark_percent} onChange={(e) => set('pass_mark_percent')(e.target.value.replace(/\D/g, '').slice(0, 3))} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle checked={form.shuffle_questions} onChange={set('shuffle_questions')} label="Shuffle the questions" />
        <Toggle checked={form.shuffle_options} onChange={set('shuffle_options')} label="Shuffle the answers" description="Questions like “All of the above” are never shuffled." />
        <Toggle checked={form.show_explanations} onChange={set('show_explanations')} label="Show explanations in the review" />
        <Toggle checked={form.allow_study_mode} onChange={set('allow_study_mode')} label="Allow study mode (no timer)" />
      </div>
      <p className="text-sm text-ink-muted">Each attempt will have {perAttempt} question{perAttempt === 1 ? '' : 's'}.</p>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-surface-low p-4">
        <Toggle checked={form.published} onChange={set('published')} label="Published" description="Students can find and take it only when this is on." />
        <span className="flex-1" />
        {form.published && bankSize === 0 && <span className="text-sm font-semibold text-danger">Add questions first. An empty exam is hidden.</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="accent" loading={save.isPending} onClick={() => save.mutate()}>Save settings</Button>
        <span className="text-sm text-ink-muted">Link: <code className="break-all">{link}</code> <button type="button" onClick={copy} className="ml-1 font-semibold text-brand-orange underline">{copied ? 'Copied' : 'Copy'}</button></span>
        <span className="flex-1" />
        {asking ? (
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            Delete this exam, its questions and its attempts?
            <Button variant="destructive" size="sm" loading={remove.isPending} onClick={() => remove.mutate()}>Yes, delete</Button>
            <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>Keep it</Button>
          </span>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setAsking(true)}>Delete exam</Button>
        )}
      </div>
    </section>
  )
}

function Bank({ exam, bank, refetch }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [replace, setReplace] = useState(false)
  const [show, setShow] = useState(false)
  const [asking, setAsking] = useState(false)
  const parsed = useMemo(() => (text.trim() ? bankFromText(text) : null), [text])
  const ready = parsed && parsed.problems.length === 0 && parsed.rows.length > 0

  const run = useMutation({
    mutationFn: () => importBank(exam.quiz_id, parsed.rows, { replace, existing: bank }),
    onSuccess: () => {
      toast.success(replace ? 'Question bank replaced.' : `${parsed.rows.length} questions added.`)
      setText('')
      setAsking(false)
      refetch()
    },
    onError: (e) => toast.error(e.message),
  })
  const del = useMutation({
    mutationFn: deleteBankQuestion,
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  })

  async function readFile(file) {
    if (!file) return
    if (file.size > CSV_MAX_BYTES) {
      toast.error('That file is too big.')
      return
    }
    setText(await file.text())
  }

  return (
    <section aria-label="Question bank" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-ink-900">Question bank <span className="font-normal text-ink-muted">({bank.length} of {BANK_MAX})</span></h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={bank.length === 0} onClick={() => downloadTextFile(`${fileSlug(exam.title, 'cbt-exam')}-bank.csv`, bankToCsv(bank))}>Download as spreadsheet</Button>
          <Button variant="ghost" size="sm" disabled={bank.length === 0} onClick={() => setShow((s) => !s)}>{show ? 'Hide questions' : 'Show questions'}</Button>
        </div>
      </div>

      {show && (
        <ol className="max-h-96 divide-y divide-hairline overflow-y-auto rounded-xl border border-hairline">
          {bank.map((q, i) => (
            <li key={q.id} className="flex items-start gap-3 px-3 py-2 text-sm">
              <span className="w-8 shrink-0 text-ink-muted">{i + 1}.</span>
              <span className="min-w-0 flex-1">
                <span className="block text-ink-900"><MathText>{q.text}</MathText></span>
                <span className="text-xs text-ink-muted">{TYPE_LABEL[q.type] ?? q.type}{q.topic ? ` · ${q.topic}` : ''}{q.explanation ? ' · has explanation' : ''}</span>
              </span>
              <button type="button" onClick={() => del.mutate(q.id)} className="shrink-0 text-xs font-semibold text-danger underline">Remove</button>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-low p-4">
        <p className="text-sm font-semibold text-ink-900">Add questions from a spreadsheet</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={'Paste rows from Excel or Google Sheets, with the header row.\n' + CBT_COLUMNS.join(', ')}
          className={`${input} font-mono text-sm`}
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="cursor-pointer rounded-md border border-hairline bg-surface px-4 py-2 font-bold">
            Upload a CSV
            <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => readFile(e.target.files?.[0])} />
          </label>
          <Toggle checked={replace} onChange={setReplace} label="Replace the whole bank" description="Off adds to the questions already here." />
        </div>
        <p className="text-xs text-ink-muted">
          Columns: {CBT_COLUMNS.join(', ')}. <code>correct</code> is A to D for multiple choice, True or False, the number (optionally <code>366|1</code> for a margin), or accepted answers separated by <code>|</code>.
          <code> explanation</code> shows in the student&apos;s review; <code>topic</code> is for your stats; <code>no_shuffle</code> = yes keeps that question&apos;s answers in order. Maths goes between dollar signs, like <code>$x^2$</code>. Typed answers are limited to 40 characters.
        </p>
        {parsed && parsed.problems.length > 0 && (
          <ul role="alert" className="flex flex-col gap-1 rounded-md bg-danger-bg p-3 text-sm font-semibold text-danger">
            {parsed.problems.slice(0, 10).map((p, i) => <li key={i}>Row {p.line}: {p.message}</li>)}
            {parsed.problems.length > 10 && <li>…and {parsed.problems.length - 10} more.</li>}
          </ul>
        )}
        {ready && <p className="text-sm font-semibold text-success">{parsed.rows.length} questions ready to {replace ? 'replace the bank' : 'add'}.</p>}
        {asking ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md bg-danger-bg p-3 text-sm font-semibold text-danger">
            This removes the current {bank.length} questions. Students in the middle of an exam will be asked to start again.
            <Button variant="destructive" size="sm" loading={run.isPending} onClick={() => run.mutate()}>Replace the bank</Button>
            <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="accent" disabled={!ready} loading={run.isPending} onClick={() => (replace && bank.length > 0 ? setAsking(true) : run.mutate())}>
            {replace ? 'Replace bank with these' : 'Add these questions'}
          </Button>
        )}
      </div>
    </section>
  )
}

function Stats({ exam }) {
  const stats = useQuery({ queryKey: ['cbt_stats', exam.id], queryFn: () => fetchStats(exam.id) })
  if (stats.isError) return <ErrorState message="Couldn't load the stats." onRetry={stats.refetch} />
  if (stats.isLoading) return <p className="text-ink-muted">Loading stats…</p>
  const s = stats.data
  const cells = [
    ['Attempts', s.attempts],
    ['Average score', `${s.average_percent}%`],
    ['Pass rate', `${s.pass_rate}%`],
    ['Average time', s.attempts ? formatDuration(s.average_seconds) : '—'],
  ]
  return (
    <section aria-label="Stats" className="flex flex-col gap-3">
      <h3 className="text-lg font-bold text-ink-900">How students are doing</h3>
      <p className="text-sm text-ink-muted">Counts timed (exam mode) attempts that were submitted. Study sessions are left out.</p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cells.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-hairline bg-surface px-4 py-3">
            <dt className="text-xs font-bold uppercase tracking-[.05em] text-ink-muted">{k}</dt>
            <dd className="text-2xl font-bold text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>
      {s.questions.length > 0 && (
        <div>
          <h4 className="mb-1 font-bold text-ink-900">Most missed questions</h4>
          <p className="mb-2 text-sm text-ink-muted">A question almost everyone misses may have a wrong key or be unclear. Check these first.</p>
          <ol className="divide-y divide-hairline rounded-xl border border-hairline">
            {s.questions.slice(0, 15).map((q) => (
              <li key={q.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0"><MathText>{q.text}</MathText>{q.topic && <span className="ml-2 text-xs text-ink-muted">{q.topic}</span>}</span>
                <span className="shrink-0 text-right"><strong className={q.miss_percent >= 70 ? 'text-danger' : 'text-ink-900'}>{q.miss_percent}% missed</strong><span className="block text-xs text-ink-muted">{q.seen} attempts</span></span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

export default function ExamEditor({ exam, onDeleted }) {
  const bankQuery = useQuery({ queryKey: ['cbt_bank', exam.quiz_id], queryFn: () => fetchBank(exam.quiz_id) })
  if (bankQuery.isError) return <ErrorState message="Couldn't load this exam." onRetry={bankQuery.refetch} />
  if (bankQuery.isLoading) return <p className="text-ink-muted">Loading…</p>
  const bank = bankQuery.data.filter((q) => q.type !== 'poll')
  return (
    <div className="flex flex-col gap-8 border-t border-hairline pt-5">
      <Settings exam={exam} bankSize={bank.length} onDeleted={onDeleted} />
      <Bank exam={exam} bank={bank} refetch={bankQuery.refetch} />
      <Stats exam={exam} />
      <p className="text-xs text-ink-muted">
        {exam.published ? <Badge tone="updated">Published</Badge> : <Badge tone="neutral">Draft</Badge>} Code {exam.code}
      </p>
    </div>
  )
}
