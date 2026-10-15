// The three card components and the wrapper that carries a look, shared by /events, /news, Home and the
// Design Studio's preview.
//
// THIS IS THE WHOLE POINT OF THE FILE GROUP. Before it, there were four card renderers that did not agree:
// hand-written markup inside Events.jsx and News.jsx, the generic ui/Card on Home's news block, and a
// fourth inline copy of the event card at Home.jsx:204-217. The studio's preview is only worth anything if
// it renders what the public page renders, so the preview renders THESE.
//
// Which is also the lesson api/_lib/quizCharacterArt.js is built around: one place draws a character, and
// both the browser and the card parser read it. A design studio whose preview draws its own approximation
// is the same mistake with a smaller blast radius.
import { Link } from 'react-router-dom'
import Badge from '../ui/Badge'
import BlurredBackdropImage from '../ui/BlurredBackdropImage'
import { themeVars } from '../../../api/_lib/contentTheme.js'

// The same pair Events.jsx and Home.jsx both used for the reveal cascade.
export const CARD_STAGGER = 0.06
export const MAX_STAGGER_DELAY = 0.3

/**
 * The reveal delay for card `index`, or none at all when the look has the cascade switched off.
 *
 * The parent owns this rather than the card, because the parent is what knows the index. `Reveal` takes a
 * `delay`, so switching the cascade off is a 0 rather than a different tree -- an admin who turns it off
 * sees the same cards arrive together.
 */
export function staggerDelay(theme, index) {
  if (!theme?.layout?.stagger) return 0
  return Math.min(index * CARD_STAGGER, MAX_STAGGER_DELAY)
}

// Mirrors the `tones` map in src/components/ui/Card.jsx:4-8, on purpose: `news.tone` and `events.tone` are
// per-ITEM accents chosen in the admin, and they have to keep painting the same colour they paint today.
// NewsDetail and Card are the two other readers of those columns.
const TONES = {
  neutral: 'border-hairline bg-surface',
  green: 'border-green-900 bg-green-900 text-white',
  orange: 'border-transparent bg-orange-100 dark:bg-brand-orange/15',
}

// Text colour follows the surface, so a green tone's title does not stay near-black on near-black.
const TONE_TEXT = {
  green: {
    title: 'text-white',
    meta: 'text-white/70',
    body: 'text-white/90',
    // On a dark fill the accent token would be the wrong thing: the site's --color-brand-orange is a dark
    // brown in light mode precisely so it reads on a page surface. The orange-500 is chosen for contrast
    // against green-900 instead.
    eyebrow: 'text-orange-500',
    action: 'text-orange-500',
  },
  orange: { title: 'text-ink-900', meta: 'text-ink-muted', body: 'text-ink', eyebrow: 'text-brand-orange', action: 'text-brand-orange' },
  // `text-brand-orange` rather than `text-orange-600`, even though the two are the same hex today
  // (src/index.css:32). `--color-brand-orange` is the token the studio's accent repoints -- it is one of
  // the three in contentTheme.js themeVars -- so the category label and the Read more link follow the look
  // instead of staying orange whatever the admin chose.
  neutral: { title: 'text-ink-900', meta: 'text-ink-muted', body: 'text-ink', eyebrow: 'text-brand-orange', action: 'text-brand-orange' },
}

const EYEBROW = 'text-xs font-bold uppercase tracking-[.05em]'

/**
 * Carries every `--content-*` custom property for everything inside it.
 *
 * The vars are emitted on a wrapper rather than per card because a card is also rendered by the studio's
 * preview and by a loading skeleton, and none of those should have to know the scale maps.
 */
export function ContentLook({ theme, className = '', children }) {
  return (
    <div style={themeVars(theme)} className={className}>
      {children}
    </div>
  )
}

/**
 * The card grid.
 *
 * The vars go on the grid element itself rather than on a wrapper around it, so nothing has to account for
 * an extra `div` between a flex column and its grid. `theme` is required rather than optional: a grid
 * without the vars would silently fall back to three columns and an unset radius, which looks like a bug the
 * admin cannot find the cause of.
 */
export function ContentGrid({ theme, className = '', children }) {
  return (
    <div style={themeVars(theme)} className={['content-grid', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

/**
 * A page's worth of cards: an optional featured story, then the grid. Both live inside one `ContentLook` so
 * the featured card inherits the same vars as the cards below it.
 */
export function ContentFeed({ theme, featured = null, gap = 'gap-5', children }) {
  return (
    <ContentLook theme={theme} className={['flex flex-col', gap].join(' ')}>
      {featured}
      <div className="content-grid">{children}</div>
    </ContentLook>
  )
}

/**
 * One event. `event.meta` and `event.description` are optional, which is what lets Home's three-up
 * preview use the same card as /events rather than a fourth copy of it.
 */
export function EventCard({ event, theme }) {
  const tone = TONES[event.tone] ? event.tone : 'neutral'
  const text = TONE_TEXT[tone]
  return (
    <Link
      to={`/events/${event.id}`}
      className={[
        'content-card flex flex-col overflow-hidden border transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5',
        TONES[tone],
        text.body,
      ].join(' ')}
    >
      <CardImage theme={theme} src={event.image_url} />
      <div className="content-card-body flex flex-grow flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {event.meta && <span className={['text-sm', text.meta].join(' ')}>{event.meta}</span>}
          <div className={['ml-auto flex items-center gap-1 text-sm', text.meta].join(' ')}>
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
            {event.date}
          </div>
        </div>
        <h3 className={['content-card-title content-clamp m-0 font-bold', text.title].join(' ')}>{event.title}</h3>
        {event.description && <p className={['content-clamp flex-grow text-base leading-relaxed', text.body].join(' ')}>{event.description}</p>}
      </div>
    </Link>
  )
}

/**
 * One news item. `excerpt` is passed only by Home, which shows a body preview and a "Read more" link;
 * /news shows the date instead, so an excerpt prop rather than a guess at which page this is.
 */
export function NewsCard({ item, theme, excerpt = '' }) {
  const tone = TONES[item.tone] ? item.tone : 'neutral'
  const text = TONE_TEXT[tone]
  return (
    <Link
      to={`/news/${item.id}`}
      className={['content-card flex flex-col overflow-hidden border transition-shadow hover:shadow-lg', TONES[tone], text.body].join(' ')}
    >
      <CardImage theme={theme} src={item.image_url} />
      <div className="content-card-body flex flex-grow flex-col gap-2">
        <div className="flex items-center gap-2">
          {item.category && <span className={[EYEBROW, text.eyebrow].join(' ')}>{item.category}</span>}
          {item.badge_tone && <Badge tone={item.badge_tone}>{item.badge_label}</Badge>}
        </div>
        <h3 className={['content-card-title content-clamp m-0 font-bold', text.title].join(' ')}>{item.title}</h3>
        {excerpt ? (
          <p className={['content-clamp text-base leading-relaxed', text.body].join(' ')}>{excerpt}</p>
        ) : (
          <p className={['mt-auto text-sm', text.meta].join(' ')}>{item.date}</p>
        )}
        <span className={['inline-flex items-center gap-1 text-sm font-bold', text.action].join(' ')}>
          Read more
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </span>
      </div>
    </Link>
  )
}

/**
 * The first story on /news, shown larger than the rest.
 *
 * `layout: 'image-left'` keeps the fixed half-height panel it has always had on phones -- its height comes
 * from the text beside it on a desktop, so an aspect ratio there would fight the layout rather than fill it.
 * `image-top` is the one that uses `--content-aspect`, because there the image is the card's own band.
 */
export function NewsFeatureCard({ item, theme }) {
  const tone = TONES[item.tone] ? item.tone : 'neutral'
  const text = TONE_TEXT[tone]
  const side = theme.layout.featured === 'image-left'
  const image = item.image_url ? (
    theme.card.image === 'none' ? null : theme.card.image === 'cover' ? (
      <BlurredBackdropImage
        src={item.image_url}
        className={side ? 'h-64 w-full shrink-0 md:h-auto md:w-1/2' : 'content-image w-full shrink-0'}
      />
    ) : (
      <img
        src={item.image_url}
        loading="lazy"
        decoding="async"
        alt=""
        className={side ? 'h-64 w-full shrink-0 object-cover md:h-auto md:w-1/2' : 'content-image w-full shrink-0 object-cover'}
      />
    )
  ) : null

  return (
    <Link
      to={`/news/${item.id}`}
      className={[
        'content-card flex flex-col overflow-hidden border transition-shadow',
        // A look with `card.shadow: 'none'` has nothing to lift TOWARDS, so the hover shadow is only declared
        // while the resting one is real. Leaving it in unconditionally was a transition animating nothing.
        theme.card.shadow === 'none' ? '' : 'hover:shadow-lg',
        side ? 'md:flex-row' : '',
        TONES[tone],
        text.body,
      ].join(' ')}
    >
      {image}
      <div className={['content-card-body flex w-full flex-col justify-center gap-2', side ? 'md:w-1/2' : ''].join(' ')}>
        <div className="flex items-center gap-2">
          {item.category && <span className={[EYEBROW, text.eyebrow].join(' ')}>{item.category}</span>}
          {item.badge_tone && <Badge tone={item.badge_tone}>{item.badge_label}</Badge>}
        </div>
        <h3 className={['content-card-title content-clamp m-0 font-bold', text.title].join(' ')}>{item.title}</h3>
        <p className={['text-sm', text.meta].join(' ')}>{item.date}</p>
      </div>
    </Link>
  )
}

/**
 * The card's picture, in whichever of the three ways the look asks for. Nothing at all when
 * `card.image` is 'none', which is the admin's way of saying these rows have no usable picture.
 */
function CardImage({ theme, src }) {
  if (!src || theme.card.image === 'none') return null
  if (theme.card.image === 'plain') {
    return <img src={src} loading="lazy" decoding="async" alt="" className="content-image w-full shrink-0 object-cover" />
  }
  return <BlurredBackdropImage src={src} className="content-image w-full shrink-0" />
}