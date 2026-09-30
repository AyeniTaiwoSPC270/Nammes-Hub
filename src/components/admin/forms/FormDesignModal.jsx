import { useEffect, useState } from 'react'
import { useBodyScrollLock } from '../../../lib/useBodyScrollLock'
import {
  CARD_SHADOWS,
  DEFAULT_THEME,
  FORM_PRESETS,
  FORM_WIDTHS,
  PAGE_TYPES,
  applyPreset,
  cardGap,
  cardPadding,
  cardStyle,
  normalizeTheme,
  pageBackground,
} from '../../../lib/formTheme'
import FormThemeShell, { FormHeaderCard } from '../../forms/FormThemeShell'
import QuestionField from '../../forms/QuestionField'
import Toggle from '../../ui/Toggle'
import { ColorField, ControlSection, FontSelect, Segmented, Slider, TextStyleControls } from './DesignControls'
import ImageAdjuster from './ImageAdjuster'

const TABS = [
  { id: 'themes', label: 'Themes', icon: 'palette' },
  { id: 'background', label: 'Background', icon: 'image' },
  { id: 'cards', label: 'Cards', icon: 'brush' },
  { id: 'text', label: 'Text', icon: 'text_fields' },
  { id: 'header', label: 'Header', icon: 'panorama' },
  { id: 'layout', label: 'Layout', icon: 'tune' },
]

const HEADER_ASPECTS = ['3:1', '21:9', '16:9', '4:3', '1:1']

function presetSwatch(patch) {
  const t = normalizeTheme(patch)
  const bg = pageBackground(t)
  return {
    page: bg?.gradient ?? bg?.base ?? t.page.color,
    card: t.card.color,
    accent: t.accent,
    text: t.text.color,
  }
}

function PresetButton({ preset, active, onPick }) {
  const s = presetSwatch({ ...preset.patch, page: { ...(preset.patch.page ?? {}), type: preset.patch.page?.type ?? 'color' } })
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={[
        'flex flex-col gap-1.5 rounded-lg border-2 p-1.5 text-left transition-colors duration-150',
        active ? 'border-green-900' : 'border-transparent hover:border-hairline',
      ].join(' ')}
    >
      <span className="relative block h-16 overflow-hidden rounded-md" style={{ background: s.page }}>
        <span className="absolute inset-x-2 top-2 bottom-2 rounded-sm" style={{ background: s.card, opacity: 0.95 }}>
          <span className="absolute left-2 top-2 h-1.5 w-8 rounded-full" style={{ background: s.text }} />
          <span className="absolute left-2 top-5 h-1 w-12 rounded-full opacity-50" style={{ background: s.text }} />
          <span className="absolute bottom-2 left-2 h-3 w-8 rounded-sm" style={{ background: s.accent }} />
        </span>
      </span>
      <span className="px-0.5 text-xs font-semibold text-ink">{preset.label}</span>
    </button>
  )
}

function PreviewQuestions({ questions, theme }) {
  const [answers, setAnswers] = useState({})
  const card = { ...cardStyle(theme), padding: cardPadding(theme) }
  return (
    <div className="mt-4 flex flex-col" style={{ gap: cardGap(theme) }}>
      {questions.map((q) => (
        <div key={q.id} style={card}>
          <QuestionField
            question={{ ...q, label: q.label || 'Untitled question' }}
            value={answers[q.id]}
            onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
            theme={theme}
          />
        </div>
      ))}
      <div>
        <span className="inline-flex min-h-11 items-center rounded-md bg-green-900 px-7 py-3 font-body font-bold text-white">Submit</span>
      </div>
    </div>
  )
}

export default function FormDesignModal({ theme, onChange, form, questions, onClose }) {
  useBodyScrollLock()
  const [tab, setTab] = useState('themes')
  const [mobilePane, setMobilePane] = useState('controls')
  const t = theme ? normalizeTheme(theme) : DEFAULT_THEME

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const update = (patch) => onChange(normalizeTheme({ ...t, ...patch }))
  const updateIn = (key, patch) => update({ [key]: { ...t[key], ...patch } })

  return (
    <div role="dialog" aria-modal="true" aria-label="Design form" className="fixed inset-0 z-50 flex flex-col bg-paper">
      <div className="flex items-center justify-between gap-3 border-b border-hairline bg-surface px-4 py-3">
        <h2 className="text-lg font-bold text-ink-900">Design form</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-low"
          >
            <span className="material-symbols-outlined text-base">restart_alt</span>
            <span className="hidden sm:inline">Reset to default</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-md bg-green-900 px-5 text-sm font-bold text-white hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-hairline bg-surface px-3 py-2 lg:hidden">
        <Segmented
          value={mobilePane}
          onChange={setMobilePane}
          options={[
            { value: 'controls', label: 'Controls' },
            { value: 'preview', label: 'Preview' },
          ]}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[380px_1fr]">
        <div className={['min-h-0 flex-col border-hairline bg-surface lg:flex lg:border-r', mobilePane === 'controls' ? 'flex' : 'hidden'].join(' ')}>
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
            {tab === 'themes' && (
              <>
                <ControlSection title="Start from a theme">
                  <div className="grid grid-cols-2 gap-2">
                    {FORM_PRESETS.map((p) => (
                      <PresetButton key={p.id} preset={p} active={theme && t.preset === p.id} onPick={() => onChange(applyPreset(p.id, t))} />
                    ))}
                  </div>
                  <p className="text-xs text-ink-muted">A theme is only a starting point — every setting stays editable.</p>
                </ControlSection>
                <ControlSection title="Accent color">
                  <ColorField label="Buttons, selections, progress" value={t.accent} onChange={(accent) => update({ accent })} />
                </ControlSection>
              </>
            )}

            {tab === 'background' && (
              <>
                <ControlSection title="Page background">
                  <Segmented value={t.page.type} options={PAGE_TYPES} onChange={(type) => updateIn('page', { type })} />
                  {t.page.type === 'default' && <p className="text-xs text-ink-muted">Uses the site&rsquo;s normal page background.</p>}
                  {(t.page.type === 'color' || t.page.type === 'gradient') && (
                    <ColorField label={t.page.type === 'gradient' ? 'From' : 'Color'} value={t.page.color} onChange={(color) => updateIn('page', { color })} />
                  )}
                  {t.page.type === 'gradient' && (
                    <>
                      <ColorField label="To" value={t.page.color2} onChange={(color2) => updateIn('page', { color2 })} />
                      <Slider label="Angle" value={t.page.angle} min={0} max={360} unit="°" onChange={(angle) => updateIn('page', { angle })} />
                    </>
                  )}
                </ControlSection>
                {t.page.type === 'image' && (
                  <>
                    <ControlSection title="Background image">
                      <ImageAdjuster
                        label="Background"
                        value={t.page.image}
                        onChange={(image) => updateIn('page', { image })}
                        layout={false}
                        background
                        defaultAspect="16:9"
                        aspects={['16:9']}
                      />
                    </ControlSection>
                    <ControlSection title="Blend">
                      <Slider label="Image opacity" value={t.page.imageOpacity} min={0} max={100} unit="%" onChange={(imageOpacity) => updateIn('page', { imageOpacity })} />
                      <Slider label="Blur" value={t.page.imageBlur} min={0} max={30} unit="px" onChange={(imageBlur) => updateIn('page', { imageBlur })} />
                      <Slider label="Darken" value={t.page.imageDim} min={0} max={80} unit="%" onChange={(imageDim) => updateIn('page', { imageDim })} />
                      <ColorField label="Color behind image" value={t.page.color} onChange={(color) => updateIn('page', { color })} />
                      <p className="text-xs text-ink-muted">Lower the opacity to let the color behind the image show through.</p>
                    </ControlSection>
                  </>
                )}
              </>
            )}

            {tab === 'cards' && (
              <>
                <ControlSection title="Card size">
                  <Slider label="Card width" value={t.card.widthPct} min={50} max={100} unit="%" onChange={(widthPct) => updateIn('card', { widthPct })} />
                  <Slider label="Inner spacing (padding)" value={t.card.padding} min={8} max={64} unit="px" onChange={(padding) => updateIn('card', { padding })} />
                  <Slider label="Space between cards" value={t.card.gap} min={0} max={64} unit="px" onChange={(gap) => updateIn('card', { gap })} />
                  <p className="text-xs text-ink-muted">To change the overall form width, use the Layout tab.</p>
                </ControlSection>
                <ControlSection title="Card style">
                  <ColorField label="Card color" value={t.card.color} onChange={(color) => updateIn('card', { color })} />
                  <Slider label="Opacity" value={t.card.opacity} min={0} max={100} unit="%" onChange={(opacity) => updateIn('card', { opacity })} />
                  <Slider label="Frosted-glass blur" value={t.card.blur} min={0} max={30} unit="px" onChange={(blur) => updateIn('card', { blur })} />
                  <Slider label="Rounded corners" value={t.card.radius} min={0} max={32} unit="px" onChange={(radius) => updateIn('card', { radius })} />
                  <Segmented label="Shadow" value={t.card.shadow} options={CARD_SHADOWS} onChange={(shadow) => updateIn('card', { shadow })} />
                  <Toggle checked={t.card.border} onChange={(border) => updateIn('card', { border })} label="Outline" />
                </ControlSection>
              </>
            )}

            {tab === 'text' && (
              <>
                <ControlSection title="Fonts">
                  <FontSelect label="Title font" value={t.fonts.heading} onChange={(heading) => updateIn('fonts', { heading })} />
                  <FontSelect label="Body font" value={t.fonts.body} onChange={(body) => updateIn('fonts', { body })} />
                </ControlSection>
                <ControlSection title="Form title">
                  <TextStyleControls value={t.title} onChange={(title) => update({ title })} sizeMin={18} sizeMax={72} colorFallback={t.text.color} />
                </ControlSection>
                <ControlSection title="Description">
                  <TextStyleControls value={t.description} onChange={(description) => update({ description })} sizeMin={12} sizeMax={32} colorFallback={t.text.muted} />
                </ControlSection>
                <ControlSection title="Question text">
                  <TextStyleControls value={t.question} onChange={(question) => update({ question })} sizeMin={12} sizeMax={32} colorFallback={t.text.color} />
                  <p className="text-xs text-ink-muted">Applies to every question. Each question can override it in the editor.</p>
                </ControlSection>
                <ControlSection title="Answers & colors">
                  <Slider label="Answer text size" value={t.answerSize} min={12} max={26} unit="px" onChange={(answerSize) => update({ answerSize })} />
                  <ColorField label="Main text color" value={t.text.color} onChange={(color) => updateIn('text', { color })} />
                  <ColorField label="Helper text color" value={t.text.muted} onChange={(muted) => updateIn('text', { muted })} />
                </ControlSection>
              </>
            )}

            {tab === 'header' && (
              <ControlSection title="Header image">
                <ImageAdjuster
                  label="Header image"
                  value={t.header}
                  onChange={(header) => update({ header })}
                  aspects={HEADER_ASPECTS}
                  defaultAspect="3:1"
                  layout={false}
                />
                <p className="text-xs text-ink-muted">Shown across the top of the title card.</p>
              </ControlSection>
            )}

            {tab === 'layout' && (
              <ControlSection title="Layout">
                <Segmented label="Form width" value={t.width} options={FORM_WIDTHS} onChange={(width) => update({ width })} />
                <Toggle checked={t.showProgress} onChange={(showProgress) => update({ showProgress })} label="Show progress bar" />
              </ControlSection>
            )}
          </div>
        </div>

        <div className={['min-h-0 overflow-y-auto bg-surface-low lg:block', mobilePane === 'preview' ? 'block' : 'hidden'].join(' ')}>
          <FormThemeShell theme={theme ? t : {}} contained>
            <FormHeaderCard form={form} theme={theme ? t : {}} />
            <PreviewQuestions questions={questions} theme={theme ? t : {}} />
          </FormThemeShell>
        </div>
      </div>
    </div>
  )
}
