import { useRef } from 'react'
import { CARD_MAX_HEIGHT, CARD_MIN_WIDTH_PCT, computeResize } from '../../lib/formTheme'

const HANDLES = {
  e: { cursor: 'ew-resize', style: { right: -8, top: '50%', marginTop: -8 }, label: 'Resize width from the right edge' },
  w: { cursor: 'ew-resize', style: { left: -8, top: '50%', marginTop: -8 }, label: 'Resize width from the left edge' },
  s: { cursor: 'ns-resize', style: { bottom: -8, left: '50%', marginLeft: -8 }, label: 'Resize height' },
  se: { cursor: 'nwse-resize', style: { bottom: -8, right: -8 }, label: 'Resize width and height from the bottom-right corner' },
  sw: { cursor: 'nesw-resize', style: { bottom: -8, left: -8 }, label: 'Resize width and height from the bottom-left corner' },
}

/**
 * A box that can be selected and resized with drag handles (edges and bottom corners). It draws the
 * box itself (`style` is its visual style) so the handles sit on its real edges. The caller owns the
 * sizes: `onResize({ widthPct?, height? })` fires while dragging, and `widthPct` is this box's current
 * width as a % of its parent so the drag maths can be relative to it.
 */
export default function ResizableFrame({
  selected,
  onSelect,
  onResize,
  widthPct = 100,
  align = 'center',
  minWidthPct = CARD_MIN_WIDTH_PCT,
  handles = ['e', 'w', 's', 'se', 'sw'],
  style,
  className = '',
  children,
}) {
  const frameRef = useRef(null)
  const dragRef = useRef(null)

  function start(e, handle) {
    const frame = frameRef.current
    if (!frame) return
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = {
      handle,
      x: e.clientX,
      y: e.clientY,
      startWidthPct: widthPct,
      startHeight: frame.offsetHeight,
      startWidthPx: frame.offsetWidth,
      containerWidth: frame.parentElement?.clientWidth ?? frame.offsetWidth,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function move(e) {
    const d = dragRef.current
    if (!d) return
    const result = computeResize({
      handle: d.handle,
      dx: e.clientX - d.x,
      dy: e.clientY - d.y,
      startWidthPct: d.startWidthPct,
      startHeight: d.startHeight,
      containerWidth: d.containerWidth,
      align,
      minWidthPct,
    })
    // Width in px after this move, for callers that turn a height into a shape (width / height).
    const widthPx = result.widthPct !== undefined ? (d.startWidthPx * result.widthPct) / d.startWidthPct : d.startWidthPx
    onResize(result, { widthPx })
  }

  function end() {
    dragRef.current = null
  }

  function key(e, handle) {
    const frame = frameRef.current
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 }[e.key]
    if (!step || !frame) return
    e.preventDefault()
    const out = {}
    if (handle !== 's' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const sign = handle.includes('w') ? -1 : 1
      out.widthPct = Math.round(Math.min(100, Math.max(minWidthPct, widthPct + step * sign * 2)))
    }
    if (handle.includes('s') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      out.height = Math.round(Math.min(CARD_MAX_HEIGHT, Math.max(0, frame.offsetHeight + step * 8)))
    }
    if (Object.keys(out).length) onResize(out, { widthPx: frame.offsetWidth * ((out.widthPct ?? widthPct) / widthPct) })
  }

  return (
    <div
      ref={frameRef}
      data-resize-frame=""
      className={['relative', className].join(' ')}
      style={{
        ...style,
        outline: selected ? '2px solid var(--color-green-900, #0b2417)' : undefined,
        outlineOffset: selected ? 3 : undefined,
        cursor: onSelect && !selected ? 'pointer' : undefined,
      }}
      onPointerDownCapture={() => onSelect?.()}
    >
      {children}
      {selected &&
        handles.map((h) => (
          <button
            key={h}
            type="button"
            aria-label={HANDLES[h].label}
            onPointerDown={(e) => start(e, h)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onKeyDown={(e) => key(e, h)}
            className="absolute z-20 h-4 w-4 touch-none rounded-full border-2 bg-white shadow-md"
            style={{ ...HANDLES[h].style, cursor: HANDLES[h].cursor, borderColor: 'var(--color-green-900, #0b2417)' }}
          />
        ))}
    </div>
  )
}
