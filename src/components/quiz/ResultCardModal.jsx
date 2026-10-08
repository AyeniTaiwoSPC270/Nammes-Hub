import { useEffect, useRef, useState } from 'react'
import Button from '../ui/Button'
import ErrorState from '../ui/ErrorState'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'
import { fetchCardBlob } from '../../lib/quizCard'
import { saveCardBlob, shareOrDownloadBlob } from '../../lib/shareCard'

// Preview a rendered result card, then share or save it. One component for every quiz mode: it takes a URL, an
// optional admin flag for the board card, and the filename to save under.
//
// It renders as a sibling of whatever layout it sits in, never inside Phone/Stage/Shell: those are fixed-size frames,
// and a position-fixed overlay inside a zoomed one gets anchored to that element instead of the screen.
export default function ResultCardModal({ url, admin = false, filename, shareTitle, onClose }) {
  const [blob, setBlob] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef(null)
  useBodyScrollLock()

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false
    let objectUrl = null
    setError('')
    setBlob(null)
    setPreview(null)
    fetchCardBlob(url, { admin })
      .then((b) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(b)
        setBlob(b)
        setPreview(objectUrl)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    // The blob stays for as long as the modal is open, so Save does not have to fetch it again. The url is released
    // here, when the <img> is about to unmount with it.
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url, admin])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function share() {
    if (!blob) return
    setBusy(true)
    try {
      await shareOrDownloadBlob(blob, filename, shareTitle)
    } catch {
      // A cancelled share sheet rejects, which is not an error worth showing.
    } finally {
      setBusy(false)
    }
  }

  function save() {
    if (!blob) return
    saveCardBlob(blob, filename)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your result card"
        tabIndex={-1}
        className="relative flex max-h-full w-full max-w-sm flex-col gap-4 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-2xl bg-surface-low">
          {error ? (
            <ErrorState message={error} onRetry={onClose} />
          ) : preview ? (
            <img src={preview} alt="Your result card" className="h-auto w-full" />
          ) : (
            <p className="px-6 py-16 text-center text-ink-muted">Making your card…</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="accent" onClick={share} loading={busy} disabled={!blob} className="flex-1">
            <span className="material-symbols-outlined" aria-hidden="true">share</span>
            Share
          </Button>
          <Button variant="secondary" onClick={save} disabled={!blob} className="flex-1">
            <span className="material-symbols-outlined" aria-hidden="true">download</span>
            Save
          </Button>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute -right-2 -top-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-danger text-white shadow-md"
        >
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </div>
    </div>
  )
}