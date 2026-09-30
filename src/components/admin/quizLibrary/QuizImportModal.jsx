import { useMemo, useRef, useState } from 'react'
import { questionsFromCsv, describeCorrect, CSV_COLUMNS, CSV_MAX_BYTES } from '../../../data/quizCsv'
import { QUESTION_TYPE_INFO } from '../../../data/quiz'
import Button from '../../ui/Button'
import FormField from '../../ui/FormField'
import QuizModal from './QuizModal'

const SAMPLE = `${CSV_COLUMNS.join(',')}
multiple,Which course covers eigenvalues?,MTH 204,STA 201,CSC 211,,A,20,1000
truefalse,Zero is an even number,,,,,True,10,500
numeric,What is pi to two decimal places?,,,,,3.14|0.01,30,1000
text,Who wrote the first computer program?,,,,,Ada Lovelace|Lovelace,30,1000`

// Import questions from a spreadsheet file or from text pasted out of Excel or Google Sheets. Nothing is saved
// until the preview looks right and the person confirms.
export default function QuizImportModal({ mode, busy, onImport, onClose }) {
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [fileError, setFileError] = useState('')
  const fileRef = useRef(null)
  const parsed = useMemo(() => (text.trim() ? questionsFromCsv(text) : null), [text])
  const creating = mode === 'new'
  const ready = parsed && parsed.questions.length > 0 && (!creating || title.trim())

  async function onFile(file) {
    setFileError('')
    if (!file) return
    if (file.size > CSV_MAX_BYTES) {
      setFileError('That file is too big (1 MB at most).')
      return
    }
    setText(await file.text())
    if (creating && !title) setTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 120))
  }

  return (
    <QuizModal label={creating ? 'Import a quiz from a spreadsheet' : 'Import questions'} onClose={onClose} wide>
      <p className="text-sm text-ink-muted">
        Choose a CSV file, or paste rows copied from Excel or Google Sheets. Columns: <code>{CSV_COLUMNS.join(', ')}</code>. A plain list of
        question, four answers and a correct letter also works.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>Choose a file</Button>
        <Button variant="ghost" size="sm" onClick={() => setText(SAMPLE)}>Use an example</Button>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" aria-label="Choose a spreadsheet file" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {fileError && <p role="alert" className="text-sm text-danger">{fileError}</p>}
      <FormField label="Or paste here" type="textarea" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste rows from your spreadsheet" />
      {creating && <FormField label="Quiz title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Freshers' week quiz" />}

      {parsed && (
        <div className="flex flex-col gap-3">
          {parsed.questions.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-md border border-hairline">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface-low text-xs uppercase tracking-[.05em] text-ink-muted">
                  <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Question</th><th className="px-3 py-2">Correct</th></tr>
                </thead>
                <tbody>
                  {parsed.questions.map((q, i) => (
                    <tr key={q.id} className="border-t border-hairline">
                      <td className="px-3 py-2 text-ink-muted">{i + 1}</td>
                      <td className="px-3 py-2">{QUESTION_TYPE_INFO[q.type].label}</td>
                      <td className="max-w-xs truncate px-3 py-2">{q.text}</td>
                      <td className="max-w-[10rem] truncate px-3 py-2">{describeCorrect(q)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {parsed.problems.length > 0 && (
            <div role="status" className="rounded-md bg-orange-500/10 p-3 text-sm text-ink-900">
              <p className="font-semibold">{parsed.problems.length} row{parsed.problems.length === 1 ? '' : 's'} will be skipped:</p>
              <ul className="mt-1 max-h-32 list-disc overflow-auto pl-5">
                {parsed.problems.map((p, i) => <li key={i}>Line {p.line}: {p.message}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <Button variant="accent" disabled={!ready} loading={busy} onClick={() => onImport({ title: title.trim(), questions: parsed.questions })}>
        {parsed && parsed.questions.length > 0 ? `Import ${parsed.questions.length} question${parsed.questions.length === 1 ? '' : 's'}` : 'Import'}
      </Button>
    </QuizModal>
  )
}
