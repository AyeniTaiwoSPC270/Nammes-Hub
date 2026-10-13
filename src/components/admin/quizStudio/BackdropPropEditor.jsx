import { useEffect, useRef, useState } from 'react'
import Button from '../../ui/Button'
import { PROP_TILTLESS, THEME_LOOKS, propLabel, propSizeRange } from '../../../../api/_lib/quizTheme.js'

const HIT_MARGIN = 1.2
const COLOR = /^#[\da-f]{6}$/i

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function BackdropPropLayer({ pattern, props, scale, inset = 0, selectedIndex, onSelect, onChangeProps, onDelete, onToggleHidden, onDeselect }) {
  const layerRef = useRef(null)
  const drag = useRef(null)

  function move(index, event) {
    if (drag.current?.index !== index || !layerRef.current) return
    const rect = layerRef.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = clamp(((event.clientX - rect.left - drag.current.offsetX) / rect.width) * 100, 0, 100)
    const y = clamp(((event.clientY - rect.top - drag.current.offsetY) / rect.height) * 100, 0, 100)
    const next = props.map((item, i) => (i === index ? { ...item, x: Math.round(x), y: Math.round(y) } : item))
    onChangeProps(next)
  }

  return (
    <div ref={layerRef} className="pointer-events-none absolute z-20 overflow-hidden" style={{ inset: inset > 0 ? `-${inset}px` : '0px' }} aria-label="Backdrop props">
      {props.map((prop, index) => {
        const size = prop.s * scale * HIT_MARGIN
        const label = propLabel(pattern, prop.k)
        const selected = selectedIndex === index
        return (
          <button
            key={`${index}-${prop.k}`}
            type="button"
            aria-label={`${label} at ${prop.x}, ${prop.y}${prop.h ? ', hidden' : ''}`}
            aria-pressed={selected}
            className={[
              'pointer-events-auto absolute touch-none rounded-sm border-2 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-white',
              selected ? 'border-orange-500 bg-orange-500/15' : 'border-transparent hover:border-white/70',
              prop.h ? 'border-dashed border-white/60 opacity-65' : '',
            ].join(' ')}
            style={{ left: `${prop.x}%`, top: `${prop.y}%`, width: size, height: size }}
            onPointerDown={(event) => {
              if (event.button !== 0) return
              event.preventDefault()
              const rect = layerRef.current?.getBoundingClientRect()
              if (!rect) return
              onSelect(index)
              drag.current = {
                index,
                offsetX: event.clientX - rect.left - (prop.x / 100) * rect.width,
                offsetY: event.clientY - rect.top - (prop.y / 100) * rect.height,
              }
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => move(index, event)}
            onPointerUp={() => { drag.current = null }}
            onPointerCancel={() => { drag.current = null }}
            onFocus={() => onSelect(index)}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 5 : 1
              const updates = {
                ArrowLeft: { x: clamp(prop.x - step, 0, 100) },
                ArrowRight: { x: clamp(prop.x + step, 0, 100) },
                ArrowUp: { y: clamp(prop.y - step, 0, 100) },
                ArrowDown: { y: clamp(prop.y + step, 0, 100) },
              }
              if (updates[event.key]) {
                event.preventDefault()
                onChangeProps(props.map((item, i) => (i === index ? { ...item, ...updates[event.key] } : item)))
              } else if (event.key === 'Delete' || event.key === 'Backspace') {
                event.preventDefault()
                onDelete(index)
              } else if (event.key.toLowerCase() === 'h') {
                event.preventDefault()
                onToggleHidden(index)
              } else if (event.key === 'Escape') {
                event.preventDefault()
                onDeselect()
              }
            }}
          />
        )
      })}
    </div>
  )
}

export function BackdropPropInspector({ pattern, prop, theme, selectionKey, onChange, onDelete, onToggleHidden }) {
  const [hex, setHex] = useState(prop?.c ?? '')
  const range = propSizeRange(pattern)
  const scheme = THEME_LOOKS[theme.look] ?? THEME_LOOKS.classic

  useEffect(() => setHex(prop?.c ?? ''), [selectionKey, prop?.c, prop?.k])
  if (!prop || !range) return <p className="text-sm text-ink-muted">Select a prop to edit it, or add one above.</p>

  const colours = [
    ['Accent', theme.accent ?? scheme.accent],
    ['Glow A', theme.glowA ?? scheme.glow[0]],
    ['Glow B', theme.glowB ?? scheme.glow[1]],
    ['Deep A', theme.deepA ?? scheme.deep[0]],
    ['Deep B', theme.deepB ?? scheme.deep[1]],
  ]
  const colorValue = (hex && COLOR.test(hex) ? hex : '#ff5a1f')
  const tiltless = PROP_TILTLESS.includes(prop.k)
  const commitHex = () => {
    if (COLOR.test(hex)) onChange({ c: hex.toLowerCase() })
    else setHex(prop.c ?? '')
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-low p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-ink-900">Selected: {propLabel(pattern, prop.k)}</p>
        <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete selected prop">
          <span className="material-symbols-outlined" aria-hidden="true">delete</span>
          Delete
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold text-ink">Size · {prop.s}px</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={prop.s <= range.min} onClick={() => onChange({ s: clamp(prop.s - 2, range.min, range.max) })} aria-label="Decrease prop size">−</Button>
            <Button variant="secondary" size="sm" disabled={prop.s >= range.max} onClick={() => onChange({ s: clamp(prop.s + 2, range.min, range.max) })} aria-label="Increase prop size">+</Button>
          </div>
        </div>
        {!tiltless && (
          <div>
            <p className="mb-1 text-xs font-semibold text-ink">Rotation · {prop.r}°</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => onChange({ r: clamp(prop.r - 5, -180, 180) })} aria-label="Rotate prop left">−</Button>
              <Button variant="secondary" size="sm" onClick={() => onChange({ r: clamp(prop.r + 5, -180, 180) })} aria-label="Rotate prop right">+</Button>
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-ink">Colour</p>
        <div className="flex flex-wrap items-center gap-2">
          {colours.map(([name, value]) => (
            <button
              key={name}
              type="button"
              aria-label={`${name} colour ${value}`}
              aria-pressed={prop.c?.toLowerCase() === value.toLowerCase()}
              onClick={() => { onChange({ c: value }); setHex(value) }}
              className={`h-8 w-8 rounded-full border-2 ${prop.c?.toLowerCase() === value.toLowerCase() ? 'border-ink-900 ring-2 ring-offset-2 ring-ink-900/30' : 'border-hairline'}`}
              style={{ backgroundColor: value }}
            />
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-hairline px-2 py-1 text-xs font-semibold text-ink-900">
            <input type="color" value={colorValue} onChange={(event) => { onChange({ c: event.target.value }); setHex(event.target.value) }} className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0" aria-label="Choose custom prop colour" />
            Custom
          </label>
          <Button variant="ghost" size="sm" onClick={() => { onChange({ c: null }); setHex('') }}>Inherit</Button>
        </div>
        <input
          type="text"
          value={hex}
          onChange={(event) => setHex(event.target.value)}
          onBlur={commitHex}
          onKeyDown={(event) => { if (event.key === 'Enter') { commitHex(); event.currentTarget.blur() } }}
          aria-label="Prop colour hex"
          placeholder="#rrggbb"
          className="mt-2 min-h-10 w-36 rounded-md border border-hairline bg-surface px-3 font-mono text-sm text-ink"
        />
      </div>

      <Button variant="secondary" size="sm" onClick={onToggleHidden}>
        <span className="material-symbols-outlined" aria-hidden="true">{prop.h ? 'visibility' : 'visibility_off'}</span>
        {prop.h ? 'Show prop' : 'Hide prop'}
      </Button>
    </div>
  )
}
