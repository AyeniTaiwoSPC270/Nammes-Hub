import { useEffect, useState } from 'react'
import Card from '../components/ui/Card'
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
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <h1 className="text-[32px]">Events</h1>
      {loading ? (
        <p className="mt-6 text-ink-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-ink-muted">No events posted yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((event) => (
            <Card
              key={event.id}
              tone={event.tone}
              eyebrow={event.date}
              title={event.title}
              meta={event.meta || undefined}
              image={event.image_url ? { src: event.image_url } : undefined}
              imageVariant="cover"
              imageAspect="standard"
            >
              {event.description}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
