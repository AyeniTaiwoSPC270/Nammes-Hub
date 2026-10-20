import { useRef, useState } from 'react'
import Button from '../ui/Button'

// The one stable URL the feed lives at. Every action below derives from it, so a download cannot drift onto a
// second endpoint that serves a different calendar.
export const CALENDAR_FEED_PATH = '/api/calendar-ics'

const webcalUrl = (url) => url.replace(/^https:/, 'webcal:')

// A panel rather than a route: the point is to get the URL into a calendar app, and a page of its own would make a
// student navigate away from the calendar they were reading.
export default function CalendarSubscribe() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef(null)

  // The feed URL is absolute for a calendar app, which is a different program from this tab; `webcal:` is the same
  // address under the scheme iOS and macOS register for subscriptions.
  const url = `${window.location.origin}${CALENDAR_FEED_PATH}`

  async function copy(value, which) {
    setError('')
    try {
      await navigator.clipboard.writeText(value)
      setCopied(which)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(null), 2000)
    } catch {
      // Clipboard access is refused on some browsers outside a secure context. Selecting the visible URL still works.
      setError('Could not copy. Select the link and copy it yourself.')
    }
  }

  async function download() {
    setError('')
    setDownloading(true)
    try {
      const response = await fetch(CALENDAR_FEED_PATH)
      if (!response.ok) throw new Error('The feed did not answer.')
      // Built from the same endpoint rather than a second URL with an attachment header: one source of truth, and
      // no extra Vercel function.
      const blob = new Blob([await response.text()], { type: 'text/calendar;charset=utf-8' })
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = 'nammes-calendar.ics'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(href)
    } catch {
      setError("Couldn't download the calendar right now.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="material-symbols-outlined text-base">event</span>
        Add to your calendar
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(92vw,28rem)] rounded-lg border border-hairline bg-surface p-4 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-ink-900">Subscribe to this calendar</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the subscribe panel"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-low hover:text-ink-900"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink">Subscribe URL</span>
            <input
              readOnly
              value={url}
              onFocus={(event) => event.target.select()}
              aria-label="Calendar subscription URL"
              className="min-h-10 w-full rounded-md border border-hairline bg-surface-low px-3 text-sm text-ink"
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => copy(url, 'subscribe')} aria-label="Copy the calendar subscription URL">
              <span className="material-symbols-outlined text-base">content_copy</span>
              {copied === 'subscribe' ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="ghost" size="sm" loading={downloading} onClick={download}>
              <span className="material-symbols-outlined text-base">download</span>
              Download .ics
            </Button>
          </div>

          <p className="mt-3 text-xs text-ink-muted">
            In Outlook or Google Calendar, choose &ldquo;Add calendar from URL&rdquo; and paste the link.
          </p>

          <div className="mt-3 border-t border-hairline pt-3">
            <p className="text-xs text-ink-muted">
              iPhone, iPad or Mac: use the <span className="font-semibold text-ink">webcal</span> version, which
              opens the subscription in the Calendar app.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1.5"
              onClick={() => copy(webcalUrl(url), 'webcal')}
              aria-label="Copy the webcal subscription URL"
            >
              <span className="material-symbols-outlined text-base">link</span>
              {copied === 'webcal' ? 'Copied' : 'Copy webcal link'}
            </Button>
          </div>

          {error && <p className="mt-2 text-xs font-semibold text-danger">{error}</p>}
        </div>
      )}
    </div>
  )
}
