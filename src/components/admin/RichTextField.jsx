// The toolbar editor behind a News body or an Event description.
//
// A plain textarea plus a formatting bar rather than a WYSIWYG engine: the stored column stays plain
// text, so the review queue, the Open Graph description and every archived post keep working, and no
// HTML sanitiser has to be trusted for content an admin can paste into. What the toolbar writes is the
// markdown subset src/lib/richText.js understands, and Preview shows the exact component the public
// page renders.
import { useEffect, useRef, useState } from 'react'
import RichBody from '../content/RichBody'

const MARKERS = /^\s*(?:#{1,3}|>|[-*+]|\d+[.)])\s+/

export default function RichTextField({ label, value, onChange, coverUrl = '', required = false }) {
  const ref = useRef(null)
  const [preview, setPreview] = useState(false)
  // A tool clicked while Preview is showing has no textarea to act on, so it waits for the edit view
  // to mount instead of silently doing nothing.
  const pendingTool = useRef(null)

  useEffect(() => {
    if (preview || !pendingTool.current) return
    const run = pendingTool.current
    pendingTool.current = null
    run()
  }, [preview])

  // React re-renders the textarea from `value`, so the caret has to be restored after that paint.
  function commit(nextValue, selectionStart, selectionEnd) {
    onChange(nextValue)
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      el.setSelectionRange(selectionStart, selectionEnd)
    })
  }

  function wrap(marker, placeholder) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end) || placeholder
    const next = value.slice(0, start) + marker + selected + marker + value.slice(end)
    commit(next, start + marker.length, start + marker.length + selected.length)
  }

  function prefixLines(prefix) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const newlineAfter = value.indexOf('\n', end)
    const lineEnd = newlineAfter === -1 ? value.length : newlineAfter
    const prefixed = value
      .slice(lineStart, lineEnd)
      .split('\n')
      .map((line) => (line.trim() ? prefix + line.replace(MARKERS, '') : line))
      .join('\n')
    commit(value.slice(0, lineStart) + prefixed + value.slice(lineEnd), lineStart + prefix.length, lineStart + prefixed.length)
  }

  function insertLink() {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const label = value.slice(start, end) || 'link text'
    const url = 'https://'
    const next = value.slice(0, start) + `[${label}](${url})` + value.slice(end)
    const urlStart = start + label.length + 3
    commit(next, urlStart, urlStart + url.length)
  }

  // The photo is the post's cover, so the button only writes a placeholder. It goes on its own lines
  // whether or not they were already blank, because `[image]` inside a paragraph would be read as text.
  function insertImage() {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const before = value.slice(0, start)
    const after = value.slice(end)
    const lead = !before ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
    const trail = !after ? '' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
    const token = `${lead}[image]${trail}`
    commit(before + token + after, start + token.length, start + token.length)
  }

  const tools = [
    { label: 'Bold', icon: 'format_bold', run: () => wrap('**', 'bold text') },
    { label: 'Italic', icon: 'format_italic', run: () => wrap('*', 'italic text') },
    { label: 'Heading', icon: 'title', run: () => prefixLines('## ') },
    { label: 'Quote', icon: 'format_quote', run: () => prefixLines('> ') },
    { label: 'Bulleted list', icon: 'format_list_bulleted', run: () => prefixLines('- ') },
    { label: 'Numbered list', icon: 'format_list_numbered', run: () => prefixLines('1. ') },
    { label: 'Link', icon: 'link', run: insertLink },
    { label: 'Photo here', icon: 'image', run: insertImage },
  ]

  return (
    <div className="flex flex-col gap-1.5 font-body">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">{label}</span>
        <button
          type="button"
          onClick={() => setPreview((shown) => !shown)}
          aria-pressed={preview}
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-semibold text-ink-muted transition-colors hover:text-brand"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            visibility
          </span>
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-hairline bg-surface">
        <div role="toolbar" aria-label={`${label} formatting`} className="flex flex-wrap gap-0.5 border-b border-hairline bg-surface-low p-1">
          {tools.map((tool) => (
            <button
              key={tool.label}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                // Formatting acts on the textarea, so a preview that is showing has to step aside first
                // and the tool runs once the edit view is back.
                if (preview) {
                  pendingTool.current = tool.run
                  setPreview(false)
                } else {
                  tool.run()
                }
              }}
              className="flex h-8 w-8 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-surface hover:text-brand"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                {tool.icon}
              </span>
            </button>
          ))}
        </div>

        {preview ? (
          <div className="min-h-[160px] px-3 py-2.5">
            {String(value).trim() ? (
              <RichBody text={value} cover={coverUrl} />
            ) : (
              <span className="text-sm text-ink-muted">Nothing to preview yet.</span>
            )}
          </div>
        ) : (
          <textarea
            ref={ref}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            required={required}
            rows={12}
            className="min-h-[260px] w-full border-0 bg-surface px-3 py-2.5 text-base text-ink focus:outline-none"
          />
        )}
      </div>

      <span className="text-xs text-ink-muted">
        Leave a blank line between paragraphs. Single line breaks are kept. Put <code>[image]</code> on its own line
        to place the photo there; without it the photo sits above the text.
      </span>
    </div>
  )
}
