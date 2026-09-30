import { useRef, useState } from 'react'
import { DEFAULT_ADJUST, EMAIL_IMAGE_ASPECTS, normalizeAdjust } from '../../../../api/_lib/emailDesign.js'
import { aspectRatio, uploadOriginal } from '../../../lib/emailImage'
import AdjustableImage from '../../forms/AdjustableImage'
import { ControlSection, Segmented, Slider } from '../forms/DesignControls'

const MAX_BYTES = 5 * 1024 * 1024

// Upload + crop + adjust for one email picture. The crop and colour settings are saved with the
// picture and baked into a real image file when the email is sent (email clients ignore CSS cropping).
// `layout` adds width / alignment / corners / link, which suit inline images but not a header banner.
export default function EmailImageField({ value, onChange, label = 'Image', layout = true, aspects, defaultAspect = 'free', simple = false }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const dragRef = useRef(null)
  const frameRef = useRef(null)

  const adjust = value ? normalizeAdjust(value.adjust) : null
  const options = EMAIL_IMAGE_ASPECTS.filter((a) => !aspects || aspects.includes(a.value))
  const cropped = adjust && aspectRatio(adjust.aspect) !== null

  const setAdjust = (patch) => onChange({ ...value, adjust: { ...adjust, ...patch } })

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
    try {
      const url = await uploadOriginal(file)
      onChange({
        ...(value ?? {}),
        url,
        src: url,
        bakeKey: '',
        alt: value?.alt ?? '',
        link: value?.link ?? '',
        widthPct: value?.widthPct ?? 100,
        align: value?.align ?? 'center',
        radius: value?.radius ?? 8,
        adjust: { ...DEFAULT_ADJUST, aspect: value ? adjust.aspect : defaultAspect },
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  function onPointerDown(e) {
    if (!cropped || !frameRef.current) return
    const rect = frameRef.current.getBoundingClientRect()
    dragRef.current = { startX: e.clientX, startY: e.clientY, x: adjust.x, y: adjust.y, w: rect.width, h: rect.height }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e) {
    const d = dragRef.current
    if (!d) return
    const rad = (-adjust.rotate * Math.PI) / 180
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad)
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad)
    const fx = adjust.flipH ? -1 : 1
    const fy = adjust.flipV ? -1 : 1
    const clamp = (n) => Math.min(100, Math.max(0, n))
    setAdjust({
      x: clamp(d.x - (((lx * fx) / d.w) * 100) / adjust.zoom),
      y: clamp(d.y - (((ly * fy) / d.h) * 100) / adjust.zoom),
    })
  }

  const stopDrag = () => {
    dragRef.current = null
  }

  // Logos are used as uploaded: no crop or colour tools.
  if (simple) {
    return (
      <div className="flex flex-col gap-2">
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-hairline bg-surface-low px-4 py-3 text-center text-sm font-semibold text-ink-muted transition-colors hover:bg-hairline/20">
          <span className="material-symbols-outlined text-xl">add_photo_alternate</span>
          {uploading ? 'Uploading…' : value ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="hidden" />
        </label>
        {error && <span className="text-xs text-danger">{error}</span>}
        {value && (
          <div className="flex items-center gap-3 rounded-md bg-surface-low p-2">
            <img src={value.url} alt="" className="h-10 max-w-[140px] object-contain" />
            <button type="button" onClick={() => onChange(null)} className="text-xs font-semibold text-danger hover:underline">
              Remove
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-hairline bg-surface-low px-4 py-3 text-center text-sm font-semibold text-ink-muted transition-colors hover:bg-hairline/20">
        <span className="material-symbols-outlined text-xl">add_photo_alternate</span>
        {uploading ? 'Uploading…' : value ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
        <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="hidden" />
      </label>
      {error && <span className="text-xs text-danger">{error}</span>}

      {value && (
        <>
          <div className="rounded-md bg-surface-low p-2">
            <div
              ref={frameRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
              className={['touch-none select-none', cropped ? 'cursor-grab active:cursor-grabbing' : ''].join(' ')}
            >
              <AdjustableImage image={{ ...adjust, url: value.src || value.url, radius: value.radius ?? 0, widthPct: 100, align: 'center' }} fill />
            </div>
            {cropped && <p className="mt-1.5 text-center text-xs text-ink-muted">Drag the picture to reposition it</p>}
          </div>

          <ControlSection title="Crop">
            <Segmented
              label="Frame shape"
              value={adjust.aspect}
              options={options.map((a) => ({ value: a.value, label: a.label }))}
              onChange={(aspect) => setAdjust({ aspect })}
            />
            {cropped && <Slider label="Zoom" value={adjust.zoom} min={1} max={4} step={0.05} unit="×" onChange={(zoom) => setAdjust({ zoom })} />}
            <div className="flex flex-wrap gap-1.5">
              {cropped && <SmallButton icon="rotate_right" label="Rotate" onClick={() => setAdjust({ rotate: (adjust.rotate + 90) % 360 })} />}
              <SmallButton icon="flip" label="Flip ↔" active={adjust.flipH} onClick={() => setAdjust({ flipH: !adjust.flipH })} />
              <SmallButton icon="flip" label="Flip ↕" active={adjust.flipV} onClick={() => setAdjust({ flipV: !adjust.flipV })} />
            </div>
          </ControlSection>

          <ControlSection title="Adjust">
            <Slider label="Brightness" value={adjust.brightness} min={30} max={180} unit="%" onChange={(brightness) => setAdjust({ brightness })} />
            <Slider label="Contrast" value={adjust.contrast} min={30} max={180} unit="%" onChange={(contrast) => setAdjust({ contrast })} />
            <Slider label="Saturation" value={adjust.saturate} min={0} max={200} unit="%" onChange={(saturate) => setAdjust({ saturate })} />
            <Slider label="Black & white" value={adjust.grayscale} min={0} max={100} unit="%" onChange={(grayscale) => setAdjust({ grayscale })} />
          </ControlSection>

          {layout && (
            <ControlSection title="Size & position">
              <Slider label="Width" value={value.widthPct ?? 100} min={10} max={100} unit="%" onChange={(widthPct) => onChange({ ...value, widthPct })} />
              <Slider label="Rounded corners" value={value.radius ?? 0} min={0} max={48} unit="px" onChange={(radius) => onChange({ ...value, radius })} />
              <Segmented
                label="Alignment"
                value={value.align ?? 'center'}
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'right', label: 'Right' },
                ]}
                onChange={(align) => onChange({ ...value, align })}
              />
            </ControlSection>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink">Description (for screen readers)</span>
            <input
              value={value.alt ?? ''}
              onChange={(e) => onChange({ ...value, alt: e.target.value })}
              placeholder="Describe the picture"
              className="min-h-10 rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink">Link (optional)</span>
            <input
              value={value.link ?? ''}
              onChange={(e) => onChange({ ...value, link: e.target.value })}
              placeholder="https://…"
              className="min-h-10 rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...value, adjust: { ...DEFAULT_ADJUST } })}
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

function SmallButton({ icon, label, onClick, active = false }) {
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
