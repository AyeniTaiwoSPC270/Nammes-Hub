import Button from '../../ui/Button'
import {
  BACKDROP_PROP_PRESETS,
  PATTERN_GLYPHS,
  applyBackdropPreset,
  defaultBackdropProps,
} from '../../../../api/_lib/quizTheme.js'

function MiniProp({ pattern, prop }) {
  const glyph = PATTERN_GLYPHS[pattern]?.[prop.k]
  if (glyph) return <span className="font-bold leading-none">{glyph}</span>
  if (prop.k === 'ring') {
    return <span className="grid h-2 w-2 place-items-center rounded-full border border-current"><span className="h-1 w-1 rounded-full border border-current" /></span>
  }
  if (prop.k === 'hex') {
    return (
      <svg viewBox="0 0 100 100" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="12" aria-hidden="true">
        <polygon points="50,5 89,27 89,73 50,95 11,73 11,27" />
      </svg>
    )
  }
  const partyShapes = {
    balloon: <><ellipse cx="50" cy="40" rx="24" ry="30" /><path d="M50 70c8 8-8 12 0 20" /></>,
    hat: <><path d="M18 78 50 14 82 78Z" /><path d="M14 82h72" /></>,
    streamer: <path d="M22 10c34 0 34 24 0 24s-34 24 0 24 34 24 0 24" />,
    confetti: <rect x="37" y="24" width="26" height="52" rx="3" />,
  }
  return (
    <svg viewBox="0 0 100 100" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="9" aria-hidden="true">
      {partyShapes[prop.k]}
    </svg>
  )
}

function PresetThumbnail({ pattern, preset }) {
  const source = defaultBackdropProps(pattern).slice(0, 10)
  const props = applyBackdropPreset(pattern, source, preset.id)
  return (
    <div className="relative aspect-[3/2] overflow-hidden rounded-md bg-green-950/90 text-brand" aria-hidden="true">
      {props.map((prop, index) => (
        <span
          key={`${preset.id}-${index}`}
          className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center"
          style={{ left: `${prop.x}%`, top: `${prop.y}%`, width: 10, height: 10, fontSize: 9 }}
        >
          <MiniProp pattern={pattern} prop={prop} />
        </span>
      ))}
    </div>
  )
}

export default function BackdropPresetPicker({ pattern, selectedPreset, onSelect, onApply, disabled = false }) {
  const groups = [
    ['repeat', 'Decorative repeats'],
    ['arrangement', 'Prop arrangements'],
  ]

  return (
    <section aria-label="Backdrop pattern picker" className="rounded-xl border border-hairline bg-surface-low p-3">
      <h3 className="mb-2 text-sm font-bold text-ink-900">Pattern picker</h3>
      {groups.map(([group, label]) => {
        const presets = BACKDROP_PROP_PRESETS.filter((preset) => preset.group === group)
        return (
          <div key={group} className="mb-3 last:mb-0">
            <p className="mb-1.5 text-xs font-semibold text-ink-muted">{label} · {presets.length}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  data-preset-id={preset.id}
                  aria-pressed={selectedPreset === preset.id}
                  disabled={disabled}
                  onClick={() => onSelect(preset.id)}
                  className={[
                    'rounded-lg border p-1.5 text-left text-xs font-semibold text-ink-900 transition-colors',
                    selectedPreset === preset.id
                      ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30'
                      : 'border-hairline bg-surface hover:bg-surface-low',
                    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <PresetThumbnail pattern={pattern} preset={preset} />
                  <span className="mt-1 block truncate">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
      <Button variant="secondary" size="sm" className="w-full" disabled={disabled || !selectedPreset} onClick={onApply}>
        Apply selected style
      </Button>
    </section>
  )
}
