import { useRef, useState } from 'react'
import Button from '../ui/Button'
import FormField from '../ui/FormField'
import HandbookEditor from './HandbookEditor'
import { authorPhotoUrl, uploadAuthorPhoto, useSaveSettingsMutation } from '../../data/handbook'
import { useExcosQuery } from '../../data/excos'
import { AUTHOR_URLS, BOOK_PANELS } from '../../lib/handbookEditor'
import { useToast } from '../../lib/ToastContext'
import {
  DEFAULT_AS_OF,
  DEFAULT_EDITION,
  DEFAULT_FOREWORD,
  DEFAULT_PEOPLE,
  DEFAULT_SESSION,
  DEFAULT_TEAM,
  FIND_DEFAULTS,
  TEXT_FIELDS,
  longSession,
} from '../../../scripts/manual/book-content.mjs'

export default function BookPanel({ id, settings, onDirty, onSaved }) {
  const panel = BOOK_PANELS.find((p) => p.id === id)
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold text-ink-900">{panel.label}</h2>
        <p className="text-sm text-ink-muted">{panel.blurb}</p>
      </div>
      {id === 'foreword' ? (
        <ForewordPanel settings={settings} onDirty={onDirty} onSaved={onSaved} />
      ) : id === 'authors' ? (
        <AuthorsPanel settings={settings} onDirty={onDirty} onSaved={onSaved} />
      ) : (
        <TextPanel panel={id} settings={settings} onDirty={onDirty} onSaved={onSaved} />
      )}
    </div>
  )
}

const inputText = (value) => String(value ?? '')

/** Covers, title page, copyright, contents and back cover: labelled text boxes. */
function TextPanel({ panel, settings, onDirty, onSaved }) {
  const toast = useToast()
  const saveMutation = useSaveSettingsMutation()
  const fields = TEXT_FIELDS.filter((f) => f.panel === panel)
  const saved = settings?.texts ?? {}
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, saved[f.key] || f.value])))
  const [edition, setEdition] = useState(settings?.edition || DEFAULT_EDITION)
  const [asOf, setAsOf] = useState(settings?.as_of || DEFAULT_AS_OF)
  const [finder, setFinder] = useState(() => FIND_DEFAULTS.map(([task], i) => saved.finder?.[i] || task))

  const change = (setter) => (event) => {
    setter(event.target.value)
    onDirty()
  }

  function save() {
    const texts = { ...saved }
    for (const f of fields) {
      const value = values[f.key].trim()
      if (!value || value === f.value) delete texts[f.key]
      else texts[f.key] = value
    }
    if (panel === 'contents') {
      const same = finder.every((task, i) => task.trim() === FIND_DEFAULTS[i][0] || !task.trim())
      if (same) delete texts.finder
      else texts.finder = finder.map((task, i) => task.trim() || FIND_DEFAULTS[i][0])
    }
    const update = { texts }
    if (panel === 'cover') update.edition = edition.trim() === DEFAULT_EDITION ? '' : edition.trim()
    if (panel === 'copyright') update.as_of = asOf.trim() === DEFAULT_AS_OF ? '' : asOf.trim()
    saveMutation.mutate(update, {
      onSuccess: () => {
        onSaved()
        toast.success('Saved. Rebuild the PDF to publish it.')
      },
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <FormField
            label={f.label}
            type={f.multiline ? 'textarea' : 'text'}
            value={values[f.key]}
            onChange={(event) => {
              setValues((v) => ({ ...v, [f.key]: event.target.value }))
              onDirty()
            }}
            rows={f.rows}
          />
          {f.help && <span className="text-xs text-ink-muted">{f.help}</span>}
        </div>
      ))}
      {panel === 'cover' && <FormField label="Edition line (also on the copyright and back pages)" value={edition} onChange={change(setEdition)} />}
      {panel === 'copyright' && <FormField label="“As it stood on” date" value={asOf} onChange={change(setAsOf)} />}
      {panel === 'contents' && (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">“Where do I find…?” shortcuts</div>
          <p className="text-xs text-ink-muted">Each line points to the chapter shown beside it. The chapter and page number are added for you.</p>
          {finder.map((task, i) => (
            <div key={FIND_DEFAULTS[i][1] + i} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_170px] sm:items-center">
              <input
                value={task}
                aria-label={`Shortcut ${i + 1}`}
                onChange={(event) => {
                  setFinder((rows) => rows.map((r, j) => (j === i ? event.target.value : r)))
                  onDirty()
                }}
                className="min-h-10 rounded-md border border-hairline bg-surface px-3 text-sm"
              />
              <span className="text-xs text-ink-muted">→ {FIND_DEFAULTS[i][1]}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-ink-muted">
        A blank line starts a new paragraph, **double stars** make bold text, and {'{{team}}'}, {'{{session}}'} and {'{{title}}'} fill in by themselves. Clear a box to go back to the original wording.
      </p>
      <div>
        <Button variant="primary" size="sm" loading={saveMutation.isPending} onClick={save}>
          Save changes
        </Button>
      </div>
    </div>
  )
}

function ForewordPanel({ settings, onDirty, onSaved }) {
  const toast = useToast()
  const editor = useRef(null)
  const saveMutation = useSaveSettingsMutation()

  function save() {
    saveMutation.mutate(
      { foreword_html: editor.current.getHtml() },
      {
        onSuccess: () => {
          onSaved()
          toast.success('Saved. Rebuild the PDF to publish it.')
        },
        onError: (error) => toast.error(error.message),
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <HandbookEditor ref={editor} html={settings?.foreword_html || DEFAULT_FOREWORD} bodyClass="foreword" onDirty={onDirty} />
      <p className="text-xs text-ink-muted">{'{{team}} and {{session}}'} in the text turn into the team name and session set under Meet the authors.</p>
      <div>
        <Button variant="primary" size="sm" loading={saveMutation.isPending} onClick={save}>
          Save changes
        </Button>
      </div>
    </div>
  )
}

const MAX_PEOPLE = 14
const photoIsUsable = (photo) => /^(builtin:|store:|url:)/.test(photo ?? '')

function AuthorsPanel({ settings, onDirty, onSaved }) {
  const toast = useToast()
  const saveMutation = useSaveSettingsMutation()
  const excosQuery = useExcosQuery()
  const saved = settings?.authors
  const [team, setTeam] = useState(saved?.team || DEFAULT_TEAM)
  const [session, setSession] = useState(saved?.session || DEFAULT_SESSION)
  const [people, setPeople] = useState(() => (saved?.people?.length ? saved.people : DEFAULT_PEOPLE).map((p) => ({ ...p })))
  const [uploading, setUploading] = useState(null)
  const [confirmLoad, setConfirmLoad] = useState(false)

  const edit = (fn) => {
    setPeople(fn)
    onDirty()
  }
  const update = (index, patch) => edit((list) => list.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  const move = (index, delta) =>
    edit((list) => {
      const next = [...list]
      const target = index + delta
      if (target < 0 || target >= next.length) return list
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  async function choosePhoto(index, file) {
    if (!file) return
    setUploading(index)
    try {
      update(index, { photo: await uploadAuthorPhoto(file) })
    } catch (error) {
      toast.error(error.message)
    } finally {
      setUploading(null)
    }
  }

  function loadFromExcos() {
    const rows = (excosQuery.data ?? []).filter((e) => e.name?.trim())
    if (!rows.length) {
      toast.error('No named executives found on Meet the Excos yet.')
      return
    }
    edit(() => rows.slice(0, MAX_PEOPLE).map((e) => ({ name: e.name.trim(), role: e.role ?? '', photo: e.photo_url ? `url:${e.photo_url}` : '' })))
    setConfirmLoad(false)
    toast.success(`Loaded ${Math.min(rows.length, MAX_PEOPLE)} executives. Check the list, then save.`)
  }

  function save() {
    const cleaned = people.map((p) => ({ name: p.name.trim(), role: p.role.trim(), photo: photoIsUsable(p.photo) ? p.photo : '' })).filter((p) => p.name)
    if (!cleaned.length) {
      toast.error('Add at least one person.')
      return
    }
    const unchanged =
      team.trim() === DEFAULT_TEAM &&
      session.trim() === DEFAULT_SESSION &&
      JSON.stringify(cleaned) === JSON.stringify(DEFAULT_PEOPLE)
    saveMutation.mutate(
      { authors: unchanged ? '' : { team: team.trim(), session: session.trim(), people: cleaned } },
      {
        onSuccess: () => {
          onSaved()
          toast.success('Saved. Rebuild the PDF to publish it.')
        },
        onError: (error) => toast.error(error.message),
      },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Team name"
          value={team}
          onChange={(e) => {
            setTeam(e.target.value)
            onDirty()
          }}
        />
        <FormField
          label="Session"
          value={session}
          onChange={(e) => {
            setSession(e.target.value)
            onDirty()
          }}
          helper={`Shown as “${team.trim() || DEFAULT_TEAM} ${session.trim() || DEFAULT_SESSION}” and, in full, “${longSession(session.trim() || DEFAULT_SESSION)} session”. Write it like 27/28.`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">People ({people.length}/{MAX_PEOPLE})</div>
        {!confirmLoad ? (
          <Button variant="secondary" size="sm" loading={excosQuery.isLoading} onClick={() => setConfirmLoad(true)}>
            Load from Meet the Excos
          </Button>
        ) : (
          <>
            <span className="text-sm text-ink-muted">Replace the list below with everyone on the Meet the Excos page?</span>
            <Button variant="destructive" size="sm" onClick={loadFromExcos}>
              Yes, replace it
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmLoad(false)}>
              Cancel
            </Button>
          </>
        )}
      </div>

      <ul className="flex flex-col gap-3">
        {people.map((person, index) => {
          const src = authorPhotoUrl(person.photo, AUTHOR_URLS)
          return (
            <li key={index} className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-surface-low">
                  {src ? <img src={src} alt="" className="h-full w-full object-cover object-top" /> : <span className="flex h-full items-center justify-center text-xs text-ink-muted">No photo</span>}
                </div>
                <label className="cursor-pointer text-sm font-semibold text-brand hover:text-orange-500">
                  {uploading === index ? 'Uploading…' : src ? 'Change photo' : 'Add photo'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading !== null} onChange={(e) => choosePhoto(index, e.target.files?.[0])} />
                </label>
              </div>
              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                <input value={person.name} aria-label={`Name ${index + 1}`} placeholder="Full name" onChange={(e) => update(index, { name: e.target.value })} className="min-h-10 rounded-md border border-hairline bg-surface px-3 text-sm" />
                <input value={person.role} aria-label={`Role ${index + 1}`} placeholder="Role, e.g. President" onChange={(e) => update(index, { role: e.target.value })} className="min-h-10 rounded-md border border-hairline bg-surface px-3 text-sm" />
              </div>
              <div className="flex gap-1">
                <IconButton label="Move up" icon="arrow_upward" disabled={index === 0} onClick={() => move(index, -1)} />
                <IconButton label="Move down" icon="arrow_downward" disabled={index === people.length - 1} onClick={() => move(index, 1)} />
                <IconButton label="Remove" icon="delete" onClick={() => edit((list) => list.filter((_, i) => i !== index))} />
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" disabled={people.length >= MAX_PEOPLE} onClick={() => edit((list) => [...list, { name: '', role: '', photo: '' }])}>
          Add a person
        </Button>
        <Button variant="primary" size="sm" loading={saveMutation.isPending} onClick={save}>
          Save changes
        </Button>
      </div>
      <p className="text-xs text-ink-muted">
        Photos are cropped to a square automatically. The list appears on the cover, the title page and the Meet the Authors page, in this order.
        The screenshots inside the chapters (for example the Meet the Excos page) are pictures of the site as it was and are not changed here.
      </p>
    </div>
  )
}

function IconButton({ label, icon, onClick, disabled }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-hairline bg-surface text-ink transition-colors hover:bg-surface-low disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="material-symbols-outlined text-lg">{inputText(icon)}</span>
    </button>
  )
}
