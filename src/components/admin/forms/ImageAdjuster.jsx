import { useRef, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { safeFileName } from '../../../lib/uploadPath'
import { DEFAULT_IMAGE, IMAGE_ASPECTS, normalizeImage } from '../../../lib/formTheme'
import AdjustableImage from '../../forms/AdjustableImage'
import { ControlSection, Segmented, Slider } from './DesignControls'

const BUCKET = 'news-images'
const MAX_BYTES = 5 * 1024 * 1024

/**
 * Upload + crop + adjust an image. `value` is an image object (see normalizeImage) or null.
 * Cropping is non-destructive: pick a frame shape, drag the picture to reposition it, zoom in.
 * `layout` adds width and alignment, which make sense for inline images but not backgrounds.
 */
export default function ImageAdjuster({ value, onChange, folder = 'forms', layout = true, aspects, label = 'Image', background = false, defaultAspect = 'free' }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const dragRef = useRef(null)
  const frameRef = useRef(null)

  const image = normalizeImage(value)
  const aspectOptions = aspects ?? IMAGE_ASPECTS.map((a) => a.value)
  const cropped = image && image.aspect !== 'free'

  function set(patch) {
    onChange({ ...image, ...patch })
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be smaller than 5MB.')
      return
    }
    setError('')
    setUploading(true)
    const path = `${folder}/${Date.now()}-${safeFileName(file.name)}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
    setUploading(false)
    if (uploadError) {
      setError(uploadError.message)
      return
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    // A new picture keeps the user's layout choices but restarts the crop position.
    onChange({ ...(image ?? DEFAULT_IMAGE), aspect: image ? image.aspect : defaultAspect, url: data.publicUrl, x: 50, y: 50, zoom: 1 })
  }

  function onPointerDown(e) {
    if (!cropped || !frameRef.current) return
    const rect = frameRef.current.getBoundingClientRect()
    dragRef.current = { startX: e.clientX, startY: e.clientY, x: image.x, y: image.y, w: rect.width, h: rect.height }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e) {
    const d = dragRef.current
    if (!d) return
    // Dragging moves the picture, so the focus point moves the opposite way. Undo the rotation first.
    const rad = (-image.rotate * Math.PI) / 180
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad)
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad)
    const fx = image.flipH ? -1 : 1
    const fy = image.flipV ? -1 : 1
    const clamp = (n) => Math.min(100, Math.max(0, n))
    set({
      x: clamp(d.x - (((lx * fx) / d.w) * 100) / image.zoom),
      y: clamp(d.y - (((ly * fy) / d.h) * 100) / image.zoom),
    })
  }

  function onPointerUp() {
    dragRef.current = null
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-hairline bg-surface-low px-4 py-3 text-center text-sm font-semibold text-ink-muted transition-colors hover:bg-hairline/20">
        <span className="material-symbols-outlined text-xl">add_photo_alternate</span>
        {uploading ? 'Uploading…' : image ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
        <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="hidden" />
      </label>
      <span className="-mt-1 text-xs text-ink-muted">JPEG, PNG, WebP up to 5MB</span>
      {error && <span className="text-xs text-danger">{error}</span>}

      {image && (
        <>
          <div className="rounded-md bg-surface-low p-2">
            <div
              ref={frameRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={['touch-none select-none', cropped ? 'cursor-grab active:cursor-grabbing' : ''].join(' ')}
            >
              <AdjustableImage image={{ ...image, widthPct: 100 }} fill />
            </div>
            {cropped && <p className="mt-1.5 text-center text-xs text-ink-muted">Drag the picture to reposition it</p>}
          </div>

          <ControlSection title={background ? 'Position' : 'Crop'}>
            {!background && (
            <Segmented
              label="Frame shape"
              value={image.aspect}
              options={IMAGE_ASPECTS.filter((a) => aspectOptions.includes(a.value)).map((a) => ({ value: a.value, label: a.label }))}
              onChange={(aspect) => set({ aspect })}
            />
            )}
            {cropped && <Slider label="Zoom" value={image.zoom} min={1} max={4} step={0.05} unit="×" onChange={(zoom) => set({ zoom })} />}
            <div className="flex flex-wrap gap-1.5">
              {cropped && !background && <ActionButton icon="rotate_right" label="Rotate" onClick={() => set({ rotate: (image.rotate + 90) % 360 })} />}
              <ActionButton icon="flip" label="Flip ↔" active={image.flipH} onClick={() => set({ flipH: !image.flipH })} />
              {!background && <ActionButton icon="flip" label="Flip ↕" active={image.flipV} onClick={() => set({ flipV: !image.flipV })} />}
            </div>
          </ControlSection>

          <ControlSection title="Adjust">
            <Slider label="Brightness" value={image.brightness} min={30} max={180} unit="%" onChange={(brightness) => set({ brightness })} />
            <Slider label="Contrast" value={image.contrast} min={30} max={180} unit="%" onChange={(contrast) => set({ contrast })} />
            <Slider label="Saturation" value={image.saturate} min={0} max={200} unit="%" onChange={(saturate) => set({ saturate })} />
            <Slider label="Black & white" value={image.grayscale} min={0} max={100} unit="%" onChange={(grayscale) => set({ grayscale })} />
            {!background && <Slider label="Blur" value={image.blur} min={0} max={20} unit="px" onChange={(blur) => set({ blur })} />}
            {!background && <Slider label="Rounded corners" value={image.radius} min={0} max={48} unit="px" onChange={(radius) => set({ radius })} />}
          </ControlSection>

          {layout && (
            <ControlSection title="Size & position">
              <Slider label="Width" value={image.widthPct} min={10} max={100} unit="%" onChange={(widthPct) => set({ widthPct })} />
              <Segmented
                label="Alignment"
                value={image.align}
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'right', label: 'Right' },
                ]}
                onChange={(align) => set({ align })}
              />
            </ControlSection>
          )}

          {!background && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink">Description (for screen readers)</span>
              <input
                value={image.alt}
                onChange={(e) => set({ alt: e.target.value })}
                placeholder="Describe the picture"
                className="min-h-10 rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand"
              />
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_IMAGE, url: image.url, alt: image.alt })}
              className="min-h-10 rounded-md border border-hairline bg-surface px-3 text-xs font-semibold text-ink hover:bg-surface-low"
            >
              Reset adjustments
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="min-h-10 rounded-md border border-danger bg-surface px-3 text-xs font-semibold text-danger hover:bg-danger-bg"
            >
              Remove {label.toLowerCase()}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function ActionButton({ icon, label, onClick, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors duration-150',
        active ? 'border-green-900 bg-green-900 text-white' : 'border-hairline bg-surface text-ink hover:bg-surface-low',
      ].join(' ')}
    >
      <span className="material-symbols-outlined text-base">{icon}</span>
      {label}
    </button>
  )
}
