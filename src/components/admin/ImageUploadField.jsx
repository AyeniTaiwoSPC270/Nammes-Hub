import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { clampImageWidth } from '../../lib/adminFields'

export default function ImageUploadField({ label, url, widthPct, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const previewRef = useRef(null)
  const dragState = useRef(null)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB.')
      return
    }
    setError('')
    setUploading(true)
    const path = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const { error: uploadError } = await supabase.storage.from('news-images').upload(path, file)
    setUploading(false)
    if (uploadError) {
      setError(uploadError.message)
      return
    }
    const { data } = supabase.storage.from('news-images').getPublicUrl(path)
    onChange({ url: data.publicUrl, widthPct: widthPct || 100 })
  }

  function handlePointerDown(e) {
    if (!previewRef.current) return
    dragState.current = {
      startX: e.clientX,
      startWidth: widthPct || 100,
      containerWidth: previewRef.current.offsetWidth,
    }
    setDragging(true)
    e.target.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e) {
    if (!dragState.current) return
    const { startX, startWidth, containerWidth } = dragState.current
    const deltaPct = ((e.clientX - startX) / containerWidth) * 100
    onChange({ url, widthPct: clampImageWidth(startWidth + deltaPct) })
  }

  function handlePointerUp() {
    dragState.current = null
    setDragging(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-green-900">{label}</span>
      <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} />
      {error && <span className="text-xs text-danger">{error}</span>}
      {url && (
        <div ref={previewRef} className="relative mt-2 max-w-[400px] rounded-sm bg-green-100 p-2">
          <img src={url} alt="" style={{ width: `${widthPct || 100}%` }} className="rounded-sm" />
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={[
              'absolute bottom-2 right-2 h-4 w-4 cursor-nwse-resize rounded-sm bg-green-700 transition-transform duration-150',
              dragging ? 'scale-125 ring-2 ring-orange-500' : '',
            ].join(' ')}
            title="Drag to resize"
          />
          <span className="mt-1 block font-mono text-xs text-ink-muted">{widthPct || 100}% width</span>
        </div>
      )}
    </div>
  )
}
