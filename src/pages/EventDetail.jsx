import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import JSZip from 'jszip'
import Breadcrumbs from '../components/Breadcrumbs'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { SkeletonText } from '../components/ui/Skeleton'
import GalleryLightbox from '../components/GalleryLightbox'
import { saveBlob } from '../lib/downloadImage'
import { useEventsQuery, getEventById } from '../data/events'
import { useEventPhotosQuery } from '../data/eventPhotos'

export default function EventDetail() {
  const { id } = useParams()
  const [tab, setTab] = useState('details')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [zipping, setZipping] = useState(false)

  const eventsQuery = useEventsQuery()
  const photosQuery = useEventPhotosQuery(id)
  const photos = photosQuery.data ?? []

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

  async function handleDownloadAll() {
    setZipping(true)
    try {
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
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Events', to: '/events' }, { label: event.title }]} />

      <h1 className="mt-1.5 text-3xl font-bold text-ink-900">{event.title}</h1>

      <div className="mt-6 flex gap-2 border-b border-hairline">
        <button
          type="button"
          onClick={() => setTab('details')}
          className={[
            'px-4 py-2 text-sm font-semibold border-b-2 -mb-px',
            tab === 'details' ? 'border-green-900 text-green-900' : 'border-transparent text-ink-muted',
          ].join(' ')}
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => setTab('gallery')}
          className={[
            'px-4 py-2 text-sm font-semibold border-b-2 -mb-px',
            tab === 'gallery' ? 'border-green-900 text-green-900' : 'border-transparent text-ink-muted',
          ].join(' ')}
        >
          Gallery{photos.length > 0 ? ` (${photos.length})` : ''}
        </button>
      </div>

      {tab === 'details' ? (
        <div className="mt-6">
          {event.image_url && <img src={event.image_url} alt="" className="w-full rounded-lg" />}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <span>{event.date}</span>
            {event.meta && (
              <>
                <span aria-hidden="true">&middot;</span>
                <span>{event.meta}</span>
              </>
            )}
          </div>
          <p className="mt-4 max-w-2xl leading-relaxed text-ink">{event.description}</p>
        </div>
      ) : (
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
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className="aspect-[4/3] overflow-hidden rounded-md bg-surface-low shadow-md transition-transform hover:scale-[1.02]"
                  >
                    <img src={photo.image_url} alt="" className="h-full w-full object-cover" />
                  </button>
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
    </div>
  )
}
