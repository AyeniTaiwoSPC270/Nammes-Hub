import { buildResponseSummary } from '../../../data/formResponses'

export default function ResponseSummaryTab({ questions, responses }) {
  const summary = buildResponseSummary(questions, responses)

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-muted">
        {responses.length} response{responses.length === 1 ? '' : 's'}
      </p>
      {summary.map(({ question, kind, counts, answers }) => (
        <div key={question.id} className="rounded-lg border border-hairline bg-surface p-5 shadow-sm">
          <h3 className="text-base font-semibold text-ink-900">{question.label}</h3>

          {kind === 'choice' ? (
            counts.every((c) => c.count === 0) ? (
              <p className="mt-4 text-sm text-ink-muted">No answers yet.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2.5">
                {(() => {
                  const max = Math.max(...counts.map((c) => c.count), 1)
                  return counts.map(({ option, count }) => (
                    <div key={option} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-sm text-ink" title={option}>{option}</span>
                      <div className="h-2.5 flex-1 rounded-full bg-hairline">
                        <div className="h-2.5 rounded-full bg-green-700" style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                      <span className="w-6 shrink-0 text-right font-mono text-xs text-ink-muted">{count}</span>
                    </div>
                  ))
                })()}
              </div>
            )
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-xs text-ink-muted">{answers.length} answer{answers.length === 1 ? '' : 's'}</p>
              {answers.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md bg-surface-low p-3">
                  {answers.map((a, i) => (
                    <p key={i} className="border-b border-hairline py-1.5 text-sm text-ink last:border-0">{a}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
