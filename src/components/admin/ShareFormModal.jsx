import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { useToast } from '../../lib/ToastContext'
import { saveBlob } from '../../lib/downloadImage'
import Button from '../ui/Button'

export default function ShareFormModal({ form, onClose }) {
  const toast = useToast()
  const dialogRef = useRef(null)
  const [qrDataUrl, setQrDataUrl] = useState(null)

  const url = `${window.location.origin}/forms/${form.id}`

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

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, { width: 320, margin: 1 }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied to clipboard.')
    } catch {
      toast.error('Could not copy the link — copy it manually.')
    }
  }

  async function handleDownloadQr() {
    if (!qrDataUrl) return
    const blob = await (await fetch(qrDataUrl)).blob()
    saveBlob(blob, `${form.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr.png`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Share form"
        tabIndex={-1}
        className="relative flex w-full max-w-sm flex-col items-center gap-4 rounded-lg bg-surface p-6 shadow-md outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-ink-900">Share &ldquo;{form.title}&rdquo;</h2>

        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR code linking to this form" className="h-48 w-48 rounded-md border border-hairline" />
        ) : (
          <div className="h-48 w-48 animate-pulse rounded-md bg-surface-low" />
        )}

        <div className="flex w-full items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 rounded-md border border-hairline bg-surface-low px-3 py-2 text-sm text-ink-muted"
          />
          <Button variant="secondary" size="sm" onClick={handleCopyLink}>
            Copy
          </Button>
        </div>

        <Button variant="primary" className="w-full justify-center" onClick={handleDownloadQr} disabled={!qrDataUrl}>
          Download QR code
        </Button>

        <button
          type="button"
          aria-label="Close share dialog"
          onClick={onClose}
          className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-danger text-white shadow-md hover:scale-105"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </div>
  )
}
