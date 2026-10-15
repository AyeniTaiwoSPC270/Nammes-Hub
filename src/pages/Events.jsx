import PageBanner from '../components/PageBanner'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import Reveal from '../components/ui/Reveal'
import { SkeletonCard } from '../components/ui/Skeleton'
import { ContentGrid, EventCard, staggerDelay } from '../components/content/ContentCards'
import { useEventsQuery, groupEventsByTime } from '../data/events'
import { usePageBanner } from '../data/pageBanners'
import { usePageLook } from '../data/contentLooks'

function EventSection({ heading, events, theme }) {
  if (events.length === 0) return null
  return (
    <Reveal as="section">
      <h2 className="mb-5 text-2xl font-bold text-ink-900">{heading}</h2>
      <ContentGrid theme={theme}>
        {events.map((event, i) => (
          <Reveal key={event.id} delay={staggerDelay(theme, i)}>
            <EventCard event={event} theme={theme} />
          </Reveal>
        ))}
      </ContentGrid>
    </Reveal>
  )
}

export default function Events() {
  const { data, isLoading, isError, refetch } = useEventsQuery()
  const { theme } = usePageLook('events')
  const rows = data ?? []
  const { upcoming, past, tba } = groupEventsByTime(rows)
  const banner = usePageBanner('events')

  return (
    <div>
      <PageBanner
        images={banner?.image_urls}
        transition={banner?.transition}
        intervalSeconds={banner?.interval_seconds}
        title={banner?.title ?? 'Events'}
        subtitle={banner?.subtitle ?? 'Workshops, seminars, and gatherings from the department.'}
      />
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        {isError && !data ? (
          <ErrorState message="Couldn't load events right now." onRetry={refetch} />
        ) : isLoading ? (
          // A fixed three-column grid rather than the look's, because `content-grid` would need the theme
          // vars and a page that has not loaded its rows has not earned them yet. The shape matches, so the
          // layout does not jump when the real cards arrive.
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard imageVariant="cover" />
            <SkeletonCard imageVariant="cover" />
            <SkeletonCard imageVariant="cover" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="event_busy"
            title="No events yet"
            description="Check back soon. Upcoming workshops, seminars, and gatherings will show up here."
          />
        ) : (
          <div className="flex flex-col gap-14">
            <EventSection heading="Upcoming Events" events={upcoming} theme={theme} />
            {/* Undated events left the upcoming bucket so they stop sitting at the top of the list forever
                (spec §10.1). They are still events, so /events still shows them -- under a heading that says why
                they are not in the list above. */}
            <EventSection heading="Dates to be confirmed" events={tba} theme={theme} />
            <EventSection heading="Past Events" events={past} theme={theme} />
          </div>
        )}
      </div>
    </div>
  )
}
