import { useEffect, useRef } from 'react'
import { useBodyScrollLock } from '../../../lib/useBodyScrollLock'

// A plain dialog shell for the quiz library tools: dark backdrop, Escape and the round close button dismiss it.
export default function QuizModal({ label, onClose, children, wide = false }) {
  const dialogRef = useRef(null)
  useBodyScrollLock()

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 sm:items-center" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`relative my-4 flex w-full flex-col gap-4 rounded-lg bg-surface p-6 shadow-md outline-none ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="pr-10 text-lg font-bold text-ink-900">{label}</h2>
        {children}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2 top-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-danger text-white shadow-md"
        >
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </div>
    </div>
  )
}
