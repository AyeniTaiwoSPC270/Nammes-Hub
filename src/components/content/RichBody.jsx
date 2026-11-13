// The formatted body of a News post or an Event description, rendered the same way in both detail
// pages so the two cannot drift the way their text used to (news collapsed every newline, events kept
// them but never spaced paragraphs apart).
//
// The cover photo is placed by an `[image]` line in the body, which is how an admin gets text above
// AND below a picture -- the ULES-news layout. With no marker the photo goes at the top, which is what
// every post did before this existed, so old rows look unchanged.
import { Fragment } from 'react'
import { bodyFontOf, parseRichText } from '../../lib/richText'
import { linkifyText } from '../../lib/linkify'

// Sizes are relative, so the same `[size=lg]` step reads right in a paragraph and in a heading.
const SIZE_CLASS = { sm: 'text-[0.85em]', base: '', lg: 'text-[1.2em]', xl: 'text-[1.45em]' }
const COLOR_CLASS = { muted: 'text-ink-muted', brand: 'text-brand', orange: 'text-brand-orange', red: 'text-danger' }
const FONT_CLASS = { serif: 'font-article-serif', mono: 'font-article-mono' }

function Inline({ segments }) {
  return segments.map((segment, index) => {
    let content = segment.href ? (
      <a
        href={segment.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand underline underline-offset-2 hover:opacity-80"
      >
        {segment.text}
      </a>
    ) : (
      linkifyText(segment.text)
    )

    // Every marker is a separate wrapper, so they compose rather than replace one another. Bold is
    // applied last (outermost) because its colour rule must not swallow a segment's own colour.
    const look = [SIZE_CLASS[segment.size], COLOR_CLASS[segment.color], FONT_CLASS[segment.font]]
      .filter(Boolean)
      .join(' ')
    if (look) content = <span className={look}>{content}</span>
    if (segment.underline) content = <u>{content}</u>
    if (segment.italic) content = <em>{content}</em>
    if (segment.bold) content = <strong className="font-bold text-ink-900">{content}</strong>

    return <Fragment key={index}>{content}</Fragment>
  })
}

/**
 * The cover photo.
 *
 * It keeps its own proportions: the 720px column is what stops a wide desktop photo from filling the
 * screen now, so cropping to a fixed ratio would only cut the top and bottom off a poster an admin
 * uploaded whole. `image_width_pct` still narrows it (the News editor's drag handle writes it).
 */
function CoverImage({ src, widthPct }) {
  if (!src) return null
  const width = Number(widthPct)
  return (
    <figure
      className="content-radius overflow-hidden bg-surface-low"
      style={width >= 30 && width <= 100 ? { width: `${width}%` } : undefined}
    >
      <img src={src} decoding="async" alt="" className="block h-auto w-full" />
    </figure>
  )
}

export default function RichBody({ text, cover = null, imageWidthPct = 100, className = '' }) {
  const blocks = parseRichText(text)
  const hasMarker = blocks.some((block) => block.type === 'image')
  // A serif body is the per-post choice; headings stay Public Sans so the two faces contrast the way
  // an editorial page expects instead of turning the whole article into a book page.
  const serif = bodyFontOf(text) === 'serif'
  let imageDrawn = false
  let ledeDrawn = false

  return (
    <div
      className={[
        'flex flex-col gap-4 leading-[1.75] text-ink',
        serif ? 'font-article-serif text-[18.5px]' : 'text-[18px]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {cover && !hasMarker && <CoverImage src={cover} widthPct={imageWidthPct} />}

      {blocks.map((block, index) => {
        if (block.type === 'image') {
          // Only the first marker is filled: the photo is the post's one cover, so repeating it down
          // the page would be a mistake the admin can see straight away rather than a second image.
          if (!cover || imageDrawn) return null
          imageDrawn = true
          return <CoverImage key={index} src={cover} widthPct={imageWidthPct} />
        }

        if (block.type === 'heading') {
          const Tag = block.level === 1 ? 'h2' : block.level === 2 ? 'h2' : 'h3'
          return (
            <Tag
              key={index}
              className={
                block.level === 1 || block.level === 2
                  ? 'mt-2 font-display text-2xl font-bold leading-snug text-ink-900'
                  : 'mt-1 font-display text-xl font-bold leading-snug text-ink-900'
              }
            >
              <Inline segments={block.segments} />
            </Tag>
          )
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={index}
              className="border-l-4 border-brand-orange pl-4 font-display text-lg italic leading-relaxed text-ink-900"
            >
              <Inline segments={block.segments} />
            </blockquote>
          )
        }

        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul'
          return (
            <Tag
              key={index}
              className={[
                'ml-1 space-y-2 pl-5',
                block.ordered ? 'list-decimal' : 'list-disc',
              ].join(' ')}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inline segments={item.segments} />
                </li>
              ))}
            </Tag>
          )
        }

        // The opening paragraph is set as a lede and carries the drop cap (`.article-lede` in
        // index.css). Only the first one: a paragraph after an [image] line is still the opening text.
        const lede = !ledeDrawn
        ledeDrawn = true
        return (
          <p
            key={index}
            className={
              lede
                ? 'article-lede whitespace-pre-line text-[1.06em] font-medium leading-[1.7] text-ink-900'
                : 'whitespace-pre-line'
            }
          >
            <Inline segments={block.segments} />
          </p>
        )
      })}
    </div>
  )
}
