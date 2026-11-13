import { useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import Reveal from '../components/ui/Reveal'
import { SkeletonText } from '../components/ui/Skeleton'
import GalleryLightbox from '../components/GalleryLightbox'
import ReportProblem from '../components/ReportProblem'
import { ContentGrid, ContentLook, EventCard } from '../components/content/ContentCards'
import ArticleHero from '../components/content/ArticleHero'
import RichBody from '../components/content/RichBody'
import { readingMinutes } from '../lib/richText'

const CARD_STAGGER = 0.06
const MAX_STAGGER_DELAY = 0.3
import { saveBlob } from '../lib/downloadImage'
import { useEventsQuery, getEventById, groupEventsByTime } from '../data/events'
import { useEventPhotosQuery } from '../data/eventPhotos'
import { usePageLook } from '../data/contentLooks'

export default function EventDetail() {
  const { id } = useParams()
  const [tab, setTab] = useState('details')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [zipping, setZipping] = useState(false)

  const eventsQuery = useEventsQuery()
  const photosQuery = useEventPhotosQuery(id)
  const photos = photosQuery.data ?? []
  // Same two reaches as NewsDetail, for the same reason: the look has no grid or card here, only an accent
  // and a radius, so the wrapper goes round the article and not round the page.
  const { theme } = usePageLook('events')

  if (eventsQuery.isError && !eventsQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this event right now." onRetry={eventsQuery.refetch} />
      </div>
    )
  }

  if (eventsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <div className="h-4 w-48 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-4 h-8 w-2/3 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-6 h-64 w-full animate-pulse rounded-lg bg-hairline" />
        <div className="mt-6">
          <SkeletonText lines={4} />
        </div>
      </div>
    )
  }

  const event = getEventById(eventsQuery.data ?? [], id)
  if (!event) return <Navigate to="/events" replace />

  // Upcoming first: a reader who just finished an event is the likeliest person to go to the next one.
  const others = (eventsQuery.data ?? []).filter((item) => String(item.id) !== String(event.id))
  const { upcoming, past } = groupEventsByTime(others)
  const more = [...upcoming, ...past].slice(0, 3)

  async function handleDownloadAll() {
    setZipping(true)
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      for (let i = 0; i < photos.length; i++) {
        const response = await fetch(photos[i].image_url)
        const blob = await response.blob()
        zip.file(`photo-${i + 1}.jpg`, blob)
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      saveBlob(zipBlob, `${event.title}-photos.zip`)
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-8 sm:px-6">
      <ContentLook theme={theme}>
        <ArticleHero
          back={{ to: '/events', label: 'Back to events' }}
          eyebrow="Event"
          title={event.title}
          date={event.date}
          minutes={readingMinutes(event.description)}
          meta={event.meta ? [event.meta] : []}
        />

        {/* The details share the article's measure -- one column for the headline, the cover and the text --
            and the gallery below keeps the full page width because a photo grid is the one thing on this
            screen that benefits from it. */}
        <div className="mx-auto max-w-[720px]">
          <div className="mt-6 flex gap-2 border-b border-hairline">
            <button
              type="button"
              onClick={() => setTab('details')}
              className={[
                'px-4 py-2 text-sm font-semibold border-b-2 -mb-px',
                tab === 'details' ? 'border-brand text-brand' : 'border-transparent text-ink-muted',
              ].join(' ')}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setTab('gallery')}
              className={[
                'px-4 py-2 text-sm font-semibold border-b-2 -mb-px',
                tab === 'gallery' ? 'border-brand text-brand' : 'border-transparent text-ink-muted',
              ].join(' ')}
            >
              Gallery{photos.length > 0 ? ` (${photos.length})` : ''}
            </button>
          </div>

          {tab === 'details' && (
            <Reveal className="mt-8">
              <RichBody text={event.description} cover={event.image_url} />
            </Reveal>
          )}
        </div>

      {tab === 'gallery' && (
        <div className="mt-6">
          {photosQuery.isError && !photosQuery.data ? (
            <ErrorState message="Couldn't load this gallery right now." onRetry={photosQuery.refetch} />
          ) : photos.length === 0 ? (
            <EmptyState
              icon="photo_library"
              title="No photos yet"
              description="Photos from this event will show up here once they're added."
            />
          ) : (
            <>
              <div className="mb-4 flex justify-end">
                <Button variant="secondary" size="sm" onClick={handleDownloadAll} loading={zipping}>
                  <span className="material-symbols-outlined text-base">download</span>
                  Download all
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((photo, i) => (
                  <Reveal key={photo.id} delay={Math.min(i * CARD_STAGGER, MAX_STAGGER_DELAY)}>
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(i)}
                      className="aspect-[4/3] w-full overflow-hidden rounded-md bg-surface-low shadow-md transition-transform hover:scale-[1.02]"
                    >
                      <img src={photo.image_url} loading="lazy" decoding="async" alt="" className="h-full w-full object-cover" />
                    </button>
                  </Reveal>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {lightboxIndex !== null && (
        <GalleryLightbox
          photos={photos}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

        <div className="mx-auto mt-10 max-w-[720px]">
          <div className="border-t border-hairline pt-5">
            <ReportProblem title={event.title} />
          </div>
        </div>

        {more.length > 0 && (
          <section className="mx-auto mt-16 max-w-[1100px]">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl font-bold text-ink-900">More events</h2>
              <Link to="/events" className="text-sm font-bold text-brand-orange hover:underline">
                All events
              </Link>
            </div>
            <ContentGrid theme={theme} className="mt-5">
              {more.map((item) => (
                <EventCard key={item.id} event={item} theme={theme} />
              ))}
            </ContentGrid>
          </section>
        )}
      </ContentLook>
    </div>
  )
}
