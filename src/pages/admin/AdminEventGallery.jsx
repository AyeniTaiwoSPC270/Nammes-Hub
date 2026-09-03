import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useEventsQuery, getEventById } from '../../data/events'
import { useEventPhotosQuery } from '../../data/eventPhotos'
import Breadcrumbs from '../../components/Breadcrumbs'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { useToast } from '../../lib/ToastContext'

async function uploadOnePhoto(eventId, file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be smaller than 5MB.')
  }
  const path = `${eventId}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`
  const { error: uploadError } = await supabase.storage.from('event-gallery').upload(path, file)
  if (uploadError) throw uploadError
  const { data } = supabase.storage.from('event-gallery').getPublicUrl(path)
  const { error: insertError } = await supabase
    .from('event_photos')
    .insert({ event_id: eventId, image_url: data.publicUrl })
  if (insertError) throw insertError
}

export default function AdminEventGallery() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [uploadProgress, setUploadProgress] = useState(null)

  const eventsQuery = useEventsQuery()
  const event = getEventById(eventsQuery.data ?? [], id)

  const photosQuery = useEventPhotosQuery(id)
  const photos = photosQuery.data ?? []

  const uploadMutation = useMutation({
    mutationFn: async (files) => {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress({ done: i, total: files.length })
        await uploadOnePhoto(id, files[i])
      }
    },
    onSuccess: (_data, files) => {
      queryClient.invalidateQueries({ queryKey: ['event_photos', id] })
      toast.success(`${files.length} photo${files.length === 1 ? '' : 's'} added.`)
    },
    onError: (error) => {
      toast.error(error.message)
    },
    onSettled: () => {
      setUploadProgress(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (photo) => {
      const path = photo.image_url.split('/event-gallery/')[1]
      if (path) await supabase.storage.from('event-gallery').remove([decodeURIComponent(path)])
      const { error } = await supabase.from('event_photos').delete().eq('id', photo.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event_photos', id] })
      toast.success('Photo removed.')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  function handleFileChange(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    uploadMutation.mutate(files)
    e.target.value = ''
  }

  if (eventsQuery.isError && !eventsQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this event right now." onRetry={eventsQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs
        items={[
          { label: 'Admin', to: '/admin' },
          { label: 'Events', to: '/admin/events' },
          { label: event ? event.title : '…' },
        ]}
      />

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-900">Gallery{event ? `: ${event.title}` : ''}</h1>
          <p className="mt-1 text-ink-muted">Upload and remove photos for this event's gallery.</p>
        </div>
        <Link
          to="/admin/events"
          className="inline-flex items-center gap-1 text-sm font-semibold text-green-900 no-underline hover:text-orange-500 hover:underline"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to Events
        </Link>
      </div>

      <label className="mt-6 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-hairline bg-surface-low p-8 text-center transition-colors hover:bg-hairline/20">
        <span className="material-symbols-outlined text-3xl text-ink-muted">add_photo_alternate</span>
        <span className="text-sm font-semibold text-ink-muted">
          {uploadProgress ? `Uploading ${uploadProgress.done + 1} of ${uploadProgress.total}…` : 'Click to upload photos'}
        </span>
        <span className="text-xs text-ink-muted">JPEG, PNG up to 5MB each — select multiple at once</span>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          disabled={Boolean(uploadProgress)}
          className="hidden"
        />
      </label>

      {photosQuery.isError && !photosQuery.data ? (
        <div className="mt-6">
          <ErrorState message="Couldn't load this gallery right now." onRetry={photosQuery.refetch} />
        </div>
      ) : photos.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon="photo_library" title="No photos yet" description="Uploaded photos will show up here." />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-low shadow-md">
              <img src={photo.image_url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => deleteMutation.mutate(photo)}
                aria-label="Delete photo"
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-danger text-white shadow-md transition-transform hover:scale-105"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
