import { THEME_LOOKS, themeCssVars, contrastWithWhite } from '../../../../api/_lib/quizTheme.js'
import Button from '../../ui/Button'

// The two rows under the colour scheme buttons: the faint tint behind every screen, and the dark gradient behind the
// "Join the game" banner and the podium. Each row is a pair because each is drawn as a gradient — one end on its own is
// not a state an admin ever wants.
//
// Every colour shown here is the *resolved* one, read back out of themeCssVars rather than derived in this file: the
// precedence chain is easy to get wrong and is unit-tested exactly once, in quizTheme.js. Only the chosen-ring reads the
// raw value, so a preset colour is never shown as picked when the admin has only picked a scheme.

const PAIRS = [
  {
    keys: ['glowA', 'glowB'],
    vars: { glowA: '--qz-glow-a', glowB: '--qz-glow-b' },
    label: 'Glow',
    hint: 'The faint tint behind every screen. It follows your accent until you set it yourself.',
    clear: 'Use the scheme’s glow',
    // Each picker swatches the same end of the gradient across every scheme, so one can be lifted onto another.
    from: { glowA: (look) => look.glow[0], glowB: (look) => look.glow[1] },
    warn: null,
  },
  {
    keys: ['deepA', 'deepB'],
    vars: { deepA: '--qz-deep-a', deepB: '--qz-deep-b' },
    label: 'Banner',
    hint: 'The dark gradient behind “Join the game” and the podium.',
    clear: 'Use the scheme’s banner',
    from: { deepA: (look) => look.deep[0], deepB: (look) => look.deep[1] },
    // White text sits on the banner by construction — text-white is hardcoded on every qz-deep panel — so a pale banner
    // is something the admin has to be told about rather than refused. 4.5 is the body-text threshold; every preset
    // measures 7 or more, so no built-in scheme can trip it.
    warn: {
      below: 4.5,
      text: 'White text on this banner is hard to read on a projector. A darker shade reads better.',
    },
  },
]

// The eight presets are the fast path and the colour input is the escape hatch, so both sit on one line — but only one
// end of the gradient fits on a line at all. The studio's control column is 420px wide with p-5 on it, leaving 380px of
// content: a tag at 16px, nine items at 32px and eight gaps at 6px comes to 352px. Two of these side by side is 704px,
// which is why the ends are stacked rather than set flex-1 against each other — flex-1 does not wrap, it squeezes, and
// two squeezed strips overlap their own controls instead of falling onto a second line.
function Picker({ tag, name, raw, shown, from, onPick }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-4 shrink-0 text-xs font-bold uppercase text-ink-muted">{tag}</span>
      {Object.entries(THEME_LOOKS).map(([id, look]) => {
        const hex = from(look)
        return (
          <button
            key={id}
            type="button"
            onClick={() => onPick(hex)}
            aria-label={`${name}: ${look.name} ${hex}`}
            aria-pressed={raw === hex}
            className={['h-8 w-8 shrink-0 cursor-pointer rounded-full border-2', raw === hex ? 'border-ink-900 ring-2 ring-ink-900/30' : 'border-transparent'].join(' ')}
            style={{ background: hex }}
          />
        )
      })}
      <input
        type="color"
        value={shown}
        onChange={(e) => onPick(e.target.value)}
        className="h-8 w-8 shrink-0 cursor-pointer rounded-full border-2 border-hairline bg-transparent p-0"
        aria-label={`Custom ${name.toLowerCase()} colour`}
        title="Any other colour"
      />
    </div>
  )
}

export default function SchemeColours({ theme, onChange }) {
  const vars = themeCssVars(theme)
  return (
    <div className="mt-4 flex flex-col gap-5 border-t border-hairline pt-4">
      {PAIRS.map(({ keys, vars: names, label, hint, clear, from, warn }) => {
        const [aKey, bKey] = keys
        // A missing key means the scheme's own colour, exactly as a null one does, so a partial theme renders the clear
        // button no more often than a saved one does.
        const customised = keys.some((k) => (theme[k] ?? null) !== null)
        const worst = warn ? Math.min(contrastWithWhite(vars[names[aKey]]), contrastWithWhite(vars[names[bKey]])) : Infinity
        return (
          <div key={aKey} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-ink-900">{label}</span>
              {customised && (
                <Button variant="secondary" size="sm" onClick={() => onChange({ [aKey]: null, [bKey]: null })}>{clear}</Button>
              )}
            </div>
            <span
              className="h-2 w-full rounded-full border border-black/10"
              style={{ background: `linear-gradient(90deg, ${vars[names[aKey]]}, ${vars[names[bKey]]})` }}
              aria-hidden="true"
            />
            <Picker tag="A" name={`${label} A`} raw={theme[aKey] ?? null} shown={vars[names[aKey]]} from={from[aKey]} onPick={(hex) => onChange({ [aKey]: hex })} />
            <Picker tag="B" name={`${label} B`} raw={theme[bKey] ?? null} shown={vars[names[bKey]]} from={from[bKey]} onPick={(hex) => onChange({ [bKey]: hex })} />
            <p className="text-sm text-ink-muted">{hint}</p>
            {warn && worst < warn.below && (
              <p role="status" className="mt-1 rounded-lg bg-orange-500/10 p-3 text-sm text-ink-900">{warn.text}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}