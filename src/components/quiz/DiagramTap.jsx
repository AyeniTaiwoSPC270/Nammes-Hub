import { useRef, useState } from 'react'
import { letterboxRect, toNormalized } from '../../../api/_lib/quizGrading.js'

// A picture the student taps. The tap is reported NORMALISED to the image's own box, which is the only form that
// survives: the same question is drawn at one size in the editor and another on a phone, and both are
// `object-contain`, so the pixel the finger landed on is not where the region is.
//
// The mapping is done here rather than in the component that owns the box because the box is this element's own
// rendered size, read back from the image once it has loaded. Measuring anything else - the parent, the viewport, the
// max-height - is the bug this whole file exists to prevent.
// How big the student's own tap is drawn, as a fraction of the picture's shorter side. A marked region brings its own
// radius; a tap does not, so it gets this instead -- big enough to see on a phone held at arm's length in a hall.
const PREVIEW_DOT_FRACTION = 0.05

export function DiagramTap({ src, alt, targets = [], preview = null, onTap, disabled = false, marked = false }) {
  const wrapRef = useRef(null)
  const imageRef = useRef(null)
  const [natural, setNatural] = useState({ width: 0, height: 0 })
  const [box, setBox] = useState({ width: 0, height: 0 })

  function handleTap(event) {
    if (disabled) return
    const wrap = wrapRef.current
    if (!wrap || !natural.width) return
    const rect = wrap.getBoundingClientRect()
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const mapped = toNormalized(point, letterboxRect({ width: rect.width, height: rect.height }, natural), natural)
    // A tap on the grey bar above or beside the picture is not a miss, it is a tap on nothing.
    if (mapped.x < 0 || mapped.x > 1 || mapped.y < 0 || mapped.y > 1) return
    onTap?.({ x: mapped.x, y: mapped.y })
  }

  // Marked mode is the reveal: the same normalised points drawn back through the same letterbox, so what the student is
  // shown is exactly what was graded. The box is re-read on every render because the image can finish loading after the
  // first paint and change how much of it is letterboxed.
  const rect = natural.width ? letterboxRect(box, natural) : null
  // `preview` is ONE point -- the tap a student has made so far -- while `targets` is every region on the picture. Only
  // the second is a list, so a single tap is wrapped here rather than at the call site: passing the bare point used to
  // throw "dots.map is not a function" the moment a student tapped a diagram, which is the one thing they must do.
  const dots = preview ? [preview] : marked ? targets : null
  const w = box.width || 1
  const h = box.height || 1

  return (
    <div className="w-full">
      <div
        ref={wrapRef}
        onClick={handleTap}
        onLoad={() => {
          const el = wrapRef.current
          if (el) setBox({ width: el.clientWidth, height: el.clientHeight })
        }}
        className={`relative mx-auto flex h-72 max-w-lg items-center justify-center ${disabled ? '' : 'cursor-crosshair'}`}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          onLoad={(e) => {
            setNatural({ width: e.target.naturalWidth, height: e.target.naturalHeight })
            const el = wrapRef.current
            if (el) setBox({ width: el.clientWidth, height: el.clientHeight })
          }}
          className="max-h-72 w-auto max-w-full rounded-xl object-contain"
        />
        {rect && dots && dots.map((t, i) => {
    // The region is a circle of radius `r` times the SHORTER side of the picture, so its drawn diameter uses the
    // shorter side too. Width and height separately would draw an ellipse on anything that is not square, and the
    // student would be shown a shape that was never graded.
    // A student's own tap carries no `r` -- it is a point, not a marked region -- so it is drawn at a fixed fraction
    // instead. Without this the diameter is NaN and the dot renders at nothing at all.
    const isPreview = Boolean(preview)
    const fraction = isPreview ? PREVIEW_DOT_FRACTION : Number(t.r) || 0
    const diameter = 2 * fraction * Math.min(rect.width, rect.height)
    return (
      <span
        key={i}
        aria-hidden="true"
        className={`pointer-events-none absolute rounded-full border-2 ${isPreview ? 'border-brand' : 'border-green-600'}`}
        style={{
          left: `${((rect.left + t.x * rect.width) / w) * 100}%`,
          top: `${((rect.top + t.y * rect.height) / h) * 100}%`,
          width: `${(diameter / w) * 100}%`,
          height: `${(diameter / h) * 100}%`,
          transform: 'translate(-50%, -50%)',
        }}
      />
    )
  })}
      </div>
      {disabled ? null : (
        <p className="mt-2 text-center text-xs text-ink-muted">
          {preview ? 'Tap somewhere else to change your answer.' : 'Tap the correct region.'}
        </p>
      )}
    </div>
  )
}