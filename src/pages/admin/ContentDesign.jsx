// The Events and News Design Studio. Spec: docs/superpowers/specs/2026-10-15-content-design-studio-design.md §6
//
// ONE body, TWO routes: `/admin/events?tab=design` and `/admin/news?tab=design` both load this with a
// different `page`. The shell, the controls and the preview are identical -- only the tab list and the
// previewed page differ -- so a second copy would be two places for a label or a default to drift, which is
// the reason the four existing studios each got their own table but this pair shares a body.
//
// The theme is a join of two public tables -- `content_settings.<page>_look_id` names the look and
// `content_looks.design` carries it -- so this screen edits a copy and writes the look, then points the
// settings row at it. Nothing here cleans a design itself: sanitizeTheme (api/_lib/contentTheme.js) is the
// only judge, on the way into the editor, into the preview and into the row.
//
// Not owner-gated, unlike CalendarDesignBody. `content_looks` is admin-write (20261015100000_content_looks.sql:
// see the comment on the policies), so every button here is live for any admin. The calendar's
// useOwnAdminRowQuery banner does not apply and must not be copied.
import { useEffect, useMemo, useState } from 'react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import Toggle from '../../components/ui/Toggle'
import { SkeletonCard, SkeletonText } from '../../components/ui/Skeleton'
import PreviewViewport from '../../components/admin/PreviewViewport'
import ContentDesignControls, { pageLabel } from '../../components/content/ContentDesignControls'
import { ContentFeed, EventCard, NewsCard, NewsFeatureCard } from '../../components/content/ContentCards'
import {
  lookLivePatch,
  lookOnHomePatch,
  newsVideoPatch,
  useContentLooksQuery,
  useContentSettingsQuery,
  useDeleteContentLookMutation,
  useSaveContentLookMutation,
  useUpdateContentSettingsMutation,
} from '../../data/contentLooks'
import { useEventsQuery, groupEventsByTime } from '../../data/events'
import { useNewsQuery, getNews, useNewsVideoFlag } from '../../data/news'
import { generateId } from '../../lib/adminFields'
import { MIN_PREVIEW_SECONDS, MAX_PREVIEW_SECONDS } from '../../lib/newsVideo'
import { useTheme } from '../../lib/ThemeContext'
import { useToast } from '../../lib/ToastContext'
import { NAME_MAX, sanitizeTheme, themeVars } from '../../../api/_lib/contentTheme.js'

// How many rows the preview shows of each kind. Enough to show a three-column grid and a four-column one, and
// few enough that the preview scrolls rather than rendering thirty cards behind a panel of controls.
const PREVIEW_EVENTS = 6
const PREVIEW_NEWS = 7

/** react-query's status as one of the three words the preview branches on. */
const queryState = (q) => (q.isError ? 'error' : q.isPending ? 'loading' : 'ready')

export function ContentDesignBody({ page }) {
  const toast = useToast()
  const { theme: siteTheme } = useTheme()
  const looksQuery = useContentLooksQuery(page)
  const settingsQuery = useContentSettingsQuery()
  const newsQuery = useNewsQuery()
  const eventsQuery = useEventsQuery()

  const label = pageLabel(page)
  const looks = looksQuery.data
  const settings = settingsQuery.data
  const liveLookId = settings?.[`${page}_look_id`] ?? null
  const onHome = settings?.[`${page}_on_home`] === true

  // `null` until both rows have loaded, so the first paint cannot show the built-in default over a design
  // that is still on its way. `seeded` gates the effect rather than the render, so a slow refetch does not
  // blank the editor.
  const [draft, setDraft] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [seeded, setSeeded] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [previewDark, setPreviewDark] = useState(false)

  const ready = looks !== undefined && settings !== undefined
  const selectedLook = (looks ?? []).find((look) => look.id === selectedId) ?? null
  const base = useMemo(() => sanitizeTheme(selectedLook?.design, page), [selectedLook, page])

  useEffect(() => {
    if (!ready || seeded) return
    setSeeded(true)
    // The editor opens on whatever the page is showing, so the screen starts from the truth rather than from
    // a default the admin then has to notice is not what visitors see.
    const startId = liveLookId ?? looks[0]?.id ?? null
    setSelectedId(startId)
    setDraft(sanitizeTheme(looks.find((look) => look.id === startId)?.design, page))
  }, [ready, seeded, liveLookId, looks, page])

  // What the page will paint, judged by the one function that judges it. The draft above stays raw: cleaning
  // it in place would drop an Advanced hex the moment another control was touched.
  const theme = useMemo(() => sanitizeTheme(draft, page), [draft, page])
  const dirty = Boolean(draft) && JSON.stringify(theme) !== JSON.stringify(base)

  const saveMutation = useSaveContentLookMutation(page)
  const deleteMutation = useDeleteContentLookMutation(page)
  const settingsMutation = useUpdateContentSettingsMutation()

  // The news video preview defaults. The input owns its text until blur: the settings row arrives
  // asynchronously, so a value seeded straight from it would reset mid-typing. `null` means "not edited
  // yet, show the stored value". `useNewsVideoFlag` sits with the other queries, before the early
  // returns below, so the hook order never changes between renders.
  const [secondsDraft, setSecondsDraft] = useState(null)
  const storedSeconds = settings?.news_video_preview_seconds ?? 3
  const loopDefault = settings?.news_video_loop === true
  const videoEnabled = useNewsVideoFlag()

  function saveSeconds() {
    if (settingsMutation.isPending || secondsDraft === null) return
    // Blank reverts rather than erroring: the column is NOT NULL with a default, so there is no
    // "clear it" state to save, and telling off an admin who deleted a digit helps nobody.
    if (String(secondsDraft).trim() === '') {
      setSecondsDraft(null)
      return
    }
    if (Number(secondsDraft) === storedSeconds) {
      setSecondsDraft(null)
      return
    }
    // Range-checked in newsVideoPatch, which throws -- caught here so the reason reaches the toast
    // instead of the console. The mutation's onError never runs for a throw that happens before it.
    let patch
    try {
      patch = newsVideoPatch({ seconds: Number(secondsDraft) })
    } catch (error) {
      toast.error(error.message)
      return
    }
    settingsMutation.mutate(patch, {
      onSuccess: () => {
        setSecondsDraft(null)
        toast.success('Preview length default saved.')
      },
      onError: (error) => toast.error(error.message),
    })
  }

  function toggleLoopDefault(next) {
    if (settingsMutation.isPending) return
    settingsMutation.mutate(newsVideoPatch({ loop: next }), {
      onSuccess: () =>
        toast.success(next ? 'Previews now repeat by default.' : 'Previews now play once by default.'),
      onError: (error) => toast.error(error.message),
    })
  }

  function selectLook(id) {
    if (id === selectedId) return
    if (dirty && !window.confirm('Discard the unsaved changes to this design?')) return
    setSelectedId(id)
    setDraft(sanitizeTheme((looks ?? []).find((look) => look.id === id)?.design, page))
    setRenamingId(null)
  }

  function handleSave() {
    if (!selectedLook) return
    saveMutation.mutate(
      { id: selectedLook.id, name: selectedLook.name, design: draft },
      { onSuccess: () => toast.success(`“${selectedLook.name}” saved.`), onError: (error) => toast.error(error.message) },
    )
  }

  function handleSaveAsNew(event) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    saveMutation.mutate(
      // Client-minted id, the same rule as an admin adding a resource row: the table has no sequence to
      // draw from and the studio's own id is what `content_settings` will point at later.
      { id: generateId(name), name, design: draft },
      {
        onSuccess: (saved) => {
          setSelectedId(saved.id)
          setNewName('')
          toast.success(`Saved “${saved.name}”. It is not live until you make it the active design.`)
        },
        onError: (error) => toast.error(error.message),
      },
    )
  }

  function handleRename(event) {
    event.preventDefault()
    const name = renameValue.trim()
    if (!name || !selectedLook || renamingId === null) return
    saveMutation.mutate(
      // The design travels with the row, because content_looks is written whole: a rename that sent only the
      // name would have to read the row back first, and a rename is not worth a round trip that could land on
      // a design somebody else had just changed.
      { id: selectedLook.id, name, design: selectedLook.design },
      { onSuccess: () => toast.success('Design renamed.'), onError: (error) => toast.error(error.message) },
    )
    setRenamingId(null)
  }

  function handleDelete(id) {
    const look = (looks ?? []).find((row) => row.id === id)
    if (!look) return
    const alsoLive = id === liveLookId
    const question = alsoLive
      ? `Delete “${look.name}”? It is the design ${label} is showing, so the page falls back to the built-in default until you make another design live.`
      : `Delete “${look.name}”? This cannot be undone.`
    if (!window.confirm(question)) return
    deleteMutation.mutate(id, {
      onSuccess: () => {
        // The pointer is cleared with the row by the `on delete set null` foreign key, so there is no second
        // write here: the page has already dropped back to its default by the time this runs.
        if (id === selectedId) {
          setSelectedId(null)
          setDraft(sanitizeTheme(undefined, page))
        }
        toast.success('Design deleted.')
      },
      onError: (error) => toast.error(error.message),
    })
  }

  function makeActive(id) {
    settingsMutation.mutate(lookLivePatch(page, id), {
      onSuccess: () => toast.success(`That design is now live on /${page}.`),
      onError: (error) => toast.error(error.message),
    })
  }

  function toggleHome(next) {
    // `Toggle` has no disabled state, so the guard lives here rather than being spread across two renders.
    if (settingsMutation.isPending) return
    settingsMutation.mutate(lookOnHomePatch(page, next), {
      onSuccess: () =>
        toast.success(
          next
            ? `The ${label.toLowerCase()} block on the home page now follows this design. The rest of the home page is untouched.`
            : `The ${label.toLowerCase()} block on the home page is back to its built-in look.`,
        ),
      onError: (error) => toast.error(error.message),
    })
  }

  if (looksQuery.isError && !looks) {
    return (
      <div className="max-w-[1400px]">
        <ErrorState message={`Couldn't load the saved ${label.toLowerCase()} designs right now.`} onRetry={looksQuery.refetch} />
      </div>
    )
  }

  // The settings row matters as much as the designs -- without it nothing can be made live -- so its failure
  // gets its own state. Without this, `ready` below would simply never become true and the studio would sit
  // on a skeleton with no error and no retry, which is the worst of the three possible outcomes.
  if (settingsQuery.isError && !settings) {
    return (
      <div className="max-w-[1400px]">
        <ErrorState message="Couldn't load which design is live right now." onRetry={settingsQuery.refetch} />
      </div>
    )
  }

  const pending = saveMutation.isPending || deleteMutation.isPending || settingsMutation.isPending

  return (
    <div className="max-w-[1400px]">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="material-symbols-outlined text-brand-orange">palette</span>
          <span className="text-sm font-semibold text-ink-900">
            {selectedLook ? selectedLook.name : 'Built-in default'}
          </span>
          {selectedLook?.id === liveLookId && <Badge tone="updated">Live</Badge>}
          {!selectedLook && <Badge tone="neutral">Not saved</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={saveMutation.isPending}
            disabled={!dirty || !selectedLook}
            onClick={handleSave}
          >
            <span className="material-symbols-outlined text-base">save</span>
            {dirty ? 'Save design' : 'Saved'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDraft(sanitizeTheme(undefined, page))}>
            <span className="material-symbols-outlined text-base">restart_alt</span>
            Reset to default
          </Button>
        </div>
      </section>

      {!ready || !draft ? (
        <div className="mt-6">
          <SkeletonText lines={6} />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[240px_360px_minmax(0,1fr)]">
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold uppercase tracking-[.05em] text-ink-muted">Saved designs</h2>

            {(looks ?? []).length === 0 ? (
              <p className="rounded-md border border-hairline bg-surface p-4 text-sm text-ink-muted">
                Nothing saved yet. Design something on the right and give it a name below.
              </p>
            ) : (
              <ul className="divide-y divide-hairline overflow-hidden rounded-md border border-hairline">
                {looks.map((look) => (
                  <li
                    key={look.id}
                    className={['flex flex-col gap-2 p-3', look.id === selectedId ? 'bg-surface-low' : 'bg-surface'].join(' ')}
                  >
                    {renamingId === look.id ? (
                      <form className="flex items-center gap-1.5" onSubmit={handleRename}>
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          aria-label={`New name for ${look.name}`}
                          maxLength={NAME_MAX}
                          className="min-h-9 min-w-0 flex-1 rounded-md border border-hairline bg-surface px-2 text-sm text-ink focus:border-brand focus:outline-none"
                        />
                        <Button type="submit" size="sm" loading={saveMutation.isPending} disabled={!renameValue.trim()}>
                          Save
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRenamingId(null)}>
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => selectLook(look.id)}
                          className="flex min-w-0 items-center gap-2 text-left text-sm font-semibold text-ink hover:text-brand"
                        >
                          <span className="truncate">{look.name}</span>
                          {look.id === liveLookId && <Badge tone="updated">Live</Badge>}
                        </button>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={pending || look.id === liveLookId}
                            onClick={() => makeActive(look.id)}
                          >
                            <span className="material-symbols-outlined text-base">check</span>
                            Make live
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => {
                              setRenamingId(look.id)
                              setRenameValue(look.name)
                            }}
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                            Rename
                          </Button>
                          <Button variant="ghost" size="sm" disabled={pending} onClick={() => handleDelete(look.id)}>
                            <span className="material-symbols-outlined text-base">delete</span>
                            Delete
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <form className="flex flex-col gap-2 rounded-md border border-hairline bg-surface p-3" onSubmit={handleSaveAsNew}>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-ink">Save the current design as</span>
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Term-time green"
                  maxLength={NAME_MAX}
                  className="min-h-10 rounded-md border border-hairline bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none"
                />
              </label>
              <Button type="submit" size="sm" loading={saveMutation.isPending} disabled={!newName.trim()}>
                <span className="material-symbols-outlined text-base">add</span>
                Save as new design
              </Button>
              <p className="text-xs text-ink-muted">
                Saving creates the design. Making it live is the separate button above, so a design you are
                still working on never reaches /{page} by accident.
              </p>
            </form>

            {/* Opt-in, and a separate switch from "live", because Home also renders awards, opportunities
                and announcements. An accent that spread to those would be a bug report rather than a
                feature -- so this says which block it touches, in the toast, rather than leaving the admin
                to work out why the whole page changed. */}
            <div className="flex flex-col gap-2 rounded-md border border-hairline bg-surface p-3">
              <Toggle
                checked={onHome}
                onChange={toggleHome}
                label="Use this design on the home page"
                description={`Applies to the ${label.toLowerCase()} block on the home page only.`}
              />

              {/* Only news has video, and only while the kill switch is on: an events default here
                  would be a control over nothing. The hook above is unconditional either way. */}
              {page === 'news' && videoEnabled && (
                <div className="flex flex-col gap-3 border-t border-hairline pt-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">Video preview defaults</p>
                    <p className="text-xs text-ink-muted">
                      Applies to every news video that has no override of its own.
                    </p>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">
                      Preview length
                    </span>
                    <input
                      type="number"
                      min={MIN_PREVIEW_SECONDS}
                      max={MAX_PREVIEW_SECONDS}
                      value={secondsDraft ?? String(storedSeconds)}
                      onChange={(e) => setSecondsDraft(e.target.value)}
                      onBlur={saveSeconds}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          saveSeconds()
                        }
                      }}
                      className="min-h-10 rounded-md border border-hairline bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none"
                    />
                    <span className="text-xs text-ink-muted">
                      Seconds, {MIN_PREVIEW_SECONDS}–{MAX_PREVIEW_SECONDS}. Saved when you leave the box.
                    </span>
                  </label>
                  <Toggle
                    checked={loopDefault}
                    onChange={toggleLoopDefault}
                    label="Repeat the preview"
                    description="Repeats until the reader leaves the card."
                  />
                </div>
              )}
            </div>
          </section>

          <div className="min-w-0 overflow-hidden rounded-lg border border-hairline bg-surface">
            <ContentDesignControls draft={draft} page={page} onChange={setDraft} />
          </div>

          <section className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-ink-muted">tune</span>
                <span className="text-sm font-semibold text-ink-900">Live preview</span>
                <span className="text-xs text-ink-muted">The same cards the page uses</span>
              </div>
              {/* `.dark` is the only place the site defines its dark palette (src/index.css), so putting the
                  class on this wrapper is the whole of the override -- there is no "light" block to switch
                  back to. Which is why the switch is only offered while the site itself is light. */}
              {siteTheme === 'dark' ? (
                <span className="text-xs text-ink-muted">Showing the dark palette</span>
              ) : (
                <Toggle checked={previewDark} onChange={setPreviewDark} label="Dark mode" description="Check a look before it goes live." />
              )}
            </div>

            <PreviewViewport label={`${label} preview`} className="mt-3">
              <div
                style={themeVars(theme)}
                className={['flex flex-col gap-4 rounded-lg border border-hairline p-4', previewDark ? 'dark bg-paper' : 'bg-paper'].join(' ')}
              >
                <ContentPreview
                  page={page}
                  theme={theme}
                  news={newsQuery.data}
                  events={eventsQuery.data}
                  newsState={queryState(newsQuery)}
                  eventsState={queryState(eventsQuery)}
                />
              </div>
            </PreviewViewport>
          </section>
        </div>
      )}
    </div>
  )
}

/**
 * Real rows through the real cards.
 *
 * This is why the cards were extracted at all: a preview built from its own markup would be a drawing of a
 * page that does not exist, and the whole cost of the extraction is the ability to write this function.
 * The Reveal is dropped because a preview that animates its cards in is a preview you cannot read while it
 * loads.
 */
function ContentPreview({ page, theme, news, events, newsState, eventsState }) {
  // `state` is 'loading' | 'error' | 'ready', so the preview never tells an admin "No news yet" when the
  // truth is that the read failed -- which would have them adjusting a design that was never the problem.
  if (page === 'events') {
    const upcoming = groupEventsByTime(events ?? []).upcoming.slice(0, PREVIEW_EVENTS)
    if (eventsState === 'error') return <PreviewEmpty note="Couldn't load the events to preview. The controls still work; the cards will appear once the read succeeds." />
    if (eventsState === 'loading' && upcoming.length === 0) return <SkeletonGrid count={PREVIEW_EVENTS} />
    if (upcoming.length === 0) return <PreviewEmpty note="No upcoming events to preview. This is what the section looks like while the list is empty." />
    return (
      <ContentFeed theme={theme}>
        {upcoming.map((event) => (
          <PreviewCard key={event.id}>
            <EventCard event={event} theme={theme} />
          </PreviewCard>
        ))}
      </ContentFeed>
    )
  }

  const [first, ...rest] = getNews(news ?? []).slice(0, PREVIEW_NEWS)
  if (newsState === 'error') return <PreviewEmpty note="Couldn't load the news to preview. The controls still work; the cards will appear once the read succeeds." />
  if (newsState === 'loading' && !first) return <SkeletonGrid count={PREVIEW_NEWS} />
  if (!first) return <PreviewEmpty note="No news yet. This is what the page looks like while the list is empty." />
  const lead = theme.layout.featured === 'none' ? null : <NewsFeatureCard item={first} theme={theme} />
  const items = theme.layout.featured === 'none' ? [first, ...rest] : rest
  return (
    <ContentFeed theme={theme} featured={lead}>
      {items.map((item) => (
        <PreviewCard key={item.id}>
          <NewsCard item={item} theme={theme} />
        </PreviewCard>
      ))}
    </ContentFeed>
  )
}

function PreviewEmpty({ note }) {
  return (
    <p className="rounded-md border border-hairline bg-surface p-6 text-center text-sm text-ink-muted">
      {note}
    </p>
  )
}

/**
 * A plain box around a card, so the grid's children line up. Deliberately NOT `Reveal`: the page staggers
 * its cards in, but a preview that animates every card on load is a preview the admin cannot read while it
 * plays. `staggerDelay` is therefore not used here at all -- the cascade is a property of the public page's
 * own render, and PreviewViewport is already the scroll container.
 */
function PreviewCard({ children }) {
  return <div className="min-w-0">{children}</div>
}

function SkeletonGrid({ count }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} imageVariant="cover" />
      ))}
    </div>
  )
}