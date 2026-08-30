import { useEffect, useState } from 'react'
import Card from '../components/ui/Card'
import PageHeader from '../components/PageHeader'
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
      <PageHeader
        eyebrow="Activities"
        title="Events"
        subtitle="See all programs and activities of NAMMES."
      />
      <div className="mx-auto max-w-[880px] px-5 pt-10 pb-12 sm:px-6">
        {loading ? (
          <p className="text-ink-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-ink-muted">No events posted yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  )
}
