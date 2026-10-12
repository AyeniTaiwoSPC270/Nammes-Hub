import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../lib/ToastContext'
import { uploadBrandingImage, removeBrandingFiles, brandingPaths, brandingUrl, BACKDROP_MAX_EDGE, BACKDROP_MAX_BYTES } from '../../data/quizBranding'
import { useQuizQuery, saveQuizTheme, saveQuizCard } from '../../data/quiz'
import { cardPreviewVersion } from '../../data/quizBranding'
import { sanitizeCard, encodeCardPreview, encodeThemePreview, DEFAULT_CARD } from '../../../api/_lib/quizCard.js'
import {
  DEFAULT_THEME,
  THEME_LOOKS,
  THEME_PATTERNS,
  THEME_CONFETTI,
  THEME_MUSIC,
  THEME_BACKDROP_FITS,
  BACKDROP_RANGES,
  MAX_SPONSORS,
  THEME_HEADLINE_MAX,
  THEME_TAGLINE_MAX,
  sanitizeTheme,
  themeAccent,
  themePageVars,
  contrastWithWhite,
  contrastRatio,
  withLook,
  withAccent,
  withPage,
  PAGE_LIGHT,
} from '../../../api/_lib/quizTheme.js'
import { isQuizImagePath } from '../../../api/_lib/quizImage.js'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import FormField from '../../components/ui/FormField'
import ErrorState from '../../components/ui/ErrorState'
import { Slider } from '../../components/admin/forms/DesignControls'
import StudioPreview, { PROJECTOR_SCREENS, PHONE_SCREENS } from '../../components/admin/quizStudio/StudioPreview'
import CharacterGallery from '../../components/admin/quizStudio/CharacterGallery'
import SoundLab from '../../components/admin/quizStudio/SoundLab'

// Quiz Design Studio: choose how a quiz looks on the projector and on phones (colours, backdrop, celebration,
// event headline), with a live preview, and browse the 50 characters. The look is saved on the quiz and copied into
// each game when it starts.

const ACCENT_SWATCHES = ['#ff5a1f', '#d97706', '#15803d', '#0e7490', '#2563eb', '#6366f1', '#7c3aed', '#db2777', '#dc2626', '#52525b']
// Light and dark, so an admin can see what a dark projector looks like without typing a hex. The pale three are the
// site's own light tokens; the first two dark ones are its dark tokens; the last three are schemes' dark ends.
const PAGE_SWATCHES = ['#fcf9f8', '#ffffff', '#f6f3f2', '#0d1310', '#16211b', '#1e1b4b', '#3b0764', '#18181b']

function Section({ title, hint, children }) {
  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-md">
      <h2 className="text-lg font-bold text-ink-900">{title}</h2>
      {hint && <p className="mb-3 text-sm text-ink-muted">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  )
}

function Choice({ selected, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        'cursor-pointer rounded-xl border text-left text-sm font-semibold transition-colors',
        selected ? 'border-orange-500 bg-orange-500/10 text-ink-900 ring-2 ring-orange-500/40' : 'border-hairline bg-surface text-ink-900 hover:bg-surface-low',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'min-h-11 cursor-pointer rounded-full px-5 text-sm font-bold',
        active ? 'bg-green-900 text-white' : 'border border-hairline bg-surface text-ink-900 hover:bg-surface-low',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export default function AdminQuizStudio() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const toast = useToast()
  const quizQuery = useQuizQuery(id)
  const [tab, setTab] = useState('look')
  const [draft, setDraft] = useState(null)
  const [cardDraft, setCardDraft] = useState(null)
  const [surface, setSurface] = useState('projector')
  const [screens, setScreens] = useState({ projector: 'lobby', phone: 'lobby' })
  const [brandBusy, setBrandBusy] = useState(false)
  const [brandError, setBrandError] = useState('')

  const quiz = quizQuery.data
  const saved = sanitizeTheme(quiz?.theme)
  const theme = draft ?? saved
  const dirty = draft !== null && JSON.stringify(sanitizeTheme(draft)) !== JSON.stringify(saved)
  const accent = themeAccent(theme)
  const contrast = contrastWithWhite(accent)
  // The colour input has to show a value, so it shows the one in effect — the page that is actually on screen, which is
  // the site's own paper while no page colour is set.
  const page = theme.page ?? PAGE_LIGHT.paper
  const pageLowContrast = theme.page !== null && contrastRatio(themePageVars(theme.page)['--color-ink-900'], theme.page) < 4.5

  // The card has its own column, its own draft and its own save, so the look's dirty state never drags it along.
  const savedCard = sanitizeCard(quiz?.card, { quizId: id })
  const card = cardDraft ?? savedCard
  // The colour input cannot show nothing, so it shows the background it is replacing while no colour of its own is set.
  const look = THEME_LOOKS[theme.look]
  const cardDirty = cardDraft !== null && JSON.stringify(sanitizeCard(cardDraft, { quizId: id })) !== JSON.stringify(savedCard)
  function changeCard(patch) {
    setCardDraft({ ...card, ...patch })
  }

  // The draft keeps what was typed (so a space at the end of a headline survives); it is cleaned when previewed and saved.
  function change(patch) {
    setDraft({ ...theme, ...patch })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const clean = await saveQuizTheme(id, theme)
      // Pictures the saved look no longer uses are deleted from storage — but only ones that belong to this quiz, so a
      // hand-edited row pointing at some other quiz's file cannot take that file down with it.
      // Only the look's own pictures: the card background is left alone here, because it is saved on its own and a card
      // draft that has dropped it says nothing about what is still in the database.
      const keep = new Set(brandingPaths(clean))
      await removeBrandingFiles(brandingPaths(saved).filter((p) => !keep.has(p) && isQuizImagePath(p, id)))
      return clean
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      setDraft(null)
      toast.success('Look saved. New games of this quiz will use it.')
    },
    onError: (error) => toast.error(error.message),
  })

  const cardMutation = useMutation({
    mutationFn: async () => {
      const clean = await saveQuizCard(id, card)
      const keep = new Set(brandingPaths(theme, clean))
      await removeBrandingFiles(brandingPaths(theme, savedCard).filter((p) => !keep.has(p) && isQuizImagePath(p, id)))
      return clean
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      setCardDraft(null)
      toast.success('Card saved. New games of this quiz will use it.')
    },
    onError: (error) => toast.error(error.message),
  })

  if (quizQuery.isError) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this quiz." onRetry={quizQuery.refetch} />
      </div>
    )
  }

  const screenList = surface === 'projector' ? PROJECTOR_SCREENS : PHONE_SCREENS

  // Uploads a logo, sponsor or backdrop picture right away (it is only part of the look once you press Save). A backdrop
  // is allowed to be far bigger than a logo, so the caller passes the limits it wants.
  async function addPicture(file, apply, limits = {}) {
    setBrandError('')
    setBrandBusy(true)
    try {
      const path = await uploadBrandingImage(id, file, limits)
      apply(path, file.name.replace(/\.[^.]+$/, '').slice(0, 40))
    } catch (e) {
      setBrandError(e.message)
    } finally {
      setBrandBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Live Quiz', to: '/admin/quizzes' }, { label: 'Design Studio' }]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-900">Design Studio</h1>
          <p className="text-ink-muted">
            {quiz ? <>How <span className="font-semibold text-ink-900">{quiz.title}</span> looks on the projector and on phones.</> : 'Loading…'}
          </p>
        </div>
        {/* The card tab saves itself, so the look's own Save and Reset stay off it. */}
        {tab !== 'characters' && tab !== 'card' && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setDraft(sanitizeTheme(DEFAULT_THEME))} disabled={!quiz}>
              Reset to default
            </Button>
            <Button variant="accent" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!dirty}>
              {dirty ? 'Save look' : 'Saved'}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Studio sections">
        <TabButton active={tab === 'look'} onClick={() => setTab('look')}>Look &amp; feel</TabButton>
        <TabButton active={tab === 'sound'} onClick={() => setTab('sound')}>Sound</TabButton>
        <TabButton active={tab === 'characters'} onClick={() => setTab('characters')}>Characters (50)</TabButton>
        <TabButton active={tab === 'card'} onClick={() => setTab('card')}>Result card</TabButton>
        <Link to="/admin/quizzes" className="ml-auto self-center text-sm text-ink-muted underline">Back to quizzes</Link>
      </div>

      {tab === 'characters' ? (
        <div className="mt-6">
          <CharacterGallery />
        </div>
      ) : tab === 'card' ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
          <div className="flex flex-col gap-4">
            <Section title="Card accent" hint="Overrides the look's accent on the result card only. Leave it on the look's own and the card follows whatever the game uses.">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant={card.accent === null ? 'accent' : 'secondary'} onClick={() => changeCard({ accent: null })}>
                  Use the look&rsquo;s accent
                </Button>
                <label className="flex cursor-pointer items-center gap-2 rounded-md bg-surface-low px-4 py-2.5 text-sm font-bold text-brand hover:bg-hairline/40">
                  Custom
                  <input
                    type="color"
                    aria-label="Card accent colour"
                    value={card.accent ?? accent}
                    onChange={(e) => changeCard({ accent: e.target.value })}
                    className="h-7 w-12 cursor-pointer rounded-md border border-hairline"
                  />
                </label>
              </div>
              <p className="mt-2 text-sm text-ink-muted">
                {card.accent === null
                  ? `Following the look, which is ${accent}.`
                  : 'The card uses this colour instead.'}
              </p>
            </Section>

            <Section title="Card pattern" hint="The backdrop drawn on the card itself. Same as the game is the default, so the card matches the screens unless you say otherwise.">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Choice selected={card.pattern === null} onClick={() => changeCard({ pattern: null })} className="px-3 py-2.5">
                  Same as the game
                </Choice>
                {Object.entries(THEME_PATTERNS).map(([key, label]) => (
                  <Choice key={key} selected={card.pattern === key} onClick={() => changeCard({ pattern: key })} className="px-3 py-2.5">
                    {label}
                  </Choice>
                ))}
              </div>
            </Section>

            <Section title="Card background" hint="A colour or a picture behind the card. A picture is drawn over the colour; without either, the card uses the pattern on the colour scheme's own background.">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-md bg-surface-low px-4 py-2.5 text-sm font-bold text-brand hover:bg-hairline/40">
                  {card.backgroundColor ?? 'Custom colour'}
                  <input
                    type="color"
                    aria-label="Card background colour"
                    value={card.backgroundColor ?? look.deep[0]}
                    onChange={(e) => changeCard({ backgroundColor: e.target.value })}
                    className="h-7 w-12 cursor-pointer rounded-md border border-hairline"
                  />
                </label>
                {card.backgroundColor !== null && (
                  <Button variant="secondary" size="sm" onClick={() => changeCard({ backgroundColor: null })}>Use the scheme&rsquo;s background</Button>
                )}
              </div>
              <div className="mt-3">
              {card.background ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-xl border border-hairline bg-surface-low">
                    <img src={brandingUrl(card.background)} alt="" className="h-full w-full object-cover" />
                  </span>
                  <label className="cursor-pointer rounded-md bg-surface-low px-4 py-2.5 text-sm font-bold text-brand hover:bg-hairline/40">
                    Replace picture
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={brandBusy}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (f) addPicture(f, (path) => changeCard({ background: path }), { maxEdge: BACKDROP_MAX_EDGE, maxBytes: BACKDROP_MAX_BYTES })
                      }}
                    />
                  </label>
                  <Button variant="ghost" size="sm" onClick={() => changeCard({ background: null })}>Remove picture</Button>
                </div>
              ) : (
                <label className="cursor-pointer rounded-md bg-surface-low px-4 py-2.5 text-sm font-bold text-brand hover:bg-hairline/40">
                  Upload a picture
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={brandBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (f) addPicture(f, (path) => changeCard({ background: path }), { maxEdge: BACKDROP_MAX_EDGE, maxBytes: BACKDROP_MAX_BYTES })
                    }}
                  />
                </label>
              )}
              </div>
            </Section>

            <Section title="What the card shows" hint="Hide anything you would rather not post. The rank band only appears for a hosted game; a practice run has no rank.">
              <div className="flex flex-col gap-2">
                {[
                  ['showCharacter', 'The cartoon character'],
                  ['showTitle', 'The quiz title'],
                  ['showPlacement', 'Rank and “placed 3 of 42”'],
                  ['showAccuracy', 'Correct answers'],
                  ['showStreak', 'Best streak'],
                  ['showTeam', 'Team name'],
                ].map(([key, label]) => (
                  <label key={key} className="flex cursor-pointer items-center gap-3 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-orange-500"
                      checked={card[key]}
                      onChange={(e) => changeCard({ [key]: e.target.checked })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </Section>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setCardDraft(sanitizeCard(DEFAULT_CARD, { quizId: id }))} disabled={!quiz}>
                Reset card
              </Button>
              <Button variant="accent" onClick={() => cardMutation.mutate()} loading={cardMutation.isPending} disabled={!cardDirty}>
                {cardDirty ? 'Save card' : 'Saved'}
              </Button>
            </div>
            {brandError && <p role="alert" className="text-sm text-ink-muted">{brandError}</p>}
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted">
              A preview with made-up numbers, drawn by the same server that draws the real card. A real game uses each
              player&rsquo;s own result.
            </p>
            {/* The endpoint renders the saved card, so the draft goes on the url as well as the version hash: the
                hash alone busts the browser cache but still asks the server for the saved design, which is why
                changing an accent or unticking a box used to leave the preview exactly as it was. */}
            {quiz && (
              <img
                key={cardPreviewVersion(card, id, theme)}
                src={`/api/quiz-card?preview=${id}&v=${cardPreviewVersion(card, id, theme)}&d=${encodeCardPreview(card, { quizId: id })}&t=${encodeThemePreview(theme)}`}
                alt="Result card preview"
                className="w-full max-w-xs rounded-2xl shadow-md"
              />
            )}
          </div>
        </div>
      ) : tab === 'sound' ? (
        <div className="mt-6">
          <SoundLab
            sound={theme.sound}
            onChange={(sound) => change({ sound })}
            onToggleEffect={(name) => change({
              sound: {
                ...theme.sound,
                off: theme.sound.off.includes(name) ? theme.sound.off.filter((x) => x !== name) : [...theme.sound.off, name],
              },
            })}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
          <div className="flex flex-col gap-4">
            <Section title="Colour scheme" hint="Sets the glow and the dark banner behind every screen. Choosing a scheme leaves your own accent colour alone.">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
                {Object.entries(THEME_LOOKS).map(([key, look]) => (
                  <Choice key={key} selected={theme.look === key} onClick={() => change(withLook(theme, key))} className="flex items-center gap-2 p-2.5">
                    <span
                      className="h-8 w-8 shrink-0 rounded-full border border-black/10"
                      style={{ background: `linear-gradient(135deg, ${look.accent} 50%, ${look.deep[0]} 50%)` }}
                      aria-hidden="true"
                    />
                    {look.name}
                  </Choice>
                ))}
              </div>
            </Section>

            <Section title="Accent colour" hint="Buttons, the timer, highlights. This overrides the scheme's own colour until you hand it back.">
              <div className="flex flex-wrap items-center gap-2">
                {ACCENT_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => change(withAccent(theme, hex))}
                    aria-label={`Accent ${hex}`}
                    // The chosen accent, not the one in effect: every scheme's own accent is in this row, so keying off
                    // the resolved colour showed one as picked when the admin had only picked a scheme.
                    aria-pressed={theme.accent === hex}
                    className={['h-9 w-9 cursor-pointer rounded-full border-2', theme.accent === hex ? 'border-ink-900 ring-2 ring-offset-2 ring-ink-900/30' : 'border-transparent'].join(' ')}
                    style={{ background: hex }}
                  />
                ))}
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-hairline px-3 py-1.5 text-sm font-semibold text-ink-900">
                  <input type="color" value={accent} onChange={(e) => change(withAccent(theme, e.target.value))} className="h-7 w-7 cursor-pointer border-0 bg-transparent p-0" aria-label="Custom accent colour" />
                  Custom
                </label>
                {theme.accent !== null && (
                  <Button variant="secondary" size="sm" onClick={() => change(withAccent(theme, null))}>Use the scheme&rsquo;s colour</Button>
                )}
              </div>
              {contrast < 3 && (
                <p role="status" className="mt-3 rounded-lg bg-orange-500/10 p-3 text-sm text-ink-900">
                  White text on this colour can be hard to read on a projector. A darker shade reads better.
                </p>
              )}
            </Section>

            <Section title="Page colour" hint="The colour behind every screen. The text flips to light or dark on its own, whichever reads better.">
              <div className="flex flex-wrap items-center gap-2">
                {PAGE_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => change(withPage(theme, hex))}
                    aria-label={`Page ${hex}`}
                    aria-pressed={theme.page === hex}
                    className={['h-9 w-9 cursor-pointer rounded-full border-2', theme.page === hex ? 'border-ink-900 ring-2 ring-offset-2 ring-ink-900/30' : 'border-hairline'].join(' ')}
                    style={{ background: hex }}
                  />
                ))}
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-hairline px-3 py-1.5 text-sm font-semibold text-ink-900">
                  <input
                    type="color"
                    value={page}
                    onChange={(e) => change(withPage(theme, e.target.value))}
                    className="h-7 w-7 cursor-pointer border-0 bg-transparent p-0"
                    aria-label="Custom page colour"
                  />
                  Custom
                </label>
                {theme.page !== null && (
                  <Button variant="secondary" size="sm" onClick={() => change(withPage(theme, null))}>Use the default page</Button>
                )}
              </div>
              {pageLowContrast && (
                <p role="status" className="mt-3 rounded-lg bg-orange-500/10 p-3 text-sm text-ink-900">
                  Text on this colour is hard to read on a projector, even after it flips. A darker or lighter shade
                  reads better.
                </p>
              )}
            </Section>

            <Section title="Backdrop" hint="A faint pattern behind the screens, so text always stays clear. Your own picture shows on the projector only, never on phones.">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(THEME_PATTERNS).map(([key, label]) => (
                  <Choice key={key} selected={theme.pattern === key} onClick={() => change({ pattern: key })} className="px-3 py-2.5">
                    {label}
                  </Choice>
                ))}
              </div>

              {theme.pattern === 'image' && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-xl border border-hairline bg-surface-low">
                    {theme.image
                      ? <img src={brandingUrl(theme.image)} alt="" className="h-full w-full object-cover" />
                      : <span className="material-symbols-outlined text-2xl text-ink-muted" aria-hidden="true">add_photo_alternate</span>}
                  </span>
                  <label className="cursor-pointer rounded-md bg-surface-low px-4 py-2.5 text-sm font-bold text-brand hover:bg-hairline/40">
                    {theme.image ? 'Replace picture' : 'Upload a picture'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={brandBusy}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (f) addPicture(f, (path) => change({ pattern: 'image', image: path }), { maxEdge: BACKDROP_MAX_EDGE, maxBytes: BACKDROP_MAX_BYTES })
                      }}
                    />
                  </label>
                  {theme.image && <Button variant="ghost" size="sm" onClick={() => change({ image: null })}>Remove picture</Button>}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3">
                {theme.pattern === 'image' && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-ink">Fit</p>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(THEME_BACKDROP_FITS).map(([key, label]) => (
                        <Choice key={key} selected={theme.backdropFit === key} onClick={() => change({ backdropFit: key })} className="px-3 py-2.5">
                          {label}
                        </Choice>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      {theme.backdropFit === 'contain'
                        ? 'The whole picture shows. Where it does not reach, the page colour fills in.'
                        : theme.backdropFit === 'stretch'
                          ? 'Fills the screen exactly, but stretches anything that is not the screen’s shape.'
                          : 'Fills the screen. Parts of the picture that do not fit are cut off.'}
                    </p>
                  </div>
                )}
                <Slider
                  label="Strength"
                  className="accent-orange-500"
                  value={theme.backdropOpacity}
                  min={BACKDROP_RANGES.opacity.min}
                  max={BACKDROP_RANGES.opacity.max}
                  step={BACKDROP_RANGES.opacity.step}
                  unit={BACKDROP_RANGES.opacity.unit}
                  onChange={(backdropOpacity) => change({ backdropOpacity })}
                />
                {theme.pattern !== 'none' && (
                  <>
                    <Slider
                      label={theme.pattern === 'image' ? 'Zoom' : 'Size'}
                      className="accent-orange-500"
                      value={theme.backdropScale}
                      min={theme.pattern === 'image' ? 100 : BACKDROP_RANGES.scale.min}
                      max={BACKDROP_RANGES.scale.max}
                      step={BACKDROP_RANGES.scale.step}
                      unit={BACKDROP_RANGES.scale.unit}
                      onChange={(backdropScale) => change({ backdropScale })}
                    />
                    <Slider
                      label="Blur"
                      className="accent-orange-500"
                      value={theme.backdropBlur}
                      min={BACKDROP_RANGES.blur.min}
                      max={BACKDROP_RANGES.blur.max}
                      step={BACKDROP_RANGES.blur.step}
                      unit={BACKDROP_RANGES.blur.unit}
                      onChange={(backdropBlur) => change({ backdropBlur })}
                    />
                  </>
                )}
                {theme.pattern === 'image' && (
                  <Slider
                    label="Fade back"
                    className="accent-orange-500"
                    value={theme.backdropDim}
                    min={BACKDROP_RANGES.dim.min}
                    max={BACKDROP_RANGES.dim.max}
                    step={BACKDROP_RANGES.dim.step}
                    unit={BACKDROP_RANGES.dim.unit}
                    onChange={(backdropDim) => change({ backdropDim })}
                  />
                )}
              </div>
              {theme.pattern !== 'none' && <p className="mt-2 text-xs text-ink-muted">Keep the strength low and the fade high, so the projector stays easy to read from the back row.</p>}
            </Section>

            <Section title="Celebration" hint="What rains down on the final leaderboard.">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(THEME_CONFETTI).map(([key, label]) => (
                  <Choice key={key} selected={theme.confetti === key} onClick={() => change({ confetti: key })} className="px-3 py-2.5">
                    {label}
                  </Choice>
                ))}
              </div>
            </Section>

            <Section title="Sound" hint="Music and effects on the projector. Hear every option on the Sound tab before you pick one.">
              <div className="grid grid-cols-3 gap-2">
                {/* 'custom' is left out here on purpose: an imported track is chosen from a list of files that only
                    exists in the browser, so it cannot be picked from a row of fixed buttons. */}
                {Object.entries(THEME_MUSIC).filter(([key]) => key !== 'custom').map(([key, label]) => (
                  <Choice key={key} selected={theme.sound.music === key} onClick={() => change({ sound: { ...theme.sound, music: key } })} className="px-3 py-2.5">
                    {label}
                  </Choice>
                ))}
              </div>
              {theme.sound.music === 'custom' && (
                <p className="mt-2 rounded-xl border border-orange-500/40 bg-orange-500/10 p-3 text-sm font-semibold text-ink-900">
                  Playing a track you imported. Change it, or choose a built-in loop, on the Sound tab.
                </p>
              )}
              <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm font-semibold text-ink-900">
                <input type="checkbox" className="h-5 w-5" checked={theme.sound.effects} onChange={(e) => change({ sound: { ...theme.sound, effects: e.target.checked } })} />
                Sound effects (countdown ticks, drum roll, right and wrong stings, cheer, fanfare)
              </label>
              {theme.sound.off.length > 0 && (
                <p className="mt-2 text-sm text-ink-muted">
                  {theme.sound.off.length === 1 ? 'One effect is' : `${theme.sound.off.length} effects are`} switched off
                  in the game. Change them on the Sound tab.
                </p>
              )}
            </Section>

            <Section title="Logo and sponsors" hint="An event logo replaces the NAMMES mark at the top. Sponsor logos show on the projector only, never on phones.">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-16 w-16 items-center justify-center rounded-xl border border-hairline bg-white p-1">
                    <img src={theme.logo ? brandingUrl(theme.logo) : '/logo-small.png'} alt="" className="max-h-full max-w-full object-contain" />
                  </span>
                  <label className="cursor-pointer rounded-md bg-surface-low px-4 py-2.5 text-sm font-bold text-brand hover:bg-hairline/40">
                    {theme.logo ? 'Replace logo' : 'Upload event logo'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={brandBusy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addPicture(f, (path) => change({ logo: path })) }} />
                  </label>
                  {theme.logo && <Button variant="ghost" size="sm" onClick={() => change({ logo: null })}>Use the NAMMES mark</Button>}
                </div>

                <ul className="flex flex-col gap-2">
                  {(theme.sponsors ?? []).map((s, i) => (
                    <li key={s.path} className="flex items-center gap-2">
                      <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg border border-hairline bg-white p-1">
                        <img src={brandingUrl(s.path)} alt="" className="max-h-full max-w-full object-contain" />
                      </span>
                      <input
                        value={s.name}
                        maxLength={40}
                        onChange={(e) => change({ sponsors: theme.sponsors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                        aria-label={`Sponsor ${i + 1} name`}
                        placeholder="Sponsor name"
                        className="min-h-11 min-w-0 flex-1 rounded-md border border-hairline bg-surface px-3 py-2 text-base text-ink"
                      />
                      <Button variant="ghost" size="sm" onClick={() => change({ sponsors: theme.sponsors.filter((_, j) => j !== i) })} aria-label={`Remove sponsor ${i + 1}`}>Remove</Button>
                    </li>
                  ))}
                </ul>
                {(theme.sponsors ?? []).length < MAX_SPONSORS && (
                  <label className="w-fit cursor-pointer rounded-md bg-surface-low px-4 py-2.5 text-sm font-bold text-brand hover:bg-hairline/40">
                    Add a sponsor logo
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={brandBusy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addPicture(f, (path, name) => change({ sponsors: [...(theme.sponsors ?? []), { name: name || 'Sponsor', path }] })) }} />
                  </label>
                )}
                {brandBusy && <p className="text-sm text-ink-muted">Uploading…</p>}
                {brandError && <p role="alert" className="text-sm text-danger">{brandError}</p>}

                <div className="flex flex-col gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-900">
                    <input type="checkbox" className="h-5 w-5" checked={theme.showSponsors.lobby} onChange={(e) => change({ showSponsors: { ...theme.showSponsors, lobby: e.target.checked } })} />
                    Show sponsors on the lobby screen
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-900">
                    <input type="checkbox" className="h-5 w-5" checked={theme.showSponsors.finish} onChange={(e) => change({ showSponsors: { ...theme.showSponsors, finish: e.target.checked } })} />
                    Show sponsors on the final results
                  </label>
                </div>
              </div>
            </Section>

            <Section title="Event message" hint="Shown on the lobby screen and on phones. Leave empty to skip.">
              <div className="flex flex-col gap-3">
                <FormField label={`Headline (${theme.headline.length}/${THEME_HEADLINE_MAX})`} value={theme.headline} maxLength={THEME_HEADLINE_MAX} onChange={(e) => change({ headline: e.target.value })} placeholder="Freshers' Night Quiz" />
                <FormField label={`Tagline (${theme.tagline.length}/${THEME_TAGLINE_MAX})`} value={theme.tagline} maxLength={THEME_TAGLINE_MAX} onChange={(e) => change({ tagline: e.target.value })} placeholder="Phones out, brains on!" />
              </div>
            </Section>
          </div>

          <div className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-24 xl:self-start">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Preview surface">
              <Choice selected={surface === 'projector'} onClick={() => setSurface('projector')} className="min-h-10 px-4">Projector</Choice>
              <Choice selected={surface === 'phone'} onClick={() => setSurface('phone')} className="min-h-10 px-4">Phone</Choice>
              <span className="mx-1 hidden h-6 w-px bg-hairline sm:block" aria-hidden="true" />
              {Object.entries(screenList).map(([key, label]) => (
                <Choice key={key} selected={screens[surface] === key} onClick={() => setScreens((s) => ({ ...s, [surface]: key }))} className="min-h-10 px-4">
                  {label}
                </Choice>
              ))}
            </div>
            <StudioPreview theme={theme} surface={surface} screen={screens[surface]} title={quiz?.title ?? ''} />
            <p className="text-center text-xs text-ink-muted">Preview with sample players. Light or dark follows the site theme toggle.</p>
          </div>
        </div>
      )}
    </div>
  )
}
