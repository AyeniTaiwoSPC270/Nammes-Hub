import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useOwnAdminRowQuery } from '../../data/admins'
import { useToast } from '../../lib/ToastContext'
import {
  useHolidayThemesQuery, useHolidaySettingsQuery,
  useSaveHolidayThemeMutation, useDeleteHolidayThemeMutation, useUpdateHolidaySettingsMutation,
  uploadHolidayImage, holidayImageUrl, removeHolidayFiles, syncHolidayQuizLook,
} from '../../data/holidays'
import {
  sanitizeHolidayTheme, holidayThemeVars, isThemeId,
  HOLIDAY_PARTICLES, HOLIDAY_TOKENS, BANNER_MAX,
} from '../../../api/_lib/holidayTheme.js'
import { THEME_PATTERNS, THEME_MUSIC, THEME_CONFETTI, THEME_LOOKS, SCHEME_COLOR_KEYS } from '../../../api/_lib/quizTheme.js'
import Button from '../../components/ui/Button'
import { slugify, generateId } from '../../lib/adminFields'

// Owner-only: a theme repaints the whole site and every visitor, so it is calendar_looks territory —
// owner write, MFA-restrictive, no review queue. The database enforces it; this screen says so kindly
// instead of letting a non-owner fill in a form that silently saves nothing.

const BLANK_QUIZ = { design: { look: 'classic', pattern: 'stars', confetti: 'off', sound: { music: 'off' } }, image: null, look_id: null }

function blankTheme() {
  return {
    id: '',
    name: '',
    starts_on: '',
    ends_on: '',
    enabled: true,
    isNew: true,
    palette: { light: {}, dark: {} },
    decor: { particles: 'off', banner: '' },
    imagery: { band: null, logo: null },
    background: { enabled: false, image: null },
    quiz: BLANK_QUIZ,
  }
}

// A row from the database, into the draft shape the form edits (dates as yyyy-mm-dd input values).
function draftFrom(row) {
  const t = sanitizeHolidayTheme(row)
  return {
    ...t,
    // The stored design settles pattern to 'none' (sanitizeTheme drops a picture that is not a quiz
    // path), but an `image` beside it means "picture backdrop at apply time" — so the editor shows
    // what the admin actually has rather than the storage artefact.
    quiz: t.quiz.image ? { ...t.quiz, design: { ...t.quiz.design, pattern: 'image' } } : t.quiz,
    starts_on: t.starts_on ?? '',
    ends_on: t.ends_on ?? '',
    isNew: false,
  }
}

function scheduleLabel(t) {
  if (!t.starts_on && !t.ends_on) return 'Always (no dates)'
  return `${t.starts_on ?? 'the beginning'} → ${t.ends_on ?? 'no end'}`
}

function HexField({ value, onChange }) {
  return (
    <span className="flex items-center gap-1.5">
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#888888'}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-8 cursor-pointer rounded border border-hairline bg-surface p-0.5"
        aria-label="Pick a colour"
      />
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="site default"
        className="w-28 rounded-lg border border-hairline bg-surface px-2 py-1 text-xs text-ink-900"
        aria-label="Hex colour"
      />
    </span>
  )
}

function ImageSlot({ label, themeId, path, kind, onPath, onClear }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!themeId) {
      setError('Give the theme an id (save it once) before uploading pictures.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const next = await uploadHolidayImage(themeId, file, kind)
      // The OLD file is not removed here: the row may still point at it until the next save lands,
      // and deleting early turned a failed or abandoned save into a dead image. The parent queues it.
      onPath(next)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">{label}</span>
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-hairline bg-surface-low px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-hairline/20">
        <span className="material-symbols-outlined text-xl">add_photo_alternate</span>
        {busy ? 'Uploading…' : 'Upload image'}
        <input type="file" accept="image/*" onChange={handleFile} disabled={busy} className="hidden" />
      </label>
      {error && <span className="text-xs text-danger">{error}</span>}
      {path && (
        <div className="flex items-center gap-2">
          <img src={holidayImageUrl(path)} alt="" className="h-14 rounded-md border border-hairline object-cover" />
          <Button type="button" size="sm" variant="ghost" onClick={onClear}>
            Remove
          </Button>
        </div>
      )}
    </div>
  )
}

export default function AdminHolidays() {
  const toast = useToast()
  const { user } = useAuth()
  const adminRowQuery = useOwnAdminRowQuery(user?.id)
  const isOwner = Boolean(adminRowQuery.data?.is_owner)

  const themesQuery = useHolidayThemesQuery(isOwner)
  const settingsQuery = useHolidaySettingsQuery(isOwner)
  const saveMutation = useSaveHolidayThemeMutation()
  const deleteMutation = useDeleteHolidayThemeMutation()
  const settingsMutation = useUpdateHolidaySettingsMutation()

  const themes = useMemo(() => (themesQuery.data ?? []).map(sanitizeHolidayTheme), [themesQuery.data])
  const settings = settingsQuery.data
  const [draft, setDraft] = useState(null)
  const [mode, setMode] = useState(null)
  const [manualId, setManualId] = useState('')
  // Pictures replaced or removed in THIS edit. They are deleted only after a write lands, because
  // removing one at replace-time meant a failed or abandoned save left the row pointing at a file
  // that was already gone. The queue is dropped when the edit is abandoned (another theme, or a new
  // one), since then the saved row still points at the old file and it has to stay.
  const replacedFiles = useRef([])

  function queueReplace(current, next) {
    if (current && current !== next) replacedFiles.current.push(current)
  }

  function flushReplaced() {
    const files = replacedFiles.current
    replacedFiles.current = []
    if (files.length > 0) removeHolidayFiles(files).catch(() => {}) // best effort either way
  }

  function abandonEdit() {
    replacedFiles.current = []
  }

  // Select the first theme once the list lands, so the screen opens on something editable.
  useEffect(() => {
    if (!draft && themes.length > 0) setDraft(draftFrom(themesQuery.data[0]))
  }, [themes, draft, themesQuery.data])

  useEffect(() => {
    if (settings) {
      setMode(settings.mode)
      setManualId(settings.active_theme_id ?? '')
    }
  }, [settings])

  if (!adminRowQuery.isLoading && !isOwner) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <p className="text-ink-muted">Only the owner can dress the site for the holidays.</p>
      </div>
    )
  }

  const busy = saveMutation.isPending || deleteMutation.isPending || settingsMutation.isPending

  function patch(next) {
    setDraft((d) => ({ ...d, ...next }))
  }

  function patchPalette(map, token, value) {
    setDraft((d) => ({ ...d, palette: { ...d.palette, [map]: { ...d.palette[map], [token]: value || undefined } } }))
  }

  function patchQuiz(next) {
    setDraft((d) => ({ ...d, quiz: { ...d.quiz, ...next, design: { ...d.quiz.design, ...(next.design ?? {}) } } }))
  }

  function startNew() {
    abandonEdit()
    setDraft(blankTheme())
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!draft) return
    // One id, settled and validated BEFORE anything is written: the look row is written first (so a
    // theme row can never name a look that is not there), but it used to be written with the raw
    // draft id — an invalid one sanitised to '', which upserted a junk `holiday-` look into every
    // admin's studio picker before the save then threw. Same id for both writes, or the look id and
    // the row id can disagree.
    const id = draft.id || slugify(draft.name) || generateId(draft.name)
    if (!isThemeId(id)) {
      toast.error('A theme needs an id of lowercase letters, numbers and dashes — check the id and the name.')
      return
    }
    let quiz = draft.quiz
    try {
      // The quiz mapping becomes a saved look the studio picker already understands, BEFORE the theme
      // row records its id — two writes, look first, so a theme row can never name a look that is not there.
      if (quiz.design && Object.keys(quiz.design).length > 0) {
        const lookId = await syncHolidayQuizLook({ ...draft, id, quiz })
        quiz = { ...quiz, look_id: lookId }
      }
      const saved = await saveMutation.mutateAsync({
        id,
        name: draft.name,
        palette: draft.palette,
        decor: draft.decor,
        imagery: draft.imagery,
        quiz,
        starts_on: draft.starts_on || null,
        ends_on: draft.ends_on || null,
        enabled: draft.enabled,
      })
      setDraft(draftFrom(saved))
      // The row no longer points at any replaced file — only now is it safe to delete them.
      flushReplaced()
      toast.success(`Saved “${saved.name}”.`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  function handleDelete() {
    if (!draft || draft.isNew) return
    if (!window.confirm(`Delete “${draft.name}”? Quizzes that already use its look keep working.`)) return
    deleteMutation.mutate(draft.id, {
      onSuccess: () => {
        setDraft(null)
        toast.success('Theme deleted.')
      },
      onError: (err) => toast.error(err.message),
    })
  }

  function handleSaveSettings(event) {
    event.preventDefault()
    settingsMutation.mutate(
      { mode, active_theme_id: mode === 'manual' ? manualId || null : null },
      { onSuccess: () => toast.success('Holiday schedule updated.'), onError: (err) => toast.error(err.message) },
    )
  }

  // The preview wears the draft's own tokens, so what the panel shows is literally what the site would
  // paint in light mode — holidayThemeVars is the same function the provider runs.
  const previewVars = draft ? holidayThemeVars(draft, 'light') : {}

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-ink-900">Holiday Themes</h1>
          <p className="mt-1 max-w-2xl text-ink-muted">
            Dress the site for a season: palette, greeting, falling snow — and a matching look for the quiz studio.
          </p>
        </div>
        <Button type="button" variant="primary" onClick={startNew} disabled={busy}>New theme</Button>
      </header>

      {/* Go-live */}
      <form onSubmit={handleSaveSettings} className="mb-8 rounded-xl border border-hairline bg-surface p-5">
        <h2 className="text-lg font-bold text-ink-900">What is live right now</h2>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {[['auto', 'Follow the schedule'], ['manual', 'Force one theme on'], ['off', 'Off — paint nothing']].map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-1.5 text-sm text-ink-900">
              <input type="radio" name="holiday-mode" checked={mode === value} onChange={() => setMode(value)} />
              {label}
            </label>
          ))}
          {mode === 'manual' && (
            <select value={manualId} onChange={(e) => setManualId(e.target.value)} className="rounded-lg border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-900">
              <option value="">Choose a theme…</option>
              {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <Button type="submit" size="sm" variant="primary" loading={settingsMutation.isPending}>
            Save schedule
          </Button>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* List */}
        <aside className="flex flex-col gap-2">
          {themesQuery.isLoading && <p className="text-sm text-ink-muted">Loading themes…</p>}
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { abandonEdit(); setDraft(draftFrom(themesQuery.data.find((r) => r.id === t.id))) }}
              className={`cursor-pointer rounded-lg border p-3 text-left transition-colors ${draft?.id === t.id ? 'border-brand bg-surface-low' : 'border-hairline bg-surface hover:bg-surface-low'}`}
            >
              <span className="block font-semibold text-ink-900">{t.name}</span>
              <span className="block text-xs text-ink-muted">{scheduleLabel(t)}{t.enabled ? '' : ' · disabled'}</span>
            </button>
          ))}
          {themes.length === 0 && !themesQuery.isLoading && (
            <p className="text-sm text-ink-muted">No themes yet. Start one with “New theme”.</p>
          )}
        </aside>

        {/* Editor */}
        {draft ? (
          <form onSubmit={handleSave} className="flex flex-col gap-5">
            <section className="rounded-xl border border-hairline bg-surface p-5">
              <h2 className="text-lg font-bold text-ink-900">{draft.isNew ? 'New theme' : `Editing “${draft.name}”`}</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-ink-900">
                  Name
                  <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} maxLength={40} required className="rounded-xl border-2 border-hairline bg-paper px-3 py-2" />
                </label>
                <label className="flex flex-col gap-1 text-sm text-ink-900">
                  Id (lowercase, dashes)
                  <input
                    value={draft.id}
                    onChange={(e) => draft.isNew && patch({ id: e.target.value })}
                    readOnly={!draft.isNew}
                    required
                    className="rounded-xl border-2 border-hairline bg-paper px-3 py-2 disabled:bg-surface-low"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-ink-900">
                  Starts on (empty = unbounded)
                  <input type="date" value={draft.starts_on} onChange={(e) => patch({ starts_on: e.target.value })} className="rounded-xl border-2 border-hairline bg-paper px-3 py-2" />
                </label>
                <label className="flex flex-col gap-1 text-sm text-ink-900">
                  Ends on (inclusive)
                  <input type="date" value={draft.ends_on} onChange={(e) => patch({ ends_on: e.target.value })} className="rounded-xl border-2 border-hairline bg-paper px-3 py-2" />
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-900 sm:col-span-2">
                  <input type="checkbox" checked={draft.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
                  Enabled — a disabled theme is never live, even in its dates or by force
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-hairline bg-surface p-5">
              <h2 className="text-lg font-bold text-ink-900">Greeting and decor</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-ink-900">
                  Falling particles
                  <select value={draft.decor.particles} onChange={(e) => patch({ decor: { ...draft.decor, particles: e.target.value } })} className="rounded-xl border-2 border-hairline bg-paper px-3 py-2">
                    {Object.entries(HOLIDAY_PARTICLES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-ink-900">
                  Banner message ({draft.decor.banner?.length ?? 0}/{BANNER_MAX}, blank = none)
                  <input value={draft.decor.banner ?? ''} onChange={(e) => patch({ decor: { ...draft.decor, banner: e.target.value } })} maxLength={BANNER_MAX} className="rounded-xl border-2 border-hairline bg-paper px-3 py-2" />
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-hairline bg-surface p-5">
              <h2 className="text-lg font-bold text-ink-900">Palette</h2>
              <p className="mt-1 text-sm text-ink-muted">Every colour is optional — anything left on “site default” keeps the site's own value.</p>
              <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2">
                {['light', 'dark'].map((map) => (
                  <div key={map}>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-[.05em] text-orange-600">{map} mode</h3>
                    <div className="flex flex-col gap-2">
                      {HOLIDAY_TOKENS.map((token) => (
                        <label key={token} className="flex items-center justify-between gap-2 text-sm text-ink-900">
                          <span className="font-mono text-xs">{token}</span>
                          <HexField value={draft.palette[map][token]} onChange={(v) => patchPalette(map, token, v)} />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-hairline bg-surface p-5">
              <h2 className="text-lg font-bold text-ink-900">Pictures</h2>
              <div className="mt-3 flex flex-wrap gap-8">
                <ImageSlot label="Homepage band" themeId={draft.id} kind="band" path={draft.imagery.band} onPath={(p) => { queueReplace(draft.imagery.band, p); patch({ imagery: { ...draft.imagery, band: p } }) }} onClear={() => { queueReplace(draft.imagery.band, null); patch({ imagery: { ...draft.imagery, band: null } }) }} />
                <ImageSlot label="Logo swap" themeId={draft.id} kind="logo" path={draft.imagery.logo} onPath={(p) => { queueReplace(draft.imagery.logo, p); patch({ imagery: { ...draft.imagery, logo: p } }) }} onClear={() => { queueReplace(draft.imagery.logo, null); patch({ imagery: { ...draft.imagery, logo: null } }) }} />
                <ImageSlot label="Page background" themeId={draft.id} kind="background" path={draft.background.image} onPath={(p) => { queueReplace(draft.background.image, p); patch({ background: { ...draft.background, image: p } }) }} onClear={() => { queueReplace(draft.background.image, null); patch({ background: { ...draft.background, image: null } }) }} />
              </div>
              <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-900">
                <input type="checkbox" checked={draft.background.enabled} onChange={(e) => patch({ background: { ...draft.background, enabled: e.target.checked } })} />
                Use as page background — paints the whole site behind the content while this theme is live
              </label>
              <p className="mt-1 text-sm text-ink-muted">No picture above? The page falls back to a soft gradient from this theme's palette. Quiz screens keep their own look either way.</p>
            </section>

            <section className="rounded-xl border border-hairline bg-surface p-5">
              <h2 className="text-lg font-bold text-ink-900">Quiz look</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Saved as a ready-made look in the quiz studio's saved-looks list. Hosts apply it per quiz, exactly like any other look.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-ink-900">
                  Scheme
                  <select value={draft.quiz.design.look} onChange={(e) => patchQuiz({ design: { look: e.target.value } })} className="rounded-xl border-2 border-hairline bg-paper px-3 py-2">
                    {Object.entries(THEME_LOOKS).map(([id, look]) => <option key={id} value={id}>{look.name}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-ink-900">
                  Backdrop pattern
                  <select value={draft.quiz.design.pattern} onChange={(e) => patchQuiz({ design: { pattern: e.target.value } })} className="rounded-xl border-2 border-hairline bg-paper px-3 py-2">
                    {Object.entries(THEME_PATTERNS).filter(([id]) => id !== 'image' || draft.quiz.image).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-ink-900">
                  Confetti on reveals
                  <select value={draft.quiz.design.confetti} onChange={(e) => patchQuiz({ design: { confetti: e.target.value } })} className="rounded-xl border-2 border-hairline bg-paper px-3 py-2">
                    {Object.entries(THEME_CONFETTI).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-ink-900">
                  Lobby music
                  <select value={draft.quiz.design.sound.music} onChange={(e) => patchQuiz({ design: { sound: { ...draft.quiz.design.sound, music: e.target.value } } })} className="rounded-xl border-2 border-hairline bg-paper px-3 py-2">
                    {Object.entries(THEME_MUSIC).filter(([id]) => id !== 'custom').map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label>
                {SCHEME_COLOR_KEYS.map((key) => (
                  <label key={key} className="flex items-center justify-between gap-2 text-sm text-ink-900">
                    <span className="font-mono text-xs">{key}</span>
                    <HexField value={draft.quiz.design[key]} onChange={(v) => patchQuiz({ design: { [key]: v || null } })} />
                  </label>
                ))}
              </div>
              <div className="mt-4">
                <ImageSlot label="Quiz backdrop picture" themeId={draft.id} kind="quiz" path={draft.quiz.image} onPath={(p) => { queueReplace(draft.quiz.image, p); patchQuiz({ image: p, design: { pattern: 'image' } }) }} onClear={() => { queueReplace(draft.quiz.image, null); patchQuiz({ image: null, design: { pattern: 'none' } }) }} />
              </div>
            </section>

            {/* Preview: the draft's own tokens on a card, in light mode — the same holidayThemeVars the provider runs. */}
            <section className="rounded-xl border border-hairline bg-surface p-5">
              <h2 className="text-lg font-bold text-ink-900">Preview</h2>
              <div className="mt-3 overflow-hidden rounded-lg border border-hairline">
                {draft.imagery.band && <img src={holidayImageUrl(draft.imagery.band)} alt="" className="h-24 w-full object-cover" />}
                {draft.decor.banner && (
                  <div className="px-4 py-2 text-center text-sm font-semibold" style={{ backgroundColor: previewVars['--color-brand'] ?? 'var(--color-brand)', color: previewVars['--color-surface'] ?? 'var(--color-surface)' }}>
                    {draft.decor.banner}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4 p-4" style={previewVars}>
                  <span className="rounded-full px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: 'var(--color-brand)', color: 'var(--color-surface)' }}>Button</span>
                  <a href="#preview" onClick={(e) => e.preventDefault()} className="text-sm font-semibold" style={{ color: 'var(--color-brand)' }}>A link</a>
                  <span className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>Muted text on {previewVars['--color-paper'] ?? 'the site’s own'} paper</span>
                  <span
                    className="h-10 w-24 rounded-md"
                    style={{
                      background: `linear-gradient(135deg, ${draft.quiz.design.glowA ?? THEME_LOOKS[draft.quiz.design.look]?.glow[0] ?? '#ff5a1f'}, ${draft.quiz.design.deepA ?? THEME_LOOKS[draft.quiz.design.look]?.deep[0] ?? '#0b2417'})`,
                    }}
                    title="The quiz look's stage colours"
                  />
                </div>
              </div>
            </section>

            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" loading={busy}>Save theme</Button>
              {!draft.isNew && (
                <Button type="button" variant="ghost" onClick={handleDelete} loading={deleteMutation.isPending}>Delete</Button>
              )}
            </div>
          </form>
        ) : (
          <p className="text-ink-muted">Pick a theme or start a new one.</p>
        )}
      </div>
    </div>
  )
}
