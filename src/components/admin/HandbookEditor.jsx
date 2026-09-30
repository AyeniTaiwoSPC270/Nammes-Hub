import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { CALLOUTS, fromEditorHtml, frameDocument, lockFigures } from '../../lib/handbookEditor'

// A what-you-see-is-what-you-get editor that shows the text on a page styled like the printed book.
// The parent reads the result with ref.current.getHtml().

const TOOLS = [
  { label: 'Bold', icon: 'format_bold', run: (e) => e.exec('bold') },
  { label: 'Italic', icon: 'format_italic', run: (e) => e.exec('italic') },
  { label: 'Heading', text: 'H2', run: (e) => e.exec('formatBlock', 'h2') },
  { label: 'Sub-heading', text: 'H3', run: (e) => e.exec('formatBlock', 'h3') },
  { label: 'Paragraph', text: '¶', run: (e) => e.exec('formatBlock', 'p') },
  { label: 'Bulleted list', icon: 'format_list_bulleted', run: (e) => e.exec('insertUnorderedList') },
  { label: 'Numbered list', icon: 'format_list_numbered', run: (e) => e.exec('insertOrderedList') },
  { label: 'Undo', icon: 'undo', run: (e) => e.exec('undo') },
  { label: 'Redo', icon: 'redo', run: (e) => e.exec('redo') },
  { label: 'Clear formatting', icon: 'format_clear', run: (e) => e.exec('removeFormat') },
]

const CALLOUT_BUTTONS = [
  ['tip', 'Tip'],
  ['note', 'Good to know'],
  ['warn', 'Careful'],
  ['admin', 'Admin only'],
]

const toolClass =
  'inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-md border border-hairline bg-surface px-2 text-sm font-bold text-ink transition-colors hover:bg-surface-low'

const HandbookEditor = forwardRef(function HandbookEditor({ html, bodyClass = 'chapter', onDirty }, ref) {
  const frameRef = useRef(null)
  const savedRange = useRef(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const doc = useMemo(() => frameDocument(html, bodyClass), [html, bodyClass])

  const frameDoc = () => frameRef.current?.contentDocument
  const editable = () => frameDoc()?.getElementById('ed')

  useImperativeHandle(ref, () => ({ getHtml: () => fromEditorHtml(editable()?.innerHTML ?? '') }), [])

  const rememberSelection = useCallback(() => {
    const selection = frameDoc()?.defaultView.getSelection()
    if (selection?.rangeCount && !selection.isCollapsed) savedRange.current = selection.getRangeAt(0).cloneRange()
  }, [])

  const exec = useCallback((command, value) => {
    const d = frameDoc()
    if (!d) return
    frameRef.current.contentWindow.focus()
    // Typing into the link box collapses the frame's selection; put the remembered one back.
    const selection = d.defaultView.getSelection()
    if ((!selection.rangeCount || selection.isCollapsed) && savedRange.current) {
      selection.removeAllRanges()
      selection.addRange(savedRange.current)
    }
    d.execCommand(command, false, value)
    onDirty?.()
  }, [onDirty])

  function handleLoad() {
    const d = frameDoc()
    if (!d) return
    lockFigures(d)
    d.getElementById('ed').addEventListener('input', () => onDirty?.())
  }

  function insertCallout(kind) {
    exec('insertHTML', CALLOUTS[kind]())
    lockFigures(frameDoc())
  }

  function applyLink(event) {
    event.preventDefault()
    const typed = linkUrl.trim()
    const url = /^(https?:\/\/|mailto:)/i.test(typed) ? typed : `https://${typed}`
    if (typed) exec('createLink', url)
    setLinkOpen(false)
    setLinkUrl('')
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1.5 rounded-md border border-hairline bg-surface-low p-2">
        {TOOLS.map((tool) => (
          <button
            key={tool.label}
            type="button"
            title={tool.label}
            aria-label={tool.label}
            className={toolClass}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => tool.run({ exec })}
          >
            {tool.icon ? <span className="material-symbols-outlined text-lg">{tool.icon}</span> : tool.text}
          </button>
        ))}
        <button
          type="button"
          title="Add link"
          aria-label="Add link"
          className={toolClass}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            rememberSelection()
            setLinkOpen((v) => !v)
          }}
        >
          <span className="material-symbols-outlined text-lg">link</span>
        </button>
        <span className="mx-1 h-6 w-px bg-hairline" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-[.05em] text-ink-muted">Add box</span>
        {CALLOUT_BUTTONS.map(([kind, label]) => (
          <button key={kind} type="button" className={`${toolClass} text-xs`} onMouseDown={(e) => e.preventDefault()} onClick={() => insertCallout(kind)}>
            {label}
          </button>
        ))}
        {linkOpen && (
          <form onSubmit={applyLink} className="flex w-full items-center gap-2 pt-1">
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              aria-label="Link address"
              className="min-h-9 flex-1 rounded-md border border-hairline bg-surface px-3 text-sm"
              placeholder="https://www.nammeshub.com.ng/outlines"
            />
            <button type="submit" className={`${toolClass} px-3`}>
              Apply to selected text
            </button>
          </form>
        )}
      </div>
      <iframe
        ref={frameRef}
        title="Handbook page editor"
        srcDoc={doc}
        onLoad={handleLoad}
        className="h-[68vh] w-full rounded-md border border-hairline bg-white"
      />
      <p className="text-xs text-ink-muted">
        Click into the page and type. Screenshots are fixed; their captions can be edited. The PDF is only updated when you use “Rebuild PDF”.
      </p>
    </div>
  )
})

export default HandbookEditor
