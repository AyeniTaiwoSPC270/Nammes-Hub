import { useRef, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { OPTION_STYLES, TIME_LIMIT_CHOICES, POINT_CHOICES, QUESTION_TYPE_INFO, blankQuestion } from '../../../data/quiz'
import { IMAGE_BUCKET, IMAGE_ALT_MAX } from '../../../../api/_lib/quizImage.js'
import { EXPLANATION_MAX, letterboxRect, toNormalized, ORDER_STEPS_MAX, DIAGRAM_TARGETS_MAX } from '../../../../api/_lib/quizGrading.js'
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

// Marks the correct regions on a picture, and captures the picture's own shape with each one.
//
// `ar` is not decoration. A normalised circle only exists if you know whether the picture is wider than it is tall,
// and this is the only moment the real width and height are both known: the server grades the tap and never opens the
// image. Without it every region on a landscape diagram is accepted twice as far across as it is drawn.
function DiagramRegions({ question, onChange }) {
  const wrapRef = useRef(null)
  const [natural, setNatural] = useState({ width: 0, height: 0 })
  const [box, setBox] = useState({ width: 0, height: 0 })
  const targets = question.diagram_targets ?? []
  const url = imageUrl(question)

  function place(event) {
    if (!natural.width || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const mapped = toNormalized(point, letterboxRect({ width: rect.width, height: rect.height }, natural), natural)
    // The grey bar beside the picture is not part of the picture, so a click there places nothing.
    if (mapped.x < 0 || mapped.x > 1 || mapped.y < 0 || mapped.y > 1) return
    if (targets.length >= DIAGRAM_TARGETS_MAX) return
    onChange({ ...question, diagram_targets: [...targets, { x: mapped.x, y: mapped.y, r: 0.12, ar: natural.width / natural.height }] })
  }

  function resize(index, r) {
    onChange({ ...question, diagram_targets: targets.map((t, i) => (i === index ? { ...t, r } : t)) })
  }

  const rect = natural.width ? letterboxRect(box, natural) : null
  const w = box.width || 1
  const h = box.height || 1

  if (!url) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-hairline p-4 text-sm text-ink-muted">
        Upload a picture first. A diagram question is answered by tapping a region of it, so there is nothing to mark
        until there is a picture to mark on.
      </p>
    )
  }

  return (
    <div className="mt-4">
      <div
        ref={wrapRef}
        onClick={place}
        className="relative mx-auto flex h-72 max-w-lg cursor-crosshair items-center justify-center rounded-lg border border-hairline bg-surface-low"
      >
        <img
          src={url}
          alt=""
          onLoad={(e) => {
            setNatural({ width: e.target.naturalWidth, height: e.target.naturalHeight })
            const el = wrapRef.current
            if (el) setBox({ width: el.clientWidth, height: el.clientHeight })
          }}
          className="max-h-72 w-auto max-w-full rounded-lg object-contain"
        />
        {rect && targets.map((t, i) => {
          const diameter = 2 * t.r * Math.min(rect.width, rect.height)
          return (
            <span
              key={i}
              aria-hidden="true"
              className="pointer-events-none absolute rounded-full border-2 border-green-600"
              style={{
                left: `${((rect.left + t.x * rect.width) / w) * 100}%`,
                top: `${((rect.top + t.y * rect.height) / h) * 100}%`,
                width: `${(diameter / w) * 100}%`,
                height: `${(diameter / h) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )
        })}
      </div>

      <p className="mt-2 text-center text-xs text-ink-muted">
        Click each region a tap should count as correct. Any one of them is enough. {targets.length} of {DIAGRAM_TARGETS_MAX}.
      </p>

      {targets.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {targets.map((t, i) => (
            <li key={i} className="flex items-center gap-3 rounded-md border border-hairline p-2">
              <span className="font-semibold text-ink-900">Region {i + 1}</span>
              <label className="flex flex-1 items-center gap-2 text-xs text-ink-muted">
                Size
                <input
                  type="range"
                  min="0.05"
                  max="0.4"
                  step="0.01"
                  value={t.r}
                  onChange={(e) => resize(i, Number(e.target.value))}
                  className="flex-1"
                  aria-label={`Size of region ${i + 1}`}
                />
              </label>
              <button
                type="button"
                onClick={() => onChange({ ...question, diagram_targets: targets.filter((_, k) => k !== i) })}
                className="shrink-0 text-xs font-bold text-danger"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// An ordering question's answer is the order the steps were typed in, so the editor numbers them and says so. The
// shuffle happens per game on the frozen draw, not here: the authored order is the answer and has to stay readable.
function OrderSteps({ question, onChange }) {
  const steps = question.options ?? []
  function setStep(index, value) {
    const options = [...steps]
    options[index] = value
    onChange({ ...question, options })
  }

  return (
    <div className="mt-4">
      <ol className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-orange-500 text-sm font-bold text-white">
              {i + 1}
            </span>
            <input
              type="text"
              value={step}
              maxLength={100}
              onChange={(e) => setStep(i, e.target.value)}
              placeholder={`Step ${i + 1}`}
              aria-label={`Step ${i + 1}`}
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={() => onChange({ ...question, options: steps.filter((_, k) => k !== i) })}
              className="shrink-0 text-xs font-bold text-ink-muted"
              aria-label={`Remove step ${i + 1}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-1 text-xs text-ink-muted">
        This order is the answer. Players are shown these steps shuffled and put them back in this sequence.
      </p>
      {steps.length < ORDER_STEPS_MAX && (
        <button
          type="button"
          onClick={() => onChange({ ...question, options: [...steps, ''] })}
          className="mt-2 rounded-md border border-hairline px-3 py-2 text-sm font-semibold text-ink-900"
        >
          Add a step
        </button>
      )}
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
        <FormField
          label="Unit (optional)"
          value={question.numeric_unit ?? ''}
          onChange={(e) => onChange({ ...question, numeric_unit: e.target.value })}
          placeholder="kN"
          maxLength={12}
        />
        <div className="sm:col-span-2">
          <FormField
            label="Other spellings of that unit (one per line, optional)"
            type="textarea"
            rows={2}
            value={question.numeric_unit_aliases ?? ''}
            onChange={(e) => onChange({ ...question, numeric_unit_aliases: e.target.value })}
            placeholder={'kiloNewton\nkilonewton'}
          />
        </div>
        <p className="text-xs text-ink-muted sm:col-span-2">
          The player types just the number. Spelling, spacing and case in the unit do not matter &mdash; but the prefix does, so
          a question answered in kN is never accepted for an answer of N. Leave the unit empty for a plain number question.
        </p>
      </div>
    )
  }

  if (type === 'order') return <OrderSteps question={question} onChange={onChange} />
  if (type === 'diagram') return <DiagramRegions question={question} onChange={onChange} />

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
      {type === 'multiple' && (
        <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={question.no_shuffle === true}
            onChange={(e) => onChange({ ...question, no_shuffle: e.target.checked })}
          />
          <span>
            <span className="block font-semibold text-ink-900">Keep these answers in this order</span>
            <span className="block text-xs text-ink-muted">
              Use this when an answer only makes sense in place, like &ldquo;All of the above&rdquo;. Questions like that are spotted
              automatically, so you only need this for the ones that are missed.
            </span>
          </span>
        </label>
      )}
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
      difficulty: question.difficulty,
      image_path: question.image_path,
      image_alt: question.image_alt,
      imageBlob: question.imageBlob,
      imageExt: question.imageExt,
      imagePreview: question.imagePreview,
      removeImage: question.removeImage,
      // The explanation belongs to the question, not to the answer format, so changing from number to multiple
      // choice must not throw away why the answer was right.
      explanation: question.explanation,
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

      {/* Not inside the picture block: most explanations explain a calculation or a definition, not a diagram. */}
      <FormField
        label={`Explanation shown on the reveal (${(question.explanation ?? '').length}/${EXPLANATION_MAX})`}
        type="textarea"
        rows={2}
        maxLength={EXPLANATION_MAX}
        value={question.explanation ?? ''}
        onChange={(e) => onChange({ ...question, explanation: e.target.value })}
        placeholder="Why this is the right answer, in a sentence or two."
      />

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
            <label className={labelClass}>
              Difficulty
              <select className={selectClass} value={question.difficulty ?? ''} onChange={(e) => onChange({ ...question, difficulty: e.target.value || null })}>
                <option value="">Not set (from points)</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
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
