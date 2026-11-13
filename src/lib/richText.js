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
//   **bold** *italic* [u]underline[/u]
//   [label](https://url)
//   [size=sm|base|lg|xl]...[/size]
//   [color=muted|brand|orange|red]...[/color]
//   [font=serif|mono]...[/font]
//   [image]         -> the post's cover photo, so the admin decides where it sits
//   [body=serif]    -> a directive line: sets the whole article's body face ("sans" is the default)
//
// The wrappers nest, and nest with the inline markers, so a heading can hold a bold orange word:
//   ## A [color=orange]**bold** word[/color]
// A size is relative (em), so the same `[size=lg]` grows a paragraph word and a heading word by the
// same step instead of flattening the heading to a fixed pixel size.
//
// Pure and framework-free: the detail pages, the cards' excerpt stripper and the news preview
// handler's description all read it, and those last two run on the server.

const HEADING_RE = /^(#{1,3})\s+(.*)$/
const QUOTE_RE = /^>\s?(.*)$/
const BULLET_RE = /^\s*[-*+]\s+(.*)$/
const NUMBERED_RE = /^\s*\d+[.)]\s+(.*)$/
const IMAGE_RE = /^\s*\[image\]\s*$/i
const BODY_FONT_RE = /^\s*\[body=(serif|sans)\]\s*$/im

// The article's body face, chosen per post. It is a directive line rather than a wrapper because a
// wrapper could not span paragraphs -- `parseInline` runs one block at a time.
export const BODY_FONTS = [
  { value: 'sans', label: 'Sans (default)' },
  { value: 'serif', label: 'Serif' },
]

export function bodyFontOf(input) {
  const match = BODY_FONT_RE.exec(String(input ?? ''))
  return match ? match[1].toLowerCase() : 'sans'
}

// The allow-lists behind the editor's three dropdowns. Exported so the toolbar offers exactly the
// values the parser accepts, rather than a second copy that can drift out of agreement.
export const TEXT_SIZES = [
  { value: 'sm', label: 'Small' },
  { value: 'base', label: 'Normal' },
  { value: 'lg', label: 'Large' },
  { value: 'xl', label: 'Extra large' },
]

export const TEXT_COLORS = [
  { value: 'muted', label: 'Muted' },
  { value: 'brand', label: 'Brand green' },
  { value: 'orange', label: 'Orange' },
  { value: 'red', label: 'Red' },
]

export const TEXT_FONTS = [
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Monospace' },
]

const SIZE_VALUES = TEXT_SIZES.map((size) => size.value).join('|')
const COLOR_VALUES = TEXT_COLORS.map((color) => color.value).join('|')
const FONT_VALUES = TEXT_FONTS.map((font) => font.value).join('|')

// The alternation order matters: `**` before `*`, or bold would be read as two italics. A marker
// cannot start or end with whitespace, so prose like "2 * 3 * 4" stays prose rather than becoming an
// italic `3`. Underscore italics are left out on purpose: `snake_case_name` is far more likely to be a
// real identifier than an emphasis marker.
// Wrappers are matched as a whole `open … close` pair so the text between them can hold any other
// marker -- that is what makes the controls combinable. `[\s\S]*?` stops at the first matching close,
// and a wrapper with no close never matches, so it is shown as the literal text an admin typed.
const INLINE_SOURCE = [
  '\\*\\*[^\\s*](?:[^*]*[^\\s*])?\\*\\*',
  '\\*[^\\s*](?:[^*]*[^\\s*])?\\*',
  '\\[u\\][\\s\\S]*?\\[\\/u\\]',
  `\\[size=(?:${SIZE_VALUES})\\][\\s\\S]*?\\[\\/size\\]`,
  `\\[color=(?:${COLOR_VALUES})\\][\\s\\S]*?\\[\\/color\\]`,
  `\\[font=(?:${FONT_VALUES})\\][\\s\\S]*?\\[\\/font\\]`,
  '\\[[^\\]\\n]+\\]\\([^)\\s]+\\)',
].join('|')

const INLINE_RE = new RegExp(`(${INLINE_SOURCE})`, 'g')

const UNDERLINE_RE = /^\[u\]([\s\S]*)\[\/u\]$/
const VALUE_WRAPPER_RE = /^\[(size|color|font)=([a-z]+)\]([\s\S]*)\[\/\1\]$/

// A link an admin types is rendered as a link only when it cannot be a `javascript:` URL. Anything
// else stays the literal text they typed, which is the safe direction and visible enough to fix.
const SAFE_HREF_RE = /^(https?:\/\/|mailto:|\/[^/])/i

// The inline matcher above already guarantees the bracket and the trailing paren, so this only has
// to split label from href.
const LINK_RE = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/

// `style` is the formatting inherited from an enclosing marker, so `**a [u]b[/u]**` gives the `b`
// segment both flags. Segments carry the flags flat (bold/size/color…), which is what RichBody reads.
function parseInline(text, style = {}) {
  const segments = []
  const parts = String(text).split(INLINE_RE)

  parts.forEach((part, index) => {
    if (!part) return
    // `split` with one capture group alternates plain text and captured marker.
    if (index % 2 === 0) {
      segments.push({ text: part, ...style })
      return
    }
    if (part.startsWith('**')) {
      segments.push(...parseInline(part.slice(2, -2), { ...style, bold: true }))
      return
    }
    if (part.startsWith('*')) {
      segments.push(...parseInline(part.slice(1, -1), { ...style, italic: true }))
      return
    }
    const underline = UNDERLINE_RE.exec(part)
    if (underline) {
      segments.push(...parseInline(underline[1], { ...style, underline: true }))
      return
    }
    const wrapper = VALUE_WRAPPER_RE.exec(part)
    if (wrapper) {
      segments.push(...parseInline(wrapper[3], { ...style, [wrapper[1]]: wrapper[2] }))
      return
    }
    const link = LINK_RE.exec(part)
    if (link && SAFE_HREF_RE.test(link[2])) {
      segments.push({ text: link[1], href: link[2], ...style })
      return
    }
    // An unsupported href is shown exactly as written rather than silently turned into a link.
    segments.push({ text: part, ...style })
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

    if (BODY_FONT_RE.test(line)) {
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
      !BODY_FONT_RE.test(lines[i]) &&
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
    .replace(/^\s*\[body=(?:serif|sans)\]\s*$/gim, ' ')
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/\[\/?(?:size|color|font)(?:=[a-z]+)?\]/gi, '')
    .replace(/\[\/?u\]/gi, '')
    .replace(/^\s{0,3}#{1,3}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * How many minutes the article takes to read, never less than one.
 *
 * 220 words a minute is the usual figure for adult prose; the number is decoration on an article page,
 * so it is rounded rather than shown as a range.
 */
export function readingMinutes(input, wordsPerMinute = 220) {
  const words = richTextPlain(input).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / wordsPerMinute))
}
