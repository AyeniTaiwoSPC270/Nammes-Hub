import { useRef, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { OPTION_STYLES, TIME_LIMIT_CHOICES, POINT_CHOICES, QUESTION_TYPE_INFO, blankQuestion } from '../../../data/quiz'
import { IMAGE_BUCKET, IMAGE_ALT_MAX } from '../../../../api/_lib/quizImage.js'
import { processQuizImage, checkImageFile } from '../../../lib/quizImage'
import { hasMath } from '../../../lib/mathText'
import MathText from '../../quiz/MathText'
import Button from '../../ui/Button'
import FormField from '../../ui/FormField'

const selectClass = 'min-h-11 rounded-md border border-hairline bg-surface px-3 py-2 text-base text-ink'
const inputClass = 'min-h-11 min-w-0 rounded-md border border-hairline bg-surface px-3 py-2 text-base text-ink'
const labelClass = 'flex flex-col gap-1 text-xs font-semibold uppercase tracking-[.05em] text-brand-orange'

function imageUrl(question) {
  if (question.imagePreview) return question.imagePreview
  if (question.image_path && !question.removeImage) return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(question.image_path).data.publicUrl
  return null
}

function ImagePicker({ question, onChange }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const url = imageUrl(question)

  async function take(file) {
    setProblem('')
    const bad = checkImageFile(file)
    if (bad) {
      setProblem(bad)
      return
    }
    setBusy(true)
    try {
      const { blob, ext } = await processQuizImage(file)
      onChange({ ...question, imageBlob: blob, imageExt: ext, imagePreview: URL.createObjectURL(blob), removeImage: false })
    } catch (e) {
      setProblem(e.message)
    } finally {
      setBusy(false)
    }
  }

  function remove() {
    onChange({ ...question, imageBlob: null, imageExt: null, imagePreview: null, removeImage: Boolean(question.image_path), image_alt: '' })
  }

  return (
    <div className="mt-4 rounded-lg border border-dashed border-hairline p-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        if (e.dataTransfer.files?.[0]) take(e.dataTransfer.files[0])
      }}
      onPaste={(e) => {
        const file = [...(e.clipboardData?.files ?? [])][0]
        if (file) take(file)
      }}
    >
      {url ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <img src={url} alt="" className="h-32 w-full rounded-md border border-hairline bg-surface-low object-contain sm:w-48" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <FormField
              label={`Describe the picture (${(question.image_alt ?? '').length}/${IMAGE_ALT_MAX})`}
              value={question.image_alt ?? ''}
              maxLength={IMAGE_ALT_MAX}
              onChange={(e) => onChange({ ...question, image_alt: e.target.value })}
              placeholder="A parabola opening upwards with its vertex at the origin"
            />
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} loading={busy}>Replace</Button>
              <Button variant="ghost" size="sm" onClick={remove}>Remove picture</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} loading={busy}>Add a picture</Button>
          <span className="text-xs text-ink-muted">JPG, PNG or WebP. Drag one here, or paste it. It is shrunk to fit phones.</span>
        </div>
      )}
      {problem && <p role="alert" className="mt-2 text-sm text-danger">{problem}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Choose a picture for this question"
        onChange={(e) => {
          if (e.target.files?.[0]) take(e.target.files[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

function Answers({ question, onChange }) {
  const type = question.type
  function setOption(index, value) {
    const options = [...question.options]
    options[index] = value
    onChange({ ...question, options })
  }

  if (type === 'truefalse') {
    return (
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {['True', 'False'].map((label, i) => (
          <label key={label} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-4 text-white ${OPTION_STYLES[i === 0 ? 1 : 0].bg}`}>
            <input type="radio" name={`correct-${question.id}`} checked={question.correct_index === i} onChange={() => onChange({ ...question, correct_index: i })} />
            <span className="font-bold">{label}</span>
            {question.correct_index === i && <span className="ml-auto text-sm">Correct answer</span>}
          </label>
        ))}
      </div>
    )
  }

  if (type === 'numeric') {
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <FormField label="Correct answer" value={question.numeric_answer} onChange={(e) => onChange({ ...question, numeric_answer: e.target.value })} placeholder="3.14  or  -2  or  1/2" />
        <FormField label="Allowed margin (plus or minus)" value={question.numeric_tolerance} onChange={(e) => onChange({ ...question, numeric_tolerance: e.target.value })} placeholder="0" />
        <p className="text-xs text-ink-muted sm:col-span-2">Put units in the question, not the answer. Players type just the number.</p>
      </div>
    )
  }

  if (type === 'text') {
    return (
      <div className="mt-4">
        <FormField
          label="Accepted answers (one per line)"
          type="textarea"
          rows={3}
          value={question.accepted_text}
          onChange={(e) => onChange({ ...question, accepted_text: e.target.value })}
          placeholder={'Ada Lovelace\nLovelace'}
        />
        <p className="mt-1 text-xs text-ink-muted">Capital letters, accents, punctuation and extra spaces are ignored when matching. Up to 8 answers.</p>
      </div>
    )
  }

  return (
    <>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {OPTION_STYLES.map((style, i) => (
          <div key={i} className="flex items-center gap-2">
            <label className="flex shrink-0 cursor-pointer items-center gap-1" title={type === 'poll' ? 'Answer colour' : 'Mark as the correct answer'}>
              {type !== 'poll' && (
                <input type="radio" name={`correct-${question.id}`} checked={question.correct_index === i} onChange={() => onChange({ ...question, correct_index: i })} />
              )}
              <span className={`flex h-9 w-9 items-center justify-center rounded-md text-white ${style.bg}`} aria-hidden="true">{style.shape}</span>
            </label>
            <input
              type="text"
              value={question.options[i]}
              maxLength={100}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={i < 2 ? `Answer ${i + 1}` : `Answer ${i + 1} (optional)`}
              aria-label={`Answer ${i + 1}`}
              className={`${inputClass} flex-1`}
            />
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {type === 'poll' ? 'A poll has no right answer. Leave a box empty for fewer than four.' : 'Tick the circle next to the correct answer. Leave a box empty for fewer than four answers.'}
      </p>
    </>
  )
}

export default function QuestionCard({ question, number, total, onChange, onMove, onRemove }) {
  const type = question.type ?? 'multiple'
  const scored = type !== 'poll'

  function changeType(next) {
    if (next === type) return
    const fresh = blankQuestion(next)
    // Keep what carries over (text, picture, timing); the answer fields start fresh for the new type.
    onChange({
      ...fresh,
      id: question.id,
      text: question.text,
      time_limit_seconds: question.time_limit_seconds,
      points: question.points,
      points_multiplier: question.points_multiplier,
      image_path: question.image_path,
      image_alt: question.image_alt,
      imageBlob: question.imageBlob,
      imageExt: question.imageExt,
      imagePreview: question.imagePreview,
      removeImage: question.removeImage,
      options: next === 'multiple' || next === 'poll' ? question.options.map((o) => (type === 'truefalse' ? '' : o)) : fresh.options,
    })
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface p-4 shadow-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-ink-900">Question {number}</span>
          <select className={selectClass} value={type} onChange={(e) => changeType(e.target.value)} aria-label={`Type of question ${number}`}>
            {Object.entries(QUESTION_TYPE_INFO).map(([key, info]) => <option key={key} value={key}>{info.label}</option>)}
          </select>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onMove(-1)} disabled={number === 1} aria-label="Move question up">↑</Button>
          <Button variant="ghost" size="sm" onClick={() => onMove(1)} disabled={number === total} aria-label="Move question down">↓</Button>
          <Button variant="destructive" size="sm" onClick={onRemove}>Remove</Button>
        </div>
      </div>
      <p className="mb-2 text-xs text-ink-muted">{QUESTION_TYPE_INFO[type].hint}</p>

      <FormField
        label="Question"
        type="textarea"
        rows={2}
        maxLength={300}
        value={question.text}
        onChange={(e) => onChange({ ...question, text: e.target.value })}
        placeholder="Which course covers eigenvalues?  (maths: $x^2 + 1$)"
      />
      {hasMath(question.text) && (
        <p className="mt-1 rounded-md bg-surface-low px-3 py-2 text-sm text-ink-900">
          <span className="mr-2 text-xs font-semibold uppercase tracking-[.05em] text-ink-muted">Preview</span>
          <MathText>{question.text}</MathText>
        </p>
      )}

      <ImagePicker question={question} onChange={onChange} />
      <Answers question={question} onChange={onChange} />

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className={labelClass}>
          Time limit
          <select className={selectClass} value={question.time_limit_seconds} onChange={(e) => onChange({ ...question, time_limit_seconds: Number(e.target.value) })}>
            {TIME_LIMIT_CHOICES.map((s) => <option key={s} value={s}>{s} seconds</option>)}
          </select>
        </label>
        {scored && (
          <>
            <label className={labelClass}>
              Points
              <select className={selectClass} value={question.points} onChange={(e) => onChange({ ...question, points: Number(e.target.value) })}>
                {POINT_CHOICES.map((p) => <option key={p} value={p}>{p}{p === 1000 ? ' (standard)' : p === 2000 ? ' (double)' : ''}</option>)}
              </select>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-ink-900">
              <input type="checkbox" checked={question.points_multiplier === 2} onChange={(e) => onChange({ ...question, points_multiplier: e.target.checked ? 2 : 1 })} />
              Double points round
            </label>
          </>
        )}
      </div>
    </div>
  )
}
