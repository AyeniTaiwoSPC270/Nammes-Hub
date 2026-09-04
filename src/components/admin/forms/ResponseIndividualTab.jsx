import { useState } from 'react'
import Button from '../../ui/Button'
import { formatAnswerForDisplay } from '../../../data/formResponses'

export default function ResponseIndividualTab({ questions, responses }) {
  const [index, setIndex] = useState(0)
  const response = responses[index]
  if (!response) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-muted">
          Response {index + 1} of {responses.length} · {new Date(response.submitted_at).toLocaleString()}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
            Previous
          </Button>
          <Button variant="secondary" size="sm" disabled={index === responses.length - 1} onClick={() => setIndex((i) => i + 1)}>
            Next
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5">
        {questions.map((q) => (
          <div key={q.id}>
            <div className="text-sm font-semibold text-ink-900">{q.label}</div>
            <div className="text-sm text-ink-muted">{formatAnswerForDisplay(q, response.answers?.[q.id])}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
