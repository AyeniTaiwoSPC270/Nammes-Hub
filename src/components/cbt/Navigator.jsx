import { questionState } from '../../data/cbt'

// The question grid: tap a number to jump there. Answered, flagged and current questions look different (and are not
// told apart by colour alone: flagged ones carry a small flag mark).
export default function Navigator({ questions, answers, flagged, current, onGo, feedback }) {
  return (
    <nav aria-label="Questions" className="flex flex-col gap-3">
      <ol className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-5">
        {questions.map((q, i) => {
          const { answered, flagged: isFlagged } = questionState(q, answers, flagged)
          const fb = feedback?.[q.id]
          const tone = fb
            ? fb.correct
              ? 'border-green-600 bg-green-600/15 text-green-700'
              : 'border-red-600 bg-red-600/15 text-red-600'
            : answered
              ? 'border-orange-500 bg-orange-500 text-white'
              : 'border-hairline bg-surface text-ink-900'
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => onGo(i)}
                aria-current={i === current ? 'true' : undefined}
                aria-label={`Question ${i + 1}${answered ? ', answered' : ', not answered'}${isFlagged ? ', flagged' : ''}`}
                className={`relative flex h-11 w-full items-center justify-center rounded-lg border-2 text-sm font-bold ${tone} ${i === current ? 'ring-2 ring-ink-900 ring-offset-2 ring-offset-paper' : ''}`}
              >
                {i + 1}
                {isFlagged && <span className="material-symbols-outlined absolute -right-1 -top-1 rounded-full bg-paper text-[16px] leading-none text-amber-600" aria-hidden="true">flag</span>}
              </button>
            </li>
          )
        })}
      </ol>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-orange-500 bg-orange-500" /> Answered</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-hairline bg-surface" /> Not answered</li>
        <li className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px] text-amber-600" aria-hidden="true">flag</span> Flagged</li>
      </ul>
    </nav>
  )
}
