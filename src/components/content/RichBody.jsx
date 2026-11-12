// The formatted body of a News post or an Event description, rendered the same way in both detail
// pages so the two cannot drift the way their text used to (news collapsed every newline, events kept
// them but never spaced paragraphs apart).
//
// The cover photo is placed by an `[image]` line in the body, which is how an admin gets text above
// AND below a picture -- the ULES-news layout. With no marker the photo goes at the top, which is what
// every post did before this existed, so old rows look unchanged.
import { Fragment } from 'react'
import { parseRichText } from '../../lib/richText'
import { linkifyText } from '../../lib/linkify'

function Inline({ segments }) {
  return segments.map((segment, index) => {
    const content = segment.href ? (
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

    if (segment.bold) {
      return (
        <strong key={index} className="font-bold text-ink-900">
          {content}
        </strong>
      )
    }
    if (segment.italic) {
      return <em key={index}>{content}</em>
    }
    return <Fragment key={index}>{content}</Fragment>
  })
}

/**
 * The cover photo.
 *
 * `image_width_pct` still narrows it (the News editor's drag handle writes it), but inside a 720px
 * column the height is capped by a 16:9 crop. That is the whole fix for a portrait phone photo that
 * used to run to 1200px wide and taller than the screen.
 */
function CoverImage({ src, widthPct }) {
  if (!src) return null
  const width = Number(widthPct)
  return (
    <figure
      className="content-radius overflow-hidden bg-surface-low"
      style={width >= 30 && width <= 100 ? { width: `${width}%` } : undefined}
    >
      <img src={src} decoding="async" alt="" className="aspect-[16/9] w-full object-cover" />
    </figure>
  )
}

export default function RichBody({ text, cover = null, imageWidthPct = 100, className = '' }) {
  const blocks = parseRichText(text)
  const hasMarker = blocks.some((block) => block.type === 'image')
  let imageDrawn = false

  return (
    <div className={['flex flex-col gap-4 text-[17px] leading-[1.75] text-ink', className].filter(Boolean).join(' ')}>
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
                  ? 'mt-2 text-2xl font-bold leading-snug text-ink-900'
                  : 'mt-1 text-xl font-bold leading-snug text-ink-900'
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
              className="border-l-4 border-brand-orange pl-4 text-lg italic leading-relaxed text-ink-900"
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

        return (
          <p key={index} className="whitespace-pre-line">
            <Inline segments={block.segments} />
          </p>
        )
      })}
    </div>
  )
}
