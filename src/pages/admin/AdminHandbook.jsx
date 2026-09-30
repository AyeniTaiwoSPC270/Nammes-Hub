import { useMemo, useRef, useState } from 'react'
import BookPanel from '../../components/admin/HandbookBookPanels'
import HandbookEditor from '../../components/admin/HandbookEditor'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import FormField from '../../components/ui/FormField'
import { SkeletonText } from '../../components/ui/Skeleton'
import {
  HANDBOOK_FALLBACK_PDF,
  useBuildPdfMutation,
  useHandbookPdfUrl,
  useHandbookQuery,
  useRestoreChapterMutation,
  useSaveChapterMutation,
} from '../../data/handbook'
import { APPENDICES, CHAPTERS, EDITABLE, TEXT_FIELDS } from '../../../scripts/manual/book-content.mjs'
import { BOOK_PANELS, htmlToText, textToHtml } from '../../lib/handbookEditor'
import { useToast } from '../../lib/ToastContext'

const BOOK_PREFIX = 'book:'
const BASE = Object.fromEntries([...CHAPTERS, ...APPENDICES].map((section) => [section.id, section]))

/** A small "Edited" tag on the sidebar entry when something on that page has been changed. */
function isBookPanelEdited(id, settings) {
  if (!settings) return false
  const texts = settings.texts ?? {}
  const has = (panel) => TEXT_FIELDS.some((f) => f.panel === panel && f.key in texts)
  if (id === 'cover') return has('cover') || Boolean(settings.edition)
  if (id === 'copyright') return has('copyright') || Boolean(settings.as_of)
  if (id === 'contents') return has('contents') || Boolean(texts.finder)
  if (id === 'foreword') return Boolean(settings.foreword_html)
  if (id === 'authors') return Boolean(settings.authors) || has('authors')
  return has(id)
}

function formatWhen(iso) {
  return iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : null
}

export default function AdminHandbook() {
  const toast = useToast()
  const query = useHandbookQuery()
  const pdfUrl = useHandbookPdfUrl()
  const buildMutation = useBuildPdfMutation()
  const [selected, setSelected] = useState(`${BOOK_PREFIX}cover`)
  const [dirty, setDirty] = useState(false)
  const [pendingSelect, setPendingSelect] = useState(null)

  const settings = query.data?.settings
  const saved = query.data?.chapters ?? {}
  const building = settings?.build_status === 'building' || buildMutation.isPending

  const groups = useMemo(() => {
    const out = []
    for (const item of EDITABLE) {
      let group = out.at(-1)
      if (!group || group.part !== item.part) {
        group = { part: item.part, items: [] }
        out.push(group)
      }
      group.items.push(item)
    }
    return out
  }, [])

  function choose(id) {
    if (id === selected) return
    if (dirty) setPendingSelect(id)
    else setSelected(id)
  }
  function discardAndSwitch() {
    setSelected(pendingSelect)
    setPendingSelect(null)
    setDirty(false)
  }

  function rebuild() {
    if (dirty) {
      toast.error('Save your changes first. The PDF is built from saved text only.')
      return
    }
    buildMutation.mutate(undefined, {
      onSuccess: (result) => toast.success(`PDF rebuilt: ${result.pages} pages. The Download buttons now serve it.`),
      onError: (error) => toast.error(error.message),
    })
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-6">
        <ErrorState message="Could not load the handbook editor." onRetry={() => query.refetch()} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-ink-900">Handbook</h1>
        <p className="max-w-2xl text-ink-muted">
          Edit the wording of the downloadable handbook, then rebuild the PDF. Visitors get the new version from the footer and the About page.
        </p>
      </header>

      <section className="mt-6 flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5 shadow-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 text-sm">
          <div className="font-bold text-ink-900">Published PDF</div>
          {query.isLoading ? (
            <SkeletonText lines={1} />
          ) : building ? (
            <div className="text-ink-muted" role="status">
              Building the PDF. This takes a minute or two; you can keep editing meanwhile.
            </div>
          ) : settings?.build_status === 'failed' ? (
            <div className="text-danger" role="alert">
              The last build failed{settings.build_error ? `: ${settings.build_error}` : '.'} Your edits are safe; try again.
            </div>
          ) : settings?.built_at ? (
            <div className="text-ink-muted">
              Rebuilt {formatWhen(settings.built_at)}
              {settings.built_pages ? `, ${settings.built_pages} pages` : ''}.
            </div>
          ) : (
            <div className="text-ink-muted">Still showing the original handbook that shipped with the site.</div>
          )}
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="w-fit font-semibold text-brand no-underline hover:text-orange-500">
            {pdfUrl === HANDBOOK_FALLBACK_PDF ? 'Open the original PDF' : 'Open the current PDF'}
          </a>
        </div>
        <Button variant="accent" size="sm" loading={building} onClick={rebuild}>
          Rebuild PDF
        </Button>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Handbook sections" className="flex flex-col gap-4 lg:max-h-[80vh] lg:overflow-y-auto lg:pr-1">
          <div className="flex flex-col gap-1">
            <div className="px-2 text-xs font-semibold uppercase tracking-[.05em] text-orange-600">Covers and front pages</div>
            {BOOK_PANELS.map((panel) => (
              <SidebarButton
                key={panel.id}
                active={selected === BOOK_PREFIX + panel.id}
                edited={isBookPanelEdited(panel.id, settings)}
                onClick={() => choose(BOOK_PREFIX + panel.id)}
              >
                {panel.label}
              </SidebarButton>
            ))}
          </div>
          {groups.map((group) => (
            <div key={group.part} className="flex flex-col gap-1">
              <div className="px-2 text-xs font-semibold uppercase tracking-[.05em] text-orange-600">{group.part}</div>
              {group.items.map((item) => (
                <SidebarButton key={item.id} active={selected === item.id} edited={Boolean(saved[item.id])} onClick={() => choose(item.id)}>
                  {item.label}
                </SidebarButton>
              ))}
            </div>
          ))}
        </nav>

        <div className="min-w-0">
          {pendingSelect && (
            <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-orange-500 bg-orange-100 px-4 py-3 text-sm text-ink-900">
              <span className="flex-1">You have unsaved changes on this page. Switching now will lose them.</span>
              <Button size="sm" variant="destructive" onClick={discardAndSwitch}>
                Discard and switch
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPendingSelect(null)}>
                Keep editing
              </Button>
            </div>
          )}
          {query.isLoading ? (
            <SkeletonText lines={8} />
          ) : selected.startsWith(BOOK_PREFIX) ? (
            <BookPanel key={selected} id={selected.slice(BOOK_PREFIX.length)} settings={settings} onDirty={() => setDirty(true)} onSaved={() => setDirty(false)} />
          ) : (
            <SectionPanel key={selected} id={selected} row={saved[selected]} onDirty={() => setDirty(true)} onSaved={() => setDirty(false)} />
          )}
        </div>
      </div>
    </div>
  )
}

function SidebarButton({ active, edited, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={[
        'flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
        active ? 'bg-green-900 font-bold text-white' : 'text-ink hover:bg-surface-low',
      ].join(' ')}
    >
      <span>{children}</span>
      {edited && (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${active ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-700'}`}>
          Edited
        </span>
      )}
    </button>
  )
}

function SectionPanel({ id, row, onDirty, onSaved }) {
  const toast = useToast()
  const base = BASE[id]
  const isChapter = base.intro !== undefined
  const editor = useRef(null)
  const saveMutation = useSaveChapterMutation()
  const restoreMutation = useRestoreChapterMutation()
  const [title, setTitle] = useState(() => htmlToText(row?.title || base.title))
  const [intro, setIntro] = useState(() => htmlToText(row?.intro || base.intro || ''))
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [restored, setRestored] = useState(false)

  function save() {
    const cleanTitle = textToHtml(title.trim())
    const cleanIntro = textToHtml(intro.trim())
    saveMutation.mutate(
      {
        id,
        title: cleanTitle === base.title ? '' : cleanTitle,
        intro: isChapter && cleanIntro !== base.intro ? cleanIntro : '',
        html: editor.current.getHtml(),
      },
      {
        onSuccess: () => {
          onSaved()
          toast.success('Saved. Rebuild the PDF to publish it.')
        },
        onError: (error) => toast.error(error.message),
      },
    )
  }

  function restore() {
    restoreMutation.mutate(id, {
      onSuccess: () => {
        onSaved()
        toast.success('Original text restored. Rebuild the PDF to publish it.')
        setConfirmRestore(false)
        setTitle(htmlToText(base.title))
        setIntro(htmlToText(base.intro || ''))
        setRestored(true)
      },
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label={base.letter ? `Appendix ${base.letter} title` : 'Chapter title'}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            onDirty()
          }}
        />
        {isChapter && (
          <div className="sm:col-span-2">
            <FormField
              label="Opening paragraph (shown on the chapter's first page)"
              type="textarea"
              value={intro}
              onChange={(e) => {
                setIntro(e.target.value)
                onDirty()
              }}
            />
          </div>
        )}
      </div>
      <HandbookEditor
        key={restored ? 'original' : 'saved'}
        ref={editor}
        html={restored ? base.html : row?.html || base.html}
        bodyClass="chapter"
        onDirty={onDirty}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="sm" loading={saveMutation.isPending} onClick={save}>
          Save changes
        </Button>
        {row && !confirmRestore && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmRestore(true)}>
            Restore original text
          </Button>
        )}
        {row && confirmRestore && (
          <>
            <span className="text-sm text-ink-muted">This throws away your edits to this page.</span>
            <Button variant="destructive" size="sm" loading={restoreMutation.isPending} onClick={restore}>
              Yes, restore it
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmRestore(false)}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
