// The toolbar editor behind a News body or an Event description.
//
// A plain textarea plus a formatting bar rather than a WYSIWYG engine: the stored column stays plain
// text, so the review queue, the Open Graph description and every archived post keep working, and no
// HTML sanitiser has to be trusted for content an admin can paste into. What the toolbar writes is the
// markup subset src/lib/richText.js understands, and Preview shows the exact component the public
// page renders.
import { useRef, useState } from 'react'
import {
  BODY_FONTS,
  IMAGE_SHAPES,
  TEXT_COLORS,
  TEXT_FONTS,
  TEXT_SIZES,
  bodyFontOf,
  editorOf,
  imageRatioOf,
  readMinutesOf,
  summaryOf,
} from '../../lib/richText'
import RichBody from '../content/RichBody'

const MARKERS = /^\s*(?:#{1,3}|>|[-*+]|\d+[.)])\s+/
const CLOSERS = { size: '[/size]', color: '[/color]', font: '[/font]' }
const SELECT_CLASS = 'h-7 rounded-sm border border-hairline bg-surface px-1 text-xs font-semibold text-ink-muted'
const BODY_DIRECTIVE_RE = /^\s*\[body=(?:serif|sans)\]\s*\n*/i
const IMAGE_MARKER_RE = /^[ \t]*\[image(?:=[^\]\n]+)?\][ \t]*$/im
const READ_TIME_RE = /^\s*\[read=\d{1,3}\]\s*\n*/im

export default function RichTextField({ label, value, onChange, coverUrl = '', required = false }) {
  const ref = useRef(null)
  const [preview, setPreview] = useState(false)

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

  function wrapPair(open, close, placeholder) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end) || placeholder
    const next = value.slice(0, start) + open + selected + close + value.slice(end)
    // An inserted placeholder stays selected, so the admin's next keystroke replaces it.
    commit(next, start + open.length, start + open.length + selected.length)
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
    const shape = imageRatioOf(value)
    const marker = shape === 'natural' ? '[image]' : `[image=${shape}]`
    const token = `${lead}${marker}${trail}`
    commit(before + token + after, start + token.length, start + token.length)
  }

  // The standfirst and the editor's name are kept as directives in the same column, so they travel with
  // the post through the review queue and need no migration. Typing only rewrites the one line.
  function setDirective(tag, text) {
    const re = new RegExp(`^\\s*\\[${tag}\\][\\s\\S]*?\\[\\/${tag}\\]\\s*\\n*`, 'im')
    const rest = String(value).replace(re, '')
    const clean = String(text).replace(/\s+/g, ' ').trim()
    onChange((clean ? `[${tag}]${clean}[/${tag}]\n` : '') + rest)
  }

  // The cover's shape is a property of the marker line, so this rewrites that line rather than adding a
  // second setting. A body with no marker is placed at the top, which is where the cover already sat.
  function setPhotoShape(shape) {
    const marker = shape === 'natural' ? '[image]' : `[image=${shape}]`
    if (IMAGE_MARKER_RE.test(value)) {
      onChange(String(value).replace(IMAGE_MARKER_RE, marker))
      return
    }
    // "Own shape" is the default, so there is nothing to write when no marker exists.
    if (shape === 'natural') return
    const lines = String(value).split('\n')
    const bodyAt = lines.findIndex((line) => BODY_DIRECTIVE_RE.test(line))
    lines.splice(bodyAt + 1, 0, marker, '')
    onChange(lines.join('\n'))
  }

  // Optional by design: an empty box removes the directive and the article falls back to the word-count
  // estimate, so no post is ever obliged to state a time. Rewritten rather than appended, so typing 4
  // over 3 does not leave both.
  function setReadMinutes(raw) {
    const minutes = Math.round(Number(raw))
    const plain = String(value).replace(READ_TIME_RE, '').replace(/^\n+/, '')
    onChange(minutes >= 1 && minutes <= 999 ? `[read=${minutes}]\n${plain}` : plain)
  }

  // The whole-article face is a directive line rather than a wrapper, because a wrapper cannot span
  // paragraphs. It is rewritten in place, so flipping it twice does not stack blank lines.
  function setBodyFont(font) {
    const plain = String(value).replace(BODY_DIRECTIVE_RE, '').replace(/^\n+/, '')
    onChange(font === 'serif' ? `[body=serif]\n\n${plain}` : plain)
  }

  // A control clicked while Preview is showing has no textarea to act on. Switching back to the edit
  // view is the only honest outcome; the admin picks the control again. Acting anyway would wrap the
  // start of the document, because a remounted textarea has no remembered selection.
  function runTool(run) {
    if (preview) {
      setPreview(false)
      return
    }
    run()
  }

  const tools = [
    { label: 'Bold', icon: 'format_bold', run: () => wrapPair('**', '**', 'bold text') },
    { label: 'Italic', icon: 'format_italic', run: () => wrapPair('*', '*', 'italic text') },
    { label: 'Underline', icon: 'format_underlined', run: () => wrapPair('[u]', '[/u]', 'underlined text') },
    { label: 'Heading', icon: 'title', run: () => prefixLines('## ') },
    { label: 'Quote', icon: 'format_quote', run: () => prefixLines('> ') },
    { label: 'Bulleted list', icon: 'format_list_bulleted', run: () => prefixLines('- ') },
    { label: 'Numbered list', icon: 'format_list_numbered', run: () => prefixLines('1. ') },
    { label: 'Link', icon: 'link', run: insertLink },
    { label: 'Photo here', icon: 'image', run: insertImage },
  ]

  const looks = [
    { kind: 'size', label: 'Text size', options: TEXT_SIZES, placeholder: 'Size' },
    { kind: 'color', label: 'Text colour', options: TEXT_COLORS, placeholder: 'Colour' },
    { kind: 'font', label: 'Font style', options: TEXT_FONTS, placeholder: 'Font' },
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
        <div role="toolbar" aria-label={`${label} formatting`} className="border-b border-hairline bg-surface-low">
          <div className="flex flex-wrap gap-0.5 p-1">
            {tools.map((tool) => (
              <button
                key={tool.label}
                type="button"
                title={tool.label}
                aria-label={tool.label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runTool(tool.run)}
                className="flex h-8 w-8 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-surface hover:text-brand"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  {tool.icon}
                </span>
              </button>
            ))}
          </div>

          {/* A dropdown applies its wrapper to the selected text, so size, colour and font stack with
              bold, italics and a heading instead of replacing them. */}
          <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
            {looks.map((look) => (
              <select
                key={look.kind}
                aria-label={look.label}
                value=""
                onChange={(event) => {
                  const chosen = event.target.value
                  if (!chosen) return
                  runTool(() => wrapPair(`[${look.kind}=${chosen}]`, CLOSERS[look.kind], 'text'))
                }}
                className={SELECT_CLASS}
              >
                <option value="">{look.placeholder}</option>
                {look.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ))}

            {/* Sets the whole article, not the selection: a body face is a document decision. */}
            <select
              aria-label="Article body font"
              value={bodyFontOf(value)}
              onChange={(event) => {
                if (preview) setPreview(false)
                setBodyFont(event.target.value)
              }}
              className={SELECT_CLASS}
            >
              {BODY_FONTS.map((font) => (
                <option key={font.value} value={font.value}>
                  Body: {font.label}
                </option>
              ))}
            </select>

            {/* Applies to the cover whether or not it is already in the text: choosing a shape inserts
                the marker, so "Square" cannot mean nothing on a post that has never placed its photo. */}
            <select
              aria-label="Cover photo shape"
              value={imageRatioOf(value)}
              onChange={(event) => {
                if (preview) setPreview(false)
                setPhotoShape(event.target.value)
              }}
              className={SELECT_CLASS}
            >
              {IMAGE_SHAPES.map((shape) => (
                <option key={shape.value} value={shape.value}>
                  Photo: {shape.label}
                </option>
              ))}
            </select>

            {/* The reading time is decoration on the article page, so it is a hint the admin can correct
                or ignore rather than a field they must fill. Blank means "work it out from the words". */}
            <label className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.1em] text-ink-muted">
              Read
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="999"
                aria-label="Reading time in minutes"
                value={readMinutesOf(value) ?? ''}
                onChange={(event) => {
                  if (preview) setPreview(false)
                  setReadMinutes(event.target.value)
                }}
                placeholder="auto"
                className="h-7 w-16 rounded-sm border border-hairline bg-surface px-1 text-xs font-semibold text-ink focus:outline-none"
              />
              min
            </label>
          </div>
        </div>

        <div className="grid gap-2 border-b border-hairline px-2 py-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[.1em] text-ink-muted">Standfirst</span>
            <input
              type="text"
              defaultValue={summaryOf(value)}
              onChange={(event) => setDirective('summary', event.target.value)}
              placeholder="One line under the headline"
              className="h-8 rounded-sm border border-hairline bg-surface px-2 text-sm text-ink focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[.1em] text-ink-muted">Editor</span>
            <input
              type="text"
              defaultValue={editorOf(value)}
              onChange={(event) => setDirective('editor', event.target.value)}
              placeholder="Who edited it (optional)"
              className="h-8 rounded-sm border border-hairline bg-surface px-2 text-sm text-ink focus:outline-none"
            />
          </label>
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
        Select text before choosing a size, colour or font so the style wraps just that text; Body sets the whole
        article and Photo its cover shape. The standfirst sits under the headline and the editor joins the writer
        in the credit box. Read is the minutes shown beside the date — leave it blank to work the time out from
        the word count. Leave a blank line between paragraphs. Put <code>[image]</code> on its own line to
        place the photo there; without it the photo sits above the text.
      </span>
    </div>
  )
}
