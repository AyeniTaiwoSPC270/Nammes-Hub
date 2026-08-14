import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { SkeletonCard } from '../components/ui/Skeleton'
import { EVENT_TONE_ICONS } from '../lib/illustrations'
import { useEventsQuery } from '../data/events'

export default function Events() {
  const { data, isLoading, isError, refetch } = useEventsQuery()
  const rows = data ?? []

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <h1 className="text-[32px]">Events</h1>
      {isError ? (
        <div className="mt-6">
          <ErrorState message="Couldn't load events right now." onRetry={refetch} />
        </div>
      ) : isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No events yet" body="No events posted yet." />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rows.map((event) => (
            <Card
              key={event.id}
              tone={event.tone}
              eyebrow={event.date}
              title={event.title}
              meta={event.meta || undefined}
              image={{ src: EVENT_TONE_ICONS[event.tone] || EVENT_TONE_ICONS.green }}
            >
              {event.description}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
