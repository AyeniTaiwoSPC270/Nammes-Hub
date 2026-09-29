import { useRef } from 'react'

// Remembers the image that was saved before this field was touched, so an
// unsaved upload can be undone. Call markTouched() on any upload/remove.
export function useRevertableUrl(url) {
  const original = useRef('')
  const touched = useRef(false)
  if (!touched.current) original.current = url || ''
  return {
    original: original.current,
    markTouched: () => {
      touched.current = true
    },
  }
}

export function ClearImageButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove image"
      className={[
        'absolute -right-2 -top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-danger text-white shadow-md transition-transform hover:scale-105',
        className,
      ].join(' ')}
    >
      <span className="material-symbols-outlined text-base">close</span>
    </button>
  )
}

// Shown only when the current value differs from the image that was there before editing.
export function RevertImageButton({ url, original, onRevert }) {
  if (!original || url === original) return null
  return (
    <button type="button" onClick={onRevert} className="self-start text-xs font-semibold text-green-900 hover:underline">
      {url ? 'Revert to previous image' : 'Restore previous image'}
    </button>
  )
}
