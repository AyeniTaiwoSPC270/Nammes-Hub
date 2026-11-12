// The formatting an admin types into a News body or an Event description.
//
// Deliberately NOT HTML and not a WYSIWYG dependency: the two columns are plain `text` and are
// enumerated column-by-column by `apply_change_request`, so introducing HTML would mean either a
// migration to add another column or a sanitiser that has to be right in the review queue too. A
// tiny markdown subset round-trips through the existing `body`/`description` text columns and renders
// old plain-text posts unchanged -- a legacy body simply becomes paragraphs.
//
// Supported, and only this:
//   blank line      -> a new paragraph (single newlines inside one are kept and render as line breaks)
//   ## / ###        -> heading
//   > text          -> pull quote
//   - item / 1. item -> bulleted / numbered list
//   **bold** *italic* [label](https://url)
//   [image]         -> the post's cover photo, so the admin decides where it sits
//
// Pure and framework-free: the detail pages, the cards' excerpt stripper and the news preview
// handler's description all read it, and those last two run on the server.

const HEADING_RE = /^(#{1,3})\s+(.*)$/
const QUOTE_RE = /^>\s?(.*)$/
const BULLET_RE = /^\s*[-*+]\s+(.*)$/
const NUMBERED_RE = /^\s*\d+[.)]\s+(.*)$/
const IMAGE_RE = /^\s*\[image\]\s*$/i

// The alternation order matters: `**` before `*`, or bold would be read as two italics. A marker
// cannot start or end with whitespace, so prose like "2 * 3 * 4" stays prose rather than becoming an
// italic `3`. Underscore italics are left out on purpose: `snake_case_name` is far more likely to be a
// real identifier than an emphasis marker.
const INLINE_RE = /(\*\*[^\s*](?:[^*]*[^\s*])?\*\*|\*[^\s*](?:[^*]*[^\s*])?\*|\[[^\]\n]+\]\([^)\s]+\))/g

// A link an admin types is rendered as a link only when it cannot be a `javascript:` URL. Anything
// else stays the literal text they typed, which is the safe direction and visible enough to fix.
const SAFE_HREF_RE = /^(https?:\/\/|mailto:|\/[^/])/i

// The inline matcher above already guarantees the bracket and the trailing paren, so this only has
// to split label from href.
const LINK_RE = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/

function parseInline(text) {
  const segments = []
  const parts = String(text).split(INLINE_RE)

  parts.forEach((part, index) => {
    if (!part) return
    // `split` with one capture group alternates plain text and captured marker.
    if (index % 2 === 0) {
      segments.push({ text: part })
      return
    }
    if (part.startsWith('**')) {
      segments.push({ text: part.slice(2, -2), bold: true })
      return
    }
    if (part.startsWith('*')) {
      segments.push({ text: part.slice(1, -1), italic: true })
      return
    }
    const link = LINK_RE.exec(part)
    if (link && SAFE_HREF_RE.test(link[2])) {
      segments.push({ text: link[1], href: link[2] })
      return
    }
    // An unsupported href is shown exactly as written rather than silently turned into a link.
    segments.push({ text: part })
  })

  return segments
}

/**
 * The blocks of a body, in order.
 *
 * `type` is one of `paragraph`, `heading` (with `level`), `quote`, `list` (with `ordered` and `items`)
 * or `image`. Every text-carrying block has `segments`; a list has one segment list per item. The
 * renderer is the only consumer that turns a segment into an element, so a bold word and a link are
 * decided in one place.
 */
export function parseRichText(input) {
  const text = String(input ?? '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i += 1
      continue
    }

    if (IMAGE_RE.test(line)) {
      blocks.push({ type: 'image' })
      i += 1
      continue
    }

    const heading = HEADING_RE.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, segments: parseInline(heading[2].trim()) })
      i += 1
      continue
    }

    if (QUOTE_RE.test(line)) {
      const quoted = []
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        quoted.push(QUOTE_RE.exec(lines[i])[1])
        i += 1
      }
      blocks.push({ type: 'quote', segments: parseInline(quoted.join('\n').trim()) })
      continue
    }

    if (BULLET_RE.test(line) || NUMBERED_RE.test(line)) {
      const ordered = NUMBERED_RE.test(line)
      const itemRe = ordered ? NUMBERED_RE : BULLET_RE
      const items = []
      while (i < lines.length) {
        const item = itemRe.exec(lines[i])
        if (!item) break
        items.push({ segments: parseInline(item[1].trim()) })
        i += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    // A paragraph runs until a blank line or the start of another block. Its internal newlines are
    // kept: a legacy event description that used a single newline as a line break must keep it.
    const parts = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !IMAGE_RE.test(lines[i]) &&
      !HEADING_RE.test(lines[i]) &&
      !QUOTE_RE.test(lines[i]) &&
      !BULLET_RE.test(lines[i]) &&
      !NUMBERED_RE.test(lines[i])
    ) {
      parts.push(lines[i].trim())
      i += 1
    }
    blocks.push({ type: 'paragraph', segments: parseInline(parts.join('\n')) })
  }

  return blocks
}

/**
 * The body as one line of plain text, for the places that cannot render blocks: a card excerpt, the
 * Open Graph description, and the news preview handler.
 *
 * Markup is removed rather than escaped, so `**Aegis** results` reads "Aegis results" instead of
 * showing the asterisks. `[image]` is dropped entirely -- a cover photo is not part of the prose.
 */
export function richTextPlain(input) {
  return String(input ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*\[image\]\s*$/gim, ' ')
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^\s{0,3}#{1,3}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}
