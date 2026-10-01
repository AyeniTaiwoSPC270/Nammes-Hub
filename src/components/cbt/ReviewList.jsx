import { useState } from 'react'
import MathText from '../quiz/MathText'

// After submitting: every question with the student's answer next to the right one. Filter by what you want to revisit.
const FILTERS = [
  ['all', 'All'],
  ['wrong', 'Wrong'],
  ['unanswered', 'Unanswered'],
  ['flagged', 'Flagged'],
]

function pass(item, filter) {
  if (filter === 'wrong') return item.answered && !item.correct
  if (filter === 'unanswered') return !item.answered
  if (filter === 'flagged') return item.flagged
  return true
}

export default function ReviewList({ review }) {
  const [filter, setFilter] = useState('all')
  const shown = review.map((item, i) => ({ item, n: i + 1 })).filter(({ item }) => pass(item, filter))
  const count = (f) => review.filter((r) => pass(r, f)).length

  return (
    <section aria-label="Review" className="flex flex-col gap-3">
      <div role="tablist" aria-label="Filter the review" className="flex flex-wrap gap-2">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={`min-h-10 rounded-full border px-4 text-sm font-bold ${filter === id ? 'border-ink-900 bg-ink-900 text-paper' : 'border-hairline bg-surface text-ink-900'}`}
          >
            {label} ({count(id)})
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="rounded-xl border border-hairline bg-surface p-4 text-ink-muted">Nothing here.</p>}
      <ol className="flex flex-col gap-3">
        {shown.map(({ item, n }) => {
          const choice = item.type === 'multiple' || item.type === 'truefalse'
          return (
            <li key={item.id} className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                <span className="text-ink-muted">Question {n}</span>
                {!item.answered ? (
                  <span className="rounded-full bg-ink-muted/15 px-2.5 py-0.5 text-ink-muted">Unanswered</span>
                ) : item.correct ? (
                  <span className="rounded-full bg-green-600/15 px-2.5 py-0.5 text-green-700">Correct</span>
                ) : (
                  <span className="rounded-full bg-red-600/15 px-2.5 py-0.5 text-red-600">Wrong</span>
                )}
                {item.flagged && <span className="flex items-center gap-1 text-amber-700"><span className="material-symbols-outlined text-[18px]" aria-hidden="true">flag</span>Flagged</span>}
              </div>
              <p className="text-lg font-semibold"><MathText>{item.text}</MathText></p>
              {choice ? (
                <ul className="flex flex-col gap-2">
                  {item.options.map((option, i) => {
                    const right = i === item.correctIndex
                    const mine = i === item.chosen
                    const tone = right ? 'border-green-600 bg-green-600/10' : mine ? 'border-red-600 bg-red-600/10' : 'border-hairline'
                    return (
                      <li key={i} className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 ${tone}`}>
                        <span className="min-w-0 flex-1"><MathText>{option}</MathText></span>
                        {right && <span className="text-sm font-bold text-green-700">Correct answer</span>}
                        {mine && !right && <span className="text-sm font-bold text-red-600">Your answer</span>}
                        {mine && right && <span className="text-sm font-bold text-green-700">Your answer</span>}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="flex flex-col gap-1 text-lg">
                  <p>Your answer: <strong className={item.correct ? 'text-green-700' : 'text-red-600'}>{item.answered ? item.answerText : 'none'}</strong></p>
                  {!item.correct && <p>Correct answer: <strong className="text-green-700">{item.correctText}</strong></p>}
                </div>
              )}
              {item.explanation && (
                <p className="rounded-lg bg-surface-low p-3 text-ink-900"><span className="font-bold">Why: </span><MathText>{item.explanation}</MathText></p>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
