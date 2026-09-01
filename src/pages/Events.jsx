import { useEffect, useState } from 'react'
import PageBanner from '../components/PageBanner'
import EmptyState from '../components/ui/EmptyState'
import { fetchEvents } from '../data/events'

export default function Events() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvents().then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <PageBanner title="Events" subtitle="Workshops, seminars, and gatherings from the department." />
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        {loading ? (
          <p className="text-ink-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="event_busy"
            title="No events yet"
            description="Check back soon — upcoming workshops, seminars, and gatherings will show up here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((event) => (
              <article
                key={event.id}
                className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-md hover:shadow-lg transition-shadow"
              >
                {event.image_url && (
                  <img src={event.image_url} alt="" className="h-48 w-full object-cover" />
                )}
                <div className="flex flex-grow flex-col gap-2 p-6">
                  <div className="flex items-center justify-between gap-3">
                    {event.meta && <span className="text-sm text-ink-muted">{event.meta}</span>}
                    <div className="ml-auto flex items-center gap-1 text-sm text-ink-muted">
                      <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                      {event.date}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-ink-900 m-0">{event.title}</h3>
                  <p className="flex-grow text-base leading-relaxed text-ink">{event.description}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
