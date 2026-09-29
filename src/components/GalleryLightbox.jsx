import { useEffect, useRef } from 'react'
import { downloadImage } from '../lib/downloadImage'
import { useBodyScrollLock } from '../lib/useBodyScrollLock'

export default function GalleryLightbox({ photos, index, onIndexChange, onClose }) {
  const dialogRef = useRef(null)
  const photo = photos[index]
  const touchStartX = useRef(null)

  useBodyScrollLock()

  // Horizontal swipe changes photo (>50px), so phones don't rely on the small arrow buttons.
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 50) return
    if (dx < 0 && index < photos.length - 1) onIndexChange(index + 1)
    if (dx > 0 && index > 0) onIndexChange(index - 1)
  }

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndexChange(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [index, photos.length, onIndexChange, onClose])

  if (!photo) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <button
        type="button"
        aria-label="Close photo viewer"
        onClick={onClose}
        className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-danger text-white shadow-md"
      >
        <span className="material-symbols-outlined">close</span>
      </button>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Photo viewer"
        tabIndex={-1}
        className="relative flex max-h-full max-w-4xl flex-col items-center outline-none"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX
        }}
        onTouchEnd={handleTouchEnd}
      >
        <img src={photo.image_url} alt="" className="max-h-[75dvh] max-w-full rounded-md object-contain" />

        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => onIndexChange(index - 1)}
            disabled={index === 0}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink-900 shadow-md disabled:opacity-40"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button
            type="button"
            aria-label="Download this photo"
            onClick={() => downloadImage(photo.image_url, `photo-${photo.id}.jpg`)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink-900 shadow-md hover:text-brand"
          >
            <span className="material-symbols-outlined">download</span>
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => onIndexChange(index + 1)}
            disabled={index === photos.length - 1}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink-900 shadow-md disabled:opacity-40"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>

      </div>
    </div>
  )
}
