// Every setting that shapes how /calendar looks. Controlled: a raw `draft` theme in, `onChange(draft)` out.
// Modelled on EmailDesignControls.jsx, which is the same job for a different surface.
//
// The draft is deliberately *raw* and only ever cleaned for display (sanitizeTheme below). `sanitizeTheme` is not
// idempotent for a custom hex: it reads a colour from the `color` key only, so re-applying it to its own output drops
// the hex it just produced (api/_lib/calendarTheme.js:96). Sanitising on every keystroke would therefore wipe the
// admin's Advanced colour the moment they touched anything else. Keeping the draft raw is the same discipline as
// AdminQuizStudio.jsx:112 -- the draft holds what was typed, and cleaning happens once, where it is rendered and
// where it is saved.
import { useState } from 'react'
import {
  CALENDAR_DENSITIES,
  CALENDAR_RADII,
  DEFAULT_THEME,
  KIND_ORDER,
  SOURCE_ORDER,
  SWATCHES,
  sanitizeTheme,
} from '../../../api/_lib/calendarTheme.js'
import Toggle from '../ui/Toggle'
import FormField from '../ui/FormField'
import { ColorField, ControlSection, Segmented, Slider, ToggleIcon } from '../admin/forms/DesignControls'

const TABS = [
  { id: 'accents', label: 'Accents', icon: 'brush' },
  { id: 'grid', label: 'Grid', icon: 'calendar_month' },
  { id: 'defaults', label: 'Defaults', icon: 'tune' },
  { id: 'page', label: 'Page', icon: 'palette' },
]

// The icons a kind may be given.
//
// `sanitizeTheme` will accept any lowercase word as an icon name, and an icon the font was not asked to load renders
// as its own name in text on the calendar. So the picker cannot be an open field: it is this list, and
// CalendarDesignControls.test.js holds every entry against the `icon_names=` list in index.html.
const KIND_ICON_CHOICES = [
  'school',
  'menu_book',
  'assignment',
  'edit_note',
  'beach_access',
  'workspace_premium',
  'groups',
  'event',
  'calendar_month',
  'flag',
  'how_to_reg',
  'military_tech',
]

const SOURCE_LABELS = { academic: 'Academic calendar', event: 'Departmental events' }

// The eight curated colours, drawn with the token each swatch names rather than a hex copied out of index.css, so a
// swatch tile is whatever that token currently is -- which is also why the list follows the site into dark mode.
function SwatchPicker({ label, color, hex, onPick }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch.id}
            type="button"
            onClick={() => onPick(swatch.id)}
            aria-pressed={!hex && color === swatch.id}
            aria-label={swatch.label}
            title={swatch.label}
            className={[
              'flex h-9 w-9 items-center justify-center rounded-md border-2 transition-colors duration-150',
              !hex && color === swatch.id ? 'border-green-900' : 'border-hairline hover:border-brand',
            ].join(' ')}
          >
            <span className="h-5 w-5 rounded-sm" style={{ background: `var(${swatch.token})` }} aria-hidden="true" />
          </button>
        ))}
      </div>
      {hex && <p className="text-xs text-ink-muted">Using a custom colour. Pick a swatch above to go back to one.</p>}
    </div>
  )
}

// Hidden until asked for: eight curated colours cover almost every calendar, and a free hex field sitting open on the
// page invites a colour nobody chose. Collapsed is also what makes "this is the unusual thing" legible.
function AdvancedColor({ open, onToggle, value, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-9 items-center gap-1.5 self-start rounded-md px-2 text-xs font-semibold text-brand hover:bg-surface-low"
      >
        <span className="material-symbols-outlined text-base">{open ? 'expand_less' : 'expand_more'}</span>
        Advanced colour
      </button>
      {open && (
        <div className="flex flex-col gap-1.5">
          {/* No `fallback`: an <input type="color"> only accepts a hex, and the value of a swatch is a token name, not
              a colour this file is allowed to write down. ColorField's own default stands in while the field is empty. */}
          <ColorField label="Custom colour" value={value} allowClear onChange={onChange} />
          <p className="text-xs text-ink-muted">
            A colour outside the eight above is kept as its own value. Anything that is not a hex falls back to the
            swatch this kind started on, so the calendar always has a colour it can paint.
          </p>
        </div>
      )}
    </div>
  )
}

function IconPicker({ value, onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {KIND_ICON_CHOICES.map((icon) => (
        <ToggleIcon key={icon} icon={icon} label={icon.replace(/_/g, ' ')} active={value === icon} onClick={() => onPick(icon)} />
      ))}
    </div>
  )
}

/** Every calendar setting, grouped into tabs. `draft` in, a new `draft` out; nothing is written to the database here. */
export default function CalendarDesignControls({ draft, onChange }) {
  const [tab, setTab] = useState('accents')
  const [advanced, setAdvanced] = useState({})

  // The single place a value is judged. Everything below reads this, never `draft`, so the admin is always looking at
  // what the calendar will actually render rather than at what they typed.
  const theme = sanitizeTheme(draft)

  const changeIn = (key, patch) => onChange({ ...draft, [key]: { ...draft?.[key], ...patch } })
  const changeAccent = (kind, patch) =>
    onChange({ ...draft, accents: { ...draft?.accents, [kind]: { ...draft?.accents?.[kind], ...patch } } })

  // The hex is written to `color`, the only key sanitizeTheme reads a colour from, and it is handed back as the
  // swatch the kind already had plus the hex in `hex`. Clearing it puts that swatch back rather than the seeded
  // default, so an admin who picked Flame and then typed a hex gets Flame back and not Brand.
  const setAccentColor = (kind, swatchId, hex) => changeAccent(kind, { color: hex || swatchId })

  const toggleKind = (kind) => {
    const current = theme.defaults.kinds
    const next = current.includes(kind) ? current.filter((one) => one !== kind) : [...current, kind]
    changeIn('defaults', { kinds: next })
  }

  const toggleSource = (source) => {
    const current = theme.defaults.sources
    const next = current.includes(source) ? current.filter((one) => one !== source) : [...current, source]
    changeIn('defaults', { sources: next })
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-hairline px-2 py-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={[
              'flex min-h-10 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors duration-150',
              tab === item.id ? 'bg-green-900 text-white' : 'text-ink hover:bg-surface-low',
            ].join(' ')}
          >
            <span className="material-symbols-outlined text-base">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        {tab === 'accents' &&
          KIND_ORDER.map((kind) => {
            const accent = theme.accents[kind]
            const isOpen = Boolean(advanced[kind])
            return (
              <ControlSection
                key={kind}
                title={DEFAULT_THEME.accents[kind].label}
                action={
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                    <span className="material-symbols-outlined text-base">{accent.icon}</span>
                    {accent.label}
                    <span
                      className="h-3 w-3 rounded-sm"
                      style={{ background: accent.hex || `var(--cal-${kind})` }}
                      aria-hidden="true"
                    />
                  </span>
                }
              >
                <FormField
                  label={`${DEFAULT_THEME.accents[kind].label} label`}
                  value={accent.label}
                  maxLength={60}
                  onChange={(event) => changeAccent(kind, { label: event.target.value })}
                />
                <SwatchPicker
                  label="Colour"
                  color={accent.color}
                  hex={accent.hex}
                  onPick={(swatchId) => setAccentColor(kind, swatchId, '')}
                />
                <AdvancedColor
                  open={isOpen}
                  onToggle={() => setAdvanced((current) => ({ ...current, [kind]: !current[kind] }))}
                  value={accent.hex}
                  onChange={(hex) => setAccentColor(kind, accent.color, hex)}
                />
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-ink">Icon</span>
                  <IconPicker value={accent.icon} onPick={(icon) => changeAccent(kind, { icon })} />
                </div>
              </ControlSection>
            )
          })}

        {tab === 'grid' && (
          <>
            <ControlSection title="Week">
              <Segmented
                label="Week starts on"
                value={String(theme.grid.weekStart)}
                options={[
                  { value: '1', label: 'Monday' },
                  { value: '0', label: 'Sunday' },
                ]}
                onChange={(weekStart) => changeIn('grid', { weekStart: Number(weekStart) })}
              />
              <Toggle
                checked={theme.grid.showWeekends}
                onChange={(showWeekends) => changeIn('grid', { showWeekends })}
                label="Show Saturdays and Sundays"
                description="Turning them off gives weekdays five columns instead of seven."
              />
            </ControlSection>
            <ControlSection title="Space">
              {/* Density lives on `page` in the theme because that is where themeVars reads it from, but it is a
                  grid setting and reads as one here. */}
              <Segmented
                label="Density"
                value={theme.page.density}
                options={CALENDAR_DENSITIES.map((density) => ({
                  value: density,
                  label: density === 'comfortable' ? 'Comfortable' : 'Compact',
                }))}
                onChange={(density) => changeIn('page', { density })}
              />
              <Slider
                label="Items per day before “more”"
                value={theme.grid.maxPerDay}
                min={1}
                max={12}
                onChange={(maxPerDay) => changeIn('grid', { maxPerDay })}
              />
            </ControlSection>
            <ControlSection title="Highlights">
              <Toggle
                checked={theme.highlight.today}
                onChange={(today) => changeIn('highlight', { today })}
                label="Ring today's date"
              />
              <Toggle
                checked={theme.highlight.nextUp}
                onChange={(nextUp) => changeIn('highlight', { nextUp })}
                label="Show the “Next up” strip"
                description="The few items running or coming up, above the grid."
              />
            </ControlSection>
          </>
        )}

        {tab === 'defaults' && (
          <>
            <ControlSection title="Landing view">
              <Segmented
                label="The calendar opens on"
                value={theme.defaults.view}
                options={[
                  { value: 'month', label: 'Month' },
                  { value: 'agenda', label: 'Agenda' },
                ]}
                onChange={(view) => changeIn('defaults', { view })}
              />
              <p className="text-xs text-ink-muted">Phones open on the agenda whatever this says -- a seven column grid does not fit.</p>
            </ControlSection>
            <ControlSection title="Kinds switched on">
              {KIND_ORDER.map((kind) => (
                <Toggle
                  key={kind}
                  checked={theme.defaults.kinds.includes(kind)}
                  onChange={() => toggleKind(kind)}
                  label={theme.accents[kind].label}
                />
              ))}
              <p className="text-xs text-ink-muted">
                The last one cannot be turned off: a calendar with nothing switched on has nothing to show, so the
                shared theme rules put them all back.
              </p>
            </ControlSection>
            <ControlSection title="Sources switched on">
              {SOURCE_ORDER.map((source) => (
                <Toggle
                  key={source}
                  checked={theme.defaults.sources.includes(source)}
                  onChange={() => toggleSource(source)}
                  label={SOURCE_LABELS[source]}
                />
              ))}
              <p className="text-xs text-ink-muted">Readers can still change this themselves; this is what they start with.</p>
            </ControlSection>
          </>
        )}

        {tab === 'page' && (
          <>
            <ControlSection title="Accent">
              <SwatchPicker
                label="Page accent"
                color={theme.page.accent}
                hex={theme.page.hex}
                onPick={(swatchId) => changeIn('page', { accent: swatchId })}
              />
              <AdvancedColor
                open={Boolean(advanced.page)}
                onToggle={() => setAdvanced((current) => ({ ...current, page: !current.page }))}
                value={theme.page.hex}
                onChange={(hex) => changeIn('page', { accent: hex || theme.page.accent })}
              />
              <p className="text-xs text-ink-muted">
                The accent is links, the “more” links and the view switch on the calendar page.
              </p>
            </ControlSection>
            <ControlSection title="Shape">
              <Segmented
                label="Corner roundness"
                value={theme.page.radius}
                options={CALENDAR_RADII.map((radius) => ({
                  value: radius,
                  label: { sm: 'Small', md: 'Medium', lg: 'Large', full: 'Round' }[radius],
                }))}
                onChange={(radius) => changeIn('page', { radius })}
              />
            </ControlSection>
          </>
        )}
      </div>
    </div>
  )
}