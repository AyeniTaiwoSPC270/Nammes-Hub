import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDuration, shareText } from '../../data/cbt'
import ReviewList from './ReviewList'

// The result screen: score, pass or fail, time used and the review.
export default function ResultView({ result, code }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/cbt/${code}`

  async function share() {
    const text = shareText({ title: result.title, courseCode: result.courseCode, score: result.score, total: result.total, percent: result.percent, url })
    try {
      if (navigator.share) {
        await navigator.share({ text })
        return
      }
    } catch {
      // cancelled: fall through to copying
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // nothing to do
    }
  }

  const study = result.mode === 'study'
  const answered = result.review.filter((r) => r.answered).length
  return (
    <>
      <section aria-label="Your result" className="flex flex-col items-center gap-3 rounded-2xl border border-hairline bg-surface p-6 text-center shadow-sm sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-ink-muted">{study ? 'Study session finished' : 'Exam submitted'}</p>
        <p className="text-6xl font-bold tabular-nums text-ink-900">{result.score}<span className="text-3xl text-ink-muted"> / {result.total}</span></p>
        <p className="text-2xl font-semibold text-ink-900">{result.percent}%</p>
        {!study && (
          <p className={`rounded-full px-4 py-1.5 text-lg font-bold ${result.passed ? 'bg-green-600/15 text-green-700' : 'bg-red-600/15 text-red-600'}`}>
            {result.passed ? 'Passed' : 'Not passed'} <span className="font-semibold">(pass mark {result.passMarkPercent}%)</span>
          </p>
        )}
        <p className="text-sm text-ink-muted">
          {answered} of {result.total} answered{!study && <> · time used {formatDuration(result.secondsUsed)}</>}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link to={`/cbt/${code}`} className="flex min-h-12 items-center rounded-xl bg-orange-500 px-6 font-bold text-white no-underline">Retake</Link>
          <Link to="/cbt" className="flex min-h-12 items-center rounded-xl border-2 border-hairline px-6 font-bold text-ink-900 no-underline">All exams</Link>
          <button type="button" onClick={share} className="min-h-12 rounded-xl border-2 border-hairline px-6 font-bold text-ink-900">{copied ? 'Copied!' : 'Share result'}</button>
        </div>
        <p className="max-w-md text-xs text-ink-muted">Your score is saved on this device. This review stays available for 24 hours.</p>
      </section>
      <ReviewList review={result.review} />
    </>
  )
}
