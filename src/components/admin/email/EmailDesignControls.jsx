import { useState } from 'react'
import {
  EMAIL_FONTS,
  EMAIL_PRESETS,
  HEADER_STYLES,
  STRIPE_STYLES,
  normalizeDesign,
  presetDesign,
} from '../../../../api/_lib/emailDesign.js'
import Toggle from '../../ui/Toggle'
import { ColorField, ControlSection, Segmented, Slider, ToggleIcon } from '../forms/DesignControls'
import EmailImageField from './EmailImageField'

const TABS = [
  { id: 'layout', label: 'Layout', icon: 'palette' },
  { id: 'colors', label: 'Colors', icon: 'brush' },
  { id: 'text', label: 'Text', icon: 'text_fields' },
  { id: 'header', label: 'Header', icon: 'panorama' },
  { id: 'button', label: 'Button', icon: 'smart_button' },
  { id: 'footer', label: 'Footer', icon: 'notes' },
  { id: 'card', label: 'Card', icon: 'tune' },
]

const COLOR_GROUPS = [
  {
    title: 'Page & card',
    fields: [
      ['page', 'Page background'],
      ['card', 'Card background'],
      ['border', 'Borders & lines'],
    ],
  },
  {
    title: 'Text',
    fields: [
      ['text', 'Body text'],
      ['heading', 'Headings & title'],
      ['muted', 'Muted text'],
      ['link', 'Links & accents'],
    ],
  },
  {
    title: 'Header',
    fields: [
      ['headerBg', 'Header bar'],
      ['headerText', 'Header text'],
      ['tagBg', 'Tag background'],
      ['tagText', 'Tag text'],
    ],
  },
  {
    title: 'Button',
    fields: [
      ['buttonBg', 'Button color'],
      ['buttonText', 'Button text'],
    ],
  },
  {
    title: 'Highlight box & stripe',
    fields: [
      ['calloutBg', 'Highlight background'],
      ['calloutBorder', 'Highlight accent'],
      ['stripeA', 'Stripe / divider color'],
      ['stripeB', 'Stripe second color'],
    ],
  },
  {
    title: 'Footer',
    fields: [
      ['footerBg', 'Footer background'],
      ['footerText', 'Footer text'],
    ],
  },
]

function TextInput({ label, value, onChange, placeholder, helper }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-10 rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand"
      />
      {helper && <span className="text-xs text-ink-muted">{helper}</span>}
    </label>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-10 rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function PresetSwatch({ preset, active, onPick }) {
  const d = presetDesign(preset.id)
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      title={preset.description}
      className={[
        'flex flex-col gap-1.5 rounded-lg border-2 p-1.5 text-left transition-colors duration-150',
        active ? 'border-green-900' : 'border-transparent hover:border-hairline',
      ].join(' ')}
    >
      <span className="relative block h-16 overflow-hidden rounded-md border border-hairline" style={{ background: d.colors.page }}>
        <span className="absolute inset-x-2 top-2 bottom-0 overflow-hidden rounded-t-sm" style={{ background: d.colors.card }}>
          {d.stripe !== 'none' && <span className="block h-1" style={{ background: d.stripe === 'split' ? d.colors.stripeA : d.colors.calloutBorder }} />}
          <span className="block h-3" style={{ background: d.header.style === 'bar' ? d.colors.headerBg : d.colors.card }} />
          <span className="mx-2 mt-2 block h-1.5 w-10 rounded-full" style={{ background: d.colors.heading, marginInline: d.title.align === 'center' ? 'auto' : undefined }} />
          <span className="mx-2 mt-1.5 block h-1 w-14 rounded-full opacity-40" style={{ background: d.colors.text, marginInline: d.title.align === 'center' ? 'auto' : undefined }} />
          {d.button.show && <span className="mx-2 mt-1.5 block h-2 w-6 rounded-full" style={{ background: d.colors.buttonBg, marginInline: d.button.align === 'center' ? 'auto' : undefined }} />}
        </span>
      </span>
      <span className="px-0.5 text-xs font-semibold text-ink">{preset.label}</span>
    </button>
  )
}

/** Every setting that shapes how an email looks. Controlled: `design` in, `onChange(design)` out. */
export default function EmailDesignControls({ design, onChange, hidePresets = false }) {
  const [tab, setTab] = useState(hidePresets ? 'colors' : 'layout')
  const d = normalizeDesign(design)
  const tabs = hidePresets ? TABS.filter((t) => t.id !== 'layout') : TABS

  const update = (patch) => onChange(normalizeDesign({ ...d, ...patch }))
  const updateIn = (key, patch) => update({ [key]: { ...d[key], ...patch } })

  function applyPreset(id) {
    const next = presetDesign(id)
    // A chosen logo and header banner belong to the brand, not the layout, so they survive switching.
    onChange({ ...next, header: { ...next.header, logo: d.header.logo, logoUrl: d.header.logoUrl, banner: d.header.banner, wordmark: d.header.wordmark } })
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-hairline px-2 py-2">
        {tabs.map((item) => (
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
        {tab === 'layout' && (
          <ControlSection title="Start from a layout">
            <div className="grid grid-cols-2 gap-2">
              {EMAIL_PRESETS.map((p) => (
                <PresetSwatch key={p.id} preset={p} active={d.layout === p.id} onPick={() => applyPreset(p.id)} />
              ))}
            </div>
            <p className="text-xs text-ink-muted">A layout is only a starting point — every setting stays editable.</p>
          </ControlSection>
        )}

        {tab === 'colors' &&
          COLOR_GROUPS.map((group) => (
            <ControlSection key={group.title} title={group.title}>
              {group.fields.map(([key, label]) => (
                <ColorField key={key} label={label} value={d.colors[key]} onChange={(v) => updateIn('colors', { [key]: v })} />
              ))}
            </ControlSection>
          ))}

        {tab === 'text' && (
          <>
            <ControlSection title="Fonts">
              <Select label="Title & heading font" value={d.fonts.heading} options={EMAIL_FONTS} onChange={(heading) => updateIn('fonts', { heading })} />
              <Select label="Body font" value={d.fonts.body} options={EMAIL_FONTS} onChange={(body) => updateIn('fonts', { body })} />
              <p className="text-xs text-ink-muted">Only fonts every inbox can show, so the email looks the same for everyone.</p>
            </ControlSection>
            <ControlSection title="Title">
              <Toggle checked={d.title.show} onChange={(show) => updateIn('title', { show })} label="Show the subject as a title" />
              <div className="flex flex-wrap gap-1.5">
                <ToggleIcon icon="format_bold" label="Bold" active={d.title.bold} onClick={() => updateIn('title', { bold: !d.title.bold })} />
                <ToggleIcon icon="format_italic" label="Italic" active={d.title.italic} onClick={() => updateIn('title', { italic: !d.title.italic })} />
                <ToggleIcon icon="format_underlined" label="Underline" active={d.title.underline} onClick={() => updateIn('title', { underline: !d.title.underline })} />
                <span className="mx-1 w-px self-stretch bg-hairline" />
                <ToggleIcon icon="format_align_left" label="Align left" active={d.title.align === 'left'} onClick={() => updateIn('title', { align: 'left' })} />
                <ToggleIcon icon="format_align_center" label="Align center" active={d.title.align === 'center'} onClick={() => updateIn('title', { align: 'center' })} />
                <ToggleIcon icon="format_align_right" label="Align right" active={d.title.align === 'right'} onClick={() => updateIn('title', { align: 'right' })} />
              </div>
              <Slider label="Title size" value={d.sizes.title} min={16} max={56} unit="px" onChange={(title) => updateIn('sizes', { title })} />
              <ColorField label="Title color" value={d.title.color} allowClear fallback={d.colors.heading} onChange={(color) => updateIn('title', { color })} />
            </ControlSection>
            <ControlSection title="Body text">
              <Slider label="Size" value={d.sizes.body} min={12} max={22} unit="px" onChange={(body) => updateIn('sizes', { body })} />
              <Slider label="Line spacing" value={d.sizes.lineHeight} min={1.2} max={2.2} step={0.05} onChange={(lineHeight) => updateIn('sizes', { lineHeight })} />
            </ControlSection>
          </>
        )}

        {tab === 'header' && (
          <>
            <ControlSection title="Header">
              <Segmented label="Style" value={d.header.style} options={HEADER_STYLES} onChange={(style) => updateIn('header', { style })} />
              <Toggle checked={d.header.rule} onChange={(rule) => updateIn('header', { rule })} label="Line under the header" />
              <Segmented
                label="Logo"
                value={d.header.logo}
                options={[
                  { value: 'site', label: 'NAMMES logo' },
                  { value: 'custom', label: 'My logo' },
                  { value: 'none', label: 'None' },
                ]}
                onChange={(logo) => updateIn('header', { logo })}
              />
              {d.header.logo === 'custom' && (
                <EmailImageField
                  label="Logo"
                  simple
                  value={d.header.logoUrl ? { url: d.header.logoUrl, src: d.header.logoUrl, adjust: {} } : null}
                  onChange={(v) => updateIn('header', { logoUrl: v?.url ?? '' })}
                />
              )}
              <TextInput label="Name next to logo" value={d.header.wordmark} onChange={(wordmark) => updateIn('header', { wordmark })} placeholder="NAMMES Hub" />
              <TextInput label="Tag" value={d.header.tag} onChange={(tag) => updateIn('header', { tag })} placeholder="Official Notice" helper="Small label in the header. Leave empty to hide." />
              <TextInput
                label="Eyebrow line"
                value={d.header.eyebrow}
                onChange={(eyebrow) => updateIn('header', { eyebrow })}
                placeholder="Announcement · {{date}}"
                helper="Use {{date}}, {{date_full}} for today's date."
              />
              <Toggle checked={d.header.dateBadge} onChange={(dateBadge) => updateIn('header', { dateBadge })} label="Show today's date badge" />
            </ControlSection>
            <ControlSection title="Banner image">
              <EmailImageField
                label="Banner"
                layout={false}
                aspects={['free', '3:1', '21:9', '16:9', '4:3']}
                defaultAspect="3:1"
                value={d.header.banner}
                onChange={(banner) => updateIn('header', { banner })}
              />
            </ControlSection>
            <ControlSection title="Decoration">
              <Segmented label="Top stripe" value={d.stripe} options={STRIPE_STYLES} onChange={(stripe) => update({ stripe })} />
              <Toggle checked={d.callout} onChange={(callout) => update({ callout })} label="Put the message in a highlight box" />
              <Toggle checked={d.divider} onChange={(divider) => update({ divider })} label="Short divider under the title" />
            </ControlSection>
          </>
        )}

        {tab === 'button' && (
          <ControlSection title="Call-to-action button">
            <Toggle checked={d.button.show} onChange={(show) => updateIn('button', { show })} label="Show a button at the end of every email" />
            {d.button.show && (
              <>
                <TextInput label="Button text" value={d.button.text} onChange={(text) => updateIn('button', { text })} />
                <TextInput
                  label="Button link"
                  value={d.button.url}
                  onChange={(url) => updateIn('button', { url })}
                  placeholder="https://… or site:/events"
                  helper="https:// link, or site:/path for a page on NAMMES Hub."
                />
                <Segmented
                  label="Style"
                  value={d.button.style}
                  options={[
                    { value: 'filled', label: 'Filled' },
                    { value: 'outline', label: 'Outline' },
                  ]}
                  onChange={(style) => updateIn('button', { style })}
                />
                <Slider label="Corner roundness" value={Math.min(d.button.radius, 40)} min={0} max={40} unit="px" onChange={(radius) => updateIn('button', { radius: radius >= 40 ? 999 : radius })} />
                <Segmented
                  label="Alignment"
                  value={d.button.align}
                  options={[
                    { value: 'left', label: 'Left' },
                    { value: 'center', label: 'Center' },
                    { value: 'right', label: 'Right' },
                  ]}
                  onChange={(align) => updateIn('button', { align })}
                />
              </>
            )}
            <p className="text-xs text-ink-muted">You can also add buttons anywhere in an email as content blocks.</p>
          </ControlSection>
        )}

        {tab === 'footer' && (
          <ControlSection title="Footer">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink">Footer text</span>
              <textarea
                value={d.footer.text}
                onChange={(e) => updateIn('footer', { text: e.target.value })}
                rows={5}
                className="rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand"
              />
              <span className="text-xs text-ink-muted">One line per row. Links like [label](https://…) work.</span>
            </label>
            <Toggle checked={d.footer.showPrefs} onChange={(showPrefs) => updateIn('footer', { showPrefs })} label="Show “Manage notification preferences” link" />
          </ControlSection>
        )}

        {tab === 'card' && (
          <ControlSection title="Card">
            <Slider label="Width" value={d.card.width} min={420} max={700} unit="px" onChange={(width) => updateIn('card', { width })} />
            <Slider label="Inner spacing" value={d.card.padding} min={16} max={64} unit="px" onChange={(padding) => updateIn('card', { padding })} />
            <Slider label="Rounded corners" value={d.card.radius} min={0} max={32} unit="px" onChange={(radius) => updateIn('card', { radius })} />
            <Toggle checked={d.card.border} onChange={(border) => updateIn('card', { border })} label="Outline" />
          </ControlSection>
        )}
      </div>
    </div>
  )
}
